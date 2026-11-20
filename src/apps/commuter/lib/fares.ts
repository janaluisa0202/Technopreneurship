import { distanceProfiles } from '../services/catalog';
import type { FareMode, Passenger } from '../types';
import type { FareTable, RouteItinerary } from '../types/route';

export const roundFare = (value: number) => Math.round(value * 100) / 100;
export function fareForPassenger(table: FareTable, passenger: Passenger): number | null {
  const value = table[passenger];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? roundFare(value) : null;
}
export function totalFares(values: (number | null)[]) {
  const knownFare = roundFare(values.reduce<number>((sum, value) => sum + (value ?? 0), 0));
  const missingFares = values.filter(value => value === null).length;
  return { fare: missingFares ? null : knownFare, knownFare, missingFares };
}
export function sampleDistanceFare(mode: FareMode, distance: number, passenger: Passenger): number | null {
  const profile = distanceProfiles[mode];
  const base = fareForPassenger(profile.base, passenger);
  const extra = fareForPassenger(profile.perKm, passenger);
  return base === null || extra === null ? null : roundFare(base + Math.max(0, distance - profile.thresholdKm) * extra);
}
export function repriceItinerary(route: RouteItinerary, passenger: Passenger): RouteItinerary {
  const legs = route.legs.map(leg => ({ ...leg, fare: leg.segment.mode === 'walk' ? 0 : fareForPassenger(leg.segment.fares, passenger) }));
  return { ...route, legs, passenger, metrics: { ...route.metrics, ...totalFares(legs.map(leg => leg.fare)) } };
}
