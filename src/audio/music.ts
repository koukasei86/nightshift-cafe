import musicUrl from './midnight-reserve.mp3?inline';
export const MUSIC={title:'Midnight Reserve',bpm:76,duration:128*60/76};
/** One stereo loop, separate from sound-effect voices and gain. */
export class LoungeMusic {
 enabled=true;volume=.28;
 private buffer:AudioBuffer|null=null;private loading:Promise<void>|null=null;
 private node:AudioBufferSourceNode|null=null;private gain:GainNode|null=null;
 private ctx:AudioContext|null=null;private offset=0;private started=0;private disposed=false;
 error=false;
 get status(){return {enabled:this.enabled,volume:this.volume,playing:!!this.node&&this.enabled&&this.volume>0&&this.ctx?.state==='running',loaded:!!this.buffer,loading:!!this.loading,error:this.error,position:this.node&&this.ctx?(this.offset+this.ctx.currentTime-this.started)%MUSIC.duration:this.offset};}
 async start(ctx:AudioContext,output:AudioNode){
  if(this.disposed||!this.enabled||document.hidden)return;this.ctx=ctx;
  try{
   if(!this.buffer){
    if(!this.loading)this.loading=(async()=>{
     const bytes=Uint8Array.from(atob(musicUrl.split(',')[1]),v=>v.charCodeAt(0));
     const decoded=await ctx.decodeAudioData(bytes.buffer);
     const length=Math.round(MUSIC.duration*ctx.sampleRate),start=Math.floor((decoded.length-length)/2);
     if(start<0)throw Error('Music is shorter than the score');
     const loop=ctx.createBuffer(2,length,ctx.sampleRate);
     for(let ch=0;ch<2;ch++){
      const dst=loop.getChannelData(ch);dst.set(decoded.getChannelData(ch).subarray(start,start+length));
      // Remove only the tiny codec boundary mismatch, over 8 ms; no silence between loops.
      const difference=dst[length-1]-dst[0],fade=Math.round(ctx.sampleRate*.008);
      for(let i=0;i<fade;i++)dst[length-fade+i]-=difference*(i/(fade-1));
     }
     this.buffer=loop;this.error=false;
    })().finally(()=>{this.loading=null;});
    await this.loading;
   }
   if(this.disposed||!this.enabled||document.hidden||ctx.state!=='running'||this.node)return;
   this.gain=ctx.createGain();this.gain.gain.value=0;this.gain.connect(output);
   const node=ctx.createBufferSource();node.buffer=this.buffer;node.loop=true;node.connect(this.gain);
   this.node=node;this.started=ctx.currentTime;node.start(0,this.offset);
   this.gain.gain.setTargetAtTime(this.volume,ctx.currentTime,.25);
  }catch{this.error=true;/* Music decoding must not block play or sound effects. */}
 }
 setEnabled(value:boolean){this.enabled=value;this.updateGain();}
 setVolume(value:number){if(!Number.isFinite(value))return;this.volume=Math.max(0,Math.min(1,value));this.updateGain();}
 private updateGain(){if(this.gain&&this.ctx)this.gain.gain.setTargetAtTime(this.enabled?this.volume:0,this.ctx.currentTime,.08);}
 pause(){
  if(this.node&&this.ctx){this.offset=(this.offset+this.ctx.currentTime-this.started)%MUSIC.duration;this.node.stop();this.node.disconnect();this.node=null;}
  this.gain?.disconnect();this.gain=null;
 }
 dispose(){this.disposed=true;this.pause();this.buffer=null;}
}
