import type { CharacterLook } from '../../data/characters';
import { ellipse } from './geometry';
const ink='#292a22';
function shape(c:CanvasRenderingContext2D,p:string,fill:string,line=ink,w=1.25){const path=new Path2D(p);c.fillStyle=fill;c.fill(path);if(line){c.strokeStyle=line;c.lineWidth=w;c.stroke(path);}}
function line(c:CanvasRenderingContext2D,p:string,color=ink,w=.85){c.strokeStyle=color;c.lineWidth=w;c.stroke(new Path2D(p));}
export function referencePalette(v:CharacterLook){
 const shirt={polo:'#555d3d',redvest:'#963936',tie:'#e8e8da',tracksuit:'#cd7135',skirt:'#323332',bluevest:'#344354',skull:'#303233'}[v.outfit];
 return {skin:v.dark?'#ab875e':'#cec697',shade:v.dark?'#7e6548':'#a39e77',hair:v.hair==='blue'?'#316373':v.hair==='blonde'?'#e8cd78':v.hair==='white'?'#ece9df':v.hair==='flat'?'#282b2c':'#5c4d32',shirt,light:v.outfit==='redvest'?'#e3e4d8':v.outfit==='bluevest'?'#9b969f':shirt,trousers:['polo','skull'].includes(v.outfit)?'#455c72':['redvest','bluevest'].includes(v.outfit)?'#b9ae88':v.outfit==='tracksuit'?'#cd7135':'#353737'};
}
export function paintOutfit(c:CanvasRenderingContext2D,v:CharacterLook,rear:boolean,skin:string){
 if(v.outfit==='redvest'||v.outfit==='bluevest'){
  shape(c,'M24 45 L28 44 L33 50 L39 44 L43 46 L44 68 Q34 72 23 68 Z',v.outfit==='redvest'?'#9e3937':'#344557');
  line(c,'M27 46 L33 53 L40 46 M25 65 Q33 68 42 65',v.outfit==='redvest'?'#d87863':'#74859b',.9);
  if(!rear)shape(c,'M28 44 L33 47 L31 51 L26 46 M33 47 L38 44 L40 47 L35 51 Z','#e9e7da',ink,.65);
 }else if(v.outfit==='tie'){
  if(!rear){shape(c,'M25 44 L32 47 L39 44 L42 48 L36 52 L32 48 L28 51 Z','#f1efdf',ink,.8);shape(c,'M32 49 L35 49 L36 52 L34 55 L38 65 L35 68 L32 65 L33 54 L31 52 Z','#a83b38',ink,.7);line(c,'M39 55 L44 55 L44 60 L39 60 Z','#7c7f73');}
  line(c,'M23 67 Q34 70 45 67','#aaa995');
 }else if(v.outfit==='skirt'){
  shape(c,'M25 44 L32 50 L39 44 L43 48 L40 58 L45 72 Q34 76 23 71 L26 58 L21 49 Z','#343735');
  if(!rear){shape(c,'M28 45 L33 49 L37 45 L35 56 Z',skin,ink,.6);line(c,'M25 47 L29 55 L33 53 M39 47 L35 58 M33 59 L32 66','#62685b',1);ellipse(c,33,60,.7,.7,'#b6b292');}
  line(c,'M27 69 Q34 72 42 69','#666a5b');
 }else if(v.outfit==='tracksuit'){
  line(c,'M32 45 L33 68','#f2c378',1.3);line(c,'M25 49 L26 65 M41 49 L42 65','#e4a951',1.7);
  shape(c,'M28 44 L32 48 L36 44 L38 46 L34 52 L30 51 L26 46 Z','#e0a451',ink,.6);
  line(c,'M28 61 L30 63 M36 63 L39 61','#925329');
 }else if(v.outfit==='polo'){
  shape(c,'M25 44 L31 47 L37 44 L41 47 L36 51 L31 48 L27 51 Z','#303a2d',ink,.65);line(c,'M32 49 L33 57','#969b76',.8);
  ellipse(c,33,52,.65,.65,'#ccc9a9');ellipse(c,33,55,.65,.65,'#ccc9a9');
 }else if(v.outfit==='skull'&&!rear){
  // Skull emblem is drawn as a face, not a generic cross or emoji.
  shape(c,'M29 55 Q28 50 34 50 Q41 50 40 55 L39 59 L37 60 L37 63 L32 63 L32 60 L29 59 Z','#e6e6d7',ink,.65);
  ellipse(c,32,55,1.7,2,'#353b35');ellipse(c,37,55,1.5,2,'#353b35');shape(c,'M34 57 L36 59 L33 59 Z','#353b35','');line(c,'M34 60 L34 63 M36 60 L36 63',ink,.55);
 }
}
const hairPaths:Partial<Record<CharacterLook['hair'],string>>={
 messy:'M10 29 L11 23 L7 24 L13 17 L7 19 L17 10 L13 9 L25 7 L30 4 L33 7 L42 5 L41 8 Q54 9 57 20 Q58 28 51 33 L46 28 L44 17 L38 23 L38 17 L30 24 L29 18 L22 25 L21 21 L16 30 L14 25 Z',
 bob:'M12 40 Q7 32 10 22 Q10 10 26 7 Q42 4 52 14 Q58 21 56 40 L48 46 L47 27 Q39 26 31 15 Q26 25 19 29 L22 46 Z',
 blonde:'M11 32 Q6 24 12 16 Q17 7 29 7 Q45 3 53 15 Q59 21 54 28 L47 24 Q36 26 29 16 Q26 24 20 29 L20 36 L15 39 Z',
 quiff:'M11 32 Q5 22 14 15 Q21 10 30 9 Q37 7 41 2 Q42 8 49 9 L52 7 Q59 17 55 26 Q47 25 44 21 Q34 25 25 24 L22 34 L16 37 Z',
 blue:'M11 32 L7 23 L12 17 L9 12 L18 13 L21 6 L27 9 L35 3 L39 9 L47 5 L48 12 L55 12 L52 18 L58 22 L53 28 L44 24 L36 23 L28 25 L23 33 L17 35 Z',
 flat:'M11 31 L9 25 Q5 22 9 18 Q5 14 11 12 Q9 7 16 8 Q17 3 23 6 Q26 1 31 5 Q36 1 41 6 Q48 2 50 8 Q57 6 56 12 Q62 13 57 19 Q62 23 56 27 L52 32 L44 28 L24 29 L21 36 L16 37 Z',
 bowl:'M11 32 Q6 20 15 12 Q24 5 36 7 Q51 6 55 19 L56 27 Q48 26 40 21 Q33 17 31 12 Q28 22 20 28 L20 36 L15 39 Z',
 white:'M11 29 Q6 24 12 20 Q9 15 16 13 Q14 7 22 9 Q26 3 32 7 Q39 3 44 8 Q51 5 53 12 Q61 12 57 20 Q62 25 55 28 L46 25 L30 24 L24 32 L19 36 L13 35 Z',
};
export function paintReferenceHead(c:CanvasRenderingContext2D,v:CharacterLook,rear:boolean,skin:string,shade:string,zombie:boolean,step:number){
 const palette=referencePalette(v),hair=palette.hair;
 const jaw=v.broad?'M13 16 Q27 5 43 11 Q54 15 56 25 L55 32 L61 37 L55 41 L54 53 L36 54 L24 49 L16 41 L10 29 Z':v.female?'M14 16 Q27 5 42 11 Q53 14 55 24 L54 32 L59 37 L55 40 Q55 48 46 51 Q33 52 23 44 L14 35 Z':'M13 17 Q24 6 40 10 Q53 12 56 25 L54 31 L61 38 L55 41 L56 46 Q52 52 43 51 L28 47 Q17 44 13 35 Z';
 shape(c,jaw,skin,ink,1.5);
 shape(c,'M13 29 L21 34 Q25 43 36 46 L47 50 L37 49 Q22 47 16 40 Z',shade,'');
 if(v.hair==='bald'){
  shape(c,'M12 25 Q9 16 18 12 L18 18 L15 23 L19 29 L17 34 L12 32 Z','#64634c',ink,.8);
  line(c,'M23 11 L24 9 M27 10 L29 8 M33 9 L34 7',ink,.75);
  ellipse(c,39,14,1,.7,shade);ellipse(c,44,18,.8,.9,shade);ellipse(c,34,17,.7,.7,shade);
 }else if(v.hair!=='helmet'){
  shape(c,hairPaths[v.hair]!,hair,ink,1.5);
  const shine=v.hair==='blue'?'#548792':v.hair==='flat'?'#454749':v.hair==='white'?'#c7c7bc':v.hair==='blonde'?'#f6e3a1':'#8c7951';
  line(c,v.hair==='flat'?'M13 17 Q11 12 17 13 M24 12 Q21 7 27 9 M38 12 Q43 7 46 14 M50 19 Q55 14 56 20':v.hair==='bob'||v.hair==='bowl'?'M14 23 Q15 13 28 10 M34 11 Q40 20 51 22 M13 28 L15 37':'M15 22 Q21 14 29 14 M33 14 L40 11 M40 18 L48 17',shine,1.05);
 }
 if(rear){
  if(v.hair!=='bald'&&v.hair!=='helmet'){
   shape(c,'M12 27 Q26 31 38 30 Q48 29 55 25 L54 39 Q47 48 34 46 Q19 44 13 36 Z',hair,ink,1.1);
   line(c,'M17 36 Q29 42 44 39 M43 42 L50 38',v.hair==='blue'?'#548792':'#7b7357',.9);
  }else{line(c,'M15 28 Q10 33 17 37 M23 42 Q37 48 49 43',shade);}
 }else{
  shape(c,'M22 32 Q14 26 13 33 Q13 41 21 40 L24 36',skin,ink,1.1);line(c,'M16 33 Q20 32 20 37',shade,1);
  const round=v.female||v.hair==='bowl';
  shape(c,round?'M30 29 Q36 25 43 29 Q46 38 36 39 Q29 38 30 29 Z':'M29 29 Q36 26 44 29 L43 36 Q36 39 30 35 Z',zombie?'#e9e1ad':'#eeeece',ink,1);
  shape(c,round?'M46 29 Q51 26 56 30 L55 36 Q50 39 46 35 Z':'M46 29 Q51 27 56 29 L55 35 L46 35 Z',zombie?'#e9e1ad':'#eeeece',ink,1);
  ellipse(c,39,33,1.6,step===29?.5:2.2,ink);ellipse(c,52,32.5,1.4,step===29?.5:1.9,ink);
  if(!round){shape(c,'M30 29 L43 29 L43 32 L30 31 Z',skin,'');shape(c,'M46 29 L55 29 L55 31 L46 32 Z',skin,'');line(c,'M30 31 L43 32 M46 32 L55 31',ink,.7);}
  line(c,'M29 26 Q36 24 43 26 M46 26 L55 25',ink,v.hair==='blue'||v.broad?1.8:1.1);
  if(v.female)line(c,'M30 30 L28 28 M30 33 L27 32 M55 29 L57 27',ink,1);
  if(v.glasses){
   line(c,'M21 30 L28 30 M28 28 L44 29 L44 39 Q35 42 29 37 Z M45 31 L47 31 M47 29 L57 28 L57 37 Q52 40 47 37 Z',v.dark?'#252a29':'#3d5657',2.1);
   line(c,'M30 29 L41 30 M49 30 L55 29','#a5b3a0',.65);
  }
  shape(c,v.old?'M46 32 L48 39 L54 42 L48 44 L44 42':'M46 33 L48 38 L54 40 L48 42 L45 40',skin,ink,.8);
  if(v.old){line(c,'M29 41 L33 43 M30 44 L35 46 M35 39 L40 40 M48 47 L52 46 M37 43 L35 47 M36 48 L41 49',shade,.9);}
  if(v.dark){shape(c,'M31 43 L36 42 L40 43 L42 42 L50 43 L49 45 L42 45 L40 48 L36 47 Z','#454331','',.5);line(c,'M35 48 L43 49',ink,1.2);}
  else if(v.female){shape(c,'M38 44 Q42 42 45 44 L51 43 Q47 48 42 47 Z',zombie?'#7c7254':'#8a4147',ink,.65);line(c,'M41 45 L48 45','#d5a292',.6);}
  else if(zombie){shape(c,'M35 44 Q44 42 52 44 L49 47 L39 47 Z','#524d39',ink,.7);shape(c,'M41 44 L45 44 L45 46 L42 46 Z','#e7dfb4','');}
  else{line(c,v.old?'M38 46 L43 44 L48 45':'M35 44 Q43 47 51 43','#5e5942',1);if(v.hair==='quiff')shape(c,'M39 44 L48 44 L46 46 L40 46 Z','#ede7cc',ink,.5);}
  if(v.hair==='blue'){for(const [x,y] of [[27,37],[28,40],[32,43],[48,22]])ellipse(c,x,y,.65,.65,'#90785b');ellipse(c,17,39,1.4,1.7,'#c4c1ac');}
  if(v.broad)line(c,'M44 49 L47 51 M47 49 L44 51',shade,.85);
  if(zombie){line(c,'M25 38 L29 40 M26 37 L25 40 M28 38 L27 41','#69714a',.7);ellipse(c,31,43,1.2,.8,'#727c4c');}
 }
 if(v.hair==='helmet'){
  shape(c,'M10 25 L12 17 Q15 7 29 6 Q48 5 53 15 L55 25 Z','#e9c641',ink,1.6);
  shape(c,'M12 18 Q17 9 29 8 L29 22 L16 24 Z','#f8dc65','');
  shape(c,'M28 7 L33 7 L36 23 L31 24 Z','#d9ae2c',ink,.7);
  shape(c,'M42 9 L46 11 L50 24 L46 25 Z','#ba9324',ink,.7);
  shape(c,'M9 24 Q31 20 55 24 L60 28 Q40 33 14 30 L8 28 Z','#e4bc35',ink,1.3);
  line(c,'M12 25 Q33 22 53 26','#ffdf6c',1.2);
 }
}
