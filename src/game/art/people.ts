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

const hairShapes = [
  'M12 31 Q8 26 13 16 Q20 9 31 8 Q47 8 53 20 L60 22 Q64 25 57 27 L42 26 Q29 24 19 30 L15 35 Z',
  'M11 29 Q9 23 13 20 Q9 14 16 12 Q16 6 23 8 Q27 3 33 7 Q42 3 45 9 Q53 6 55 13 Q62 14 58 20 Q62 25 56 27 Q50 25 48 31 L44 26 Q36 21 26 24 L24 32 Q20 37 15 36 Z',
  'M10 32 Q6 29 11 23 Q7 18 13 14 Q11 8 20 9 Q20 3 27 6 Q31 1 36 6 Q43 3 46 8 Q53 5 54 12 Q61 12 58 18 Q63 22 58 27 Q59 33 52 34 L44 27 Q33 24 25 26 L22 34 Q17 40 12 38 Z',
  'M10 34 Q7 25 14 16 Q18 12 29 10 L34 5 L44 10 L51 8 Q58 18 58 27 Q51 25 47 21 Q37 26 28 24 L23 35 L17 38 Z',
];

export function paintPerson(ctx: CanvasRenderingContext2D, style: number, step: number, facing: Facing, carrying = false, food = 'stew') {
  ctx.save(); ctx.translate(18,0);
  const chef = style < 0;
  const zombie = chef || style >= ZOMBIE_STYLE_OFFSET;
  const look = characterLook(style);
  const type = chef ? 3 : style % 3;
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
  if (chef) {
    shape(ctx, 'M27 49 L40 50 L44 71 Q34 75 23 70 Z', '#e9e3cd', ink, 1);
    stroke(ctx, 'M29 51 L26 67 M38 52 L40 69 M29 61 L38 62 L37 67 L29 66 Z', '#a49c89', .7);
    stroke(ctx, 'M23 49 L29 47 M39 48 L44 51', '#faf6e6', 1.3);
  } else {
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
  if (!chef) {
    ctx.translate(34,39);ctx.scale(.9,.9);ctx.translate(-34,-43);
    paintReferenceHead(ctx,look,rear,skin,shade,zombie,step);
    ctx.restore();ctx.restore();return;
  }
  const head = 'M14 16 Q23 8 39 10 Q52 12 56 24 L55 30 L60 36 L56 40 L56 45 Q54 51 44 51 L31 49 Q19 48 15 40 L11 30 Z';
  shape(ctx, head, rear ? palette.hair : skin, ink, 1.7);
  if (!rear) {
    shape(ctx, 'M14 28 Q19 35 22 36 Q27 44 37 46 L45 49 Q36 51 29 48 Q18 46 15 39 Z', shade, '');
  }
  shape(ctx, hairShapes[type], palette.hair, ink, 1.7);
  stroke(ctx, type === 2 ? 'M16 19 Q12 15 18 13 M25 12 Q23 8 29 9 M38 11 Q43 7 46 13 M50 18 Q56 14 55 23' : type === 1 ? 'M16 20 Q13 14 21 14 M25 13 Q29 8 34 12 M40 12 Q47 9 51 17' : 'M17 24 Q24 15 34 16 M27 21 Q37 13 47 17', type === 1 ? '#c7c5bd' : type === 2 ? '#555551' : '#8b7354', 1.05);
  if (rear) {
    shape(ctx, 'M12 27 Q24 29 31 30 Q46 30 55 25 L54 40 Q48 49 33 46 Q17 45 13 37 Z',
      palette.hair);
    stroke(ctx, 'M17 36 Q27 41 40 40 M37 42 Q46 41 51 37', chef ? '#46382c' : '#666157');
  } else {
    shape(ctx, 'M20 32 Q13 27 13 35 Q15 42 21 40 L23 37', skin);
    stroke(ctx, 'M16 34 Q19 33 20 37 M34 26 Q39 24 43 27 M46 27 Q51 24 54 27');
    shape(ctx, 'M32 31 Q38 28 44 31 L43 36 Q37 39 32 35 Z', zombie ? '#e4d783' : '#f4eee1', ink, 1.1);
    shape(ctx, 'M46 31 Q51 28 55 31 L54 35 Q50 37 46 34 Z', zombie ? '#e8dc90' : '#f4eee1', ink, 1.05);
    if(step===29) { stroke(ctx,'M32 33 L43 33 M46 33 L55 33',shade,2.4); }
    if(step===30) { stroke(ctx,'M32 27 L43 30 M46 30 L55 27',ink,2); }
    ellipse(ctx, 40, 33, 1.45, step===29 ? .6 : 2, ink);
    ellipse(ctx, 51, 33, 1.35, 1.75, ink);
    if (type !== 0) {
      const frame = chef ? '#3c626d' : '#3a3734';
      stroke(ctx, 'M23 31 L31 31 L33 38 Q39 40 44 36 L45 30 L33 29 L31 31 M45 32 L47 32 M47 30 L56 30 L55 36 L47 37 Z',
        frame, 2.1);
    }
    stroke(ctx, 'M48 34 L51 39 L47 40', shade);
    stroke(ctx, 'M33 38 Q38 40 42 38 M48 38 L53 37 M31 42 L34 43 M44 49 L49 48', shade, .7);
    stroke(ctx, 'M28 29 L31 28 M46 25 L50 24', '#fff4d34d', .7);
    if (zombie) {
      shape(ctx, 'M36 44 Q44 42 52 43 L49 46 L40 46 Z', '#504439');
      shape(ctx, 'M43 43 L47 43 L47 45 L44 45 Z', '#e7d8a2', '');
      ellipse(ctx, 29, 39, 2, 1.1, '#596b47');
      ellipse(ctx, 31, 43, 1.3, 1, '#596b47');
    } else {
      stroke(ctx, type === 1 ? 'M35 44 Q44 41 52 43 M31 39 L34 42 M43 46 L48 46' :
        'M37 44 Q43 45 51 42', '#6b4f42');
    }
  }
  ctx.restore();
  ctx.restore();
}

const portraitCache=new Map<string,string>();
export function personPortrait(style:number,zombie=false) {
 const key=`${style}-${zombie}`;if(portraitCache.has(key))return portraitCache.get(key)!;
 const canvas=document.createElement('canvas');canvas.width=210;canvas.height=188;
 const ctx=canvas.getContext('2d')!;ctx.scale(2,2);paintPerson(ctx,style+(zombie?ZOMBIE_STYLE_OFFSET:0),0,'sw');
 const result=canvas.toDataURL();portraitCache.set(key,result);return result;
}
