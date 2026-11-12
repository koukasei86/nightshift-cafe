import type { CafeScene } from '../scenes/CafeScene';

export function bindPointer(stage: HTMLElement, scene: CafeScene) {
  let drag: { id: number; startX: number; startY: number; x: number; y: number; moved: boolean } | null = null;

  stage.addEventListener('pointerdown', event => {
    if (drag || event.button !== 0) return;
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, moved: false };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5;
    if (!drag.moved) return;
    scene.pan(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  stage.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    if (!drag.moved) {
      const bounds = stage.getBoundingClientRect();
      scene.pick(event.clientX - bounds.left, event.clientY - bounds.top);
    }
    drag = null;
  });
  stage.addEventListener('lostpointercapture', event => {
    if (drag?.id === event.pointerId) drag = null;
  });
}
