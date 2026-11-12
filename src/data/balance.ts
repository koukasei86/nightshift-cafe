export type TimeMode = 'normal' | 'playtest';
export const balance = Object.freeze({
  guestWalkSpeed: 0.95, staffWalkSpeed: 1.05, firstSpawn: 1000,
  spawnBase: 23000, spawnRatingSlope: 900, patience: 120000,
  meal: 16000, payment: 2200, seating: 650, pickup: 1400, serving: 1800,
  cleaning: 1600, outburst: 1600, burnDelay: 600000, restRecoveryPerSecond: 0.25,
  tipDeadline: 55000, blockedRetry: 1600, blockedCancel: 6000,
});
// First two durations use previously observed display examples as tuning references.
// Independent recipes: these are NOT verified one-to-one recreations.
export const normalCooking = [120000, 300000, 600000, 900000] as const;
export const normalPortions = [12, 20, 24, 30] as const;
