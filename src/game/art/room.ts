import { DOOR, ROOM_DEPTH, WIDTH } from '../../data/cafe';
import type { Tile } from '../../core/pathfinding/grid';
import { ellipse, poly, project, WORLD } from './geometry';

const ink = '#393229';
const floorColors = ['#cdcdca', '#d2d1ce', '#d1d0ce', '#c8c8c5', '#d6d5d2', '#cecdca'];
const doorHeight = 71;
const wallHeight = 132;
const leftPaint = '#eed791';
const rearPaint = '#c4a457';

type Wall = 'left' | 'rear';
const wallPoint = (side: Wall, along: number, z: number) =>
  side === 'left' ? project(0, along, z) : project(along, 0, z);

export const doorTarget = project(DOOR.x + .5, 0, doorHeight / 2);
export const openDoorTarget = project(DOOR.x + .055, .30, doorHeight / 2);

function noise(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function ground(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  color: string, outline?: string) {
  poly(ctx, [project(x, y), project(x + w, y), project(x + w, y + h), project(x, y + h)], color, outline);
}

function line(ctx: CanvasRenderingContext2D, points: Tile[], color: string, width = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.restore();
}

export function paintRoom(ctx: CanvasRenderingContext2D) {
  const random = noise(2281);
  ctx.fillStyle = '#68773d';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (let i = 0; i < 25000; i++) {
    const x = random() * WORLD.width, y = random() * WORLD.height;
    ctx.fillStyle = i % 3 ? '#485c2c60' : '#a4a76f55';
    ctx.fillRect(x, y, 1.5, 2 + random() * 2);
  }
  for (const [x, y, w, h] of [[-5.7, -5.7, 22, 4.8], [-5.7, -.95, 4.8, 17.5]]) {
    ground(ctx, x, y, w, h, '#8a8b89', '#656660');
  }
  ground(ctx, -5, -3.3, 22, .13, '#d7ad4d');
  ground(ctx, -1.56, -.1, .13, 16, '#d7ad4d');
  for (let i = 0; i < 12; i++) {
    ground(ctx, i, -1.02, 1, 1.02, '#bdbdb9', '#7d7b76');
    ground(ctx, -1.02, i, 1.02, 1, '#bdbdb9', '#7d7b76');
  }
  ground(ctx, 0, 0, WIDTH, ROOM_DEPTH, '#d1d0ca', ink);
  for (let y = 0; y < ROOM_DEPTH * 2; y++) {
    for (let x = 0; x < WIDTH * 2; x++) {
      ground(ctx, x / 2, y / 2, .5, .5, floorColors[Math.floor(random() * floorColors.length)], '#66635e99');
    }
  }
  for(let i=0;i<18000;i++) {
    const p=project(random()*WIDTH,random()*ROOM_DEPTH);
    ctx.fillStyle=i%2?'#ffffff22':'#514c4010';
    ctx.fillRect(p.x,p.y,.4+random()*.8,.3+random()*.6);
  }
  for (const [x, y] of [[.4, 4.1], [2.7, 5.5], [8.1, 1.6], [.4, .35], [7.9, 5.9]]) {
    for (let i = 0; i < 45; i++) {
      const p = project(x + random() * .68, y + random() * .72);
      ellipse(ctx, p.x, p.y, .5 + random() * 3, .4 + random() * 2, i % 2 ? '#7a69563e' : '#67634445');
    }
  }
  for (const [x, y] of [[.7, 5.1], [7.9, 4.55], [8.1, .6], [3.7, 5.9]]) {
    const origin = project(x, y);
    line(ctx, [origin, project(x + .21, y + .05), project(x + .18, y + .19),
      project(x + .43, y + .25), project(x + .39, y + .44), project(x + .58, y + .51)], '#5a5551', 1.2);
    line(ctx, [project(x + .43, y + .25), project(x + .56, y + .13), project(x + .68, y + .16)], '#625b53');
  }
  ground(ctx, DOOR.x, -.18, 1, .27, '#b7a68a', '#5a4d3a');
  drawWall(ctx, 'left', 0, ROOM_DEPTH);
  boardWindow(ctx, 1.35);
  boardWindow(ctx, 3.75);
  wallGrime(ctx, 'left', .35, 94, false);
  wallGrime(ctx, 'left', 5.72, 95, true);
  wallGrime(ctx, 'left', 6.02, 82, true);
}

function panel(ctx: CanvasRenderingContext2D, side: Wall, start: number, end: number,
  base: number, top: number, color: string, outline?: string) {
  poly(ctx, [wallPoint(side, start, base), wallPoint(side, end, base),
    wallPoint(side, end, top), wallPoint(side, start, top)], color, outline);
}

function drawWall(ctx: CanvasRenderingContext2D, side: Wall, start: number, end: number) {
  panel(ctx, side, start, end, 0, wallHeight, side === 'left' ? leftPaint : rearPaint, ink);
  panel(ctx, side, start, end, wallHeight - 5, wallHeight, '#ecd396', ink);
  const random = noise(Math.floor(start*918+end*73+(side==='left'?71:97)));
  for (let i=0; i<(end-start)*380; i++) {
    const along=start+random()*(end-start), z=random()*(wallHeight-6);
    const p=wallPoint(side,along,z);
    ctx.fillStyle=i%4 ? '#9c713414' : '#fff7cc38';
    ctx.fillRect(p.x,p.y,.3+random()*1.2,.4+random()*1.4);
  }
  // Irregular rising damp and chipped plaster along the skirting.
  for(let i=0;i<(end-start)*26;i++) {
    const u=start+random()*(end-start), z=random()*11;
    const p=wallPoint(side,u,z);
    ellipse(ctx,p.x,p.y,.6+random()*2.2,.7+random()*3,'#795d3530');
  }
  panel(ctx, side, start, end, 0, 3, '#695338');
}

function boardWindow(ctx: CanvasRenderingContext2D, at: number) {
  panel(ctx, 'left', at, at + .9, 42, 80, '#b0bfc0', ink);
  panel(ctx, 'left', at + .13, at + .19, 43, 79, '#51676a');
  panel(ctx, 'left', at + .67, at + .72, 43, 79, '#51676a');
  panel(ctx, 'left', at - .09, at + .98, 46, 55, '#79553a', ink);
  panel(ctx, 'left', at - .1, at + .94, 65, 73, '#896342', ink);
  const u = (x: number, z: number) => wallPoint('left', at + x, z);
  poly(ctx, [u(.28, 40), u(.49, 40), u(.70, 84), u(.48, 85)], '#6b4d36', ink);
  for (const [x, y] of [[0, 50], [.84, 50], [.03, 69], [.83, 68], [.39, 44], [.59, 79]]) {
    const p = u(x, y);
    ellipse(ctx, p.x, p.y, 1, 1, '#3a3227');
  }
}

function wallGrime(ctx: CanvasRenderingContext2D, side: Wall, at: number, z: number, drip: boolean) {
  const random = noise(Math.floor(at * 341));
  if (drip) {
    const p = (u: number, v: number) => wallPoint(side, at + u, z + v);
    poly(ctx, [p(-.23, 0), p(.35, 2), p(.30, -9), p(.23, -8), p(.18, -25), p(.12, -28),
      p(.07, -10), p(.02, -10), p(-.025, -40), p(-.085, -42), p(-.14, -10), p(-.19, -15)], '#526033', '#424a2c');
    line(ctx, [p(.11, -4), p(.09, -13), p(.055, -21)], '#9b9c56');
    return;
  }
  for (let i = 0; i < 85; i++) {
    const x = at + random() * .70;
    const height = random() * (z * Math.pow(1 - (x - at) / .85, 1.8));
    const p = wallPoint(side, x, height);
    ellipse(ctx, p.x, p.y, .5 + random() * 3.5, 1 + random() * 5, '#815e3a55');
  }
}

export function paintRearWall(ctx: CanvasRenderingContext2D) {
  drawWall(ctx, 'rear', 0, DOOR.x);
  drawWall(ctx, 'rear', DOOR.x + 1, WIDTH);
  panel(ctx, 'rear', DOOR.x, DOOR.x + 1, doorHeight, wallHeight, rearPaint, ink);
  panel(ctx, 'rear', DOOR.x, DOOR.x + 1, wallHeight - 5, wallHeight, '#ecd396', ink);
  panel(ctx, 'rear', DOOR.x, DOOR.x + .052, 0, doorHeight, '#76603b', ink);
  panel(ctx, 'rear', DOOR.x + .945, DOOR.x + 1, 0, doorHeight, '#aa824a', ink);
  wallGrime(ctx, 'rear', .04, 67, false);
  for (const [x, z] of [[1.8, 61], [2.62, 42], [3.48, 51], [8.12, 82]]) {
    const at = (dx: number, dz: number) => wallPoint('rear', x + dx, z + dz);
    poly(ctx, [at(-.42, -2), at(-.25, 3), at(-.18, 3), at(-.04, 10), at(.06, 6),
      at(.26, 7), at(.36, 11), at(.26, 2), at(.16, 0), at(.05, -6), at(-.13, -5)], '#876838', ink);
    for (let j=0;j<9;j++) {
      const u=-.32+j*.073;
      line(ctx,[at(u,-1+Math.sin(j*4)*2),at(u+.04,2+Math.cos(j*7)*2)],'#463c2a99',.7);
    }
    line(ctx, [at(-.34, -3), at(-.03, -4), at(.17, -1)], '#ebcb83');
  }
  const at = (x: number, z: number) => wallPoint('rear', x, z);
  line(ctx, [at(7.58, 130), at(7.61, 91), at(7.50, 82), at(7.56, 73), at(7.43, 62),
    at(7.42, 51), at(7.25, 42), at(7.27, 31), at(7.13, 24)], '#382e20', 2.4);
  line(ctx, [at(7.50, 82), at(7.72, 77), at(7.74, 67), at(7.93, 59),
    at(7.92, 48), at(8.06, 40), at(8.08, 30)], '#3d3022', 2);
}

export function paintDoor(ctx: CanvasRenderingContext2D, open: boolean) {
  const left = DOOR.x + .055;
  const point = (x: number, z: number) => open ? project(left, x * .68, z) : project(left + x, 0, z);
  const surface = (l: number, r: number, b: number, t: number, color: string) =>
    poly(ctx, [point(l, b), point(r, b), point(r, t), point(l, t)], color, '#354347');
  surface(0, .89, 1, doorHeight - 2, '#477078');
  surface(.09, .80, 26, 61, '#738d8e');
  surface(.12, .77, 31, 58, '#87a4a4');
  surface(.16, .71, 9, 19, '#557d82');
  surface(.67, .79, 23, 25, '#e0c97e');
  for (const z of [11, 53]) surface(0, .055, z, z + 8, '#a28b50');
  surface(.21, .68, 40, 47, open ? '#607344' : '#8d493f');
  const label = point(.44, 43);
  ctx.save();
  ctx.translate(label.x, label.y);
  ctx.transform(1, open ? -.5 : .5, 0, 1, 0, 0);
  ctx.fillStyle = '#fff0c8';
  ctx.textAlign = 'center';
  ctx.font = 'bold 5px sans-serif';
  ctx.fillText(open ? 'OPEN' : 'CLOSED', 0, 1.5);
  ctx.restore();
}
