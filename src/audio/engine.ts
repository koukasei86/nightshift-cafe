import { LoungeMusic } from './music';
import {renderEffect,type SoundId} from './effects';
const KEY='nightshift-cafe-sound-v1';
export class CafeAudio {
 enabled=true;volume=.45;
 readonly music=new LoungeMusic();
 private output:AudioNode|null=null;
 private ctx:AudioContext|null=null;private master:GainNode|null=null;
 private buffers=new Map<SoundId,AudioBuffer>();private voices=new Set<AudioBufferSourceNode>();
 private last=new Map<SoundId,number>();private disposed=false;
 private events:Array<{id:SoundId;at:number}>=[];
 constructor(){try{const s=JSON.parse(localStorage.getItem(KEY)??'null');if(s){this.enabled=s.enabled!==false;this.music.enabled=s.musicEnabled??this.enabled;if(Number.isFinite(s.musicVolume))this.music.setVolume(s.musicVolume);if(Number.isFinite(s.volume))this.volume=Math.max(0,Math.min(1,s.volume));}}catch{}}
 get status(){return {enabled:this.enabled,volume:this.volume,state:this.ctx?.state??'locked',active:this.voices.size,music:this.music.status,events:[...this.events]};}
 unlock(){
  if(this.disposed||(!this.enabled&&!this.music.enabled)||document.hidden)return;
  try {
   if(!this.ctx){const Constructor=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Constructor)return;
    this.ctx=new Constructor();this.master=this.ctx.createGain();this.master.gain.value=this.volume;
    const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-9;limiter.knee.value=4;limiter.ratio.value=12;limiter.attack.value=.002;limiter.release.value=.09;
    this.master.connect(limiter);limiter.connect(this.ctx.destination);this.output=limiter;
   }
   const ctx=this.ctx,output=this.output!;
   if(ctx.state!=='running')void ctx.resume().then(()=>this.music.start(ctx,output)).catch(()=>{});else void this.music.start(ctx,output);
  }catch{/* Sound failure must never stop the simulation. */}
 }
 play(id:SoundId){
  const c=this.ctx;if(this.disposed||!this.enabled||this.volume===0||document.hidden||!c||c.state!=='running'||!this.master)return false;
  const now=c.currentTime;if(now-(this.last.get(id)??-Infinity)<(id==='tap'?.065:.16)||this.voices.size>=6)return false;
  this.last.set(id,now);
  let buffer=this.buffers.get(id);if(!buffer){const samples=renderEffect(id,c.sampleRate);buffer=c.createBuffer(1,samples.length,c.sampleRate);buffer.copyToChannel(samples,0);this.buffers.set(id,buffer);}
  const node=c.createBufferSource();node.buffer=buffer;node.connect(this.master);this.voices.add(node);
  node.onended=()=>{node.disconnect();this.voices.delete(node);};node.start();
  if(import.meta.env.DEV){this.events.push({id,at:now});if(this.events.length>80)this.events.shift();}
  return true;
 }
 setEnabled(value:boolean){this.enabled=value;if(!value)this.stop();else this.unlock();this.persist();}
 setVolume(value:number){if(!Number.isFinite(value))return;this.volume=Math.max(0,Math.min(1,value));if(this.master&&this.ctx)this.master.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.015);if(this.volume===0)this.stop();this.persist();}
 setMusicEnabled(value:boolean){this.music.setEnabled(value);if(value)this.unlock();this.persist();}
 setMusicVolume(value:number){this.music.setVolume(value);this.persist();}
 private persist(){try{localStorage.setItem(KEY,JSON.stringify({enabled:this.enabled,volume:this.volume,musicEnabled:this.music.enabled,musicVolume:this.music.volume}));}catch{}}
 stop(){for(const voice of this.voices){try{voice.stop();}catch{}voice.disconnect();}this.voices.clear();this.last.clear();}
 background(){this.music.pause();this.stop();if(this.ctx?.state==='running')void this.ctx.suspend().catch(()=>{});}
 dispose(){this.disposed=true;this.music.dispose();this.stop();if(this.ctx)void this.ctx.close().catch(()=>{});this.buffers.clear();}
}
