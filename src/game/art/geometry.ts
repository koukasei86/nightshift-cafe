import type { Tile } from '../../core/pathfinding/grid';

export const WORLD = { width: 1000, height: 610 };
export const ORIGIN = { x: 485, y: 154 };
export const HALF_W = 42;
export const HALF_H = 21;

export function project(x: number, y: number, z = 0): Tile {
  return { x: ORIGIN.x + (x - y) * HALF_W, y: ORIGIN.y + (x + y) * HALF_H - z };
}

export function tileCenter(tile: Tile) {
  return project(tile.x + 0.5, tile.y + 0.5);
}

export function poly(ctx: CanvasRenderingContext2D, points: Tile[], fill: string, stroke?: string) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string | CanvasGradient) {
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number,
  base: number, top: number, colors: readonly [string, string, string]) {
  const a = project(x, y, top), b = project(x + w, y, top);
  const c = project(x + w, y + d, top), e = project(x, y + d, top);
  const p = project(x + w, y, base), q = project(x + w, y + d, base), r = project(x, y + d, base);
  poly(ctx, [b, p, q, c], colors[2], '#39281a85');
  poly(ctx, [e, c, q, r], colors[1], '#39281a85');
  poly(ctx, [a, b, c, e], colors[0], '#39281a85');
  // Material is painted in each face's own plane so wear follows the object.
  for (const [face, amount] of [[[b, p, q, c], .13], [[e, c, q, r], .09], [[a, b, c, e], .045]] as const) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(face[0].x, face[0].y);
    for (const point of face.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath(); ctx.clip();
    const minX = Math.min(...face.map(v => v.x)), maxX = Math.max(...face.map(v => v.x));
    const minY = Math.min(...face.map(v => v.y)), maxY = Math.max(...face.map(v => v.y));
    const shade = ctx.createLinearGradient(minX, minY, maxX, maxY);
    shade.addColorStop(0, '#ffffee22'); shade.addColorStop(.5, '#7a725800'); shade.addColorStop(1, `rgba(43,39,31,${amount})`);
    ctx.fillStyle = shade; ctx.fillRect(minX, minY, maxX-minX, maxY-minY);
    let seed = Math.floor(x*137+y*941+top*71) >>> 0;
    const rand = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    const area = (maxX-minX)*(maxY-minY);
    for (let i=0; i<area/5; i++) {
      ctx.fillStyle = i%3 ? '#665a4611' : '#fffdf028';
      ctx.fillRect(minX+rand()*(maxX-minX),minY+rand()*(maxY-minY),.3+rand()*.8,.25+rand()*.65);
    }
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(e.x+.6,e.y+.8); ctx.lineTo(c.x,c.y+.8); ctx.lineTo(b.x-.4,b.y+.5);
  ctx.strokeStyle = '#fff8da65'; ctx.lineWidth=.65; ctx.stroke();
}
