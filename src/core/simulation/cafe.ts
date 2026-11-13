import { makeLayout, type Furniture } from './layout';
import { balance, normalCooking, normalPortions, type TimeMode } from '../../data/balance';
import { archetypes, counters, cafeGrid, CHEF_SPEED, COUNTER_WORK, DOOR, DOOR_OUTSIDE, EXIT, GUEST_SPEED,
  LEVEL_XP, recipes, seats, furniture, STOVE, STAFF_LIMIT, STOVE_WORK, type Recipe } from '../../data/cafe';
import { position, route, walk, type Movement } from '../npc/movement';
import { findPath, tileKey, sameTile, type Grid, type Tile } from '../pathfinding/grid';
import { STEP_MS } from './clock';

export type GuestState = 'approach' | 'seating' | 'waiting' | 'eating' | 'paying' | 'leaving';
export type StaffState = 'idle' | 'toStove' | 'cooking' | 'toCounter' | 'toTable' | 'serving' |
  'pickup' | 'returning' | 'toClean' | 'cleaning' | 'resting' | 'outburst';

export interface Guest extends Movement {
  id: number;
  state: GuestState;
  seat: number | null;
  since: number;
  style: number;
  meal: Recipe | null;
  tip: number;
  lastAction: string;
}

export interface Staff extends Movement {
  id: number;
  name: string;
  style: number;
  state: StaffState;
  until: number;
  guestId: number | null;
  cleanSeat: number | null;
  carried: Batch | null;
  taskId: number | null;
  blockedSince: number | null;
  energy: number;
  maxEnergy: number;
  tip: number;
  temper: number;
  role?: 'all'|'cook'|'service';
  restRequested: boolean;
  lastAction: string;
}

export interface Batch {
  id: number; counterId: string; recipe: Recipe; portions: number;
  reserved: number; expiresAt: number;
}
export interface ServiceTask {
  taskId: number; guestId: number; seatId: number; requestedAt: number;
  status: 'queued'|'reserved'|'pickup'|'carrying'|'serving'|'completed'|'cancelled';
  assignedStaffId: number|null; reservedBatchId: number|null; counterId: string|null;
  priority: number; reason?: string;
}
interface KitchenOrder {
  recipe: Recipe;
  requestedId: number | undefined;
  cookId: number | null;
  status: 'queued' | 'walking' | 'cooking' | 'ready';
  until: number;
}

function employee(id: number, name: string, style: number, tile: Tile, maxEnergy: number,
  speed: number, tip: number, temper: number): Staff {
  return { id, name, style, tile, maxEnergy, energy: maxEnergy, speed, tip, temper, state: 'idle',
    path: [], fraction: 0, facing: 'se', until: 0, guestId: null, cleanSeat: null, carried: null,
    restRequested: false, taskId: null, blockedSince: null, lastAction: '仕事を待つ' };
}

export class Cafe {
  time = 0;
  coins = 120;
  sales = 0;
  served = 0;
  toxin = 3;
  xp = 0;
  rating = 3;
  outbursts = 0;
  open = true;
  notice = 'コンロをタップして、最初の料理を選ぼう';
  guests: Guest[] = [];
  employees = [employee(0, 'シェフ・モス', -1, { x: 1, y: 3 }, 80, CHEF_SPEED, 2, 16)];
  dirty = new Set<number>();
  furniture = structuredClone(furniture);
  seats: {position: Tile; service: Tile; table: Tile}[] = structuredClone([...seats]);
  stoves = [{id: 'stove-0', tile: {...STOVE}, work: {...STOVE_WORK}}];
  selectedStoveId = 'stove-0';
  orders = new Map<string, KitchenOrder>();
  get order() { return this.orders.get(this.selectedStoveId) ?? null; }
  set order(value: KitchenOrder | null) { if(value) this.orders.set(this.selectedStoveId,value); else this.orders.delete(this.selectedStoveId); }
  get stove() { return this.stoves.find(s=>s.id===this.selectedStoveId)!; }
  shopItems = [
    {kind: 'stove' as const, name: 'コンロ', price: 100, description: '追加の調理設備。従業員が空き次第、調理します。', slots: [{x:0,y:5}]},
    {kind: 'table' as const, name: 'テーブル', price: 45, description: '椅子と揃えると接客席になります。', slots: [{x:4,y:5},{x:7,y:1}]},
    {kind: 'chair' as const, name: '椅子', price: 25, description: '購入済みテーブルの隣に置き、席を増やします。', slots: [{x:4,y:6},{x:8,y:1}]},
  ];
  shopCount(kind: string) { return this.furniture.filter(f=>f.id.startsWith('bought-') && f.kind===kind).length; }
  private purchaseCandidate(kind:string) {
    const item=this.shopItems.find(i=>i.kind===kind);if(!item)return null;
    const index=this.shopCount(kind);if(!item.slots[index])return null;
    let options: {x:number;y:number;rotation:number}[]=[];
    if(kind==='chair'){
      const table=this.furniture.find(f=>f.id===`bought-table-${index}`);if(!table)return null;
      options=[{x:table.x-1,y:table.y,rotation:0},{x:table.x,y:table.y-1,rotation:1},{x:table.x+1,y:table.y,rotation:2},{x:table.x,y:table.y+1,rotation:3}];
    }else options=[{...item.slots[index],rotation:0},...Array.from({length:63},(_,i)=>({x:i%9,y:Math.floor(i/9),rotation:0}))];
    for(const tile of options){
      if(this.furniture.some(f=>sameTile(f,tile)))continue;
      const candidate={...tile,id:`bought-${kind}-${index}`,kind:item.kind,occupiedTiles:[{x:tile.x,y:tile.y}],blocking:kind!=='chair',renderKey:item.kind};
      if(!this.layoutIssue([...this.furniture,candidate]))return candidate;
    }
    return null;
  }
  purchaseIssue(kind: string) {
    const item=this.shopItems.find(i=>i.kind===kind);
    if(!item)return '商品がありません';
    const index=this.shopCount(kind);
    if(!item.slots[index])return '設置スペースがいっぱいです';
    if(kind==='chair'&&this.shopCount('table')<=index)return '先にテーブルを購入してください';
    if(this.coins<item.price)return 'コインが足りません';
    const tile=this.purchaseCandidate(kind);if(!tile)return '配置できる空きスペースがありません';
    if([...this.guests,...this.employees].some(a=>sameTile(a.tile,tile)||a.path.some(t=>sameTile(t,tile))))return '設置場所を通行中です。少し待ってください';
    return '';
  }
  buyFurniture(kind: string) {
    const issue=this.purchaseIssue(kind);if(issue){this.notice=issue;return false;}
    const item=this.shopItems.find(i=>i.kind===kind)!,candidate=this.purchaseCandidate(kind)!;
    const layout=makeLayout([...this.furniture,candidate]);
    this.coins-=item.price;this.furniture.push(candidate);this.grid=layout.grid;this.stoves=layout.stoves;this.counters=layout.counters;
    const oldSeats=this.seats;
    this.seats=[...oldSeats.map(s=>layout.seats.find(t=>sameTile(t.position,s.position))!),...layout.seats.filter(s=>!oldSeats.some(t=>sameTile(s.position,t.position)))];
    this.layoutRevision++;this.notice=`${item.name}を購入・設置しました（−${item.price}コイン）`;return true;
  }
  counters = structuredClone([...counters]) as {id:string;name:string;tile:Tile;work:Tile}[];
  layoutRevision=0;
  autoStock=false;
  batches: Batch[] = [];
  tasks: ServiceTask[] = [];
  policy: 'fifo'|'nearest' = 'fifo';
  mode: TimeMode;
  private nextBatch = 1;
  private nextTask = 1;
  readonly timing = balance;
  private nextId = 1;
  private spawnAt: number = balance.firstSpawn;
  private seed: number;

  constructor(private grid: Grid = cafeGrid, seed = 2035, mode: TimeMode = 'normal') {
    if(grid===cafeGrid) this.grid={...grid,blocked:new Set(grid.blocked)};
    this.mode = mode;
    this.seed = seed >>> 0;
  }

  layoutIssue(items: Furniture[]) {try {makeLayout(items);return '';}catch(e){return (e as Error).message;}}
  applyLayout(items: Furniture[]) {
    const issue=this.layoutIssue(items);if(issue){this.notice=issue;return false;}
    this.settleVisitors();
    this.furniture=structuredClone(items).map(f=>({...f,occupiedTiles:[{x:f.x,y:f.y}]}));
    const layout=makeLayout(this.furniture);this.grid=layout.grid;this.stoves=layout.stoves;this.counters=layout.counters;this.seats=layout.seats;
    const used=new Set([...this.orders.entries()].filter(([,o])=>['cooking','walking'].includes(o.status)).map(([id])=>tileKey(this.stoves.find(s=>s.id===id)!.work,9)));
    for(const w of this.employees) {
      const cooking=[...this.orders.entries()].find(([,o])=>o.cookId===w.id && ['cooking','walking'].includes(o.status));
      const target=cooking?this.stoves.find(s=>s.id===cooking[0])!.work:this.freeSpot(used);
      w.tile={...target};w.path=[];w.fraction=0;used.add(tileKey(target,9));
      if(cooking && cooking[1].status==='walking'){cooking[1].status='cooking';cooking[1].until=this.time+cooking[1].recipe.cookMs;w.state='cooking';}
    }
    this.layoutRevision++;this.notice='配置を保存しました。お客様は入口から再び来店します';return true;
  }
  private freeSpot(used=new Set<number>()) {
    const occupied=new Set(this.furniture.map(f=>tileKey(f,9)));
    for(let y=1;y<7;y++)for(let x=1;x<9;x++) {
      const t={x,y},k=tileKey(t,9);
      if(!occupied.has(k)&&!used.has(k)&&findPath(this.grid,DOOR,t))return t;
    }
    return {...DOOR};
  }
  private settleVisitors() {
    for(const w of this.employees) {
      const carried=w.carried;if(carried&&carried.expiresAt>this.time)carried.portions++;
      this.releaseTask(w);w.path=[];w.fraction=0;
      if(!['cooking','toStove','resting'].includes(w.state))w.state='idle';
    }
    this.tasks=[];this.guests=[];this.dirty.clear();
  }

  saveData() {
    return {version:1,time:this.time,coins:this.coins,sales:this.sales,served:this.served,toxin:this.toxin,xp:this.xp,rating:this.rating,outbursts:this.outbursts,open:this.open,
      guests:this.guests,employees:this.employees,dirty:[...this.dirty],furniture:this.furniture,seats:this.seats,stoves:this.stoves,counters:this.counters,
      selectedStoveId:this.selectedStoveId,orders:[...this.orders],batches:this.batches,tasks:this.tasks,policy:this.policy,mode:this.mode,autoStock:this.autoStock,
      nextBatch:this.nextBatch,nextTask:this.nextTask,nextId:this.nextId,spawnAt:this.spawnAt,seed:this.seed};
  }
  static fromData(raw: unknown) {
    const d=raw as ReturnType<Cafe['saveData']>;
    if(!d || d.version!==1 || !Array.isArray(d.furniture)||!Array.isArray(d.employees)||!Array.isArray(d.batches)||!Array.isArray(d.orders)||!Array.isArray(d.seats)||!Array.isArray(d.guests)||!Array.isArray(d.tasks)||!Array.isArray(d.dirty))throw Error('保存データの形式が不正です');
    if(d.employees.length<1||d.employees.length>3||d.furniture.length>63||d.guests.length>20||d.batches.length>1000||d.orders.length>63)throw Error('保存データの件数が不正です');
    for(const key of ['time','coins','sales','served','toxin','xp','rating','nextBatch','nextTask','nextId','spawnAt','seed'] as const)if(!Number.isFinite(d[key])||d[key]<0)throw Error('保存データの数値が不正です');
    const layout=makeLayout(d.furniture);
    if(d.employees.some(w=>!Number.isFinite(w.energy)||w.energy<0||!Array.isArray(w.path)) || d.batches.some(b=>!layout.counters.some(c=>c.id===b.counterId)||b.portions<0||b.reserved<0))throw Error('従業員・在庫の保存データが不正です');
    const c=new Cafe(undefined,2035,d.mode);
    Object.assign(c,structuredClone(d));
    c.grid=layout.grid;c.orders=new Map(d.orders);c.dirty=new Set(d.dirty);
    for(const w of c.employees) if(w.carried)w.carried=c.batches.find(b=>b.id===w.carried!.id)??null;
    if(!c.stoves.some(s=>s.id===c.selectedStoveId))c.selectedStoveId=c.stoves[0].id;
    c.notice='保存した店舗を再開しました';return c;
  }
  advanceOffline(elapsedMs:number) {
    if(!Number.isFinite(elapsedMs)||elapsedMs<1000)return null;
    const start=this.time,end=start+elapsedMs,previousSales=this.sales,previousLevel=this.level;
    if(elapsedMs<=120000){for(let i=0;i<Math.floor(elapsedMs/STEP_MS);i++)this.tick();return {elapsedMs,sales:this.sales-previousSales,completed:0,expired:0};}
    const initialEnergy=new Map(this.employees.map(w=>[w.id,w.energy]));
    const resting=new Set(this.employees.filter(w=>w.state==='resting').map(w=>w.id));
    const busy=new Map<number,number>();let completed=0,expired=0;
    const arrivals=new Map(this.batches.map(b=>[b.id,start]));
    const spend=(w:Staff,amount:number,at:number)=>{
      const drain=this.open&&!resting.has(w.id)?Math.max(0,at-start)/60000*.6:0;
      if(w.energy-drain<=Math.max(w.temper,amount))return false;
      w.energy-=amount;return true;
    };
    // Finish meals already on tables once; reservation and carried inventory are then released.
    for(const g of this.guests)if(g.meal&&['eating','paying'].includes(g.state)) {
      const due=g.since+(g.state==='eating'?balance.meal+balance.payment:balance.payment);
      if(due<=end){this.coins+=g.meal.price+g.tip;this.sales+=g.meal.price+g.tip;this.served++;this.xp+=g.meal.xp;}
    }
    this.settleVisitors();
    for(const [id,order] of [...this.orders].sort((a,b)=>Number(a[1].status==='queued')-Number(b[1].status==='queued'))) {
      let due=order.status==='ready'?order.until-balance.burnDelay:order.until;
      let cook=this.employees.find(w=>w.id===order.cookId);
      if(order.status==='queued'||order.status==='walking') {
        cook=order.status==='walking'?cook:this.eligibleCooks(order.recipe,order.requestedId).find(w=>!resting.has(w.id));
        if(!cook)continue;
        const begin=Math.max(start,busy.get(cook.id)??start)+2000;
        due=begin+order.recipe.cookMs;order.cookId=cook.id;order.status='cooking';order.until=due;cook.state='cooking';
      }
      if(cook)busy.set(cook.id,due);
      if(order.status==='cooking' && due<=end) {
        if(cook){cook.energy=Math.max(0,cook.energy-order.recipe.energy);cook.state='idle';}
        order.status='ready';order.until=due+balance.burnDelay;completed++;
      }
      if(order.status==='ready' && this.autoStock) {
        const counter=this.counters.reduce((a,b)=>this.counterStock(a.id)<=this.counterStock(b.id)?a:b);
        const batch={id:this.nextBatch++,counterId:counter.id,recipe:order.recipe,portions:order.recipe.portions,reserved:0,expiresAt:due+order.recipe.keepMs};
        this.batches.push(batch);arrivals.set(batch.id,Math.max(start,due));this.orders.delete(id);
      }else if(order.status==='ready'&&order.until<=end){this.orders.delete(id);expired++;}
    }
    // Aggregate absent sales, bounded by actual inventory and worker energy; never creates food.
    let nextCustomer=start+Math.max(balance.spawnBase-this.rating*balance.spawnRatingSlope,18000);
    if(this.open && this.seats.length) for(const batch of [...this.batches].sort((a,b)=>(arrivals.get(a.id)??start)-(arrivals.get(b.id)??start))) {
      while(batch.portions>0) {
        const worker=this.employees.filter(w=>w.role!=='cook'&&!resting.has(w.id)).sort((a,b)=>(busy.get(a.id)??start)-(busy.get(b.id)??start)).find(w=>w.energy>Math.max(w.temper,10));
        if(!worker)break;
        const at=Math.max(nextCustomer,arrivals.get(batch.id)??start,busy.get(worker.id)??start)+20000;
        if(at>end||at>=batch.expiresAt||!spend(worker,10,at))break;
        batch.portions--;this.coins+=batch.recipe.price;this.sales+=batch.recipe.price;this.served++;this.xp+=batch.recipe.xp;
        nextCustomer=at+18000;busy.set(worker.id,at+balance.cleaning);
      }
    }
    for(const w of this.employees) {
      if(resting.has(w.id))w.energy=Math.min(w.maxEnergy,(initialEnergy.get(w.id)??0)+elapsedMs/1000*balance.restRecoveryPerSecond);
      else if(this.open)w.energy=Math.max(0,w.energy-elapsedMs/60000*.6);
      const order=[...this.orders.values()].find(o=>o.cookId===w.id&&o.status==='cooking');
      if(order){w.state='cooking';const id=[...this.orders].find(([,o])=>o===order)![0];w.tile={...this.stoves.find(s=>s.id===id)!.work};}else if(resting.has(w.id)||w.restRequested){w.state='resting';w.restRequested=false;}else w.state='idle';
      w.lastAction=w.state==='cooking'?'不在中も調理を継続':w.state==='resting'?'休憩中':'不在中の勤務を反映';
    }
    this.time=end;this.spawnAt=end+3000;
    expired+=this.batches.filter(b=>b.expiresAt<=end).reduce((n,b)=>n+b.portions,0);
    this.batches=this.batches.filter(b=>b.expiresAt>end);
    this.toxin+=Math.max(0,this.level-previousLevel);
    const summary={elapsedMs,sales:this.sales-previousSales,completed,expired};
    this.notice=`不在 ${Math.floor(elapsedMs/60000)}分 · 売上 +${summary.sales} · 調理完了 ${completed} · 期限切れ ${expired}`;
    return summary;
  }

  get recipes(): readonly Recipe[] {
    return this.mode === 'playtest' ? recipes : recipes.map((recipe, i) => ({ ...recipe,
      cookMs: normalCooking[i], portions: normalPortions[i], keepMs: 1800000,
    }));
  }
  setMode(mode: TimeMode) {
    this.mode = mode;
    this.notice = `${mode === 'normal' ? '通常時間（調整中）' : '試遊時間'}へ変更。調理中の料理には影響しません`;
  }
  counterStock(id: string) { return this.batches.filter(b => b.counterId === id).reduce((n,b)=>n+b.portions+b.reserved,0); }
  taskFor(worker: Staff) { return this.tasks.find(t=>t.taskId===worker.taskId); }
  private batchFor(worker: Staff) { return this.batches.find(b=>b.id===this.taskFor(worker)?.reservedBatchId); }

  get staff() { return this.employees[0]; }
  get level() { return 1 + Math.floor(this.xp / LEVEL_XP); }
  get stock() { return this.batches.reduce((total, batch) => total + batch.portions + batch.reserved, 0); }
  get doorInUse() {
    return this.open || this.guests.some(guest => {
      if (guest.state !== 'leaving') return false;
      const p = position(guest);
      return Math.abs(p.x - DOOR.x) < .45 && Math.abs(p.y + .5) < .49;
    });
  }

  stockOf(id: string) {
    return this.batches.reduce((total, batch) => total + (batch.recipe.id === id ? batch.portions + batch.reserved : 0), 0);
  }

  cookingIssue(recipe: Recipe, cookId?: number) {
    if (recipe.requiredLevel > this.level) return `Lv.${recipe.requiredLevel}で解放`;
    if (this.order) return 'コンロを使用中';
    if (this.coins < recipe.cost) return '材料費が足りません';
    if (!this.eligibleCooks(recipe, cookId).length) return '体力のある勤務中の従業員が必要です';
    return '';
  }

  startCooking(recipeId: string, cookId?: number) {
    const recipe = this.recipes.find(item => item.id === recipeId);
    if (!recipe) return false;
    const issue = this.cookingIssue(recipe, cookId);
    if (issue) { this.notice = issue; return false; }
    if (!this.eligibleCooks(recipe, cookId).some(worker => findPath(this.grid, worker.tile, this.stove.work))) {
      this.notice = 'コンロへの通路がありません';
      return false;
    }
    this.coins -= recipe.cost;
    this.order = { recipe, requestedId: cookId, cookId: null, status: 'queued', until: 0 };
    this.notice = '従業員が手の空き次第、調理します';
    this.assignCooking();
    return true;
  }

  private eligibleCooks(recipe: Recipe, cookId?: number) {
    return this.employees.filter(worker => (cookId === undefined || worker.id === cookId) &&
      worker.role!=='service' && worker.state !== 'resting' && worker.state !== 'outburst' &&
      worker.energy >= recipe.energy && worker.energy > worker.temper);
  }

  private assignCooking() {
    for(const stove of this.stoves) {
      const order=this.orders.get(stove.id);
      if(order?.status!=='queued') continue;
      const cooks=this.eligibleCooks(order.recipe,order.requestedId);
      const cook=cooks.find(worker=>worker.state==='idle' && this.routeAround(worker,stove.work));
      if(cook) {
        order.cookId=cook.id;order.status='walking';
        this.staffState(cook,'toStove','コンロへ移動');
        this.notice=`${cook.name}が調理に向かいます`;
      } else if(cooks.every(worker=>worker.state==='idle')) {
        this.coins+=order.recipe.cost;this.orders.delete(stove.id);
        this.notice='調理を引き受けられる従業員がいないため材料費を返しました';
      }
    }
  }

  collectCooking(counterId: string = this.counters.reduce((a,b)=>this.counterStock(a.id)<=this.counterStock(b.id)?a:b).id) {
    const order = this.order;
    if (!order || order.status !== 'ready' || !this.counters.some(c=>c.id===counterId)) return false;
    this.batches.push({
      id: this.nextBatch++, counterId, reserved: 0, recipe: order.recipe, portions: order.recipe.portions, expiresAt: this.time + order.recipe.keepMs,
    });
    this.order = null;
    this.notice = `${order.recipe.name}を${this.counters.find(c=>c.id===counterId)!.name}へ移しました（${order.recipe.portions}食）`;
    return true;
  }

  infectionIssue(guest: Guest) {
    if (guest.state === 'leaving') return 'この客は退店中です';
    if (guest.tile.y < DOOR.y) return '入店後に雇用できます';
    if (this.employees.length >= STAFF_LIMIT) return '従業員の枠がいっぱいです';
    if (this.toxin < archetypes[guest.style].toxin) return '毒素が足りません';
    return '';
  }

  infect(id: number) {
    const guest = this.guests.find(item => item.id === id);
    if (!guest) return false;
    const issue = this.infectionIssue(guest);
    if (issue) { this.notice = issue; return false; }
    const type = archetypes[guest.style];
    this.toxin -= type.toxin;
    this.guests = this.guests.filter(item => item.id !== id);
    const recruit = employee(id, `ゾンビ${type.name}`, guest.style, guest.tile,
      type.energy, type.speed, type.tip, type.temper);
    recruit.facing = guest.facing;
    recruit.fraction = guest.fraction;
    recruit.path = guest.fraction > 0 ? guest.path.slice(0, 1) : [];
    if (guest.seat !== null && guest.meal) this.dirty.add(guest.seat);
    this.employees.push(recruit);
    this.routeAround(recruit,this.freeSpot(new Set(this.employees.filter(w=>w!==recruit).map(w=>tileKey(w.tile,9)))));
    this.notice = `${type.name}を感染させて雇いました`;
    return true;
  }

  toggleRest(id: number) {
    const worker = this.employees.find(item => item.id === id);
    if (!worker || worker.state === 'outburst') return false;
    if (worker.state === 'resting') {
      if (worker.energy <= worker.temper) { this.notice = 'もう少し休憩が必要です'; return false; }
      this.staffState(worker, 'idle', '仕事に戻る');
    } else if (worker.state === 'cooking' || worker.state === 'toStove') {
      worker.restRequested = !worker.restRequested;
      this.notice = worker.restRequested ? '調理が終わったら休憩します' : '調理後の休憩予約を解除しました';
      return true;
    } else {
      this.rest(worker);
    }
    this.notice = worker.lastAction;
    return true;
  }

  toggleOpen() {
    this.open = !this.open;
    if (this.open) this.spawnAt = Math.min(this.spawnAt, this.time + 600);
    else this.guests = this.guests.filter(guest =>
      guest.tile.y >= DOOR.y || guest.state === 'leaving' || this.leave(guest, '入口が閉まったため引き返す'));
    this.notice = this.open ? '入口を開けました' : '入口を閉めました。店内のお客様はそのまま利用できます';
  }

  tick() {
    this.time += STEP_MS;
    if(this.open) for(const w of this.employees) if(w.state!=='resting') w.energy=Math.max(0,w.energy-STEP_MS/60000*.6);
    if(this.autoStock) {const selected=this.selectedStoveId;for(const [id,o] of this.orders) if(o.status==='ready'){this.selectedStoveId=id;this.collectCooking();}this.selectedStoveId=selected;}
    for (const worker of this.employees) {
      if (worker.carried && worker.carried.expiresAt <= this.time && worker.state==='returning') {
        worker.carried=null; this.releaseTask(worker); this.staffState(worker,'idle','期限切れの料理を廃棄');
      }
      const task = this.taskFor(worker);
      if (task && !['completed','cancelled'].includes(task.status) &&
          (!this.guests.some(g=>g.id===task.guestId && g.state==='waiting') ||
           (this.batchFor(worker)?.expiresAt ?? worker.carried?.expiresAt ?? 0) <= this.time)) {
        this.cancelService(worker, '客の退店・感染、または料理の期限切れ');
      }
    }
    this.batches = this.batches.filter(batch => batch.expiresAt > this.time || batch.reserved > 0);
    this.tasks = this.tasks.filter(t=>!['completed','cancelled'].includes(t.status) || this.time-t.requestedAt<60000);
    for(const [id,order] of this.orders) if(order.status==='ready' && this.time>=order.until) {
      this.notice=`${order.recipe.name}が焦げました`;this.orders.delete(id);
    }
    if (this.time >= this.spawnAt) {
      this.spawnAt = this.time + Math.round(balance.spawnBase - this.rating * balance.spawnRatingSlope);
      if (this.open && this.guests.length < 9) this.spawn();
    }
    this.guests = this.guests.filter(guest => this.updateGuest(guest));
    this.assignCooking();
    this.assignService();
    for (const worker of this.employees) this.updateStaff(worker);
  }

  private routeAround(actor: Movement, target: Tile) {
    const blocked = new Set(this.grid.blocked);
    for (const seat of this.seats) if (!sameTile(seat.position, target) && !sameTile(seat.position, actor.tile))
      blocked.add(tileKey(seat.position, this.grid.width));
    return route(actor, { ...this.grid, blocked }, target);
  }

  private walkAround(actor: Movement) {
    if (!actor.path.length) return true;
    const exiting = this.guests.find(guest => guest === actor && guest.state === 'leaving');
    const incoming = this.guests.some(guest => guest !== actor &&
      (guest.state === 'approach' || guest.state === 'seating') && position(guest).y < 0);
    if (exiting && incoming && actor.fraction === 0) {
      if (sameTile(actor.tile, DOOR)) actor.path = [{ x: 7, y: 0 }, { ...DOOR }, ...actor.path];
      else if (sameTile(actor.path[0], DOOR)) return false;
    }
    // Reserve both ends of an occupied edge. Followers wait; opposing traffic
    // replans around that edge instead of crossing through the other person.
    if (actor.fraction === 0) {
      const others = [...this.guests, ...this.employees].filter(other => other !== actor);
      const blocked = new Set(this.grid.blocked);
      const target = actor.path.at(-1)!;
      for (const seat of this.seats) if (!sameTile(seat.position, target)) blocked.add(tileKey(seat.position, this.grid.width));
      for (const other of others) {
        blocked.add(tileKey(other.tile, this.grid.width));
        if (other.path.length && other.fraction > 0) blocked.add(tileKey(other.path[0], this.grid.width));
      }
      if (blocked.has(tileKey(actor.path[0], this.grid.width))) {
        blocked.delete(tileKey(actor.tile, this.grid.width));
        const detour = findPath({ ...this.grid, blocked }, actor.tile, target);
        if (!detour) {
          const blocker = others.find(o=>sameTile(o.tile,actor.path[0]) && !o.path.length);
          const staffBlocker = this.employees.find(w=>w===blocker && ['idle','resting'].includes(w.state));
          if (staffBlocker) {
            const escape=[{x:0,y:1},{x:1,y:0},{x:0,y:-1},{x:-1,y:0}].map(d=>({x:staffBlocker.tile.x+d.x,y:staffBlocker.tile.y+d.y}))
              .find(t=>t.x>=0 && t.x<this.grid.width && t.y>=0 && t.y<7 && !blocked.has(tileKey(t,this.grid.width)) && !sameTile(t,actor.tile));
            if(escape) this.routeAround(staffBlocker,escape);
          }
          const worker=this.employees.find(w=>w===actor);
          if(worker) {
            worker.blockedSince ??= this.time;
            if(worker.taskId!==null && this.time-worker.blockedSince>=balance.blockedCancel) {
              this.cancelService(worker,'通路が塞がれたため再手配'); worker.blockedSince=null;
            }
          }
          return false;
        }
        actor.path = detour;
      }
    }
    const movingWorker=this.employees.find(w=>w===actor); if(movingWorker) movingWorker.blockedSince=null;
    // Stop exactly at a cell boundary so the following edge is reserved again.
    const arrived = walk(actor, Math.min(STEP_MS, (1 - actor.fraction) * 1000 / actor.speed + 1e-7));
    if (actor.fraction < 1e-6) actor.fraction = 0;
    return arrived;
  }

  private spawn() {
    if (this.guests.some(guest => {
      const p = position(guest);
      return Math.hypot(p.x - EXIT.x, p.y - EXIT.y) < 1.2;
    })) return;
    if (!findPath(this.grid, EXIT, DOOR)) return;
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    const guest: Guest = {
      id: this.nextId++, style: (this.seed >>> 16) % archetypes.length, state: 'approach', seat: null,
      since: this.time, tile: { ...EXIT }, path: [], fraction: 0, facing: 'nw', speed: GUEST_SPEED * Math.min(1.15,archetypes[(this.seed >>> 16) % archetypes.length].speed), meal: null,
      tip: 0, lastAction: '入口へ移動',
    };
    if (this.routeAround(guest, DOOR_OUTSIDE)) this.guests.push(guest);
  }

  private guestState(guest: Guest, state: GuestState, action: string) {
    guest.state = state;
    guest.since = this.time;
    guest.lastAction = action;
  }

  private adjustRating(change: number) {
    this.rating = Math.round(Math.max(0.5, Math.min(5, this.rating + change)) * 100) / 100;
  }

  private leave(guest: Guest, reason: string) {
    if (guest.seat !== null && guest.meal) this.dirty.add(guest.seat);
    guest.seat = null;
    this.guestState(guest, 'leaving', reason);
    return this.routeAround(guest, EXIT);
  }

  private updateGuest(guest: Guest): boolean {
    const elapsed = this.time - guest.since;
    switch (guest.state) {
      case 'approach': {
        if (!this.walkAround(guest)) break;
        if (!this.open) return this.leave(guest, '閉店のため退店');
        const seat = this.seats.findIndex((spot, index) => !this.dirty.has(index) &&
          !this.guests.some(other => other.seat === index) &&
          findPath(this.grid, guest.tile, spot.position) !== null);
        if (seat < 0) return this.leave(guest, '空いている席がないため退店');
        if (!this.routeAround(guest, this.seats[seat].position)) return this.leave(guest, '席への通路がありません');
        guest.seat = seat;
        this.guestState(guest, 'seating', '予約した席へ移動');
        break;
      }
      case 'seating':
        if (this.walkAround(guest)) this.guestState(guest, 'waiting', '着席して料理を待つ');
        break;
      case 'waiting':
        if (elapsed >= balance.patience) {
          this.adjustRating(-0.18);
          return this.leave(guest, '待ち時間を超えて退店');
        }
        break;
      case 'eating':
        if (elapsed >= balance.meal) this.guestState(guest, 'paying', '食事を終えて会計');
        break;
      case 'paying':
        if (elapsed >= balance.payment && guest.meal) {
          const amount = guest.meal.price + guest.tip;
          this.coins += amount;
          this.sales += amount;
          this.served++;
          const level = this.level;
          this.xp += guest.meal.xp;
          this.adjustRating(guest.tip ? 0.18 : 0.08);
          this.notice = `お会計 +${amount} コイン`;
          if (level < this.level) {
            this.toxin++;
            this.notice = `レベル${this.level}にアップ！ 毒素 +1`;
          }
          return this.leave(guest, '会計を終えて退店');
        }
        break;
      case 'leaving':
        return !this.walkAround(guest);
    }
    return true;
  }

  private staffState(worker: Staff, state: StaffState, action: string) {
    worker.state = state;
    worker.lastAction = action;
  }

  private releaseTask(worker: Staff) {
    const task = this.taskFor(worker);
    const batch = this.batchFor(worker);
    if (task && !['completed','cancelled'].includes(task.status)) {
      if (batch && ['reserved','pickup'].includes(task.status)) {
        batch.reserved--; if (batch.expiresAt > this.time) batch.portions++;
      }
      task.status = 'cancelled';
    }
    worker.taskId = null;
    worker.carried = null;
    worker.guestId = null;
    worker.cleanSeat = null;
    // Finish the current edge before another action; never snap backwards.
    worker.path = worker.fraction > 0 ? worker.path.slice(0, 1) : [];
    if (!worker.path.length) worker.fraction = 0;
  }

  private rest(worker: Staff) {
    if (worker.carried) {
      worker.restRequested = true;
      this.cancelService(worker, '休憩のため料理を戻す');
      return;
    }
    this.releaseTask(worker);
    worker.restRequested = false;
    this.staffState(worker, 'resting', '休憩中・体力回復');
  }

  private cancelService(worker: Staff, reason: string) {
    const task = this.taskFor(worker);
    const carried = worker.carried;
    this.releaseTask(worker);
    if (task) { task.status = 'cancelled'; task.reason = reason; }
    if (carried && carried.expiresAt > this.time) {
      worker.carried = carried;
      const counter = this.counters.find(c=>c.id===carried.counterId)!;
      this.routeAround(worker, counter.work);
      this.staffState(worker, 'returning', reason);
    } else {
      worker.carried = null;
      if (worker.restRequested) this.rest(worker);
      else this.staffState(worker, 'idle', reason);
    }
  }

  private assignService() {
    for (const guest of this.guests) if (guest.state === 'waiting' && guest.seat !== null &&
      !this.tasks.some(t=>t.guestId===guest.id && !['cancelled','completed'].includes(t.status))) {
      this.tasks.push({ taskId: this.nextTask++, guestId: guest.id, seatId: guest.seat,
        requestedAt: guest.since, status: 'queued', assignedStaffId: null,
        reservedBatchId: null, counterId: null, priority: 0 });
    }
    for (const task of this.tasks) if (task.status==='queued' && !this.guests.some(g=>g.id===task.guestId && g.state==='waiting')) task.status='cancelled';
    const available = this.employees.filter(w=>w.role!=='cook' && w.state==='idle' && !w.path.length && w.energy>Math.max(w.temper,7) && !w.restRequested);
    const choices: {task:ServiceTask;worker:Staff;batch:Batch;cost:number;work:Tile}[]=[];
    for(const task of this.tasks.filter(t=>t.status==='queued')) for(const worker of available) for(const batch of this.batches) {
      if(batch.portions<=0 || batch.expiresAt<=this.time) continue;
      const counter=this.counters.find(c=>c.id===batch.counterId)!;
      const blocked=new Set(this.grid.blocked);
      for(const seat of this.seats) if(!sameTile(seat.position,worker.tile)) blocked.add(tileKey(seat.position,this.grid.width));
      const nav={...this.grid,blocked};
      const first=findPath(nav,worker.tile,counter.work),second=findPath(nav,counter.work,this.seats[task.seatId].service);
      if(first && second) choices.push({task,worker,batch,cost:first.length+second.length,work:counter.work});
    }
    choices.sort((a,b)=>this.policy==='fifo' ? a.task.requestedAt-b.task.requestedAt || a.cost-b.cost || a.worker.id-b.worker.id :
      (a.cost-Math.floor((this.time-a.task.requestedAt)/5000))-(b.cost-Math.floor((this.time-b.task.requestedAt)/5000)) || a.task.taskId-b.task.taskId || a.worker.id-b.worker.id);
    const claimed=new Set<string>();
    for(const c of choices) {
      if(c.task.status!=='queued' || c.worker.state!=='idle' || c.batch.portions<=0 || claimed.has(c.batch.counterId) ||
        this.employees.some(w=>['toCounter','pickup','returning'].includes(w.state) && (this.taskFor(w)?.counterId===c.batch.counterId || w.carried?.counterId===c.batch.counterId))) continue;
      if(!this.routeAround(c.worker,c.work)) continue;
      c.batch.portions--; c.batch.reserved++;
      Object.assign(c.task,{status:'reserved',assignedStaffId:c.worker.id,reservedBatchId:c.batch.id,counterId:c.batch.counterId});
      c.worker.guestId=c.task.guestId;c.worker.taskId=c.task.taskId;
      this.staffState(c.worker,'toCounter','予約した料理を取りに行く');claimed.add(c.batch.counterId);
    }
  }

  private takeTask(worker: Staff) {
    if (worker.energy <= worker.temper) {
      const victim = this.guests.find(guest => guest.state === 'waiting' || guest.state === 'eating');
      if (!victim) { this.rest(worker); return; }
      const survivors = this.guests.filter(guest =>
        guest.state === 'leaving' || guest.state === 'paying' ||
        this.leave(guest, guest === victim ? 'ゾンビに襲われて逃げる' : '驚いて逃げる'));
      this.guests = survivors;
      this.adjustRating(-0.85);
      this.outbursts++;
      worker.until = this.time + balance.outburst;
      this.staffState(worker, 'outburst', '疲労で客を襲った');
      this.notice = `${worker.name}が客を襲いました！ 評価ダウン`;
      return;
    }

    if(worker.role==='cook') return;
    for (const seat of this.dirty) {
      if (this.employees.some(item => item.cleanSeat === seat)) continue;
      if (!this.routeAround(worker, this.seats[seat].service)) continue;
      worker.cleanSeat = seat;
      this.staffState(worker, 'toClean', '皿を片付けに行く');
      return;
    }
  }

  private updateStaff(worker: Staff) {
    const order = [...this.orders.values()].find(o=>o.cookId===worker.id && (o.status==='walking' || o.status==='cooking'));
    switch (worker.state) {
      case 'idle':
        if (worker.path.length && !this.walkAround(worker)) break;
        this.takeTask(worker);
        break;
      case 'toStove':
        if (this.walkAround(worker) && order) {
          order.status = 'cooking';
          order.until = this.time + order.recipe.cookMs;
          this.staffState(worker, 'cooking', 'コンロで調理中');
        }
        break;
      case 'cooking':
        if (order && this.time >= order.until) {
          worker.energy = Math.max(0, worker.energy - order.recipe.energy);
          order.status = 'ready';
          order.until = this.time + balance.burnDelay;
          this.notice = `${order.recipe.name}が完成！ コンロをタップして取り出す`;
          if (worker.restRequested) this.rest(worker);
          else this.staffState(worker, 'idle', '調理完了');
        }
        break;
      case 'toCounter':
        if (this.walkAround(worker)) {
          worker.until = this.time + balance.pickup;
          const task = this.taskFor(worker);
          if (task) task.status = 'pickup';
          this.staffState(worker, 'pickup', '料理を受け取る');
        }
        break;
      case 'pickup':
        if (this.time >= worker.until) {
          const task = this.taskFor(worker), batch = this.batchFor(worker);
          const guest = this.guests.find(g=>g.id===worker.guestId && g.state==='waiting');
          if (task && batch && batch.expiresAt > this.time && guest?.seat !== null && guest &&
              this.routeAround(worker, this.seats[guest.seat].service)) {
            batch.reserved--; worker.carried = batch; task.status = 'carrying';
            this.staffState(worker, 'toTable', '料理を持って席へ向かう');
          } else this.cancelService(worker, '受取を取り消し');
        }
        break;
      case 'returning':
        if (!worker.path.length && worker.carried) {
          const target = this.counters.find(c=>c.id===worker.carried!.counterId)!.work;
          if (!sameTile(worker.tile,target) && !this.routeAround(worker,target)) {
            worker.lastAction = '返却経路を待っています';
            break;
          }
        }
        if (this.walkAround(worker)) {
          const batch = worker.carried;
          if (batch && !sameTile(worker.tile,this.counters.find(c=>c.id===batch.counterId)!.work)) break;
          if (batch && batch.expiresAt > this.time) batch.portions++;
          worker.carried = null;
          this.releaseTask(worker);
          if (worker.restRequested) this.rest(worker);
          else this.staffState(worker, 'idle', '料理を配膳台へ戻した');
        }
        break;
      case 'toTable':
        if (this.walkAround(worker)) {
          worker.until = this.time + balance.serving;
          const task = this.taskFor(worker); if (task) task.status = 'serving';
          this.staffState(worker, 'serving', '料理をテーブルに提供');
        }
        break;
      case 'serving':
        if (this.time >= worker.until) {
          const guest = this.guests.find(item => item.id === worker.guestId && item.state === 'waiting');
          if (guest && worker.carried && worker.carried.expiresAt > this.time) {
            guest.meal = worker.carried.recipe;
            guest.tip = this.time - guest.since <= balance.tipDeadline ? worker.tip : 0;
            worker.carried = null;
            worker.energy = Math.max(0, worker.energy - 7);
            this.guestState(guest, 'eating', '配膳された料理を食べる');
            const task = this.taskFor(worker); if (task) task.status = 'completed';
          }
          if (worker.carried) { this.cancelService(worker, '配膳取消'); break; }
          this.releaseTask(worker);
          this.staffState(worker, 'idle', guest ? '配膳完了' : '配膳を取り消し');
          this.routeAround(worker,this.freeSpot(new Set(this.employees.filter(w=>w!==worker).map(w=>tileKey(w.tile,9)))));
        }
        break;
      case 'toClean':
        if (this.walkAround(worker)) {
          worker.until = this.time + balance.cleaning;
          this.staffState(worker, 'cleaning', '汚れた皿を回収');
        }
        break;
      case 'cleaning':
        if (this.time >= worker.until) {
          if (worker.cleanSeat !== null) this.dirty.delete(worker.cleanSeat);
          worker.energy = Math.max(0, worker.energy - 3);
          this.releaseTask(worker);
          this.staffState(worker, 'idle', '片付け完了');
        }
        break;
      case 'resting':
        if (worker.path.length) this.walkAround(worker);
        worker.energy = Math.min(worker.maxEnergy, worker.energy + STEP_MS / 1000 * balance.restRecoveryPerSecond);
        break;
      case 'outburst':
        if (this.time >= worker.until) this.rest(worker);
        break;
    }
  }
}
