export type TimeMode = 'normal' | 'playtest';
export const balance = Object.freeze({
  guestWalkSpeed: 1.95, staffWalkSpeed: 2.15, firstSpawn: 1000,
  spawnBase: 7300, spawnRatingSlope: 570, patience: 31000,
  meal: 3400, payment: 800, seating: 320, pickup: 450, serving: 800,
  cleaning: 700, outburst: 1600, burnDelay: 22000, restRecoveryPerSecond: 4.5,
  tipDeadline: 14000, blockedRetry: 1600, blockedCancel: 6000,
});
// First two durations use previously observed display examples as tuning references.
// Independent recipes: these are NOT verified one-to-one recreations.
export const normalCooking = [120000, 300000, 600000, 900000] as const;
export const normalPortions = [12, 20, 24, 30] as const;
