import { describe, it, expect } from 'vitest';
import { Cafe, type Guest } from '../core/simulation/cafe';
import { cafeGrid, counters, recipes, seats } from '../data/cafe';
import { position, route } from '../core/npc/movement';
const step=(c:Cafe,ms:number)=>{for(let i=0;i<ms;i+=50)c.tick()};
function fixture(two=false) {
 const c=new Cafe(cafeGrid,2035,'playtest');c.open=false;
 const guest=(id:number,seat:number):Guest=>({id,style:0,state:'waiting',seat,since:0,tile:{...seats[seat].position},path:[],fraction:0,facing:'se',speed:1.95,meal:null,tip:0,lastAction:'待機'});
 c.guests=[guest(10,0),guest(11,1)];
 if(two){const g=guest(12,2);c.guests.push(g);c.infect(12);c.employees[1].path=[];c.employees[1].tile={x:1,y:1};}
 c.batches.push({id:1,counterId:counters[0].id,recipe:recipes[0],portions:1,reserved:0,expiresAt:60000});
 return c;
}
describe('台別在庫と配膳予約',()=>{
 it('2人・2客・残り1食を出発時に1人だけ予約する',()=>{
  const c=fixture(true);c.tick();
  expect(c.batches[0].portions).toBe(0);expect(c.batches[0].reserved).toBe(1);
  expect(c.employees.filter(w=>w.taskId!==null)).toHaveLength(1);
  step(c,22000);expect(c.served).toBe(1);expect(c.stock).toBe(0);
 });
 it('総移動距離が同じなら固定順でA台を選ぶ',()=>{
  const c=fixture();c.staff.tile={x:3,y:6};
  c.batches.push({...c.batches[0],id:2,counterId:counters[1].id});c.tick();
  expect(c.taskFor(c.staff)?.counterId).toBe(counters[0].id);
 });
 it('到達不能の台を除外する',()=>{
  const grid={...cafeGrid,blocked:new Set([...cafeGrid.blocked,4*cafeGrid.width+3])};
  const c=new Cafe(grid,2035,'playtest'),seed=fixture();c.open=false;c.guests=seed.guests;c.batches=seed.batches;
  c.batches.push({...c.batches[0],id:2,counterId:counters[1].id});c.tick();
  expect(c.taskFor(c.staff)?.counterId).toBe(counters[1].id);
 });
 it('受取前に客が消えた場合は予約を解除する',()=>{
  const c=fixture();c.tick();c.guests=[];c.tick();
  expect(c.stock).toBe(1);expect(c.batches[0].reserved).toBe(0);expect(c.staff.taskId).toBeNull();
 });
 it('運搬中の取消は返却完了まで台上在庫へ戻さない',()=>{
  const c=fixture();for(let i=0;i<300&&!c.staff.carried;i++)c.tick();expect(c.staff.carried).not.toBeNull();
  step(c,350);const before=position(c.staff);c.guests=[];c.tick();
  expect(c.staff.state).toBe('returning');expect(c.stock).toBe(0);
  const after=position(c.staff);expect(Math.hypot(after.x-before.x,after.y-before.y)).toBeLessThan(.2);
  step(c,8000);expect(c.stock).toBe(1);expect(c.staff.carried).toBeNull();expect(c.batches[0].reserved).toBe(0);
 });
 it('運搬品が期限切れになったら提供も返却在庫の復活もしない',()=>{
  const c=fixture();for(let i=0;i<300&&!c.staff.carried;i++)c.tick();expect(c.staff.carried).not.toBeNull();
  c.staff.carried!.expiresAt=c.time+50;c.tick();step(c,6000);
  expect(c.served).toBe(0);expect(c.stock).toBe(0);expect(c.staff.carried).toBeNull();
 });
 it('返却口が一時的に塞がれても別の場所で在庫へ戻さない',()=>{
  const blocked=new Set(cafeGrid.blocked);
  const c=new Cafe({...cafeGrid,blocked},2035,'playtest'),seed=fixture();c.open=false;c.guests=seed.guests;c.batches=seed.batches;
  for(let i=0;i<300&&!c.staff.carried;i++)c.tick();step(c,350);
  blocked.add(counters[0].work.y*cafeGrid.width+counters[0].work.x);
  c.guests=[];c.tick();step(c,1000);expect(c.stock).toBe(0);expect(c.staff.state).toBe('returning');
  blocked.delete(counters[0].work.y*cafeGrid.width+counters[0].work.x);
  step(c,8000);expect(c.stock).toBe(1);
 });
 it('運搬中に休憩を頼むと返却後に休む',()=>{
  const c=fixture();for(let i=0;i<300&&!c.staff.carried;i++)c.tick();c.toggleRest(c.staff.id);
  expect(c.staff.state).toBe('returning');step(c,8000);expect(c.staff.state).toBe('resting');expect(c.stock).toBe(1);
 });
 it('途中の経路変更で現在位置を巻き戻さない',()=>{
  const c=fixture();const w=c.staff;w.tile={x:3,y:4};w.path=[{x:3,y:5}];w.fraction=.4;
  const before=position(w);expect(route(w,cafeGrid,{x:4,y:4})).toBe(true);expect(position(w)).toEqual(before);
 });
 it('通常・試遊時間を分離し、調理途中のモード変更で期限を変えない',()=>{
  const c=new Cafe();expect(c.recipes[0].cookMs).toBe(120000);expect(c.recipes[0].portions).toBe(12);
  c.startCooking(recipes[0].id);step(c,2000);const until=c.order!.until;
  c.setMode('playtest');expect(c.recipes[0].cookMs).toBe(5000);expect(c.order!.until).toBe(until);expect(c.order!.recipe.cookMs).toBe(120000);
 });
 it('2台の在庫は別々に集計し、予約を含む台上数を保持する',()=>{
  const c=fixture();c.batches.push({...c.batches[0],id:2,counterId:counters[1].id,portions:3});c.tick();
  expect(c.counterStock(counters[0].id)).toBe(1);expect(c.counterStock(counters[1].id)).toBe(3);
 });
});
