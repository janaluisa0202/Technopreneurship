import type { FareMode } from '../types';
import type { FareTable, DistanceFareProfile } from '../types/route';

// Deliberately illustrative per-passenger entries, NOT official tariff rules.
// Missing categories stay unavailable. No universal discount is inferred.
export const sampleFareTables = {
  jeepNorth: { regular: 25, student: 20, senior: 20, pwd: 20 },
  uvNorth: { regular: 45, student: 34, senior: 35, pwd: 35 },
  mrt: { regular: 20, student: 16, senior: 16, pwd: 16 },
  lrt: { regular: 25, student: 20, senior: 20, pwd: 20 },
  modernMoa: { regular: 20, student: 16, senior: 16, pwd: 16 },
  busMoa: { regular: 24, student: 20, senior: 19, pwd: 19 },
  localTricycle: { regular: 30, senior: 25, pwd: 25 },
  localBus: { regular: 14, student: 11, senior: 11, pwd: 11 },
  ayalaBus: { regular: 35, student: 28, senior: 28, pwd: 28 },
  ayalaUv: { regular: 55, student: 45, senior: 44, pwd: 44 },
  taftPitx: { regular: 18, student: 14, senior: 14, pwd: 14 },
  pitxMoa: { regular: 16, student: 13, senior: 12, pwd: 12 },
  pitxModern: { regular: 22, student: 18, senior: 17, pwd: 17 },
  pitxUv: { regular: 30, student: 24, senior: 23, pwd: 23 },
  pasayAyalaUv: { regular: 42, student: 33, senior: 32, pwd: 32 },
  ustTaft: { regular: 20, student: 16, senior: 16, pwd: 16 },
} satisfies Record<string, FareTable>;

export const sampleDistanceProfiles: Record<FareMode, DistanceFareProfile> = {
  jeep: { thresholdKm: 4, base: { regular: 13, student: 10.4, senior: 10.4, pwd: 10.4 }, perKm: { regular: 2.2, student: 1.75, senior: 1.7, pwd: 1.7 } },
  bus: { thresholdKm: 5, base: { regular: 15, student: 12, senior: 12, pwd: 12 }, perKm: { regular: 2.5, student: 2, senior: 1.9, pwd: 1.9 } },
  uv: { thresholdKm: 3, base: { regular: 16, student: 13, senior: 12.5, pwd: 12.5 }, perKm: { regular: 2, student: 1.6, senior: 1.5, pwd: 1.5 } },
};
