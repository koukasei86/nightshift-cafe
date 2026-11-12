import type { PropKind } from '../../data/cafe';
import type { Tile } from '../../core/pathfinding/grid';
import { box, ellipse, poly, project, tileCenter } from './geometry';

const steel = ['#565956', '#393936', '#2b2b29'] as const;
const porcelain = ['#efeee8', '#d6d4cd', '#bcbbb5'] as const;
const laminate = ['#67919d', '#3a6472', '#416d7b'] as const;
const cabinet = ['#aba9a4', '#969491', '#777674'] as const;

function speckle(ctx: CanvasRenderingContext2D, x: number, y: number, height: number) {
  for (let i = 0; i < 17; i++) {
    const a = .15 + (i * .271) % .72, b = .13 + (i * .41) % .7;
    const point = project(x + a, y + b, height);
    ellipse(ctx, point.x, point.y, i % 3 ? 1.35 : 2.2, .9, i % 3 ? '#8b827149' : '#625a4b75');
  }
}

function woodGrain(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  for (let i = 0; i < 11; i++) {
    const offset = .10 + i * .077;
    const first = project(x + .10, y + offset, 31);
    const middle = project(x + .45, y + offset + Math.sin(i) * .033, 31);
    const last = project(x + .92, y + offset + Math.cos(i) * .024, 31);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    ctx.quadraticCurveTo(middle.x, middle.y, last.x, last.y);
    ctx.strokeStyle = i % 3 ? '#92918a60' : '#8d8b8290';
    ctx.lineWidth = .8;
    ctx.stroke();
  }
  ctx.restore();
}

export function paintProp(ctx: CanvasRenderingContext2D, tile: Tile & { kind: PropKind }) {
  const { x, y, kind } = tile;
  const center = tileCenter(tile);
  const shadow = ctx.createRadialGradient(center.x+4,center.y+5,2,center.x+4,center.y+5,35);
  shadow.addColorStop(0,'#302a245c'); shadow.addColorStop(1,'#302a2400');
  ellipse(ctx,center.x+4,center.y+5,40,14,shadow);
  ellipse(ctx,center.x+1,center.y+2,kind==='chair'?13:27,kind==='chair'?4:9,'#3f392b21');
  switch (kind) {
    case 'stove': {
      box(ctx, x + .05, y + .07, .9, .86, 0, 31, porcelain);
      box(ctx, x + .05, y + .06, .9, .87, 30, 35, ['#fcfaf0', '#e0dfd6', '#b5b3a8']);
      box(ctx, x + .05, y + .04, .9, .12, 35, 44, porcelain);
      box(ctx, x + .19, y + .163, .62, .015, 38, 41, steel);
      box(ctx, x + .29, y + .178, .16, .016, 39, 40, ['#9da176', '#8a945f', '#6a744d']);
      speckle(ctx, x, y, 35);
      for (const [a, b] of [[.26, .31], [.72, .31], [.26, .72], [.72, .72]]) {
        const p = project(x + a, y + b, 35);
        ellipse(ctx, p.x, p.y, 9, 5, '#2a2a26');
        ellipse(ctx, p.x, p.y, 6.2, 3.4, '#545651');
        ellipse(ctx, p.x, p.y, 2.8, 1.6, '#222422');
      }
      box(ctx, x + .16, y + .937, .68, .018, 5, 27, steel);
      box(ctx, x + .22, y + .963, .56, .026, 23, 26, ['#737671', '#515450', '#3a3938']);
      break;
    }
    case 'sink':
    case 'counter': {
      const join = kind === 'counter';
      const lo = join ? 0 : .06;
      const span = join ? 1 : .88;
      box(ctx, x + .06, y + lo + .02, .88, span - .04, 0, 27, cabinet);
      box(ctx, x + .03, y + lo, .94, span, 27, 32, laminate);
      speckle(ctx, x, y, 32);
      if (kind === 'sink') {
        box(ctx, x + .18, y + .17, .65, .64, 31, 33, ['#3d575a', '#526062', '#324a4c']);
        box(ctx, x + .29, y + .25, .43, .47, 32, 33, ['#616751', '#666857', '#525641']);
        const p = project(x + .20, y + .47, 33);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.bezierCurveTo(p.x, p.y - 24, p.x + 13, p.y - 23, p.x + 13, p.y - 11);
        ctx.strokeStyle = '#323734';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = '#b5b7a6';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.restore();
        const drain = project(x + .52, y + .50, 33);
        ellipse(ctx, drain.x, drain.y, 4.1, 2.5, '#393f38');
      }
      break;
    }
    case 'fridge': {
      box(ctx, x + .08, y + .09, .84, .85, 0, 81, porcelain);
      box(ctx, x + .10, y + .94, .80, .045, 5, 17, porcelain);
      box(ctx, x + .10, y + .94, .80, .045, 18, 79, porcelain);
      box(ctx, x + .24, y + .982, .05, .035, 26, 49, ['#838780', '#62645d', '#575751']);
      box(ctx, x + .24, y + .982, .22, .035, 11, 13, ['#838780', '#62645d', '#575751']);
      speckle(ctx, x, y, 81);
      for (const [a, z] of [[.67, 27], [.69, 24], [.58, 12], [.78, 11], [.73, 8], [.39, 54]]) {
        const p = project(x + a, y + .99, z);
        ellipse(ctx, p.x, p.y, 1.1, 2, '#645f4d60');
      }
      break;
    }
    case 'table':
      for (const [a, b] of [[.12, .14], [.76, .14], [.12, .76], [.76, .76]]) {
        box(ctx, x + a, y + b, .095, .095, 0, 26, porcelain);
      }
      box(ctx, x + .04, y + .05, .92, .9, 24, 30, porcelain);
      woodGrain(ctx, x, y);
      for(const [a,b] of [[.14,.15],[.78,.15],[.14,.78],[.78,.78]]) {
        const p=project(x+a,y+b);
        ellipse(ctx,p.x,p.y,3.5,1.4,'#302a2465');
        const nail=project(x+a,y+b,30.3);
        ellipse(ctx,nail.x,nail.y,.65,.45,'#655f54');
      }
      break;
    case 'chair': {
      for (const [a, b] of [[.28, .28], [.65, .28], [.28, .65], [.65, .65]]) {
        box(ctx, x + a, y + b, .048, .048, 0, 17, steel);
      }
      box(ctx, x + .25, y + .24, .50, .49, 14, 18, porcelain);
      const back = x === 5 && y === 3 || x === 6 && y === 5;
      if (back) {
        box(ctx, x + .24, y + .27, .05, .43, 17, 32, steel);
        box(ctx, x + .21, y + .23, .09, .52, 23, 35, porcelain);
      } else {
        box(ctx, x + .70, y + .27, .05, .43, 17, 32, steel);
        box(ctx, x + .69, y + .23, .09, .52, 23, 35, porcelain);
      }
      break;
    }
  }
}
