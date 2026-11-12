import {describe,it,expect} from 'vitest';
import {Cafe} from '../core/simulation/cafe';
import {makeLayout} from '../core/simulation/layout';
import {decodeSave,encodeSave,restoreCafe} from '../platform/persistence';
function step(c:Cafe,ms:number){for(let i=0;i<ms/50;i++)c.tick();}
describe('保存・不在進行・模様替え',()=>{
 it('購入・所持金・配置・担当と調理を保存して復元する',()=>{
  const c=new Cafe();c.coins=1000;c.buyFurniture('table');c.buyFurniture('chair');c.staff.role='cook';c.startCooking('moon-stew');step(c,3000);
  const restored=decodeSave(encodeSave(c,1000000));
  expect(restored.cafe.saveData()).toEqual(c.saveData());expect(restored.savedAt).toBe(1000000);
 });
 it('全家具の向きと位置を検証し、不正な配置では変更しない',()=>{
  const c=new Cafe();expect(()=>makeLayout(c.furniture)).not.toThrow();
  const original=structuredClone(c.furniture),draft=structuredClone(original);
  draft.find(f=>f.kind==='fridge')!.x=1;
  expect(c.applyLayout(draft)).toBe(true);expect(c.furniture.find(f=>f.kind==='fridge')!.x).toBe(1);
  const bad=structuredClone(c.furniture);bad[0].x=6;bad[0].y=0;
  expect(c.applyLayout(bad)).toBe(false);expect(c.furniture[0].x).toBe(0);
 });
 it('移設したコンロと配膳台の作業位置・経路も更新する',()=>{
  const c=new Cafe();const draft=structuredClone(c.furniture);
  const stove=draft[0];stove.x=1;stove.y=5;stove.rotation=1;
  expect(c.applyLayout(draft)).toBe(true);expect(c.stove.work).toEqual({x:1,y:6});
  expect(c.startCooking('moon-stew')).toBe(true);step(c,130000);expect(c.order?.status).toBe('ready');
 });
 it('閉店中も実時間に従って料理が完成し、待機疲労・新規売上は増えない',()=>{
  const c=new Cafe();c.open=false;c.startCooking('moon-stew');step(c,2000);
  const energy=c.staff.energy;c.advanceOffline(180000);
  expect(c.order?.status).toBe('ready');expect(c.staff.energy).toBeCloseTo(energy-14);expect(c.sales).toBe(0);
 });
 it('営業中の不在は疲労と在庫販売を反映し、同じ保存の再利用なしでは二重計上しない',()=>{
  const c=new Cafe();c.autoStock=true;c.startCooking('moon-stew');step(c,2000);
  c.advanceOffline(300000);expect(c.sales).toBeGreaterThan(0);expect(c.staff.energy).toBeLessThan(66);
  const saved=encodeSave(c,1000000),d=decodeSave(saved);d.cafe.advanceOffline(0);
  expect(d.cafe.coins).toBe(c.coins);expect(d.cafe.stock).toBe(c.stock);
 });
 it('休憩は不在中に回復し、長期不在でも負の体力や売上無限増殖を起こさない',()=>{
  const c=new Cafe();c.staff.energy=10;c.toggleRest(0);c.advanceOffline(7*86400000);expect(c.staff.energy).toBe(80);expect(c.sales).toBe(0);
  const w=new Cafe();w.advanceOffline(7*86400000);expect(w.staff.energy).toBe(0);expect(w.coins).toBe(120);
 });
 it('机・椅子・流し・配膳台を移設しても在庫と接客を継続する',()=>{
  const c=new Cafe(undefined,2035,'playtest');c.startCooking('moon-stew');step(c,8000);c.collectCooking();
  const draft=structuredClone(c.furniture);
  Object.assign(draft.find(f=>f.id==='table-9')!,{x:3,y:1,rotation:2});
  Object.assign(draft.find(f=>f.id==='chair-10')!,{x:2,y:1,rotation:0});
  Object.assign(draft.find(f=>f.id==='counter-3')!,{x:2,y:6,rotation:0});
  Object.assign(draft.find(f=>f.id==='sink-1')!,{x:0,y:6,rotation:1});
  expect(c.applyLayout(draft)).toBe(true);expect(c.stock).toBe(2);
  expect(c.counters[0].work).toEqual({x:3,y:6});
  const restored=decodeSave(encodeSave(c,1000)).cafe;
  step(restored,100000);expect(restored.served).toBeGreaterThan(0);
 });
 it('調理・配膳の担当指定を通常営業と不在集計に適用する',()=>{
  const c=new Cafe();c.staff.role='service';expect(c.startCooking('moon-stew')).toBe(false);
  c.staff.role='cook';c.autoStock=true;expect(c.startCooking('moon-stew')).toBe(true);step(c,2000);c.advanceOffline(300000);
  expect(c.stock).toBe(12);expect(c.sales).toBe(0);
 });
 it('移設後に買う椅子は移したテーブルの隣へ設置する',()=>{
  const c=new Cafe();c.coins=1000;c.buyFurniture('table');const draft=structuredClone(c.furniture);
  Object.assign(draft.find(f=>f.id==='bought-table-0')!,{x:8,y:5});expect(c.applyLayout(draft)).toBe(true);
  expect(c.buyFurniture('chair')).toBe(true);expect(c.seats.at(-1)?.table).toEqual({x:8,y:5});
  expect(()=>decodeSave(encodeSave(c,1000))).not.toThrow();
 });
 it('破損チェックとバックアップ復元を行う',()=>{
  const c=new Cafe();c.coins=432;const good=encodeSave(c,1000000);
  expect(()=>decodeSave(good.replace('432','999'))).toThrow();
  const data=new Map([['nightshift-cafe-save-v1','broken'],['nightshift-cafe-save-v1-backup',good]]);
  const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)} as unknown as Storage;
  const restored=restoreCafe(storage,1000000);expect(restored.cafe?.coins).toBe(432);expect(restored.warning).toContain('バックアップ');
 });
 it('料理予約のある保存でも運搬中の料理は元の在庫参照に復元する',()=>{
  const c=new Cafe(undefined,2035,'playtest');c.autoStock=true;c.startCooking('moon-stew');
  for(let i=0;i<2000&&!c.staff.carried;i++)c.tick();
  expect(c.staff.carried).not.toBeNull();
  const r=decodeSave(encodeSave(c,100)).cafe;
  expect(r.staff.carried).toBe(r.batches.find(b=>b.id===c.staff.carried!.id));
 });
});
