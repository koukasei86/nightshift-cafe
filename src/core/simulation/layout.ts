import { cafeGrid, DOOR, DOOR_OUTSIDE, furniture } from '../../data/cafe';
import { findPath, sameTile, tileKey, type Tile } from '../pathfinding/grid';
export type Furniture = typeof furniture[number];
export const offsets=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
export const front=(f: Furniture)=>({x:f.x+offsets[f.rotation%4].x,y:f.y+offsets[f.rotation%4].y});
export function makeLayout(items: Furniture[]) {
 const occupied=new Set<number>();
 for(const f of items) {
  if(!Number.isInteger(f.x)||!Number.isInteger(f.y)||f.x<0||f.x>=9||f.y<0||f.y>=7) throw Error('家具は店内のマスに置いてください');
  if(!Number.isInteger(f.rotation)||f.rotation<0||f.rotation>3)throw Error('向きが不正です');
  const key=tileKey(f,9);
  if(occupied.has(key)) throw Error('家具が重なっています');
  if(sameTile(f,DOOR)||sameTile(f,{x:7,y:0})) throw Error('入口とその隣は通路として空けてください');
  occupied.add(key);
 }
 const walls=Array.from({length:9},(_,x)=>({x,y:DOOR_OUTSIDE.y})).filter(t=>t.x!==DOOR.x).map(t=>tileKey(t,9));
 const grid={...cafeGrid,blocked:new Set([...walls,...items.filter(f=>f.kind!=='chair').map(f=>tileKey(f,9))])};
 const nav={...grid,blocked:new Set([...walls,...occupied])};
 const reachable=(t:Tile)=>findPath(nav,DOOR,t)!==null;
 const stoves=items.filter(f=>f.kind==='stove').map(f=>({id:f.id,tile:{x:f.x,y:f.y},work:front(f)}));
 const counters=items.filter(f=>f.kind==='counter').map((f,i)=>({id:f.id,name:`配膳台 ${String.fromCharCode(65+i)}`,tile:{x:f.x,y:f.y},work:front(f)}));
 const workKeys=[...stoves,...counters].map(f=>tileKey(f.work,9));
 if(new Set(workKeys).size!==workKeys.length)throw Error('コンロと配膳台の作業場所を重ねないでください');
 for(const f of [...stoves,...counters]) if(!reachable(f.work))throw Error('コンロ・配膳台の矢印側に、入口からつながる作業通路が必要です');
 const seats=items.filter(f=>f.kind==='chair').map(chair=>{
  const table=items.find(f=>f.kind==='table'&&sameTile(f,front(chair)));
  if(!table)throw Error('椅子の矢印を隣のテーブルへ向けてください');
  const service=offsets.map(d=>({x:table.x+d.x,y:table.y+d.y})).find(reachable);
  const blocked=new Set(nav.blocked);blocked.delete(tileKey(chair,9));
  if(!service || !findPath({...nav,blocked},DOOR,chair))throw Error('椅子とテーブルへの通路がありません');
  return {position:{x:chair.x,y:chair.y},table:{x:table.x,y:table.y},service};
 });
 if(!seats.length)throw Error('テーブルと椅子を1組以上配置してください');
 return {grid,stoves,counters,seats};
}
