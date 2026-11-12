import * as Phaser from 'phaser';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource/dm-serif-text/latin-400.css';
import { Cafe } from './core/simulation/cafe';
import { bindPointer } from './game/camera/pointer';
import { CafeScene } from './game/scenes/CafeScene';
import { webLifecycle } from './platform/lifecycle';
import { createDashboard } from './ui/dashboard';
import './ui/styles.css';

const cafe = new Cafe(undefined, 2035, new URLSearchParams(location.search).get('mode')==='playtest'?'playtest':'normal');
const dashboard = createDashboard(cafe);
const scene = new CafeScene(cafe, dashboard.refresh, dashboard.select, dashboard.inspect);
const stage = document.getElementById('game')!;
dashboard.bind(scene);
bindPointer(stage, scene);
const unsubscribe = webLifecycle.watch(active => scene.setActive(active));
const game = new Phaser.Game({
  type: Phaser.CANVAS,
  parent: stage,
  scene,
  scale: { mode: Phaser.Scale.RESIZE },
  input: { mouse: false, touch: false, keyboard: false, gamepad: false },
  audio: { noAudio: true },
});
game.events.once(Phaser.Core.Events.DESTROY, unsubscribe);

// Read-only development telemetry for recording actual simulation transitions.
if (import.meta.env.DEV) Object.defineProperty(window, 'nightshiftQA', { get: () => ({
  time: cafe.time, guests: structuredClone(cafe.guests), staff: structuredClone(cafe.employees),
  served: cafe.served, stock: cafe.stock, tasks: structuredClone(cafe.tasks), batches: structuredClone(cafe.batches), mode: cafe.mode, selected: scene.selected,
}) });
