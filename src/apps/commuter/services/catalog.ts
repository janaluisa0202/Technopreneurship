// Active commuter catalog. Exports are ES-module *live bindings*: demo mode serves the bundled
// fixtures (unchanged behaviour); live mode replaces them ONCE with a validated database snapshot
// before CommuterApp mounts (see components/CommuterDataGate.tsx). Existing synchronous consumers
// (route engine, advisory matching, location validation, pages) therefore read one consistent
// network without being rewritten. Never mix a remote snapshot with demo IDs, and never fall back
// to fixtures silently after a live load fails.
import {
  demoPlaces, demoRoutePlaces, transportNetwork as demoNetwork, popularJourneys as demoPopularJourneys,
  sampleTrips, demoQueues, sampleDistanceProfiles, queueReportTerminals as demoQueueTerminals,
} from './demoCatalog';
import type { DataProvenance, JourneyPair } from './contracts';
import type { FareMode, Place, QueueReport, Trip } from '../types';
import type { DistanceFareProfile, TransportNetwork } from '../types/route';

export interface CommuterCatalog {
  mode: 'local-demo' | 'remote';
  provenance: DataProvenance;
  sourceName: string;
  retrievedAt: string;
  places: Place[];
  /** Places that may have mapped journeys (search suggestions). */
  routePlaces: Place[];
  network: TransportNetwork;
  popularJourneys: JourneyPair[];
  /** Pre-graph demo trips kept only for reading old saved guides/watches. Empty in live mode. */
  legacyTrips: Trip[];
  distanceProfiles: Record<FareMode, DistanceFareProfile>;
  /** Terminal display names offered in the report form. */
  queueReportTerminals: readonly string[];
  /** Display name -> server terminal id (live mode). */
  queueTerminalIds: Record<string, string>;
  /** Illustrative baseline queue cards. Empty in live mode: no sample is shown as a live reading. */
  baselineQueues: QueueReport[];
}

export const demoCommuterCatalog: CommuterCatalog = {
  mode: 'local-demo',
  provenance: 'illustrative-demo',
  sourceName: 'SakayWise local demonstration',
  retrievedAt: new Date(0).toISOString(),
  places: demoPlaces,
  routePlaces: demoRoutePlaces,
  network: demoNetwork,
  popularJourneys: demoPopularJourneys,
  legacyTrips: sampleTrips,
  distanceProfiles: sampleDistanceProfiles,
  queueReportTerminals: demoQueueTerminals,
  queueTerminalIds: {},
  baselineQueues: demoQueues,
};

let active: CommuterCatalog = demoCommuterCatalog;
export let catalogPlaces: Place[] = active.places;
export let catalogRoutePlaces: Place[] = active.routePlaces;
export let transportNetwork: TransportNetwork = active.network;
export let popularJourneys: JourneyPair[] = active.popularJourneys;
export let legacyTrips: Trip[] = active.legacyTrips;
export let distanceProfiles: Record<FareMode, DistanceFareProfile> = active.distanceProfiles;
export let queueReportTerminals: readonly string[] = active.queueReportTerminals;
export let baselineQueues: QueueReport[] = active.baselineQueues;

export function getActiveCatalog(): CommuterCatalog { return active; }
export function isLiveCatalog(): boolean { return active.mode === 'remote'; }

export function setActiveCatalog(next: CommuterCatalog): void {
  active = next;
  catalogPlaces = next.places;
  catalogRoutePlaces = next.routePlaces;
  transportNetwork = next.network;
  popularJourneys = next.popularJourneys;
  legacyTrips = next.legacyTrips;
  distanceProfiles = next.distanceProfiles;
  queueReportTerminals = next.queueReportTerminals;
  baselineQueues = next.baselineQueues;
}

/** Test helper / demo restore. */
export function resetActiveCatalog(): void { setActiveCatalog(demoCommuterCatalog); }
