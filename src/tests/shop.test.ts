import { describe, expect, it } from 'vitest';
import { Cafe } from '../core/simulation/cafe';
import { cafeGrid, DOOR, counters } from '../data/cafe';
import { findPath, tileKey } from '../core/pathfinding/grid';
function run(c: Cafe, until:()=>boolean, max=1200) {for(let i=0;i<max && !until();i++) c.tick();expect(until()).toBe(true);}
describe('家具ショップ',()=>{
 it('価格を一度だけ引き、椅子はテーブル購入後に席を追加する',()=>{
  const c=new Cafe();expect(c.buyFurniture('chair')).toBe(false);expect(c.coins).toBe(120);
  expect(c.buyFurniture('table')).toBe(true);expect(c.coins).toBe(75);expect(c.seats.length).toBe(4);
  expect(c.buyFurniture('chair')).toBe(true);expect(c.coins).toBe(50);expect(c.seats.length).toBe(5);
  expect(c.buyFurniture('stove')).toBe(false);expect(c.coins).toBe(50);
  expect(new Cafe().furniture.length).toBe(13);expect(new Cafe().seats.length).toBe(4);
 });
 it('全商品を設置しても入口・各席・調理・配膳への通路を確保する',()=>{
  const c=new Cafe();c.coins=1000;
  for(const k of ['stove','table','chair','table','chair']) expect(c.buyFurniture(k)).toBe(true);
  expect(c.coins).toBe(760);expect(c.seats.length).toBe(6);
  for(const k of ['stove','table','chair']) expect(c.buyFurniture(k)).toBe(false);
  expect(c.coins).toBe(760);
  const blocked=new Set(cafeGrid.blocked);
  for(const f of c.furniture) blocked.add(tileKey(f,cafeGrid.width));
  for(const seat of c.seats) {
   const b=new Set(blocked);b.delete(tileKey(seat.position,cafeGrid.width));
   expect(findPath({...cafeGrid,blocked:b},DOOR,seat.position)).not.toBeNull();
   expect(findPath({...cafeGrid,blocked:b},counters[0].work,seat.service)).not.toBeNull();
  }
  for(const stove of c.stoves) expect(findPath({...cafeGrid,blocked},DOOR,stove.work)).not.toBeNull();
 });
 it('購入したコンロの注文を元のコンロと別に調理・回収できる',()=>{
  const c=new Cafe(undefined,2035,'playtest');c.open=false;c.coins=1000;c.buyFurniture('stove');
  expect(c.startCooking('moon-stew')).toBe(true);
  c.selectedStoveId=c.stoves[1].id;expect(c.startCooking('moon-stew')).toBe(true);
  expect(c.orders.size).toBe(2);
  run(c,()=>[...c.orders.values()].every(o=>o.status==='ready'));
  expect(c.collectCooking('counter-4')).toBe(true);expect(c.stock).toBe(2);
  c.selectedStoveId='stove-0';expect(c.collectCooking('counter-3')).toBe(true);
  expect(c.stock).toBe(4);expect(c.orders.size).toBe(0);
 });
 it('2人の従業員は別々のコンロで並行調理できる',()=>{
  const c=new Cafe(undefined,2035,'playtest');c.open=false;c.coins=1000;c.buyFurniture('stove');
  c.employees.push({...structuredClone(c.staff),id:20,tile:{x:1,y:6}});
  expect(c.startCooking('moon-stew',0)).toBe(true);
  c.selectedStoveId=c.stoves[1].id;expect(c.startCooking('moon-stew',20)).toBe(true);
  run(c,()=>[...c.orders.values()].every(o=>o.status==='cooking'));
  expect(new Set([...c.orders.values()].map(o=>o.cookId)).size).toBe(2);
 });
 it('人物の進路上には設置しない',()=>{
  const c=new Cafe();c.coins=1000;c.staff.path=[{x:0,y:5}];
  expect(c.buyFurniture('stove')).toBe(false);expect(c.coins).toBe(1000);expect(c.stoves.length).toBe(1);
 });
 it('新しい席へ入店・配膳・会計が進む',()=>{
  const c=new Cafe(undefined,2035,'playtest');c.coins=1000;c.buyFurniture('table');c.buyFurniture('chair');
  [0,1,2,3].forEach(i=>c.dirty.add(i));
  c.startCooking('moon-stew');run(c,()=>c.order?.status==='ready');c.collectCooking();
  run(c,()=>c.guests.some(g=>g.seat===4 && g.state==='eating'));
  run(c,()=>c.served>0);expect(c.sales).toBeGreaterThan(0);
 });
});
