import { ellipse } from './geometry';
// Shared illustrated dish: recipe book, counter, dining table and carried plate.
export function paintFood(ctx: CanvasRenderingContext2D, kind: string, x=120, y=94, scale=1) {
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 const shape=(path:string,fill:string,line='#453529',width=2)=>{const p=new Path2D(path);ctx.fillStyle=fill;ctx.fill(p);if(line){ctx.strokeStyle=line;ctx.lineWidth=width;ctx.stroke(p);}};
 const line=(path:string,color:string,width=2)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke(new Path2D(path));};
 const oval=(x:number,y:number,w:number,h:number,c:string)=>ellipse(ctx,x,y,w,h,c);
 oval(3,24,91,18,'#352a2840');
 const plate=ctx.createLinearGradient(0,-10,0,32);plate.addColorStop(0,'#fffdf2');plate.addColorStop(1,'#b3b7a7');
 ellipse(ctx,0,12,91,32,plate);line('M-89 13 C-85 50 84 51 90 12','#514b41',2.5);
 oval(0,8,80,25,'#f9f4dd');oval(0,9,68,21,'#dedac3');
 line('M-74 2 Q-48 -15 -9 -13 M25 -12 Q63 -7 75 3','#fffef4',3);
 if(kind==='stew') {
  shape('M-57 -15 Q-60 29 -32 35 Q5 47 39 30 Q57 14 59 -15 Z','#b57c49');
  shape('M-55 -13 Q-54 24 -30 30 L-34 -9 Z','#d7a470','',0);
  oval(0,-16,62,24,'#463d29');oval(0,-18,57,20,'#c7b266');oval(0,-19,51,17,'#718842');
  line('M-32 -20 C-15 -35 32 -20 23 -12 C13 -3 -18 -12 -9 -18 C0 -23 14 -17 6 -14','#e5db9c',3);
  [[-31,-13],[28,-22],[14,-7]].forEach(([a,b])=>{shape(`M${a-6} ${b-4} l10 -2 4 6 -11 3 Z`,'#d5a154','#77603a',1);});
  shape('M-8 -27 Q-25 -46 -37 -31 Q-26 -17 -8 -27 M-6 -27 Q3 -49 16 -38 Q17 -24 -6 -27','#526932','#314b27',1.4);
  line('M-41 3 Q-28 12 -20 13','#edc284',2);
 } else if(kind==='toast') {
  shape('M-53 -23 Q-67 -43 -45 -48 Q-21 -57 -6 -42 L35 -11 14 26 -53 -7 Z','#93522e');
  shape('M-48 -24 Q-59 -39 -43 -42 Q-24 -49 -12 -36 L28 -10 10 17 -48 -9 Z','#e4ac59');
  shape('M-14 -32 Q-25 -53 -6 -57 Q21 -61 31 -43 L64 -6 38 23 -16 -5 Z','#a85f31');
  shape('M-8 -32 Q-17 -45 -3 -50 Q17 -53 24 -38 L55 -6 36 15 -10 -8 Z','#f0c777');
  for(let i=0;i<24;i++)oval(-39+(i*29)%86,-30+(i*13)%39,1.4,.9,'#9a602c80');
  shape('M-11 -20 Q16 -34 42 -8 L34 4 -1 -5 Z','#a84334');
  shape('M-1 -22 L9 -6 14 -24 24 -9 28 -20 35 -6 38 -17','#fbefc5','#b7a776',1.3);
  line('M-2 -33 Q11 -40 22 -30','#ffe5a1',2.5);
 } else if(kind==='pie') {
  oval(0,6,58,20,'#793c32');
  shape('M-60 0 L-49 -28 Q-12 -60 40 -33 L62 -6 49 21 -44 22 Z','#b96e39');
  shape('M-52 -7 L-44 -28 Q-7 -51 35 -30 L53 -9 Q17 13 -52 -7 Z','#e8b55f');
  shape('M-42 -4 Q-4 12 43 -5 L37 15 Q0 27 -38 10 Z','#653a30');
  shape('M-36 -2 Q-6 9 38 -2 L34 9 Q-4 17 -33 6 Z','#a84e3c','',0);
  for(let i=0;i<7;i++){const a=-42+i*14;line(`M${a} -22 l13 16`,'#bc793b',4);line(`M${a+3} -24 l13 16`,'#ffe0a0',1.4);}
  shape('M-8 -36 L5 -42 18 -32 4 -26 Z','#f5d490');line('M4 -37 L7 -30','#8f613c');
  for(let i=0;i<9;i++)oval(-49+i*12,14+Math.sin(i)*5,3.2,2,'#db994d');
  oval(65,12,3,2,'#b57a40');oval(-64,8,2,1.5,'#c78b42');
 } else {
  oval(17,0,52,20,'#62763a');oval(21,-4,48,17,'#7c9145');
  shape('M-60 4 Q-64 -38 -35 -45 Q-6 -47 0 -9 L-7 11 Z','#eee4b9','#a69d7b',1.5);
  for(let i=0;i<42;i++) {const a=-52+(i*19)%43,b=-28+(i*11)%35;line(`M${a} ${b} l3 -1`,'#fff8db',1.6);}
  oval(-35,-23,8,6,'#655c45');oval(-14,-23,7,6,'#655c45');shape('M-28 -11 l6 -1 -3 5 Z','#655c45','',0);
  line('M-38 0 L-15 1 M-31 -3 L-31 4 M-23 -3 L-23 4','#9c9471',1.3);
  [[18,-10],[43,2],[25,9]].forEach(([a,b])=>shape(`M${a-7} ${b-4} l11 -4 6 7 -12 5 Z`,'#bc8a41','#755f34',1));
  shape('M31 -16 Q40 -35 54 -26 Q50 -12 31 -16','#3b6736','#2e4d2c',1.3);
 }
 for(let i=0;i<5;i++)oval(45+i*4,19-Math.sin(i)*6,1.4,1,'#61733c');
 ctx.restore();
}
const urls=new Map<string,string>();
export function foodImage(kind:string) {
 if(!urls.has(kind)) {const c=document.createElement('canvas');c.width=480;c.height=300;const ctx=c.getContext('2d')!;ctx.scale(2,2);paintFood(ctx,kind,120,88,1.08);urls.set(kind,c.toDataURL());}
 return urls.get(kind)!;
}
