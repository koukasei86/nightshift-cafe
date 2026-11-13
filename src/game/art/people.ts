import { characterLook, characterWidth, ZOMBIE_STYLE_OFFSET } from '../../data/characters';
import { paintReferenceHead, paintOutfit, referencePalette } from './reference-people';
import { paintFood } from './food';
import type { Facing } from '../../core/npc/movement';
import { ellipse } from './geometry';

export const PERSON = { width: 105, height: 94, foot: 85 };
const ink = '#292620';
const clothes = [
  { skin: '#d6ad86', shade: '#a98669', hair: '#374b59', shirt: '#4c6875', light: '#728c96', trousers: '#424f4f' },
  { skin: '#e1c6a2', shade: '#ae967b', hair: '#f0eeea', shirt: '#8b648b', light: '#ac86a5', trousers: '#364f58' },
  { skin: '#a67f62', shade: '#85654d', hair: '#323235', shirt: '#596047', light: '#7b7f5c', trousers: '#455460' },
  { skin: '#a2aa70', shade: '#7d8a56', hair: '#67503a', shirt: '#ddd9cc', light: '#f6f2e4', trousers: '#353531' },
] as const;

function shape(ctx: CanvasRenderingContext2D, path: string, color: string, outline = ink, width = 1.55) {
  const p = new Path2D(path);
  ctx.fillStyle = color;
  ctx.fill(p);
  if (outline) {
    ctx.lineWidth = width;
    ctx.strokeStyle = outline;
    ctx.stroke(p);
  }
}

function stroke(ctx: CanvasRenderingContext2D, path: string, color = ink, width = 1.2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(new Path2D(path));
}

export function paintPerson(ctx: CanvasRenderingContext2D, style: number, step: number, facing: Facing, carrying = false, food = 'stew') {
  ctx.save(); ctx.translate(18,0);
  const chef = style < 0;
  const zombie = chef || style >= ZOMBIE_STYLE_OFFSET;
  const look = chef ? {...characterLook(16),glasses:true} : characterLook(style);
  const palette = chef ? clothes[3] : referencePalette(look);
  const skin = zombie ? (look.dark ? '#7e8957' : '#a7af75') : palette.skin;
  const shade = zombie ? '#67764d' : palette.shade;
  const rear = facing === 'ne' || facing === 'nw';
  const seated = step >= 13 && step <= 16;
  const reach = step >= 17 && step <= 20 ? (step - 16) / 4 : 0;
  const sit = seated ? Math.min(1, (step - 12) / 4) : 0;
  const phase = Math.max(0, step - 1) / 12;
  const walking = step > 0 && step < 13;
  const stride = walking ? Math.sin(phase * Math.PI * 2) * 5 : 0;
  const width = characterWidth(style);
  const height = chef ? 1.04 : look.old ? .95 : 1;

  ellipse(ctx, 34, PERSON.foot, 18, 5, '#39363062');
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (facing === 'sw' || facing === 'nw') {
    ctx.translate(69, 0);
    ctx.scale(-1, 1);
  }
  /* Character build is part of the silhouette, including the rear view. */
  ctx.translate(34, 85);
  ctx.scale(width, height);
  ctx.translate(-34, -85);
  // Two planted-foot phases per stride. Stance travels backwards by the same
  // projected distance as the body; the returning foot lifts off the floor.
  for (const [x, offset] of [[26, 0], [38, .5]] as const) {
    const t = (phase + offset) % 1;
    const fore = !walking ? 0 : t < .5 ? 10.5 - 42 * t : -10.5 + 42 * (t - .5);
    const lift = walking && t >= .5 ? Math.sin((t - .5) * Math.PI * 2) * 5.5 : 0;
    const footX = x + fore + sit * 9;
    const footY = 82 + fore * (rear ? -.5 : .5) - lift - sit * 5;
    const hipY = (chef?65:61) + sit * 5;
    const kneeX = (x + footX) / 2 + sit * 6;
    const kneeY = (hipY + footY) / 2 - sit * 3;
    const color=palette.trousers;
    shape(ctx, `M${x-5} ${hipY} L${x+5} ${hipY} L${kneeX+4} ${kneeY} L${footX+4} ${footY} L${footX-5} ${footY} L${kneeX-4} ${kneeY} Z`, color);
    if(!chef && ['polo','redvest','bluevest','skirt'].includes(look.outfit)) {
      const ankle=look.outfit==='skirt'?skin:'#e7e5d5';
      shape(ctx,`M${kneeX-3.7} ${kneeY-1} L${kneeX+3.7} ${kneeY-1} L${footX+3.8} ${footY} L${footX-4} ${footY} Z`,skin,ink,1);
      if(look.outfit!=='skirt')shape(ctx,`M${footX-4} ${footY-4} L${footX+3.5} ${footY-4} L${footX+4} ${footY} L${footX-4} ${footY} Z`,ankle,ink,.7);
      if(look.outfit==='redvest')stroke(ctx,`M${footX-3.5} ${footY-3} L${footX+3.5} ${footY-3}`,'#a9413e',1);
    }
    stroke(ctx, `M${x+1} ${hipY+3} L${kneeX} ${kneeY} L${footX} ${footY-3}`, '#777568', .65);
    shape(ctx, `M${footX-5} ${footY-2} Q${footX} ${footY} ${footX+5} ${footY-2} L${footX+9} ${footY+1} Q${footX+10} ${footY+4} ${footX+2} ${footY+4} L${footX-6} ${footY+2} Z`, chef ? '#383630' : look.outfit==='skirt'?'#ae303b':look.outfit==='tracksuit'?'#65513c':look.outfit==='tie'?'#424640':'#e3e3d9', ink, 1.15);
    stroke(ctx, `M${footX-4} ${footY+2} L${footX+6} ${footY+3}`, '#908678', .6);
  }
  ctx.translate(0, sit * 7 - (walking ? Math.abs(Math.sin(phase * Math.PI * 2)) * 1.1 : 0));
  ctx.save();
  if(!chef){ctx.translate(0,42);ctx.scale(1,.9);ctx.translate(0,-42);}
  const arm = (x: number, angle: number, far: boolean) => {
    ctx.save();
    ctx.translate(x, 48);
    ctx.rotate(angle);
    shape(ctx, 'M-5 -1 Q0 -5 5 -1 L6 8 L-5 10 Z', far ? palette.shirt : palette.light);
    shape(ctx, 'M-4 9 L5 8 L5 20 Q9 23 7 26 Q6 28 3 26 L2 29 Q-2 29 -3 26 Z', skin);
    stroke(ctx, 'M1 22 L3 25 M3 21 L5 24', shade);
    ctx.restore();
  };
  const working=step>=21 && step<=28;
  const workSwing=working ? -.8+Math.sin(step*Math.PI/2)*.3 : 0;
  if (!carrying) arm(41, working ? workSwing : seated ? -.75 : stride / 26, true);
  shape(ctx, 'M24 42 Q34 40 43 44 L48 55 L46 69 Q34 74 21 69 L20 53 Z', palette.shirt);
  shape(ctx, 'M24 47 L29 46 L31 60 L28 68 L23 67 Z', palette.light, '');
  if (chef) {
    stroke(ctx, rear ? 'M25 56 Q34 59 43 57 M34 58 Q28 55 28 60 Q30 64 34 58 Q40 55 42 60' :
      'M30 47 L35 56 L43 48 M35 56 L36 69 M40 59 L41 59 M40 64 L41 64', '#6a665c', 1.25);
  } else {
    stroke(ctx, 'M24 68 Q36 70 45 67', '#514638');
  }
  if (chef && !rear) {
    shape(ctx, 'M27 49 L40 50 L44 71 Q34 75 23 70 Z', '#e9e3cd', ink, 1);
    stroke(ctx, 'M29 51 L26 67 M38 52 L40 69 M29 61 L38 62 L37 67 L29 66 Z', '#a49c89', .7);
    stroke(ctx, 'M23 49 L29 47 M39 48 L44 51', '#faf6e6', 1.3);
  } else if(!chef) {
    paintOutfit(ctx,look,rear,skin);
  }
  if (!carrying) arm(22, working ? workSwing-.2 : seated ? -.9 : -stride / 26, false);
  if(step>=21 && step<=24) stroke(ctx,'M37 57 L50 43','#65533d',2);
  if(step>=25 && step<=28) shape(ctx,'M33 57 L47 56 L49 61 L34 63 Z','#d1b990',ink,.8);
  if (carrying) {
    ctx.save();
    ctx.translate(reach * 17, -reach * 11);
    // Bent elbows and open palms support the dish instead of swinging through it.
    shape(ctx, 'M20 48 Q25 46 28 51 L29 60 L40 57 L43 60 Q37 66 25 66 L20 59 Z', palette.light);
    shape(ctx, 'M28 59 L38 57 Q44 52 46 56 L47 59 L42 62 L28 63 Z', skin, ink, 1.1);
    stroke(ctx, 'M39 57 L43 58 M39 59 L43 60', shade, .65);
    shape(ctx, 'M42 49 L48 52 L49 57 L58 54 L61 57 L49 62 L44 59 Z', skin, ink, 1.1);
    ellipse(ctx, 50, 54, 15, 5, '#443b32');
    ellipse(ctx, 50, 52.6, 14, 4.5, '#f3eee0');
    ellipse(ctx, 50, 52, 10, 3, '#bcb5a2');
    shape(ctx, 'M41 48 L59 48 Q58 54 50 54 Q43 54 41 48 Z', '#d7d0bc', ink, .8);
    paintFood(ctx,food,50,47,.12);
    stroke(ctx, 'M45 48 Q49 46 54 48', '#c3cb84', .8);
    ellipse(ctx, 42, 52, 2, 1, '#64804a');
    ctx.restore();
  }

  ctx.restore();
  if(!chef){ctx.translate(34,39);ctx.scale(.9,.9);ctx.translate(-34,-43);}
  paintReferenceHead(ctx,look,facing,skin,shade,zombie,step);
  ctx.restore();ctx.restore();
}

const portraitCache=new Map<string,string>();
export function personPortrait(style:number,zombie=false,facing:Facing='sw') {
 const key=`${style}-${zombie}-${facing}`;if(portraitCache.has(key))return portraitCache.get(key)!;
 const canvas=document.createElement('canvas');canvas.width=210;canvas.height=188;
 const ctx=canvas.getContext('2d')!;ctx.scale(2,2);paintPerson(ctx,style+(zombie?ZOMBIE_STYLE_OFFSET:0),0,facing);
 const result=canvas.toDataURL();portraitCache.set(key,result);return result;
}
