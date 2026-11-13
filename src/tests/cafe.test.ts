import {balance} from '../data/balance';
import { position } from '../core/npc/movement';
import { describe, expect, it } from 'vitest';
import { findPath, sameTile, tileKey } from '../core/pathfinding/grid';
import { Cafe, type GuestState, type StaffState } from '../core/simulation/cafe';
import { FixedClock, STEP_MS } from '../core/simulation/clock';
import { archetypes, cafeGrid, CHEF_SPEED, DOOR, DOOR_OUTSIDE, EXIT, GUEST_SPEED, recipes, seats, STOVE_WORK } from '../data/cafe';

const recipe = recipes[0];
const ticks = (cafe: Cafe, ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) cafe.tick();
};

const until=(c:Cafe,p:()=>boolean,ms=180000)=>{for(let i=0;i<ms/STEP_MS&&!p();i++)c.tick();expect(p()).toBe(true);};

describe('店舗の営業', () => {
  it('入口から着席し、調理、配膳、食事、会計、退店まで進む', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    expect(cafe.startCooking(recipe.id)).toBe(true);
    expect(cafe.coins).toBe(120 - recipe.cost);
    expect(cafe.startCooking(recipe.id)).toBe(false);
    const guestStates = new Set<GuestState>();
    const staffStates = new Set<StaffState>();
    for (let i = 0; i < 2000; i++) {
      cafe.tick();
      if (cafe.order?.status === 'ready') cafe.collectCooking();
      staffStates.add(cafe.staff.state);
      for (const guest of cafe.guests) {
        if (guest.id === 1) guestStates.add(guest.state);
      }
    }
    expect([...guestStates]).toEqual(['approach', 'seating', 'waiting', 'eating', 'paying', 'leaving']);
    expect([...staffStates]).toEqual(expect.arrayContaining(['toStove', 'cooking', 'idle', 'toCounter', 'toTable', 'serving', 'cleaning']));
    expect(cafe.guests.some(guest => guest.id === 1),JSON.stringify(cafe.guests)).toBe(false);
    expect(cafe.served).toBe(recipe.portions);
    expect(cafe.sales).toBe(recipe.portions * (recipe.price + 2));
    expect(cafe.stock).toBe(0);
    expect(cafe.coins).toBe(120 - recipe.cost + cafe.sales);
  });

  it('受付終了後は新しい客が出現せず、再開すると来店する', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    cafe.toggleOpen();
    ticks(cafe, 10000);
    expect(cafe.guests).toHaveLength(0);
    cafe.toggleOpen();
    until(cafe,()=>cafe.guests.some(g=>g.state==='waiting'));
    expect(cafe.guests.some(guest => guest.state === 'waiting')).toBe(true);
  });

  it('満席でも客は退店し、着席待ちや経路探索で滞留しない', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    let turnedAway = false;
    for (let i = 0; i < 24000; i++) {
      cafe.tick();
      const assigned = cafe.guests.flatMap(guest => guest.seat === null ? [] : [guest.seat]);
      if (new Set(assigned).size !== assigned.length || assigned.length > seats.length) {
        throw new Error('席の予約が重複しています');
      }
      if (cafe.guests.length > 6 || cafe.guests.some(guest => guest.state === 'leaving' && cafe.time - guest.since > 20000)) {
        throw new Error('退店中の客が滞留しています');
      }
      turnedAway ||= cafe.guests.some(guest => guest.lastAction === '空いている席がないため退店');
    }
    expect(turnedAway).toBe(true);
    expect(cafe.served).toBe(0);
  });

  it('入口が封鎖されていてもNPCが入口に残らない', () => {
    const cafe = new Cafe({
      ...cafeGrid, blocked: new Set([...cafeGrid.blocked, tileKey(DOOR, cafeGrid.width)]),
    }, 2035, 'playtest');
    ticks(cafe, 120000);
    expect(cafe.guests).toHaveLength(0);
  });

  it('扉を閉めると通過前の客は引き返し、通過した客は引き続き着席する', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    ticks(cafe, 1300);
    const outside = cafe.guests[0];
    expect(outside.tile.y).toBeLessThan(0);
    cafe.toggleOpen();
    expect(outside.state).toBe('leaving');
    ticks(cafe, 3200);
    expect(cafe.guests).toHaveLength(0);
    cafe.toggleOpen();
    until(cafe,()=>cafe.guests.some(g=>g.tile.y>=0));
    const inside = cafe.guests[0];
    expect(inside.tile.y).toBeGreaterThanOrEqual(0);
    cafe.toggleOpen();
    for(let i=0;i<200 && inside.state!=='waiting';i++) cafe.tick();
    expect(inside.state).toBe('waiting');
    expect(cafe.doorInUse).toBe(false);
  });

  it('閉店後に残った客は右奥の入口を通って退店できる', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    until(cafe,()=>cafe.guests.some(g=>g.state==='waiting'));
    const guest = cafe.guests[0];
    cafe.toggleOpen();
    let openedForExit = false;
    for (let i = 0; i < 3600; i++) {
      cafe.tick();
      openedForExit ||= cafe.doorInUse;
    }
    expect(openedForExit).toBe(true);
    expect(cafe.guests).not.toContain(guest);
    expect(cafe.doorInUse).toBe(false);
    expect(cafe.open).toBe(false);
  });

  it('来客とシェフはv0.6の約半分の速度で、客には個体差がある', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    ticks(cafe, 1000);
    expect(cafe.guests[0].speed).toBeCloseTo(GUEST_SPEED*Math.min(1.15,archetypes[cafe.guests[0].style].speed));
    expect(GUEST_SPEED).toBeLessThanOrEqual(1);
    expect(cafe.staff.speed).toBe(CHEF_SPEED);
    expect(CHEF_SPEED).toBeLessThanOrEqual(1.1);
  });

  it('コンロ前が封鎖されている場合は料金を取らない', () => {
    const cafe = new Cafe({
      ...cafeGrid, blocked: new Set([...cafeGrid.blocked, tileKey(STOVE_WORK, cafeGrid.width)]),
    });
    expect(cafe.startCooking(recipe.id)).toBe(false);
    expect(cafe.coins).toBe(120);
    expect(cafe.order).toBeNull();
  });

  it('完成品は期限が来ると在庫から外れる', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    cafe.toggleOpen();
    cafe.startCooking(recipe.id);
    ticks(cafe, 8000);
    expect(cafe.stock).toBe(0);
    expect(cafe.collectCooking()).toBe(true);
    expect(cafe.collectCooking()).toBe(false);
    expect(cafe.stock).toBe(recipe.portions);
    ticks(cafe, recipe.keepMs);
    expect(cafe.stock).toBe(0);
  });

  it('取り出さずに放置した料理は焦げる', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    cafe.startCooking(recipe.id);
    cafe.open=false;until(cafe,()=>cafe.order?.status==='ready');ticks(cafe,balance.burnDelay);
    expect(cafe.order).toBeNull();
    expect(cafe.stock).toBe(0);
    expect(cafe.notice).toContain('焦げました');
  });

  it('感染した客は同じ外見の種類を持つ従業員となり、配膳や休憩ができる', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    until(cafe,()=>cafe.guests.some(g=>g.tile.y>=0));
    const guest = cafe.guests[0];
    expect(cafe.infect(guest.id)).toBe(true);
    const worker = cafe.employees[1];
    expect(worker.style).toBe(guest.style);
    expect(cafe.toxin).toBeLessThan(3);
    expect(cafe.infect(guest.id)).toBe(false);
    expect(cafe.guests.some(item => item.id === worker.id)).toBe(false);
    expect(cafe.startCooking(recipe.id, worker.id)).toBe(true);
    cafe.toggleRest(worker.id);
    until(cafe,()=>worker.state==='resting');
    expect(worker.state).toBe('resting');
    ticks(cafe, 2000);
    expect(worker.energy).toBeGreaterThan(worker.maxEnergy - recipe.energy);
    expect(cafe.toggleRest(worker.id)).toBe(true);
    expect(worker.state).toBe('idle');
  });

  it('休憩を予約すると、低体力による暴走と評価低下を防げる', () => {
    function shift(scheduleRest: boolean) {
      const cafe = new Cafe(cafeGrid, 2035, 'playtest');
      for(let i=0;i<250 && !cafe.guests.some(guest=>guest.state==='waiting');i++) cafe.tick();
      cafe.staff.energy = cafe.staff.temper + 1;
      expect(cafe.startCooking(recipe.id)).toBe(true);
      if (scheduleRest) cafe.toggleRest(cafe.staff.id);
      ticks(cafe, 8200);
      return cafe;
    }
    const exhausted = shift(false), rested = shift(true);
    expect(exhausted.outbursts).toBe(1);
    expect(exhausted.guests.some(guest => guest.lastAction.includes('襲われて'))).toBe(true);
    expect(rested.outbursts).toBe(0);
    expect(rested.rating).toBeGreaterThan(exhausted.rating);
  });

  it('同じ来店条件でもレシピを変えると売上と体力が変わる', () => {
    function shift(recipeId: string) {
      const cafe = new Cafe(cafeGrid, 2035, 'playtest');
      let energyAfterCooking = cafe.staff.energy;
      expect(cafe.startCooking(recipeId)).toBe(true);
      for (let i = 0; i < 3600; i++) {
        cafe.tick();
        if (cafe.order?.status === 'ready') {
          energyAfterCooking = cafe.staff.energy;
          cafe.collectCooking();
        }
      }
      return { cafe, energyAfterCooking };
    }
    const quick = shift(recipe.id), large = shift(recipes[1].id);
    expect(large.cafe.served).toBeGreaterThan(quick.cafe.served);
    expect(large.cafe.sales).toBeGreaterThan(quick.cafe.sales);
    expect(large.energyAfterCooking).toBeLessThan(quick.energyAfterCooking);
  });

  it('複数人で残り1食を配膳しても在庫が二重に消費されない', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    until(cafe,()=>cafe.guests.some(g=>g.state==='waiting'));
    cafe.infect(cafe.guests[0].id);
    cafe.startCooking(recipe.id);
    ticks(cafe, 19500);
    cafe.collectCooking();
    ticks(cafe, 100000);
    expect(cafe.stock,JSON.stringify({staff:cafe.employees,guests:cafe.guests})).toBe(0);
    expect(cafe.served).toBe(recipe.portions);
  });

  it('配膳中に頼んだ次の調理は予約され、手が空くと始まる', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    cafe.startCooking(recipe.id);
    ticks(cafe, 8000);
    cafe.collectCooking();
    until(cafe,()=>cafe.staff.state==='toCounter');
    expect(cafe.staff.state).toBe('toCounter');
    expect(cafe.startCooking(recipes[1].id)).toBe(true);
    expect(cafe.order?.status).toBe('queued');
    until(cafe,()=>cafe.order?.status==='cooking');
    expect(cafe.order?.status).toBe('cooking');
  });
});

describe('経路と時間', () => {
  it('家具を避け、入口を経由して席まで進む', () => {
    const route = findPath(cafeGrid, EXIT, seats[0].position);
    expect(route).not.toBeNull();
    expect(route!.some(tile => sameTile(tile, DOOR))).toBe(true);
    expect(route!.some(tile => sameTile(tile, DOOR_OUTSIDE))).toBe(true);
    expect(route!.every(tile => !cafeGrid.blocked.has(tileKey(tile, cafeGrid.width)))).toBe(true);
    expect(route!.at(-1)).toEqual(seats[0].position);
    expect(findPath(cafeGrid, EXIT, seats[0].position, 1)).toBeNull();
  });

  it('30fps相当と60fps相当で同じ調理進行になる', () => {
    const simulate = (frames: number) => {
      const cafe = new Cafe(cafeGrid, 2035, 'playtest');
      const clock = new FixedClock();
      cafe.startCooking(recipe.id);
      for (let i = 0; i < frames; i++) clock.advance(12010 / frames, () => cafe.tick());
      return { time: cafe.time, state: cafe.staff.state, guests: cafe.guests, stock: cafe.stock };
    };
    expect(simulate(360)).toEqual(simulate(720));
    expect(simulate(360).time).toBe(12000);
  });

  it('長時間停止から復帰しても一度の更新回数を制限する', () => {
    const clock = new FixedClock();
    let count = 0;
    clock.advance(300000, () => count++);
    expect(count).toBe(10);
    clock.advance(NaN, () => count++);
    expect(count).toBe(10);
  });
});


describe('歩行と人物の間隔', () => {
  it('営業中に人物の足元が同じ位置を通り抜けず、着席客のマスを避ける', () => {
    const cafe = new Cafe(cafeGrid, 2035, 'playtest');
    for(let i=0;i<2400;i++) {
      if(!cafe.order && cafe.stock===0 && cafe.staff.energy>30) cafe.startCooking(recipe.id);
      cafe.tick();
      if(cafe.order?.status==='ready') cafe.collectCooking();
      const actors=[...cafe.guests,...cafe.employees];
      for(let a=0;a<actors.length;a++) for(let b=a+1;b<actors.length;b++) {
        const p=position(actors[a]),q=position(actors[b]);
        expect(Math.hypot(p.x-q.x,p.y-q.y), `overlap ${JSON.stringify([actors[a],actors[b]])} at ${cafe.time}`).toBeGreaterThan(.5);
      }
    }
    expect(cafe.served).toBeGreaterThan(0);
  });
});
