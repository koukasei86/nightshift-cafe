export const STEP_MS = 50;

export class FixedClock {
  private pendingMs = 0;

  advance(deltaMs: number, step: () => void) {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.pendingMs += Math.min(deltaMs, 500);
    while (this.pendingMs >= STEP_MS) {
      this.pendingMs -= STEP_MS;
      step();
    }
  }

  reset() {
    this.pendingMs = 0;
  }
}
