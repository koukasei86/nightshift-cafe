import * as Phaser from 'phaser';
import { direction, facings, position, type Facing, type Movement } from '../../core/npc/movement';
import { Cafe } from '../../core/simulation/cafe';
import { FixedClock } from '../../core/simulation/clock';
import { FOOD_COUNTER, furniture, recipes, seats, STOVE } from '../../data/cafe';
import { WORLD, project, tileCenter } from '../art/geometry';
import { paintPerson, PERSON } from '../art/people';
import { paintProp } from '../art/props';
import { doorTarget, openDoorTarget, paintDoor, paintRearWall, paintRoom } from '../art/room';

interface ActorSprite {
  image: Phaser.GameObjects.Image;
  bubble: Phaser.GameObjects.Text;
  inside: boolean;
  lastX: number;
  lastY: number;
  travel: number;
  sit: number;
}

const stoveTop = project(STOVE.x + .5, STOVE.y + .5, 35);
const counterTop = project(FOOD_COUNTER.x + .5, FOOD_COUNTER.y + .5, 32);
const dishTones: Record<string, number> = { stew: 0x82934e, toast: 0xbf8849, pie: 0x9c4b3c, curry: 0x64824b };

export class CafeScene extends Phaser.Scene {
  debug = false;
  selected: number | null = null;
  active = true;
  ready = false;
  private readonly clock = new FixedClock();
  private readonly sprites = new Map<number, ActorSprite>();
  private routes!: Phaser.GameObjects.Graphics;
  private effects!: Phaser.GameObjects.Graphics;
  private kitchenBadge!: Phaser.GameObjects.Text;
  private doorOpen!: Phaser.GameObjects.Image;
  private doorClosed!: Phaser.GameObjects.Image;
  private stockLabels: Phaser.GameObjects.Text[] = [];
  private meals: Phaser.GameObjects.Graphics[] = [];
  private view = { x: WORLD.width / 2, y: 250, scale: 1 };

  constructor(private readonly cafe: Cafe, private readonly refresh: () => void,
    private readonly select: (id: number | null) => void,
    private readonly inspect: (target: 'stove' | 'counter' | 'door') => void) {
    super('cafe');
  }

  create() {
    this.texture('room', WORLD.width, WORLD.height, paintRoom);
    this.add.image(0, 0, 'room').setScale(.5).setOrigin(0);
    this.texture('rear-wall', WORLD.width, WORLD.height, paintRearWall);
    this.texture('door-open', WORLD.width, WORLD.height, ctx => paintDoor(ctx, true));
    this.texture('door-closed', WORLD.width, WORLD.height, ctx => paintDoor(ctx, false));
    this.add.image(0, 0, 'rear-wall').setScale(.5).setOrigin(0).setDepth(4);
    this.doorOpen = this.add.image(0, 0, 'door-open').setScale(.5).setOrigin(0).setDepth(5);
    this.doorClosed = this.add.image(0, 0, 'door-closed').setScale(.5).setOrigin(0).setDepth(5).setVisible(false);

    furniture.forEach((prop, index) => {
      const key = `prop-${index}`;
      const center = tileCenter(prop);
      this.texture(key, 112, 135, ctx => {
        ctx.translate(56 - center.x, 101 - center.y);
        paintProp(ctx, prop);
      });
      this.add.image(center.x, center.y, key).setScale(.5).setOrigin(0.5, 101 / 135).setDepth(center.y - 1);
    });
    for (let style = -1; style < 6; style++) {
      for (let frame = 0; frame < 21; frame++) {
        for (const facing of facings) {
          this.texture(`person-${style}-${frame}-${facing}`, PERSON.width, PERSON.height,
            ctx => paintPerson(ctx, style, frame, facing));
          if (style < 0 || style >= 3) this.texture(`carry-${style}-${frame}-${facing}`, PERSON.width, PERSON.height,
            ctx => paintPerson(ctx, style, frame, facing, true));
        }
      }
    }
    this.routes = this.add.graphics().setDepth(1500);
    this.meals = seats.map(seat => this.add.graphics().setDepth(tileCenter(seat.table).y + .1));
    this.effects = this.add.graphics().setDepth(1499);
    this.kitchenBadge = this.add.text(stoveTop.x, stoveTop.y - 30, '', {
      fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '14px', color: '#fff2bd',
      backgroundColor: '#593326', padding: { x: 7, y: 4 },
    }).setOrigin(.5).setDepth(1510);
    this.stockLabels = Array.from({ length: recipes.length }, () => this.add.text(0, 0, '', {
      fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '11px', color: '#fff7e4', stroke: '#2c2520', strokeThickness: 3,
    }).setOrigin(.5, 0).setDepth(1510).setVisible(false));
    this.cameras.main.setBackgroundColor('#68773d');
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyCamera, this);
      this.ready = false;
    });
    this.ready = true;
    this.applyCamera();
  }

  update(_time: number, delta: number) {
    if (!this.active) return;
    this.clock.advance(delta, () => this.cafe.tick());
    const visible = new Set<number>();
    this.effects.clear();
    const doorInUse = this.cafe.doorInUse;
    this.doorOpen.setVisible(doorInUse);
    this.doorClosed.setVisible(!doorInUse);
    for (const staff of this.cafe.employees) {
      const symbol = staff.state === 'outburst' ? '!!' : staff.state === 'resting' ? 'Zz' :
        staff.energy <= staff.temper + 10 ? '!' : '';
      const guest = this.cafe.guests.find(item => item.id === staff.guestId);
      const table = staff.state === 'serving' && guest?.seat !== null && guest?.seat !== undefined ? seats[guest.seat].table : null;
      const serving = table ? Math.max(0, 1 - (staff.until - this.cafe.time) / 800) : 0;
      this.drawActor(staff.id, staff, staff.style < 0 ? -1 : staff.style + 3, false, symbol, Boolean(staff.carried),
        table ? direction(staff.tile, table) : staff.facing, serving);
      visible.add(staff.id);
    }
    for (const guest of this.cafe.guests) {
      const seated = guest.state === 'waiting' || guest.state === 'eating' || guest.state === 'paying';
      const bubble = guest.state === 'waiting' ? '…' : guest.state === 'paying' ? '$' : '';
      const table = seated && guest.seat !== null ? seats[guest.seat].table : null;
      this.drawActor(guest.id, guest, guest.style, seated, bubble, false, table ? direction(guest.tile, table) : guest.facing);
      visible.add(guest.id);
    }
    for (const [id, sprite] of this.sprites) {
      if (visible.has(id)) continue;
      sprite.image.destroy();
      sprite.bubble.destroy();
      this.sprites.delete(id);
    }
    const order = this.cafe.order;
    if (order?.status === 'cooking' || order?.status === 'ready') this.drawPot(order.status === 'cooking');
    const badge = order?.status === 'ready' ? '完成!' : order?.status === 'cooking'
      ? `${Math.ceil((order.until - this.cafe.time) / 1000)}s` : order ? '…' : '+';
    if (badge !== this.kitchenBadge.text) this.kitchenBadge.setText(badge);
    let plated = 0;
    for (const [index, recipe] of recipes.entries()) {
      const count = this.cafe.stockOf(recipe.id);
      const label = this.stockLabels[index];
      label.setVisible(count > 0);
      if (!count) continue;
      const x = counterTop.x - plated * 13;
      const y = counterTop.y + plated * 6;
      this.plate(x, y, dishTones[recipe.animation]);
      if (label.text !== String(count)) label.setText(String(count));
      label.setPosition(x, y + 2);
      plated++;
    }
    for (const [i, seat] of seats.entries()) {
      this.meals[i].clear();
      const diner = this.cafe.guests.find(guest => guest.seat === i && guest.meal);
      if (diner || this.cafe.dirty.has(i)) {
        const p = project(seat.table.x + .51, seat.table.y + .49, 32);
        this.plate(p.x, p.y, diner?.meal ? dishTones[diner.meal.animation] : 0x896446, this.meals[i]);
      }
    }
    this.routes.clear();
    if (this.debug) {
      for (const staff of this.cafe.employees) this.drawRoute(staff, 0x386c34);
      for (const guest of this.cafe.guests) this.drawRoute(guest, 0xffc98f);
    }
    this.refresh();
  }

  setActive(active: boolean) {
    this.active = active;
    this.clock.reset();
  }

  zoom(factor: number) {
    this.view.scale = Phaser.Math.Clamp(this.view.scale * factor, 0.8, 2.4);
    this.applyCamera();
  }

  resetView() {
    this.view = { x: WORLD.width / 2, y: 250, scale: 1 };
    this.applyCamera();
  }

  pan(dx: number, dy: number) {
    if (!this.ready) return;
    const zoom = this.cameras.main.zoom;
    this.view.x = Phaser.Math.Clamp(this.view.x - dx / zoom, 180, 710);
    this.view.y = Phaser.Math.Clamp(this.view.y - dy / zoom, 80, 510);
    this.applyCamera();
  }

  pick(x: number, y: number) {
    if (!this.ready) return;
    const point = this.cameras.main.getWorldPoint(x, y);
    const doorX = point.x - doorTarget.x;
    const leafX = point.x - openDoorTarget.x;
    const throughDoor = Math.abs(doorX) <= 24 && Math.abs(point.y - doorTarget.y - doorX * .5) <= 39;
    const onOpenLeaf = this.cafe.doorInUse && Math.abs(leafX) <= 17 &&
      Math.abs(point.y - openDoorTarget.y + leafX * .5) <= 38;
    if (throughDoor || onOpenLeaf) {
      this.inspect('door');
      return;
    }
    if (Math.abs(point.x - stoveTop.x) <= 25 && point.y >= stoveTop.y - 46 && point.y <= stoveTop.y + 11) {
      this.inspect('stove');
      return;
    }
    if (Math.abs(point.x - counterTop.x) <= 23 && Math.abs(point.y - counterTop.y) <= 13) {
      this.inspect('counter');
      return;
    }
    const hit = [...this.sprites.entries()]
      .filter(([, { image, inside }]) => inside && Math.abs(image.x - point.x) <= 23 && point.y >= image.y - 77 && point.y <= image.y + 5)
      .sort((a, b) => b[1].image.depth - a[1].image.depth)[0];
    this.select(hit?.[0] ?? null);
  }

  private applyCamera() {
    if (!this.ready) return;
    const zoom = Math.min(this.scale.width / 625, this.scale.height / 325);
    this.cameras.main.setZoom(zoom * this.view.scale).centerOn(this.view.x, this.view.y);
  }

  private texture(key: string, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is unavailable');
    ctx.scale(2, 2);
    paint(ctx);
    this.textures.addCanvas(key, canvas);
  }

  private drawActor(id: number, actor: Movement, style: number, seated: boolean, symbol: string,
    carrying = false, facing: Facing = actor.facing, serving = 0) {
    const key = `person-${style}-0-${facing}`;
    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = {
        image: this.add.image(0, 0, key).setScale(.5).setOrigin(0.5, PERSON.foot / PERSON.height),
        inside: true, lastX: NaN, lastY: NaN, travel: 0, sit: 0,
        bubble: this.add.text(0, 0, '', {
          fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '13px', color: '#fff4c6', backgroundColor: '#5b3526',
          padding: { x: 5, y: 1 },
        }).setOrigin(0.5, 1).setDepth(1510).setVisible(false),
      };
      this.sprites.set(id, sprite);
    }
    const tile = position(actor);
    const target = tileCenter(tile);
    if (serving) { target.x += (facing.endsWith('w') ? -9 : 9) * serving; target.y -= 4.5 * serving; }
    if (!Number.isFinite(sprite.lastX)) { sprite.lastX = target.x; sprite.lastY = target.y; }
    // Render interpolation smooths the 20 Hz simulation without changing game time.
    const blend = Math.min(1, this.game.loop.delta / 42);
    const p = { x: Phaser.Math.Linear(sprite.lastX, target.x, blend), y: Phaser.Math.Linear(sprite.lastY, target.y, blend) };
    const moved = Math.hypot(p.x - sprite.lastX, p.y - sprite.lastY);
    sprite.travel += moved;
    sprite.lastX = p.x; sprite.lastY = p.y;
    sprite.sit = Phaser.Math.Clamp(sprite.sit + (seated ? 1 : -1) * this.game.loop.delta / 320, 0, 1);
    const frame = serving > 0 ? 16 + Math.max(1, Math.ceil(serving * 4)) : sprite.sit > 0 ? 12 + Math.max(1, Math.ceil(sprite.sit * 4)) : moved > .05 ? 1 + Math.floor(sprite.travel / (47 * (style < 0 ? .87 : style % 3 === 2 ? 1.12 : .9)) * 12) % 12 : 0;
    const textureKey = `${carrying ? 'carry' : 'person'}-${style}-${frame}-${facing}`;
    sprite.inside = tile.y >= -.5;
    if (this.selected === id) {
      this.effects.lineStyle(1.5, 0x426f37, 0.9).fillStyle(0x9bd17c, .48);
      const tileCorners = [project(tile.x + .08, tile.y + .08), project(tile.x + .92, tile.y + .08),
        project(tile.x + .92, tile.y + .92), project(tile.x + .08, tile.y + .92)];
      this.effects.fillPoints(tileCorners.map(v => new Phaser.Math.Vector2(v.x, v.y)), true);
      this.effects.fillStyle(0xd45142).fillTriangle(p.x - 8, p.y - 84, p.x + 8, p.y - 84, p.x, p.y - 73);
    }
    sprite.image.setTexture(textureKey).setPosition(p.x, p.y).setDepth(sprite.inside ? p.y : 2 + p.y / 1000);
    if (symbol !== sprite.bubble.text) sprite.bubble.setText(symbol);
    sprite.bubble.setVisible(sprite.inside && Boolean(symbol)).setPosition(p.x + 20, p.y - 68);

  }

  private plate(x: number, y: number, food = 0x889244, graphics = this.effects) {
    graphics.fillStyle(0x50392b, .85).fillEllipse(x, y + 1, 17, 10);
    graphics.fillStyle(0xffedce).fillEllipse(x, y, 15, 8);
    graphics.fillStyle(food).fillEllipse(x, y, 9, 5);
  }

  private drawPot(steaming: boolean) {
    const pot = project(STOVE.x + .67, STOVE.y + .32, 39);
    this.effects.fillStyle(0x342f28).fillEllipse(pot.x, pot.y + 3, 23, 12);
    this.effects.fillStyle(0xa3a49a).fillRoundedRect(pot.x - 10, pot.y - 10, 20, 15, 4);
    this.effects.fillStyle(0xc7c4b3).fillEllipse(pot.x, pot.y - 9, 20, 10);
    this.effects.fillStyle(0x646545).fillEllipse(pot.x, pot.y - 9, 14, 6);
    if (!steaming) return;
    for (let i = 0; i < 4; i++) {
      const progress = ((this.cafe.time + i * 290) % 1150) / 1150;
      this.effects.fillStyle(0xfff7d8, (1 - progress) * 0.8);
      this.effects.fillCircle(pot.x + Math.sin(progress * 5 + i) * 6, pot.y - progress * 30, 2 + progress * 5);
    }
  }

  private drawRoute(actor: Movement, color: number) {
    if (!actor.path.length) return;
    const points = [position(actor), ...actor.path].map(tileCenter);
    this.routes.lineStyle(2, color, 0.85);
    this.routes.beginPath();
    this.routes.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) this.routes.lineTo(point.x, point.y);
    this.routes.strokePath();
    const end = points.at(-1)!;
    this.routes.strokeCircle(end.x, end.y, 6);
  }
}
