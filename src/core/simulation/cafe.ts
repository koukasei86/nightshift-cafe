import { archetypes, cafeGrid, CHEF_SPEED, COUNTER_WORK, DOOR, DOOR_OUTSIDE, EXIT, GUEST_SPEED,
  LEVEL_XP, recipes, seats, STAFF_LIMIT, STOVE_WORK, type Recipe } from '../../data/cafe';
import { position, route, walk, type Movement } from '../npc/movement';
import { findPath, tileKey, sameTile, type Grid, type Tile } from '../pathfinding/grid';
import { STEP_MS } from './clock';

export type GuestState = 'approach' | 'seating' | 'waiting' | 'eating' | 'paying' | 'leaving';
export type StaffState = 'idle' | 'toStove' | 'cooking' | 'toCounter' | 'toTable' | 'serving' |
  'toClean' | 'cleaning' | 'resting' | 'outburst';

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
  energy: number;
  maxEnergy: number;
  tip: number;
  temper: number;
  restRequested: boolean;
  lastAction: string;
}

interface Batch { recipe: Recipe; portions: number; expiresAt: number }
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
    restRequested: false, lastAction: '仕事を待つ' };
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
  order: KitchenOrder | null = null;
  private batches: Batch[] = [];
  private nextId = 1;
  private spawnAt = 1000;
  private seed: number;

  constructor(private readonly grid: Grid = cafeGrid, seed = 2035) {
    this.seed = seed >>> 0;
  }

  get staff() { return this.employees[0]; }
  get level() { return 1 + Math.floor(this.xp / LEVEL_XP); }
  get stock() { return this.batches.reduce((total, batch) => total + batch.portions, 0); }
  get doorInUse() {
    return this.open || this.guests.some(guest => {
      if (guest.state !== 'leaving') return false;
      const p = position(guest);
      return Math.abs(p.x - DOOR.x) < .45 && Math.abs(p.y + .5) < .49;
    });
  }

  stockOf(id: string) {
    return this.batches.reduce((total, batch) => total + (batch.recipe.id === id ? batch.portions : 0), 0);
  }

  cookingIssue(recipe: Recipe, cookId?: number) {
    if (recipe.requiredLevel > this.level) return `Lv.${recipe.requiredLevel}で解放`;
    if (this.order) return 'コンロを使用中';
    if (this.coins < recipe.cost) return '材料費が足りません';
    if (!this.eligibleCooks(recipe, cookId).length) return '体力のある勤務中の従業員が必要です';
    return '';
  }

  startCooking(recipeId: string, cookId?: number) {
    const recipe = recipes.find(item => item.id === recipeId);
    if (!recipe) return false;
    const issue = this.cookingIssue(recipe, cookId);
    if (issue) { this.notice = issue; return false; }
    if (!this.eligibleCooks(recipe, cookId).some(worker => findPath(this.grid, worker.tile, STOVE_WORK))) {
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
      worker.state !== 'resting' && worker.state !== 'outburst' &&
      worker.energy >= recipe.energy && worker.energy > worker.temper);
  }

  private assignCooking() {
    const order = this.order;
    if (order?.status !== 'queued') return;
    const cooks = this.eligibleCooks(order.recipe, order.requestedId);
    const cook = cooks.find(worker => worker.state === 'idle' && this.routeAround(worker, STOVE_WORK));
    if (cook) {
      order.cookId = cook.id;
      order.status = 'walking';
      this.staffState(cook, 'toStove', 'コンロへ移動');
      this.notice = `${cook.name}が調理に向かいます`;
    } else if (cooks.every(worker => worker.state === 'idle')) {
      this.coins += order.recipe.cost;
      this.order = null;
      this.notice = '調理を引き受けられる従業員がいないため材料費を返しました';
    }
  }

  collectCooking() {
    const order = this.order;
    if (!order || order.status !== 'ready') return false;
    this.batches.push({
      recipe: order.recipe, portions: order.recipe.portions, expiresAt: this.time + order.recipe.keepMs,
    });
    this.order = null;
    this.notice = `${order.recipe.name}をカウンターへ移しました（${order.recipe.portions}食）`;
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
    if (guest.seat !== null && guest.meal) this.dirty.add(guest.seat);
    this.employees.push(recruit);
    this.routeAround(recruit, { x: 1, y: this.employees.length === 2 ? 1 : 5 });
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
    this.batches = this.batches.filter(batch => batch.expiresAt > this.time);
    if (this.order?.status === 'ready' && this.time >= this.order.until) {
      this.notice = `${this.order.recipe.name}が焦げました`;
      this.order = null;
    }
    if (this.time >= this.spawnAt) {
      this.spawnAt = this.time + Math.round(7300 - this.rating * 570);
      if (this.open && this.guests.length < 9) this.spawn();
    }
    this.guests = this.guests.filter(guest => this.updateGuest(guest));
    this.assignCooking();
    for (const worker of this.employees) this.updateStaff(worker);
  }

  private routeAround(actor: Movement, target: Tile) {
    const blocked = new Set(this.grid.blocked);
    for (const seat of seats) if (!sameTile(seat.position, target) && !sameTile(seat.position, actor.tile))
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
      for (const seat of seats) if (!sameTile(seat.position, target)) blocked.add(tileKey(seat.position, this.grid.width));
      for (const other of others) {
        blocked.add(tileKey(other.tile, this.grid.width));
        if (other.path.length && other.fraction > 0) blocked.add(tileKey(other.path[0], this.grid.width));
      }
      if (blocked.has(tileKey(actor.path[0], this.grid.width))) {
        blocked.delete(tileKey(actor.tile, this.grid.width));
        const detour = findPath({ ...this.grid, blocked }, actor.tile, target);
        if (!detour) return false;
        actor.path = detour;
      }
    }
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
      since: this.time, tile: { ...EXIT }, path: [], fraction: 0, facing: 'nw', speed: GUEST_SPEED, meal: null,
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
        const seat = seats.findIndex((spot, index) => !this.dirty.has(index) &&
          !this.guests.some(other => other.seat === index) &&
          findPath(this.grid, guest.tile, spot.position) !== null);
        if (seat < 0) return this.leave(guest, '空いている席がないため退店');
        this.routeAround(guest, seats[seat].position);
        guest.seat = seat;
        this.guestState(guest, 'seating', '予約した席へ移動');
        break;
      }
      case 'seating':
        if (this.walkAround(guest)) this.guestState(guest, 'waiting', '着席して料理を待つ');
        break;
      case 'waiting':
        if (elapsed >= 31000) {
          this.adjustRating(-0.18);
          return this.leave(guest, '待ち時間を超えて退店');
        }
        break;
      case 'eating':
        if (elapsed >= 3400) this.guestState(guest, 'paying', '食事を終えて会計');
        break;
      case 'paying':
        if (elapsed >= 800 && guest.meal) {
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
    if (worker.carried && worker.carried.expiresAt > this.time) worker.carried.portions++;
    worker.carried = null;
    worker.guestId = null;
    worker.cleanSeat = null;
    worker.path = [];
    worker.fraction = 0;
  }

  private rest(worker: Staff) {
    this.releaseTask(worker);
    worker.restRequested = false;
    this.staffState(worker, 'resting', '休憩中・体力回復');
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
      worker.until = this.time + 1600;
      this.staffState(worker, 'outburst', '疲労で客を襲った');
      this.notice = `${worker.name}が客を襲いました！ 評価ダウン`;
      return;
    }

    if (this.stock > 0) {
      const waiting = this.guests.filter(guest => guest.state === 'waiting' && guest.seat !== null &&
        !this.employees.some(item => item.guestId === guest.id))
        .sort((a, b) => a.since - b.since || a.id - b.id);
      const guest = waiting.find(item => findPath(this.grid, COUNTER_WORK, seats[item.seat!].service));
      if (guest && this.routeAround(worker, COUNTER_WORK)) {
        worker.guestId = guest.id;
        this.staffState(worker, 'toCounter', 'カウンターへ料理を取りに行く');
        return;
      }
    }
    for (const seat of this.dirty) {
      if (this.employees.some(item => item.cleanSeat === seat)) continue;
      if (!this.routeAround(worker, seats[seat].service)) continue;
      worker.cleanSeat = seat;
      this.staffState(worker, 'toClean', '皿を片付けに行く');
      return;
    }
  }

  private updateStaff(worker: Staff) {
    const order = this.order?.cookId === worker.id ? this.order : null;
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
          order.until = this.time + 22000;
          this.notice = `${order.recipe.name}が完成！ コンロをタップして取り出す`;
          if (worker.restRequested) this.rest(worker);
          else this.staffState(worker, 'idle', '調理完了');
        }
        break;
      case 'toCounter':
        if (this.walkAround(worker)) {
          const guest = this.guests.find(item => item.id === worker.guestId && item.state === 'waiting');
          const batch = this.batches.find(item => item.portions > 0);
          if (guest && guest.seat !== null && batch &&
            this.routeAround(worker, seats[guest.seat].service)) {
            batch.portions--;
            worker.carried = batch;
            this.staffState(worker, 'toTable', '料理を持って席へ向かう');
          } else {
            this.releaseTask(worker);
            this.staffState(worker, 'idle', '配膳を取り消し');
          }
        }
        break;
      case 'toTable':
        if (this.walkAround(worker)) {
          worker.until = this.time + 800;
          this.staffState(worker, 'serving', '料理をテーブルに提供');
        }
        break;
      case 'serving':
        if (this.time >= worker.until) {
          const guest = this.guests.find(item => item.id === worker.guestId && item.state === 'waiting');
          if (guest && worker.carried) {
            guest.meal = worker.carried.recipe;
            guest.tip = this.time - guest.since <= 14000 ? worker.tip : 0;
            worker.carried = null;
            worker.energy = Math.max(0, worker.energy - 7);
            this.guestState(guest, 'eating', '配膳された料理を食べる');
          }
          this.releaseTask(worker);
          this.staffState(worker, 'idle', guest ? '配膳完了' : '配膳を取り消し');
          this.routeAround(worker, { x: 1, y: [3, 1, 5][this.employees.indexOf(worker)] });
        }
        break;
      case 'toClean':
        if (this.walkAround(worker)) {
          worker.until = this.time + 700;
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
        worker.energy = Math.min(worker.maxEnergy, worker.energy + STEP_MS * 0.0045);
        break;
      case 'outburst':
        if (this.time >= worker.until) this.rest(worker);
        break;
    }
  }
}
