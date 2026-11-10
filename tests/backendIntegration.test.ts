import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { isPrivilegedKey, readRuntimeConfig } from '../src/apps/commuter/services/runtimeConfig';
import { buildRemoteCatalog, mapAdvisoryRows, mapQueueEstimates, type CatalogRows, type QueueEstimateRow } from '../src/apps/commuter/services/supabase/remoteCatalog';
import { createRemoteSupportService } from '../src/apps/commuter/services/supabase/remoteServices';
import { getActiveCatalog, resetActiveCatalog, setActiveCatalog, transportNetwork } from '../src/apps/commuter/services/catalog';
import { transportNetwork as demoNetwork, demoPlaces, sampleDistanceProfiles } from '../src/apps/commuter/services/demoCatalog';
import { createRoadWatchDemoData } from '../src/apps/commuter/data/roadwatchDemoData';
import { recommendRoutes } from '../src/apps/commuter/lib/routeEngine';
import { latestQueueReport, queueForSegment } from '../src/apps/commuter/lib/queues';
import { isSelectedLocation, selectPlace } from '../src/apps/commuter/lib/locations';
import { sampleDistanceFare } from '../src/apps/commuter/lib/fares';
import { validatedAdvisories } from '../src/apps/commuter/lib/roadwatchService';
import { SupportError } from '../src/apps/commuter/lib/supportService';
import type { QueueReport } from '../src/apps/commuter/types';

const jwt = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;

test('data mode defaults to demo and live mode refuses missing or privileged credentials', () => {
  assert.deepEqual(readRuntimeConfig({}), { mode: 'demo' });
  assert.equal(readRuntimeConfig({ VITE_SAKAYWISE_DATA_MODE: 'live' }).problem, 'missing-url');
  assert.equal(readRuntimeConfig({ VITE_SAKAYWISE_DATA_MODE: 'live', VITE_SUPABASE_URL: 'http://evil.example' }).problem, 'invalid-url');
  assert.equal(readRuntimeConfig({ VITE_SAKAYWISE_DATA_MODE: 'live', VITE_SUPABASE_URL: 'https://p.supabase.co' }).problem, 'missing-key');
  assert.equal(readRuntimeConfig({ VITE_SAKAYWISE_DATA_MODE: 'live', VITE_SUPABASE_URL: 'https://p.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' }).problem, 'secret-key');
  assert.equal(readRuntimeConfig({ VITE_SAKAYWISE_DATA_MODE: 'live', VITE_SUPABASE_URL: 'https://p.supabase.co', VITE_SUPABASE_ANON_KEY: jwt({ role: 'service_role' }) }).problem, 'secret-key');
  assert.equal(readRuntimeConfig({ VITE_SAKAYWISE_DATA_MODE: 'staging' }).problem, 'invalid-mode');
  const ok = readRuntimeConfig({ VITE_SAKAYWISE_DATA_MODE: 'live', VITE_SUPABASE_URL: 'https://p.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' });
  assert.deepEqual(ok, { mode: 'live', supabaseUrl: 'https://p.supabase.co', supabaseKey: 'sb_publishable_abc' });
  assert.equal(isPrivilegedKey(jwt({ role: 'anon' })), false);
  assert.equal(readRuntimeConfig({ VITE_SAKAYWISE_DATA_MODE: 'live', VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon' }) }).problem, undefined);
});

/** Rebuilds database rows from the demo fixtures (mirrors scripts/generate-demo-seed.mjs). */
function rowsFromDemo(): CatalogRows {
  const placeIds = new Set(demoPlaces.map(place => place.id));
  const slug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const rides = demoNetwork.segments.filter(segment => segment.mode !== 'walk');
  return {
    places: demoPlaces.map((place, index) => ({ id: place.id, name: place.name, formatted_address: place.formattedAddress, street: place.street ?? null, building: place.building ?? null,
      barangay: place.barangay ?? null, city: place.city ?? null, landmark: place.landmark ?? null, latitude: 14.6, longitude: 121, coordinates_verified: false, provenance: 'illustrative-demo', sort_order: index })),
    stops: demoNetwork.nodes.map(node => ({ id: node.id, name: node.name, place_id: placeIds.has(node.id) ? node.id : null, area_id: node.areaId ?? node.id, provenance: 'illustrative-demo' })),
    services: rides.map(segment => ({ id: segment.serviceId!, name: segment.service, mode: segment.mode, provenance: 'illustrative-demo' })),
    terminals: [...new Set(rides.map(segment => segment.queue!.terminal))].map((name, index) => ({ id: slug(name), name, is_reportable: true, sort_order: index, provenance: 'illustrative-demo' })),
    segments: demoNetwork.segments.map(segment => ({ id: segment.id, from_stop_id: segment.from, to_stop_id: segment.to, mode: segment.mode, service_id: segment.serviceId ?? null,
      signboard: segment.signboard, instruction: segment.instruction, travel_minutes: String(segment.travelMinutes), transfer_minutes: segment.transferMinutes, boarding_wait_minutes: segment.boardingWaitMinutes,
      queue_terminal_id: segment.queue ? slug(segment.queue.terminal) : null, queue_default_level: segment.queue?.defaultLevel ?? null,
      queue_low_minutes: segment.queue?.minutes.low ?? null, queue_mid_minutes: segment.queue?.minutes.mid ?? null, queue_high_minutes: segment.queue?.minutes.high ?? null, provenance: 'illustrative-demo' })),
    journeys: [{ origin_place_id: 'ust-frassati', destination_place_id: 'sm-north', sort_order: 0 }],
    fareRules: [
      ...rides.flatMap(segment => Object.entries(segment.fares).map(([passenger, amount]) => ({ matrix_type: 'segment' as const, calculator_mode: null, segment_id: segment.id,
        passenger_category: passenger as 'regular', fare_amount: String(amount), included_km: null, per_km_amount: null, verification_status: 'illustrative-sample' as const }))),
      ...(['regular', 'student'] as const).map(passenger => ({ matrix_type: 'distance' as const, calculator_mode: 'jeep' as const, segment_id: null, passenger_category: passenger,
        fare_amount: sampleDistanceProfiles.jeep.base[passenger]!, included_km: 4, per_km_amount: sampleDistanceProfiles.jeep.perKm[passenger]!, verification_status: 'illustrative-sample' as const })),
    ],
  };
}

test('database rows map to the exact network the existing engine already uses', () => {
  const catalog = buildRemoteCatalog(rowsFromDemo(), new Date().toISOString());
  assert.equal(catalog.provenance, 'illustrative-demo');
  assert.deepEqual(catalog.network.segments, demoNetwork.segments, 'segments incl. fares, queue and service ids are identical');
  assert.equal(catalog.places.every(place => place.source === 'remote' && place.latitude === undefined), true, 'unverified coordinates are never exposed');
  const request = { originId: 'ust-frassati', destinationId: 'sm-north', passenger: 'student' as const, priority: 'time' as const };
  const ids = (network = demoNetwork) => recommendRoutes(request, [], 0, network).map(route => [route.id, route.metrics.totalMinutes, route.metrics.fare]);
  assert.deepEqual(ids(catalog.network), ids());
  assert.equal(recommendRoutes({ ...request, originId: 'sm-north', destinationId: 'ust-frassati' }, [], 0, catalog.network).length, 0, 'no reverse edges are inferred');
});

test('invalid database payloads are rejected instead of rendered', () => {
  const rows = rowsFromDemo();
  assert.throws(() => buildRemoteCatalog({ ...rows, segments: [{ ...rows.segments[1], travel_minutes: 'NaN' }] }, ''), /invalid_catalog/);
  assert.throws(() => buildRemoteCatalog({ ...rows, segments: [{ ...rows.segments[1], service_id: 'srv:missing' }] }, ''), /invalid_catalog/);
  assert.throws(() => buildRemoteCatalog({ ...rows, segments: [] }, ''), /invalid_catalog/);
});

test('missing distance-calculator categories and modes stay unavailable', () => {
  const catalog = buildRemoteCatalog(rowsFromDemo(), '');
  setActiveCatalog(catalog);
  try {
    assert.equal(sampleDistanceFare('jeep', 6, 'regular'), 17.4);
    assert.equal(sampleDistanceFare('jeep', 6, 'senior'), null);
    assert.equal(sampleDistanceFare('bus', 6, 'regular'), null);
  } finally { resetActiveCatalog(); }
});

test('switching the active catalog updates live bindings and place validation', () => {
  const catalog = buildRemoteCatalog(rowsFromDemo(), '');
  assert.equal(transportNetwork, demoNetwork);
  setActiveCatalog(catalog);
  try {
    assert.equal(transportNetwork, catalog.network);
    assert.equal(getActiveCatalog().mode, 'remote');
    assert.equal(isSelectedLocation(selectPlace(catalog.places[0])), true);
    assert.equal(isSelectedLocation(selectPlace(demoPlaces[0])), false, 'a demo-labelled place is not accepted as a live place');
  } finally { resetActiveCatalog(); }
  assert.equal(isSelectedLocation(selectPlace(demoPlaces[0])), true);
});

test('queue aggregates: honoured by routing, never tagged local, no-report kept distinct from low', () => {
  const now = Date.parse('2026-11-10T10:00:00Z');
  const rows: QueueEstimateRow[] = [
    { terminal_id: 'ust-espana', terminal_name: 'UST España', is_reportable: true, queue_level: 'high', source: 'community', confidence: 'medium', sample_count: 3, latest_reported_at: '2026-11-10T09:55:00Z', next_change_at: '2026-11-10T10:20:00Z' },
    { terminal_id: 'pitx', terminal_name: 'PITX', is_reportable: true, queue_level: null, source: 'none', confidence: 'none', sample_count: 0, latest_reported_at: null, next_change_at: null },
  ];
  const { reports, noReport, nextChangeAt } = mapQueueEstimates(rows);
  assert.deepEqual(noReport, ['PITX']);
  assert.equal(nextChangeAt, Date.parse('2026-11-10T10:20:00Z'));
  assert.equal(reports[0].isLocal, undefined);
  assert.equal(reports[0].source, 'community-aggregate');
  const segment = demoNetwork.segments.find(item => item.id === 'ust-north-jeep')!;
  const observation = queueForSegment(segment, reports, now);
  assert.deepEqual([observation.level, observation.source, observation.minutes], ['high', 'community', 28]);
  assert.match(observation.label, /Not verified/);
  const sample: QueueReport = { id: 'ust', place: 'UST España', where: '', level: 'high', estimate: '', updated: '', progress: 1, reportedAt: '2026-11-10T09:59:00Z' };
  assert.equal(latestQueueReport([sample], 'UST España'), undefined, 'untrusted/unlabelled cards never drive estimates');
});

test('advisory rows map to records the existing validator accepts, with explicit impacts only', () => {
  const demo = createRoadWatchDemoData(Date.parse('2026-11-10T10:00:00Z'));
  const rows = demo.map(a => ({ id: a.id, incident_id: a.incidentId ?? null, title: a.title, description: a.description, category: a.category, severity: a.severity, status: a.status,
    source_type: a.sourceType, source_name: a.sourceName, source_url: a.sourceUrl ?? null, verification_status: a.verificationStatus, area_name: a.areaName, impact_type: a.impactType,
    effect_confirmed: a.effectConfirmed, estimated_delay_minutes: a.estimatedDelayMinutes === undefined ? null : String(a.estimatedDelayMinutes), delay_basis: a.delayBasis ?? null,
    delay_evidence: a.delayEvidence ?? null, starts_at: a.startsAt ?? null, ends_at: a.endsAt ?? null, published_at: a.publishedAt, updated_at: a.updatedAt,
    suggested_action: a.suggestedAction ?? null, latitude: null, longitude: null, geometry_verified: false,
    road_advisory_impacts: [...a.affectedSegmentIds.map(id => ({ target_type: 'segment', segment_id: id, stop_id: null, service_id: null, itinerary_id: null })),
      ...a.affectedStopIds.map(id => ({ target_type: 'stop', segment_id: null, stop_id: id, service_id: null, itinerary_id: null })),
      ...a.affectedServiceIds.map(id => ({ target_type: 'service', segment_id: null, stop_id: null, service_id: id, itinerary_id: null }))] }));
  const mapped = validatedAdvisories(mapAdvisoryRows(rows));
  assert.equal(mapped.length, demo.length);
  assert.deepEqual(mapped.map(a => [a.id, a.affectedSegmentIds, a.affectedStopIds, a.affectedServiceIds, a.estimatedDelayMinutes]),
    demo.map(a => [a.id, a.affectedSegmentIds, a.affectedStopIds, a.affectedServiceIds, a.estimatedDelayMinutes]));
});

// Minimal fake of the supabase-js surface used by the support adapter.
function fakeSupabase(options: { session?: boolean; rpcError?: string } = {}) {
  const calls: { kind: string; name: string; args?: unknown }[] = [];
  let session = options.session ? { user: { id: 'u1' } } : null;
  const result = (data: unknown, error: unknown = null) => ({ data, error });
  const query = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'order', 'limit']) chain[name] = () => chain;
    chain.then = (resolve: (value: unknown) => void) => resolve(result(table === 'support_messages'
      ? [{ id: 'm2', conversation_id: 'c1', sender_type: 'admin', sender_id: 'a1', message: 'Reply', created_at: '2026-11-10T10:01:00Z', read_at: null, request_id: 'r2' },
         { id: 'm1', conversation_id: 'c1', sender_type: 'commuter', sender_id: 'u1', message: 'Hi', created_at: '2026-11-10T10:00:00Z', read_at: '2026-11-10T10:02:00Z', request_id: 'r1' }]
      : []));
    calls.push({ kind: 'from', name: table });
    return chain;
  };
  const client = {
    calls,
    auth: {
      getSession: async () => result({ session }),
      signInAnonymously: async () => { calls.push({ kind: 'auth', name: 'signInAnonymously' }); session = { user: { id: 'u1' } }; return result({ user: session.user, session }); },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: query,
    rpc: async (name: string, args: unknown) => {
      calls.push({ kind: 'rpc', name, args });
      if (options.rpcError) return result(null, { message: options.rpcError });
      if (name === 'support_create_conversation') return result([{ id: 'c1', owner_id: 'u1', category: 'route', subject: 'Route problems', status: 'open', created_at: '2026-11-10T10:00:00Z', updated_at: '2026-11-10T10:00:00Z', last_message_at: null, nickname: null, contact_email: null, related_trip: null }]);
      if (name === 'support_send_message') return result([{ id: 'm1', conversation_id: 'c1', sender_type: 'commuter', sender_id: 'u1', message: 'Hi', created_at: '2026-11-10T10:00:00Z', read_at: null, request_id: 'r1' }]);
      return result(null);
    },
  };
  return client;
}
const memory = () => { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } }; };

test('remote support: listing never signs in; sending creates a guest session and reports only server-accepted status', async () => {
  const supabase = fakeSupabase();
  const service = createRemoteSupportService(supabase as never, memory());
  assert.equal(service.mode, 'remote');
  assert.deepEqual(await service.getConversationsForSession(), []);
  assert.equal(supabase.calls.some(call => call.name === 'signInAnonymously'), false);
  const conversation = await service.createConversation({ message: 'Hi', category: 'route', nickname: '', email: '', relatedTrip: '' });
  assert.equal(supabase.calls.filter(call => call.name === 'signInAnonymously').length, 1);
  const message = await service.sendMessage(conversation.id, 'Hi', 'r1');
  assert.equal(message.deliveryStatus, 'sent');
  assert.equal(message.readAt, undefined);
  const messages = await service.getConversationMessages('c1');
  assert.deepEqual(messages.map(item => [item.id, item.senderType, item.deliveryStatus, !!item.readAt]), [['m1', 'commuter', 'sent', true], ['m2', 'admin', 'delivered', false]], 'oldest first');
});

test('remote support: server errors map to specific, truthful messages', async () => {
  for (const [server, code] of [['rate_limited', 'rate-limited'], ['conversation_closed', 'closed'], ['duplicate_message', 'duplicate'], ['boom', 'network']] as const) {
    const service = createRemoteSupportService(fakeSupabase({ session: true, rpcError: server }) as never, memory());
    await assert.rejects(service.sendMessage('c1', 'x', 'r'), (error: unknown) => error instanceof SupportError && error.code === code);
  }
});

test('remote support drafts stay on the device', async () => {
  const storage = memory();
  const service = createRemoteSupportService(fakeSupabase() as never, storage);
  await service.saveDraft({ message: 'draft', category: 'fare', nickname: '', email: '', relatedTrip: '' });
  assert.equal((await service.getDraft()).message, 'draft');
  assert.equal(storage.getItem('sakaywise:support:v1'), null, 'the local demo history is untouched');
});
