import type { CafeScene } from '../scenes/CafeScene';

export function bindPointer(stage: HTMLElement, scene: CafeScene) {
 type Gesture={id:number;startX:number;startY:number;x:number;y:number;moved:boolean;grabbed:boolean;furniture:string|null;origin:{x:number;y:number}|null;timer:ReturnType<typeof setTimeout>|null};
 let gesture:Gesture|null=null;
 const local=(x:number,y:number)=>{const r=stage.getBoundingClientRect();return {x:x-r.left,y:y-r.top};};
 const cancel=(restore:boolean)=>{
  if(!gesture)return;
  if(gesture.timer)clearTimeout(gesture.timer);
  if(restore&&gesture.grabbed&&gesture.furniture&&gesture.origin)scene.editorAction?.('move',gesture.furniture,gesture.origin);
  stage.classList.remove('furniture-grabbed');gesture=null;
 };
 stage.addEventListener('contextmenu',event=>{if(scene.editItems)event.preventDefault();});
 stage.addEventListener('pointerdown',event=>{
  if(gesture||event.button!==0)return;
  const p=local(event.clientX,event.clientY),id=scene.editorHit(p.x,p.y),f=scene.editItems?.find(f=>f.id===id);
  gesture={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,moved:false,grabbed:false,furniture:id,origin:f?{x:f.x,y:f.y}:null,timer:null};
  const current=gesture;
  if(id)current.timer=setTimeout(()=>{
    if(gesture!==current||current.moved||!scene.editItems)return;
    current.grabbed=true;scene.feedback?.('tap');scene.editorAction?.('select',id);stage.classList.add('furniture-grabbed');
  },450);
  stage.setPointerCapture(event.pointerId);
 });
 stage.addEventListener('pointermove',event=>{
  if(gesture?.id!==event.pointerId)return;
  const g=gesture;g.moved ||= Math.hypot(event.clientX-g.startX,event.clientY-g.startY)>7;
  if(g.grabbed&&g.furniture&&g.origin){
    const p=local(event.clientX,event.clientY),o=local(g.startX,g.startY),d=scene.editorDelta(p.x,p.y,o.x,o.y);
    scene.editorAction?.('move',g.furniture,{x:g.origin.x+d.x,y:g.origin.y+d.y});
  }else if(g.moved){if(g.timer){clearTimeout(g.timer);g.timer=null;}scene.pan(event.clientX-g.x,event.clientY-g.y);}
  g.x=event.clientX;g.y=event.clientY;
 });
 stage.addEventListener('pointerup',event=>{
  if(gesture?.id!==event.pointerId)return;
  const g=gesture;
  if(g.grabbed){const valid=scene.editorDropValid(g.furniture!);scene.feedback?.(valid?'place':'error');cancel(!valid);}
  else {if(!g.moved){const p=local(event.clientX,event.clientY);scene.pick(p.x,p.y);}cancel(false);}
 });
 stage.addEventListener('pointercancel',()=>cancel(true));
 stage.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId)cancel(true);});
 window.addEventListener('blur',()=>cancel(true));
}
