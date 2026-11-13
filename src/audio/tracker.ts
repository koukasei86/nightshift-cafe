import type {Cafe} from '../core/simulation/cafe';
import type {SoundId} from './effects';
const snapshot=(c:Cafe)=>({time:c.time,open:c.open,sales:c.sales,level:c.level,furniture:c.furniture.length,batch:c.batches.map(b=>b.id),orders:new Map([...c.orders].map(([id,o])=>[id,o.status])),guests:new Map(c.guests.map(g=>[g.id,g.state])),staff:new Map(c.employees.map(w=>[w.id,w.state]))});
/** Observe live transitions only. Restoring saves and offline catch-up never replay old sounds. */
export class SoundTracker {
 private previous:ReturnType<typeof snapshot>;
 constructor(c:Cafe,private readonly play:(id:SoundId)=>unknown){this.previous=snapshot(c);}
 reset(c:Cafe){this.previous=snapshot(c);}
 update(c:Cafe){
  const p=this.previous,n=snapshot(c);this.previous=n;
  if(n.time-p.time>1000||n.time<p.time)return;
  if(n.open!==p.open)this.play('door');
  if(n.furniture>p.furniture)this.play('buy');
  if(n.sales>p.sales)this.play('cash');
  if(n.level>p.level)this.play('level');
  for(const [id,status] of n.orders)if(status!==p.orders.get(id)){
   if(status==='cooking')this.play('cook');if(status==='ready')this.play('ready');
  }
  if(n.batch.some(id=>!p.batch.includes(id)))this.play('plate');
  for(const [id,state] of n.guests){
   if(state==='seating'&&p.guests.get(id)==='approach')this.play('arrival');
   if(state==='eating'&&p.guests.get(id)!=='eating')this.play('plate');
  }
  for(const [id,state] of n.staff){
   if(!p.staff.has(id))this.play('infect');
   else if(state!==p.staff.get(id)&&state==='resting')this.play('rest');
  }
 }
}
