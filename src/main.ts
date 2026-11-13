import { CafeAudio } from './audio/engine';
import { SoundTracker } from './audio/tracker';
import * as Phaser from 'phaser';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource/dm-serif-text/latin-400.css';
import { Cafe } from './core/simulation/cafe';
import { bindPointer } from './game/camera/pointer';
import { CafeScene } from './game/scenes/CafeScene';
import { restoreCafe, attachPersistence } from './platform/persistence';
import { createDashboard } from './ui/dashboard';
import './ui/styles.css';

const restored=(()=>{try{return restoreCafe(localStorage);}catch{return {cafe:null,warning:'このブラウザでは保存を利用できません'};}})();
const cafe = restored.cafe ?? new Cafe(undefined,2035,new URLSearchParams(location.search).get('mode')==='playtest'?'playtest':'normal');
if(restored.warning)cafe.notice=restored.warning;
const audio=new CafeAudio();
const sounds=new SoundTracker(cafe,id=>audio.play(id));
const dashboard = createDashboard(cafe,audio);
const scene = new CafeScene(cafe, dashboard.refresh, dashboard.select, dashboard.inspect);
scene.onTick=()=>sounds.update(cafe);
scene.feedback=id=>audio.play(id);
const stage = document.getElementById('game')!;
dashboard.bind(scene);
bindPointer(stage, scene);
const persistence = attachPersistence(cafe, active => {
 scene.setActive(active);sounds.reset(cafe);
 if(!active)audio.background();else if(audio.status.state!=='locked')audio.unlock();
});
const unlockAudio=()=>audio.unlock();
document.addEventListener('pointerdown',unlockAudio,{capture:true});
document.addEventListener('keydown',unlockAudio,{capture:true});
document.addEventListener('click',()=>setTimeout(persistence.save,0));
document.addEventListener('change',()=>setTimeout(persistence.save,0));
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: stage,
  scene,
  scale: { mode: Phaser.Scale.RESIZE },
  input: { mouse: false, touch: false, keyboard: false, gamepad: false },
  audio: { noAudio: true },
});
game.events.once(Phaser.Core.Events.DESTROY,()=>{persistence.dispose();audio.dispose();document.removeEventListener('pointerdown',unlockAudio,true);document.removeEventListener('keydown',unlockAudio,true);});

// Read-only development telemetry for recording actual simulation transitions.
if (import.meta.env.DEV) Object.defineProperty(window, 'nightshiftQA', { get: () => ({
  audio:audio.status,editing:structuredClone(scene.editItems),editSelected:scene.editSelected,
  coins:cafe.coins, furniture:structuredClone(cafe.furniture), seats:structuredClone(cafe.seats), orders:[...cafe.orders.entries()],
  time: cafe.time, guests: structuredClone(cafe.guests), staff: structuredClone(cafe.employees),
  served: cafe.served, stock: cafe.stock, tasks: structuredClone(cafe.tasks), batches: structuredClone(cafe.batches), mode: cafe.mode, selected: scene.selected,
}) });
