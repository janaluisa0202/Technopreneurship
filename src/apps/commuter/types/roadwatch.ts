import type { RouteItinerary } from './route';

export type AdvisoryCategory = 'traffic' | 'closure' | 'flooding' | 'transport' | 'roadworks';
export type AdvisorySeverity = 'low' | 'moderate' | 'high' | 'critical';
export type AdvisoryStatus = 'active' | 'scheduled' | 'resolved' | 'expired' | 'unknown';
export type AdvisoryImpactType = 'informational' | 'delay' | 'service-interruption' | 'segment-closure' | 'unknown';
export interface RoadAdvisory {
  id: string;
  incidentId?: string;
  title: string;
  description: string;
  category: AdvisoryCategory;
  severity: AdvisorySeverity;
  status: AdvisoryStatus;
  sourceType: 'demo' | 'official' | 'community' | 'unknown';
  sourceName: string;
  sourceUrl?: string;
  verificationStatus: 'simulated' | 'verified' | 'unverified';
  areaName: string;
  affectedRouteIds: string[];
  affectedSegmentIds: string[];
  affectedStopIds: string[];
  affectedServiceIds: string[];
  impactType: AdvisoryImpactType;
  effectConfirmed: boolean;
  estimatedDelayMinutes?: number;
  delayBasis?: 'additional-travel' | 'queue-overlap' | 'unknown';
  delayEvidence?: 'simulation' | 'source-estimate';
  startsAt?: string;
  endsAt?: string;
  publishedAt: string;
  updatedAt: string;
  suggestedAction?: string;
  geometry?: { type: 'Point'; coordinates: [number, number]; verified: boolean };
}
export interface AdvisoryRouteImpact {
  advisoryId: string;
  title: string;
  impactType: AdvisoryImpactType;
  segmentIds: string[];
  blocking: boolean;
  appliedDelayMinutes: number;
  explanation: string;
  simulated: boolean;
}
export interface AdvisoryFilters {
  query: string;
  category: 'all' | AdvisoryCategory;
  severity: 'all' | AdvisorySeverity;
  status: 'all' | AdvisoryStatus;
  sort: 'recent' | 'severity' | 'relevant';
}
export interface RoadWatchPreferences { closure:boolean; traffic:boolean; flooding:boolean; transport:boolean; roadworks:boolean; savedTrips:boolean; }
export interface RoadWatchProvider {
  load: () => Promise<{ advisories: unknown[]; retrievedAt: string; label: string }>;
}
export interface AdvisoryTripContext {
  affected: RouteItinerary[];
  alternative?: RouteItinerary;
}
export type RoadWatchDataStatus = 'loading' | 'ready' | 'unavailable' | 'outdated';
export type RoadWatchScenario = 'standard' | 'clear' | 'closure' | 'no-alternative';
