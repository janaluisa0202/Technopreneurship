// Pure mapping + validation from database rows to the existing frontend models.
// No Supabase SDK import here, so it is unit-tested in tests/backendIntegration.test.ts.
import { isTransportSegment } from '../../lib/storageValidation';
import type { CommuterCatalog } from '../catalog';
import type { DataProvenance } from '../contracts';
import type { FareMode, Passenger, Place, QueueLevel, QueueReport } from '../../types';
import type { DistanceFareProfile, FareTable, TransportMode, TransportNetwork, TransportSegment } from '../../types/route';
import { queueEstimate, queueProgress } from '../../lib/commute';

type DbProvenance = 'illustrative-demo' | 'verified-source';
export interface PlaceRow { id: string; name: string; formatted_address: string; street: string | null; building: string | null; barangay: string | null; city: string | null; landmark: string | null; latitude: number | null; longitude: number | null; coordinates_verified: boolean; provenance: DbProvenance; sort_order: number; }
export interface StopRow { id: string; name: string; place_id: string | null; area_id: string; provenance: DbProvenance; }
export interface ServiceRow { id: string; name: string; mode: TransportMode; provenance: DbProvenance; }
export interface TerminalRow { id: string; name: string; is_reportable: boolean; sort_order: number; provenance: DbProvenance; }
export interface SegmentRow {
  id: string; from_stop_id: string; to_stop_id: string; mode: TransportMode; service_id: string | null; signboard: string; instruction: string;
  travel_minutes: number | string; transfer_minutes: number | string; boarding_wait_minutes: number | string;
  queue_terminal_id: string | null; queue_default_level: QueueLevel | null;
  queue_low_minutes: number | string | null; queue_mid_minutes: number | string | null; queue_high_minutes: number | string | null;
  provenance: DbProvenance;
}
export interface JourneyRow { origin_place_id: string; destination_place_id: string; sort_order: number; }
export interface FareRuleRow {
  matrix_type: 'segment' | 'distance'; calculator_mode: FareMode | null; segment_id: string | null; passenger_category: Passenger;
  fare_amount: number | string; included_km: number | string | null; per_km_amount: number | string | null;
  verification_status: 'illustrative-sample' | 'verified';
}
export interface CatalogRows { places: PlaceRow[]; stops: StopRow[]; services: ServiceRow[]; terminals: TerminalRow[]; segments: SegmentRow[]; journeys: JourneyRow[]; fareRules: FareRuleRow[]; }

/** Columns requested by the browser adapter; also exercised against the real schema in supabase/tests. */
export const catalogColumns = {
  transport_places: 'id,name,formatted_address,street,building,barangay,city,landmark,latitude,longitude,coordinates_verified,provenance,sort_order',
  transport_stops: 'id,name,place_id,area_id,provenance',
  transport_services: 'id,name,mode,provenance',
  queue_terminals: 'id,name,is_reportable,sort_order,provenance',
  transport_segments: 'id,from_stop_id,to_stop_id,mode,service_id,signboard,instruction,travel_minutes,transfer_minutes,boarding_wait_minutes,queue_terminal_id,queue_default_level,queue_low_minutes,queue_mid_minutes,queue_high_minutes,provenance',
  popular_journeys: 'origin_place_id,destination_place_id,sort_order',
} as const;
export const advisoryColumns = 'id,incident_id,title,description,category,severity,status,source_type,source_name,source_url,verification_status,area_name,impact_type,effect_confirmed,estimated_delay_minutes,delay_basis,delay_evidence,starts_at,ends_at,published_at,updated_at,suggested_action,latitude,longitude,geometry_verified';
export const advisoryImpactColumns = 'target_type,segment_id,stop_id,service_id,itinerary_id';

export class CatalogValidationError extends Error {
  constructor(detail: string) { super(`invalid_catalog: ${detail}`); }
}
const num = (value: number | string | null | undefined): number => typeof value === 'number' ? value : Number(value);

export function buildRemoteCatalog(rows: CatalogRows, retrievedAt: string): CommuterCatalog {
  if (!rows.places.length || !rows.stops.length || !rows.segments.length) throw new CatalogValidationError('empty network');
  const provenanceOf = (value: DbProvenance) => value === 'verified-source' ? 'verified-source' : 'illustrative-demo';
  const places: Place[] = [...rows.places].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)).map(row => ({
    id: row.id, name: row.name, formattedAddress: row.formatted_address, source: 'remote', provenance: provenanceOf(row.provenance),
    ...(row.street ? { street: row.street } : {}), ...(row.building ? { building: row.building } : {}), ...(row.barangay ? { barangay: row.barangay } : {}),
    ...(row.city ? { city: row.city } : {}), ...(row.landmark ? { landmark: row.landmark } : {}),
    // Coordinates are exposed only when verified; nothing downstream may treat guesses as positions.
    ...(row.coordinates_verified && row.latitude !== null && row.longitude !== null ? { latitude: row.latitude, longitude: row.longitude } : {}),
  }));
  const placeIds = new Set(places.map(place => place.id));
  const stopNames = new Map(rows.stops.map(stop => [stop.id, stop.name]));
  const services = new Map(rows.services.map(service => [service.id, service]));
  const terminals = new Map(rows.terminals.map(terminal => [terminal.id, terminal]));

  const fares = new Map<string, FareTable>();
  const calculator = new Map<FareMode, DistanceFareProfile>();
  for (const rule of rows.fareRules) {
    const amount = num(rule.fare_amount);
    if (!Number.isFinite(amount) || amount < 0) throw new CatalogValidationError(`fare ${rule.segment_id ?? rule.calculator_mode}`);
    if (rule.matrix_type === 'segment' && rule.segment_id) {
      fares.set(rule.segment_id, { ...fares.get(rule.segment_id), [rule.passenger_category]: amount });
    } else if (rule.matrix_type === 'distance' && rule.calculator_mode) {
      const profile = calculator.get(rule.calculator_mode) ?? { base: {}, perKm: {}, thresholdKm: num(rule.included_km) };
      profile.base[rule.passenger_category] = amount;
      profile.perKm[rule.passenger_category] = num(rule.per_km_amount);
      calculator.set(rule.calculator_mode, profile);
    }
  }
  // A calculator mode without verified-or-sample rules stays unavailable (empty tables -> null fare).
  const distanceProfiles = Object.fromEntries((['jeep', 'bus', 'uv'] as FareMode[]).map(mode => [mode, calculator.get(mode) ?? { base: {}, perKm: {}, thresholdKm: 0 }])) as Record<FareMode, DistanceFareProfile>;

  const network: TransportNetwork = {
    nodes: rows.stops.map(stop => ({ id: stop.id, name: stop.name, ...(stop.place_id ? { placeId: stop.place_id } : {}), areaId: stop.area_id })),
    segments: rows.segments.map(row => {
      const service = row.service_id ? services.get(row.service_id) : undefined;
      if (row.mode !== 'walk' && !service) throw new CatalogValidationError(`segment ${row.id} service`);
      const terminal = row.queue_terminal_id ? terminals.get(row.queue_terminal_id) : undefined;
      if (row.queue_terminal_id && !terminal) throw new CatalogValidationError(`segment ${row.id} terminal`);
      const segment: TransportSegment = {
        id: row.id, from: row.from_stop_id, to: row.to_stop_id, mode: row.mode,
        service: service?.name ?? 'Walking connection', ...(service ? { serviceId: service.id } : {}),
        signboard: row.signboard, boarding: stopNames.get(row.from_stop_id) ?? '', alighting: stopNames.get(row.to_stop_id) ?? '',
        instruction: row.instruction, travelMinutes: num(row.travel_minutes), transferMinutes: num(row.transfer_minutes),
        boardingWaitMinutes: num(row.boarding_wait_minutes), fares: row.mode === 'walk' ? {} : fares.get(row.id) ?? {},
        ...(terminal && row.queue_default_level ? { queue: { terminal: terminal.name, defaultLevel: row.queue_default_level,
          minutes: { low: num(row.queue_low_minutes), mid: num(row.queue_mid_minutes), high: num(row.queue_high_minutes) } } } : {}),
      };
      if (!isTransportSegment(segment) || !stopNames.has(segment.from) || !stopNames.has(segment.to)) throw new CatalogValidationError(`segment ${row.id}`);
      return segment;
    }),
  };
  for (const stop of rows.stops) if (stop.place_id && (stop.place_id !== stop.id || !placeIds.has(stop.place_id))) throw new CatalogValidationError(`stop ${stop.id}`);

  const routable = new Set(network.nodes.filter(node => node.placeId).map(node => node.placeId!));
  const anyDemo = [...rows.places, ...rows.stops, ...rows.services, ...rows.segments, ...rows.terminals].some(row => row.provenance !== 'verified-source')
    || rows.fareRules.some(rule => rule.verification_status !== 'verified');
  const provenance: DataProvenance = anyDemo ? 'illustrative-demo' : 'verified-source';
  const sortedTerminals = [...rows.terminals].sort((a, b) => a.sort_order - b.sort_order);
  return {
    mode: 'remote', provenance, retrievedAt,
    sourceName: anyDemo ? 'SakayWise database (illustrative demo data)' : 'SakayWise database',
    places,
    routePlaces: places.filter(place => routable.has(place.id)),
    network,
    popularJourneys: [...rows.journeys].sort((a, b) => a.sort_order - b.sort_order)
      .filter(row => placeIds.has(row.origin_place_id) && placeIds.has(row.destination_place_id))
      .map(row => ({ originId: row.origin_place_id, destinationId: row.destination_place_id })),
    legacyTrips: [],
    distanceProfiles,
    queueReportTerminals: sortedTerminals.filter(terminal => terminal.is_reportable).map(terminal => terminal.name),
    queueTerminalIds: Object.fromEntries(sortedTerminals.map(terminal => [terminal.name, terminal.id])),
    baselineQueues: [],
  };
}

export interface QueueEstimateRow {
  terminal_id: string; terminal_name: string; is_reportable: boolean; queue_level: QueueLevel | null; source: 'none' | 'community' | 'terminal-staff';
  confidence: 'none' | 'low' | 'medium' | 'high'; sample_count: number; latest_reported_at: string | null; next_change_at: string | null;
}

/** Server aggregates -> QueueReport. "No current report" terminals are returned separately, never as "low". */
export function mapQueueEstimates(rows: QueueEstimateRow[]): { reports: QueueReport[]; noReport: string[]; nextChangeAt?: number } {
  const reports: QueueReport[] = [];
  const noReport: string[] = [];
  for (const row of rows) {
    if (!row.queue_level || row.source === 'none' || !row.latest_reported_at || row.confidence === 'none') {
      // Only terminals commuters can report on get a "no current report" card.
      if (row.is_reportable) noReport.push(row.terminal_name);
      continue;
    }
    const staff = row.source === 'terminal-staff';
    reports.push({
      id: `remote:${row.terminal_id}`, place: row.terminal_name,
      where: staff ? 'Terminal staff report' : `${row.sample_count} independent community ${row.sample_count === 1 ? 'report' : 'reports'}`,
      level: row.queue_level, estimate: queueEstimate(row.queue_level), progress: queueProgress(row.queue_level),
      updated: staff ? 'Terminal staff' : 'Community estimate', reportedAt: new Date(row.latest_reported_at).toISOString(),
      source: staff ? 'terminal-staff' : 'community-aggregate', confidence: row.confidence, sampleCount: row.sample_count,
    });
  }
  const next = rows.map(row => Date.parse(row.next_change_at ?? '')).filter(Number.isFinite).sort((a, b) => a - b)[0];
  return { reports, noReport, ...(next ? { nextChangeAt: next } : {}) };
}

export interface AdvisoryRow {
  id: string; incident_id: string | null; title: string; description: string; category: string; severity: string; status: string;
  source_type: string; source_name: string; source_url: string | null; verification_status: string; area_name: string; impact_type: string;
  effect_confirmed: boolean; estimated_delay_minutes: number | string | null; delay_basis: string | null; delay_evidence: string | null;
  starts_at: string | null; ends_at: string | null; published_at: string; updated_at: string; suggested_action: string | null;
  latitude: number | null; longitude: number | null; geometry_verified: boolean;
  road_advisory_impacts: { target_type: string; segment_id: string | null; stop_id: string | null; service_id: string | null; itinerary_id: string | null }[];
}
const iso = (value: string | null) => value === null ? undefined : new Date(value).toISOString();

/** Maps rows to the RoadAdvisory *shape*; useRoadWatch still validates every record before use. */
export function mapAdvisoryRows(rows: AdvisoryRow[]): unknown[] {
  return rows.map(row => {
    const ids = (type: string, key: 'segment_id' | 'stop_id' | 'service_id' | 'itinerary_id') =>
      (row.road_advisory_impacts ?? []).filter(impact => impact.target_type === type && impact[key]).map(impact => impact[key] as string);
    const advisory: Record<string, unknown> = {
      id: row.id, title: row.title, description: row.description, category: row.category, severity: row.severity, status: row.status,
      sourceType: row.source_type, sourceName: row.source_name, verificationStatus: row.verification_status, areaName: row.area_name,
      affectedRouteIds: ids('itinerary', 'itinerary_id'), affectedSegmentIds: ids('segment', 'segment_id'),
      affectedStopIds: ids('stop', 'stop_id'), affectedServiceIds: ids('service', 'service_id'),
      impactType: row.impact_type, effectConfirmed: row.effect_confirmed, publishedAt: iso(row.published_at), updatedAt: iso(row.updated_at),
    };
    if (row.incident_id) advisory.incidentId = row.incident_id;
    if (row.source_url) advisory.sourceUrl = row.source_url;
    if (row.estimated_delay_minutes !== null) advisory.estimatedDelayMinutes = num(row.estimated_delay_minutes);
    if (row.delay_basis) advisory.delayBasis = row.delay_basis;
    if (row.delay_evidence) advisory.delayEvidence = row.delay_evidence;
    if (row.starts_at) advisory.startsAt = iso(row.starts_at);
    if (row.ends_at) advisory.endsAt = iso(row.ends_at);
    if (row.suggested_action) advisory.suggestedAction = row.suggested_action;
    if (row.latitude !== null && row.longitude !== null) advisory.geometry = { type: 'Point', coordinates: [row.longitude, row.latitude], verified: row.geometry_verified };
    return advisory;
  });
}

export function advisoryFeedLabel(rows: AdvisoryRow[]): string {
  return rows.length && rows.every(row => row.source_type === 'demo') ? 'DEMO ADVISORIES · SAKAYWISE DATABASE' : 'ROADWATCH ADVISORIES';
}
