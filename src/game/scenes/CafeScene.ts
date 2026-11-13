import type { SoundId } from '../../audio/effects';
import { characterWidth, ZOMBIE_STYLE_OFFSET } from '../../data/characters';
import { paintFood } from '../art/food';
import { type Furniture } from '../../core/simulation/layout';
import * as Phaser from 'phaser';
import { direction, facings, position, type Facing, type Movement } from '../../core/npc/movement';
import { Cafe } from '../../core/simulation/cafe';
import { FixedClock } from '../../core/simulation/clock';
import { counters, FOOD_COUNTER, furniture, recipes, seats, STOVE } from '../../data/cafe';
import { WORLD, project, tileCenter, rotatedProjection, ORIGIN, HALF_W, HALF_H } from '../art/geometry';
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
  onTick?:()=>void;
  feedback?:(id:SoundId)=>unknown;
  debug = false;
  shopping = false;
  editItems: Furniture[] | null=null;
  editSelected: string|null=null;
  editorAction?: (action:'select'|'tap'|'move',id:string,tile?:{x:number;y:number})=>void;
  private editorGrid!: Phaser.GameObjects.Graphics;
  private layoutSignature='';
  private propImages: Phaser.GameObjects.Image[]=[];
  private dishImages: Phaser.GameObjects.Image[]=[];
  private dishesUsed=0;
  private drawnFurniture = 0;
  private stoveBadges: Phaser.GameObjects.Text[] = [];
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
    private readonly inspect: (target: 'stove' | 'counter' | 'door', counterId?: string) => void) {
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

    this.editorGrid=this.add.graphics().setDepth(3);
    this.routes = this.add.graphics().setDepth(1500);
    this.meals = this.cafe.seats.map(seat => this.add.graphics().setDepth(tileCenter(seat.table).y + .1));
    this.effects = this.add.graphics().setDepth(1499);
    this.kitchenBadge = this.add.text(stoveTop.x, stoveTop.y - 30, '', {
      fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '14px', color: '#fff2bd',
      backgroundColor: '#593326', padding: { x: 7, y: 4 },
    }).setOrigin(.5).setDepth(1510);
    this.stockLabels = Array.from({ length: recipes.length * counters.length }, () => this.add.text(0, 0, '', {
      fontFamily: 'sans-serif', fontStyle: 'bold', fontSize: '11px', color: '#fff7e4', stroke: '#2c2520', strokeThickness: 3,
    }).setOrigin(.5, 0).setDepth(1510).setVisible(false));
    this.cameras.main.setBackgroundColor('#68773d');
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.applyCamera, this);
      this.ready = false;
    });
    this.syncFurniture();
    this.kitchenBadge.setVisible(false);
    this.ready = true;
    this.applyCamera();
  }

  private syncFurniture() {
    const items=this.editItems??this.cafe.furniture;
    const signature=JSON.stringify(items);
    if(signature!==this.layoutSignature) {
      this.propImages.forEach(i=>i.destroy());this.propImages=[];
      items.forEach((prop,index)=>{
        const key=`prop-${index}`,center=tileCenter(prop);
        if(this.textures.exists(key))this.textures.remove(key);
        this.texture(key,112,150,ctx=>{ctx.translate(56-center.x,116-center.y);rotatedProjection(prop,prop.rotation+(prop.kind==='stove'?3:0),()=>paintProp(ctx,prop));});
        this.propImages.push(this.add.image(center.x,center.y,key).setScale(.5).setOrigin(.5,116/150).setDepth(center.y-1));
      });
      this.layoutSignature=signature;
    }
    while(this.meals.length<this.cafe.seats.length) this.meals.push(this.add.graphics().setDepth(tileCenter(this.cafe.seats[this.meals.length].table).y+.1));
    while(this.stoveBadges.length<this.cafe.stoves.length) {
      const stove=this.cafe.stoves[this.stoveBadges.length], top=project(stove.tile.x+.5,stove.tile.y+.5,35);
      this.stoveBadges.push(this.add.text(top.x,top.y-30,'+', {fontFamily:'sans-serif',fontSize:'13px',color:'#fff2bd',backgroundColor:'#593326',padding:{x:5,y:3}}).setOrigin(.5).setDepth(1510));
    }
  }

  update(_time: number, delta: number) {
    this.syncFurniture();
    this.editorGrid.clear();
    if(this.editItems) {
      this.effects.clear();this.routes.clear();this.meals.forEach(m=>m.clear());this.dishImages.forEach(i=>i.setVisible(false));this.stoveBadges.forEach(b=>b.setVisible(false));
      this.sprites.forEach(s=>{s.image.setVisible(false);s.bubble.setVisible(false);});
      for(let y=0;y<7;y++)for(let x=0;x<9;x++) {
        const points=[project(x,y),project(x+1,y),project(x+1,y+1),project(x,y+1)].map(p=>new Phaser.Math.Vector2(p.x,p.y));
        this.editorGrid.lineStyle(1,0xfff0bd,.6).strokePoints(points,true);
      }
      const selected=this.editItems.find(f=>f.id===this.editSelected);
      if(selected){const p=tileCenter(selected);this.routes.lineStyle(3,0x81d5a0,1).strokeEllipse(p.x,p.y,78,38);const d=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}][selected.rotation];const q=tileCenter({x:selected.x+d.x*.75,y:selected.y+d.y*.75});this.routes.lineBetween(p.x,p.y,q.x,q.y).fillStyle(0x81d5a0).fillCircle(q.x,q.y,5);}
      return;
    }
    if (!this.active || this.shopping) return;
    this.sprites.forEach(s=>s.image.setVisible(true));this.stoveBadges.forEach(b=>b.setVisible(true));
    this.dishImages.forEach(i=>i.setVisible(false));this.dishesUsed=0;
    this.clock.advance(delta, () => {this.cafe.tick();this.onTick?.();});
    const visible = new Set<number>();
    this.effects.clear();
    const doorInUse = this.cafe.doorInUse;
    this.doorOpen.setVisible(doorInUse);
    this.doorClosed.setVisible(!doorInUse);
    for (const staff of this.cafe.employees) {
      const symbol = staff.state === 'outburst' ? '!!' : staff.state === 'resting' ? 'Zz' :
        staff.energy <= staff.temper + 10 ? '!' : '';
      const guest = this.cafe.guests.find(item => item.id === staff.guestId);
      const table = staff.state === 'serving' && guest?.seat !== null && guest?.seat !== undefined ? this.cafe.seats[guest.seat].table : null;
      const serving = table ? Math.max(0, 1 - (staff.until - this.cafe.time) / this.cafe.timing.serving) : 0;
      this.drawActor(staff.id, staff, staff.style < 0 ? -1 : staff.style + ZOMBIE_STYLE_OFFSET, false, symbol, Boolean(staff.carried),
        table ? direction(staff.tile, table) : staff.facing, serving, staff.carried?.recipe.animation,
        staff.state==='cooking' ? 21+Math.floor(this.cafe.time/180)%4 : staff.state==='cleaning' ? 25+Math.floor(this.cafe.time/150)%4 : staff.state==='resting' ? 29 : staff.state==='outburst' ? 30 : undefined);
      visible.add(staff.id);
    }
    for (const guest of this.cafe.guests) {
      const seated = guest.state === 'waiting' || guest.state === 'eating' || guest.state === 'paying';
      const bubble = guest.state === 'waiting' ? '…' : guest.state === 'paying' ? '$' : '';
      const table = seated && guest.seat !== null ? this.cafe.seats[guest.seat].table : null;
      this.drawActor(guest.id, guest, guest.style, seated, bubble, false, table ? direction(guest.tile, table) : guest.facing);
      visible.add(guest.id);
    }
    for (const [id, sprite] of this.sprites) {
      if (visible.has(id)) continue;
      sprite.image.destroy();
      sprite.bubble.destroy();
      this.sprites.delete(id);
    }
    for(const [i,stove] of this.cafe.stoves.entries()) {
      const order=this.cafe.orders.get(stove.id);
      if(order?.status==='cooking' || order?.status==='ready') this.drawPot(order.status==='cooking',stove.tile);
      this.stoveBadges[i].setPosition(project(stove.tile.x+.5,stove.tile.y+.5,35).x,project(stove.tile.x+.5,stove.tile.y+.5,35).y-30).setText(order?.status==='ready'?'完成!':order?.status==='cooking'?`${Math.ceil((order.until-this.cafe.time)/1000)}s`:order?'…':'+');
    }
    this.stockLabels.forEach(label=>label.setVisible(false));
    for(const [ci,counter] of this.cafe.counters.entries()) {
      const top=project(counter.tile.x+.5,counter.tile.y+.5,32);
      let plated=0;
      for(const [ri,recipe] of recipes.entries()) {
        const count=this.cafe.batches.filter(b=>b.counterId===counter.id && b.recipe.id===recipe.id).reduce((n,b)=>n+b.portions+b.reserved,0);
        if(!count) continue;
        const x=top.x-plated*13,y=top.y+plated*6;
        this.plate(x,y,recipe.animation);
        this.stockLabels[ci*recipes.length+ri].setText(String(count)).setPosition(x,y+2).setVisible(true);plated++;
      }
    }
    for (const [i, seat] of this.cafe.seats.entries()) {
      this.meals[i].clear();this.meals[i].setDepth(tileCenter(seat.table).y+.1);
      const diner = this.cafe.guests.find(guest => guest.seat === i && guest.meal);
      if (diner || this.cafe.dirty.has(i)) {
        const p = project(seat.table.x + .51, seat.table.y + .49, 32);
        this.plate(p.x, p.y, diner?.meal ? diner.meal.animation : 'dirty', this.meals[i]);
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

  editorHit(x:number,y:number) {
    if(!this.ready||!this.editItems)return null;
    const p=this.cameras.main.getWorldPoint(x,y);
    const items=this.editItems.map((f,i)=>({f,i})).sort((a,b)=>(b.f.x+b.f.y)-(a.f.x+a.f.y));
    for(const {f,i} of items){
      const center=tileCenter(f),px=Math.floor((p.x-center.x+56)*2),py=Math.floor((p.y-center.y+116)*2);
      if(px<0||px>=224||py<0||py>=300)continue;
      const canvas=this.textures.get(`prop-${i}`).getSourceImage() as HTMLCanvasElement;
      if(canvas.getContext('2d')!.getImageData(px,py,1,1).data[3]>210)return f.id;
    }
    return null;
  }
  editorDelta(x:number,y:number,originX:number,originY:number) {
    const p=this.cameras.main.getWorldPoint(x,y),o=this.cameras.main.getWorldPoint(originX,originY);
    const dx=(p.x-o.x)/HALF_W,dy=(p.y-o.y)/HALF_H;
    return {x:Math.round((dx+dy)/2),y:Math.round((dy-dx)/2)};
  }
  editorDropValid(id:string) {
    const f=this.editItems?.find(f=>f.id===id);if(!f)return false;
    return f.x>=0&&f.x<9&&f.y>=0&&f.y<7&&!(f.y===0&&(f.x===6||f.x===7))&&!this.editItems!.some(o=>o.id!==id&&o.x===f.x&&o.y===f.y);
  }

  pick(x: number, y: number) {
    if (!this.ready || this.shopping) return;
    const point = this.cameras.main.getWorldPoint(x, y);
    if(this.editItems){const id=this.editorHit(x,y);if(id)this.editorAction?.('tap',id);return;}
    const doorX = point.x - doorTarget.x;
    const leafX = point.x - openDoorTarget.x;
    const throughDoor = Math.abs(doorX) <= 24 && Math.abs(point.y - doorTarget.y - doorX * .5) <= 39;
    const onOpenLeaf = this.cafe.doorInUse && Math.abs(leafX) <= 17 &&
      Math.abs(point.y - openDoorTarget.y + leafX * .5) <= 38;
    if (throughDoor || onOpenLeaf) {
      this.inspect('door');
      return;
    }
    for(const stove of this.cafe.stoves) {
      const top=project(stove.tile.x+.5,stove.tile.y+.5,35);
      if(Math.abs(point.x-top.x)<=25 && point.y>=top.y-46 && point.y<=top.y+11) {
        this.inspect('stove',stove.id);return;
      }
    }
    const fridge=this.cafe.furniture.find(f=>f.kind==='fridge');
    if(fridge){const p=tileCenter(fridge);if(Math.abs(point.x-p.x)<29 && point.y>=p.y-90 && point.y<=p.y){
      const frontActor=[...this.sprites.entries()].filter(([,s])=>s.inside&&s.image.depth>p.y&&Math.abs(s.image.x-point.x)<=23&&point.y>=s.image.y-77&&point.y<=s.image.y+5).sort((a,b)=>b[1].image.depth-a[1].image.depth)[0];
      if(frontActor)this.select(frontActor[0]);else this.inspect('counter');return;
    }}
    for(const counter of this.cafe.counters) {
      const top=project(counter.tile.x+.5,counter.tile.y+.5,32);
      if(Math.abs(point.x-top.x)<=25 && Math.abs(point.y-top.y)<=17) { this.inspect('counter',counter.id); return; }
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
    carrying = false, facing: Facing = actor.facing, serving = 0, foodId = 'stew', actionFrame?: number) {
    const key = `person-${style}-0-${facing}`;
    if(!this.textures.exists(key)) this.texture(key,PERSON.width,PERSON.height,ctx=>paintPerson(ctx,style,0,facing));
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
    sprite.sit = Phaser.Math.Clamp(sprite.sit + (seated ? 1 : -1) * this.game.loop.delta / this.cafe.timing.seating, 0, 1);
    const frame = actionFrame ?? (serving > 0 ? 16 + Math.max(1, Math.ceil(serving * 4)) : sprite.sit > 0 ? 12 + Math.max(1, Math.ceil(sprite.sit * 4)) : moved > .05 ? 1 + Math.floor(sprite.travel / (47 * characterWidth(style)) * 12) % 12 : 0);
    const textureKey = `${carrying ? `carry-${foodId}` : 'person'}-${style}-${frame}-${facing}`;
    if(!this.textures.exists(textureKey)) this.texture(textureKey,PERSON.width,PERSON.height,
      ctx=>paintPerson(ctx,style,frame,facing,carrying,foodId));
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

  private plate(x:number,y:number,food='stew',graphics=this.effects) {
    if(food==='dirty'){graphics.fillStyle(0xc8c4b2).fillEllipse(x,y,21,10);graphics.fillStyle(0x765344).fillEllipse(x+2,y,8,4);return;}
    const key=`dish-${food}`;
    if(!this.textures.exists(key))this.texture(key,240,150,ctx=>paintFood(ctx,food,120,88));
    let image=this.dishImages[this.dishesUsed++];
    if(!image){image=this.add.image(x,y,key);this.dishImages.push(image);}
    image.setTexture(key).setScale(.075).setOrigin(.5,88/150).setPosition(x,y).setDepth(graphics===this.effects?1498:graphics.depth).setVisible(true);
  }

  private drawPot(steaming: boolean, tile = STOVE) {
    const pot = project(tile.x + .67, tile.y + .32, 39);
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
