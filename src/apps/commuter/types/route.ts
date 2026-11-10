import type { Passenger, Priority, QueueLevel } from '../types';

export type TransportMode = 'walk' | 'jeepney' | 'modern-jeepney' | 'uv' | 'bus' | 'mrt' | 'lrt' | 'tricycle';
export type FareTable = Partial<Record<Passenger, number>>;
export interface DistanceFareProfile {base:FareTable;perKm:FareTable;thresholdKm:number;}
export interface TransportNode { id: string; name: string; placeId?: string; areaId?: string; }
export interface TransportSegment {
  id: string;
  from: string;
  to: string;
  mode: TransportMode;
  service: string;
  serviceId?: string;
  signboard: string;
  boarding: string;
  alighting: string;
  instruction: string;
  travelMinutes: number;
  // Dwell for changing vehicles, applied only after an earlier ride.
  transferMinutes: number;
  boardingWaitMinutes: number;
  fares: FareTable;
  queue?: { terminal: string; defaultLevel: QueueLevel; minutes: Record<QueueLevel, number> };
}
export interface TransportNetwork { nodes: TransportNode[]; segments: TransportSegment[]; }
export interface QueueObservation {
  minutes: number;
  level: QueueLevel;
  source: 'community' | 'sample' | 'stale';
  label: string;
  reportedAt?: string;
}
export interface EvaluatedLeg {
  segment: TransportSegment;
  fare: number | null;
  queue: QueueObservation;
  transferMinutes: number;
}
export interface JourneyMetrics {
  walkingMinutes: number;
  ridingMinutes: number;
  queueMinutes: number;
  boardingWaitMinutes: number;
  waitingMinutes: number;
  transferMinutes: number;
  totalMinutes: number;
  advisoryDelayMinutes?: number;
  transfers: number;
  fare: number | null;
  knownFare: number;
  missingFares: number;
}
export interface RouteItinerary {
  id: string;
  originId: string;
  destinationId: string;
  name: string;
  legs: EvaluatedLeg[];
  metrics: JourneyMetrics;
  passenger: Passenger;
  computedAt: string;
  reason: string;
  advisoryImpacts?: import('./roadwatch').AdvisoryRouteImpact[];
  unavailable?: boolean;
}
export interface RouteRequest {
  originId: string;
  destinationId: string;
  passenger: Passenger;
  priority: Priority;
}
