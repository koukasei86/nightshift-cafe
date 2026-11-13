import type { Tile } from '../../core/pathfinding/grid';

export const WORLD = { width: 1000, height: 610 };
export const ORIGIN = { x: 485, y: 154 };
export const HALF_W = 42;
export const HALF_H = 21;

let rotation: {x:number;y:number;turns:number}|null=null;
export function rotatedProjection(tile:Tile,turns:number,paint:()=>void) {
 const old=rotation;rotation={x:tile.x+.5,y:tile.y+.5,turns:turns%4};try{paint();}finally{rotation=old;}
}
export function project(x: number, y: number, z = 0): Tile {
 if(rotation){let dx=x-rotation.x,dy=y-rotation.y;for(let i=0;i<rotation.turns;i++)[dx,dy]=[-dy,dx];x=rotation.x+dx;y=rotation.y+dy;}
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
  const back=project(x,y,base);
  // An opaque silhouette prevents anti-aliased seams between adjoining faces.
  const sorted=[a,b,c,e,p,q,r,back].sort((u,v)=>u.x-v.x||u.y-v.y);
  const cross=(o:Tile,u:Tile,v:Tile)=>(u.x-o.x)*(v.y-o.y)-(u.y-o.y)*(v.x-o.x);
  const half=(points:Tile[])=>{const hull:Tile[]=[];for(const point of points){while(hull.length>1&&cross(hull[hull.length-2],hull[hull.length-1],point)<=0)hull.pop();hull.push(point);}return hull;};
  const lower=half(sorted),upper=half([...sorted].reverse());lower.pop();upper.pop();
  poly(ctx,[...lower,...upper],colors[1]);
  // Rotation can expose any side: paint all four opaque walls, back to front.
  const sides: {face:Tile[];color:string;amount:number}[]=[
    {face:[a,back,p,b],color:colors[1],amount:.09},
    {face:[a,e,r,back],color:colors[2],amount:.13},
    {face:[b,p,q,c],color:colors[2],amount:.13},
    {face:[e,c,q,r],color:colors[1],amount:.09},
  ].sort((u,v)=>u.face.reduce((n,p)=>n+p.y,0)-v.face.reduce((n,p)=>n+p.y,0));
  const faces=[...sides,{face:[a,b,c,e],color:colors[0],amount:.045}];
  for(const {face,color,amount} of faces) {
    poly(ctx,face,color,'#39281a85');
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
