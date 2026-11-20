// Generates supabase/seed.sql from the frontend's own demo fixtures, so database IDs can never
// drift from the IDs the route engine, advisories and saved guides use.
//   node scripts/generate-demo-seed.mjs            -> writes supabase/seed.sql
//   node scripts/generate-demo-seed.mjs --check    -> exits 1 if seed.sql is out of date
// Every generated row is labelled illustrative-demo / illustrative-sample / simulated.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const out = mkdtempSync(join(tmpdir(), 'sakaywise-seed-'));
let sql;
try {
  writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}');
  const compiled = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--target', 'ES2022', '--module', 'commonjs',
    '--moduleResolution', 'node', '--skipLibCheck', '--rootDir', 'src', '--outDir', out, 'src/apps/commuter/services/demoCatalog.ts'], { stdio: 'inherit' });
  if (compiled.status !== 0) process.exit(compiled.status ?? 1);
  const require = createRequire(import.meta.url);
  const catalog = require(join(out, 'apps/commuter/services/demoCatalog.js'));
  const { createRoadWatchDemoData } = require(join(out, 'apps/commuter/data/roadwatchDemoData.js'));
  sql = buildSeed(catalog, createRoadWatchDemoData);
} finally {
  rmSync(out, { recursive: true, force: true });
}

const target = 'supabase/seed.sql';
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch { /* missing */ }
  if (current !== sql) { console.error(`${target} is out of date. Run: node scripts/generate-demo-seed.mjs`); process.exit(1); }
  console.log(`${target} is up to date.`);
} else {
  writeFileSync(target, sql);
  console.log(`Wrote ${target}`);
}

function lit(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('non-finite'); return String(value); }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replaceAll("'", "''")}'`;
}
function slug(text) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function upsert(table, columns, rows, conflict = 'id') {
  if (!rows.length) return '';
  const updates = columns.filter(column => !conflict.split(',').map(c => c.trim()).includes(column)).map(column => `${column} = excluded.${column}`);
  return `insert into public.${table} (${columns.join(', ')}) values\n${rows.map(row => `  (${row.join(', ')})`).join(',\n')}\n` +
    `on conflict (${conflict}) do ${updates.length ? `update set ${updates.join(', ')}` : 'nothing'};\n\n`;
}
// Deterministic UUID-shaped ids for demo fare matrices so re-running the seed updates in place.
function demoUuid(n) { return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`; }

function buildSeed(catalog, createRoadWatchDemoData) {
  const { demoPlaces, transportNetwork, popularJourneys, sampleDistanceProfiles, queueReportTerminals } = catalog;
  const placeIds = new Set(demoPlaces.map(place => place.id));
  const stopType = name => /platform/i.test(name) ? 'platform' : /drop-off|exit/i.test(name) ? 'drop-off'
    : /boarding|terminal|bus stop/i.test(name) ? 'boarding-area' : /local stop/i.test(name) ? 'local-stop' : 'transfer-point';
  const terminalPlace = { 'UST España': 'ust-frassati', 'SM North EDSA': 'sm-north', PITX: 'pitx', 'One Ayala': 'one-ayala', 'Pasay Rotonda': 'pasay-rotonda', 'MOA Terminal': 'sm-moa' };
  const segmentTerminals = transportNetwork.segments.flatMap(segment => segment.queue ? [segment.queue.terminal] : []);
  const terminals = [...new Set([...queueReportTerminals, ...segmentTerminals])];
  const rides = transportNetwork.segments.filter(segment => segment.mode !== 'walk');
  const passengers = ['regular', 'student', 'senior', 'pwd'];

  let sql = `-- =============================================================================
-- SakayWise DEMO SEED — GENERATED, DO NOT EDIT BY HAND.
-- Source: src/apps/commuter/data/* via scripts/generate-demo-seed.mjs
--
-- Every record below is FICTIONAL / ILLUSTRATIVE. Provenance columns say so:
--   provenance = 'illustrative-demo', fare verification_status = 'illustrative-sample',
--   advisory source_type = 'demo' + verification_status = 'simulated'.
-- Do not load this into a production project that serves real commuters.
-- No queue reports, support conversations or admin replies are seeded: community data
-- must come from real submissions, and fake admin messages are never created.
-- Advisory times are relative to now(); re-run this file to refresh the simulation.
-- Safe to re-run (upserts).
-- =============================================================================
begin;

`;
  sql += '-- Places\n' + upsert('transport_places',
    ['id', 'name', 'formatted_address', 'street', 'building', 'barangay', 'city', 'landmark', 'provenance', 'sort_order'],
    demoPlaces.map((place, index) => [lit(place.id), lit(place.name), lit(place.formattedAddress), lit(place.street), lit(place.building), lit(place.barangay), lit(place.city), lit(place.landmark), "'illustrative-demo'", lit(index)]));

  sql += '-- Graph nodes (place endpoints use the place id as their own id)\n' + upsert('transport_stops',
    ['id', 'name', 'place_id', 'area_id', 'stop_type', 'provenance'],
    transportNetwork.nodes.map(node => [lit(node.id), lit(node.name), lit(node.placeId), lit(node.areaId || node.id),
      lit(placeIds.has(node.id) ? 'place-endpoint' : stopType(node.name)), "'illustrative-demo'"]));

  sql += '-- Vehicle services (one per sample ride connection)\n' + upsert('transport_services',
    ['id', 'name', 'mode', 'provenance'],
    rides.map(segment => [lit(segment.serviceId), lit(segment.service), lit(segment.mode), "'illustrative-demo'"]));

  sql += '-- Queue terminals\n' + upsert('queue_terminals',
    ['id', 'name', 'place_id', 'is_reportable', 'sort_order', 'provenance'],
    terminals.map((name, index) => [lit(slug(name)), lit(name), lit(terminalPlace[name]), lit(queueReportTerminals.includes(name)), lit(index), "'illustrative-demo'"]));

  sql += '-- Directed segments (no reverse edges inferred)\n' + upsert('transport_segments',
    ['id', 'from_stop_id', 'to_stop_id', 'mode', 'service_id', 'signboard', 'instruction', 'travel_minutes', 'transfer_minutes',
      'boarding_wait_minutes', 'queue_terminal_id', 'queue_default_level', 'queue_low_minutes', 'queue_mid_minutes', 'queue_high_minutes', 'provenance'],
    transportNetwork.segments.map(segment => [lit(segment.id), lit(segment.from), lit(segment.to), lit(segment.mode), lit(segment.serviceId),
      lit(segment.signboard), lit(segment.instruction), lit(segment.travelMinutes), lit(segment.transferMinutes), lit(segment.boardingWaitMinutes),
      lit(segment.queue ? slug(segment.queue.terminal) : null), lit(segment.queue?.defaultLevel), lit(segment.queue?.minutes.low),
      lit(segment.queue?.minutes.mid), lit(segment.queue?.minutes.high), "'illustrative-demo'"]));

  sql += '-- Popular sample journeys\n' + upsert('popular_journeys',
    ['origin_place_id', 'destination_place_id', 'sort_order'],
    popularJourneys.map((pair, index) => [lit(pair.originId), lit(pair.destinationId), lit(index)]), 'origin_place_id, destination_place_id');

  // Fares: one illustrative matrix per mode for segment fares, one per calculator mode for distance profiles.
  const modes = [...new Set(rides.map(segment => segment.mode))];
  const calculatorModes = { jeep: 'jeepney', bus: 'bus', uv: 'uv' };
  const matrices = [
    ...modes.map((mode, index) => ({ id: demoUuid(index + 1), name: `Illustrative sample segment fares — ${mode}`, type: 'segment', mode, calculator: null })),
    ...Object.entries(calculatorModes).map(([calculator, mode], index) => ({ id: demoUuid(100 + index), name: `Illustrative sample distance calculator — ${calculator}`, type: 'distance', mode, calculator })),
  ];
  sql += '-- Fare matrices (illustrative samples — NOT official tariffs)\n' + upsert('fare_matrices',
    ['id', 'name', 'matrix_type', 'mode', 'calculator_mode', 'effective_from', 'source_name', 'verification_status', 'notes'],
    matrices.map(m => [lit(m.id), lit(m.name), lit(m.type), lit(m.mode), lit(m.calculator), "'2026-01-01T00:00:00+08:00'",
      "'SakayWise illustrative demo (not an official LTFRB/DOTr tariff)'", "'illustrative-sample'",
      "'Copied from src/apps/commuter/data/fares.ts. Missing passenger categories are intentionally absent.'"]));
  sql += `delete from public.fare_rules where fare_matrix_id in (${matrices.map(m => lit(m.id)).join(', ')});\n`;
  const segmentRules = rides.flatMap(segment => passengers.filter(p => typeof segment.fares[p] === 'number').map(p =>
    [lit(matrices.find(m => m.type === 'segment' && m.mode === segment.mode).id), lit(p), lit(segment.id), lit(segment.fares[p]), 'null', 'null']));
  const distanceRules = Object.entries(sampleDistanceProfiles).flatMap(([calculator, profile]) => passengers
    .filter(p => typeof profile.base[p] === 'number' && typeof profile.perKm[p] === 'number')
    .map(p => [lit(matrices.find(m => m.calculator === calculator).id), lit(p), 'null', lit(profile.base[p]), lit(profile.thresholdKm), lit(profile.perKm[p])]));
  sql += `insert into public.fare_rules (fare_matrix_id, passenger_category, segment_id, fare_amount, included_km, per_km_amount) values\n` +
    [...segmentRules, ...distanceRules].map(row => `  (${row.join(', ')})`).join(',\n') + ';\n\n';

  // Advisories: generate with a zero clock so every timestamp is an offset in minutes from now().
  const advisories = createRoadWatchDemoData(0, 'standard');
  const at = iso => iso === undefined ? 'null' : `now() + make_interval(mins => ${Date.parse(iso) / 60000})`;
  sql += '-- Simulated RoadWatch advisories (source_type demo, verification simulated)\n' + upsert('road_advisories',
    ['id', 'incident_id', 'title', 'description', 'category', 'severity', 'status', 'source_type', 'source_name', 'source_url', 'verification_status',
      'area_name', 'impact_type', 'effect_confirmed', 'estimated_delay_minutes', 'delay_basis', 'delay_evidence', 'starts_at', 'ends_at',
      'published_at', 'updated_at', 'suggested_action', 'is_published'],
    advisories.map(a => [lit(a.id), lit(a.incidentId), lit(a.title), lit(a.description), lit(a.category), lit(a.severity), lit(a.status),
      lit(a.sourceType), lit(a.sourceName), lit(a.sourceUrl), lit(a.verificationStatus), lit(a.areaName), lit(a.impactType), lit(a.effectConfirmed),
      lit(a.estimatedDelayMinutes), lit(a.delayBasis), lit(a.delayEvidence), at(a.startsAt), at(a.endsAt), at(a.publishedAt), at(a.updatedAt),
      lit(a.suggestedAction), 'true']));
  sql += `delete from public.road_advisory_impacts where advisory_id in (${advisories.map(a => lit(a.id)).join(', ')});\n`;
  const impacts = advisories.flatMap(a => [
    ...a.affectedSegmentIds.map(id => [lit(a.id), "'segment'", lit(id), 'null', 'null', 'null']),
    ...a.affectedStopIds.map(id => [lit(a.id), "'stop'", 'null', lit(id), 'null', 'null']),
    ...a.affectedServiceIds.map(id => [lit(a.id), "'service'", 'null', 'null', lit(id), 'null']),
    ...a.affectedRouteIds.map(id => [lit(a.id), "'itinerary'", 'null', 'null', 'null', lit(id)]),
  ]);
  sql += `insert into public.road_advisory_impacts (advisory_id, target_type, segment_id, stop_id, service_id, itinerary_id) values\n` +
    impacts.map(row => `  (${row.join(', ')})`).join(',\n') + ';\n\ncommit;\n';
  return sql;
}
