/** Original synthesized effects. No YouTube audio or external samples are bundled. */
export const soundLabels = {
 tap:'選択',door:'扉の開閉',arrival:'来店ベル',cook:'調理開始',ready:'料理完成',plate:'配膳・食器',cash:'会計',infect:'ゾンビ化',level:'レベルアップ',buy:'家具購入',rotate:'家具の回転',place:'家具の配置',error:'操作できない時',rest:'休憩',
} as const;
export type SoundId=keyof typeof soundLabels;
const lengths:Record<SoundId,number>={tap:.10,door:.45,arrival:.72,cook:.95,ready:1.05,plate:.4,cash:.7,infect:1.15,level:1.25,buy:.5,rotate:.18,place:.3,error:.35,rest:.5};
export function renderEffect(id:SoundId,rate=44100):Float32Array<ArrayBuffer> {
 const data=new Float32Array(Math.ceil(lengths[id]*rate));let seed=18727;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
 const tone=(start:number,duration:number,hz:number,gain:number,endHz=hz,harmonic=0)=>{
  let phase=0;for(let i=0;i<Math.ceil(duration*rate);i++){
   const t=i/rate,index=Math.floor(start*rate)+i;if(index>=data.length)break;
   phase+=2*Math.PI*(hz+(endHz-hz)*t/duration)/rate;
   const env=Math.min(1,t/.003)*Math.exp(-t/(duration*.24))*Math.min(1,(duration-t)/.015);
   data[index]+=gain*env*(Math.sin(phase)+harmonic*Math.sin(phase*2.01));
  }
 };
 const noise=(start:number,duration:number,gain:number,rough=.3)=>{
  let low=0;for(let i=0;i<Math.ceil(duration*rate);i++){
   const t=i/rate,index=Math.floor(start*rate)+i;if(index>=data.length)break;
   low+=(random()-low)*rough;
   data[index]+=low*gain*Math.min(1,t/.004)*Math.exp(-t/(duration*.32))*Math.min(1,(duration-t)/.02);
  }
 };
 const bell=(at:number,hz:number,gain:number,d=.65)=>{tone(at,d,hz,gain);tone(at,d*.6,hz*2.76,gain*.24);tone(at,d*.3,hz*5.4,gain*.06);};
 const ceramic=(at:number,gain:number)=>{noise(at,.03,gain*.2);tone(at,.27,1830,gain);tone(at,.19,2610,gain*.38);tone(at,.12,3370,gain*.16);};
 switch(id){
  case 'tap':tone(0,.075,610,.23,350,.2);noise(0,.024,.11);break;
  case 'rotate':tone(0,.11,360,.3,510,.35);noise(.045,.06,.17,.13);break;
  case 'place':noise(0,.13,.45,.08);tone(0,.19,145,.35,78,.1);noise(.09,.1,.13);break;
  case 'door':noise(0,.09,.23,.12);tone(.03,.26,195,.12,108,.5);noise(.28,.12,.4,.08);tone(.28,.15,95,.28,64);break;
  case 'arrival':bell(0,1397,.24,.5);bell(.16,1047,.20,.53);break;
  case 'cook':noise(0,.07,.4,.7);tone(0,.08,130,.18,65);noise(.075,.83,.45,.68);for(let i=0;i<7;i++)tone(.15+i*.09,.07,160+i*23,.09,90);break;
  case 'ready':bell(0,880,.3,.65);bell(.22,1175,.26,.78);break;
  case 'plate':ceramic(0,.24);ceramic(.09,.11);noise(.025,.18,.08,.1);break;
  case 'cash':noise(0,.07,.23,.25);tone(0,.13,155,.27,80);bell(.055,1760,.23,.5);bell(.19,2349,.16,.48);noise(.38,.13,.16,.1);break;
  case 'buy':tone(0,.13,170,.26,90);bell(.03,1568,.19,.35);bell(.12,1175,.16,.33);noise(.28,.14,.2,.1);break;
  case 'infect':for(let i=0;i<9;i++)tone(i*.07,.14,160+i*31,.17,80+i*13,.25);tone(.2,.85,110,.18,58,.55);noise(.08,.8,.19,.055);break;
  case 'level':[523,659,784,1047].forEach((hz,i)=>bell(i*.15,hz,.22,.7));break;
  case 'error':tone(0,.14,170,.21,140,.4);tone(.15,.16,140,.18,110,.3);break;
  case 'rest':tone(0,.44,280,.12,140);noise(0,.4,.13,.03);break;
 }
 // A short zero tail and deterministic peak ceiling avoid edge clicks and clipping.
 let peak=0;for(const v of data)peak=Math.max(peak,Math.abs(v));const scale=peak>.65?.65/peak:1;
 for(let i=0;i<data.length;i++)data[i]*=scale*Math.min(1,(data.length-1-i)/(rate*.012));
 return data;
}
