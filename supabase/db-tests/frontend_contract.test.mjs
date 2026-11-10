// End-to-end contract: seeded database -> the browser adapter's exact column lists -> the pure
// mapper -> the EXISTING route engine. Live mode must produce the same recommendations as demo mode.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { as, createDatabase, createUser, randomUUID, rows } from './harness.mjs';

const repo = new URL('../../', import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), 'sakaywise-contract-'));
after(() => rmSync(out, { recursive: true, force: true }));
writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}');
const entries = ['services/supabase/remoteCatalog.ts', 'services/demoCatalog.ts', 'lib/routeEngine.ts', 'lib/roadwatchService.ts', 'lib/advisoryImpact.ts']
  .map(file => join(repo, 'src/apps/commuter', file));
const compiled = spawnSync(process.execPath, [join(repo, 'node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs',
  '--moduleResolution', 'node', '--skipLibCheck', '--rootDir', join(repo, 'src'), '--outDir', out, ...entries], { stdio: 'inherit' });
assert.equal(compiled.status, 0, 'frontend modules compile');
const load = file => createRequire(import.meta.url)(join(out, 'apps/commuter', file));
const { buildRemoteCatalog, catalogColumns, advisoryColumns, advisoryImpactColumns, mapAdvisoryRows, mapQueueEstimates } = load('services/supabase/remoteCatalog.js');
const demo = load('services/demoCatalog.js');
const { analyzeRouteRecommendations } = load('lib/routeEngine.js');
const { validatedAdvisories } = load('lib/roadwatchService.js');

const db = await createDatabase();
// Read exactly what the browser would read: anon role, same columns, active rows only.
const catalogRows = await as(db, null, async tx => {
  const pick = (table, extra = 'where is_active') => rows(tx, `select ${catalogColumns[table]} from public.${table} ${extra}`);
  return {
    places: await pick('transport_places'), stops: await pick('transport_stops'), services: await pick('transport_services'),
    terminals: await pick('queue_terminals'), segments: await pick('transport_segments'), journeys: await pick('popular_journeys'),
    fareRules: await rows(tx, 'select * from public.get_current_fare_rules()'),
  };
});
const live = buildRemoteCatalog(catalogRows, new Date().toISOString());
const summary = result => result.routes.map(route => [route.id, route.metrics.totalMinutes, route.metrics.fare, route.metrics.missingFares]);

test('live catalog labels itself as demo data because the seed is illustrative', () => {
  assert.equal(live.provenance, 'illustrative-demo');
  assert.equal(live.mode, 'remote');
});

test('existing route recommendations are identical with database-backed data', () => {
  const now = Date.parse('2026-11-10T10:00:00Z');
  for (const { originId, destinationId } of demo.popularJourneys) {
    for (const passenger of ['regular', 'student', 'senior', 'pwd']) {
      for (const priority of ['time', 'cost', 'wait', 'transfers']) {
        const request = { originId, destinationId, passenger, priority };
        assert.deepEqual(summary(analyzeRouteRecommendations(request, [], now, live.network)),
          summary(analyzeRouteRecommendations(request, [], now, demo.transportNetwork)), `${originId}->${destinationId} ${passenger} ${priority}`);
      }
    }
  }
});

test('unsupported and reverse routes return empty states, not invented routes', () => {
  const empty = request => analyzeRouteRecommendations({ passenger: 'regular', priority: 'time', ...request }, [], Date.now(), live.network).routes.length;
  assert.equal(empty({ originId: 'marikina-sports', destinationId: 'antipolo-cathedral' }), 0);
  assert.equal(empty({ originId: 'sm-north', destinationId: 'ust-frassati' }), 0);
  assert.equal(empty({ originId: 'manual:my house', destinationId: 'pitx' }), 0);
});

test('missing passenger fares stay incomplete through the database path', () => {
  const route = analyzeRouteRecommendations({ originId: 'pasay-rotonda', destinationId: 'sm-moa', passenger: 'student', priority: 'time' }, [], Date.now(), live.network)
    .allRoutes.find(item => item.legs.some(leg => leg.segment.id === 'pasay-libertad-tricycle'));
  assert.equal(route.metrics.fare, null);
  assert.equal(route.metrics.missingFares, 1);
});

async function feed() {
  const advisories = await as(db, null, tx => rows(tx, `select ${advisoryColumns} from public.road_advisories where is_published order by updated_at desc`));
  const impacts = await as(db, null, tx => rows(tx, `select advisory_id, ${advisoryImpactColumns} from public.road_advisory_impacts`));
  // Postgres returns Date objects; PostgREST returns ISO strings. Normalise to the wire format.
  const wire = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]));
  return validatedAdvisories(mapAdvisoryRows(advisories.map(row => ({ ...wire(row), road_advisory_impacts: impacts.filter(i => i.advisory_id === row.id) }))));
}

test('verified/confirmed closures affect only mapped segments; expired and unrelated advisories change nothing', async () => {
  const advisories = await feed();
  assert.equal(advisories.length, 8);
  const now = Date.now();
  const request = { originId: 'ust-frassati', destinationId: 'sm-north', passenger: 'regular', priority: 'time' };
  const withFeed = analyzeRouteRecommendations(request, [], now, live.network, advisories);
  const blocked = withFeed.allRoutes.filter(route => route.unavailable).map(route => route.id);
  assert.ok(blocked.length > 0 && blocked.every(id => id.includes('ust-north-jeep')), 'only routes using the closed segment are blocked');
  const unrelatedOnly = advisories.filter(a => ['rw-unrelated', 'rw-expired', 'rw-resolved'].includes(a.id));
  assert.deepEqual(summary(analyzeRouteRecommendations(request, [], now, live.network, unrelatedOnly)), summary(analyzeRouteRecommendations(request, [], now, live.network)));
});

test('server queue estimates change route estimates only for the reported terminal', async () => {
  for (let i = 0; i < 3; i++) {
    const guest = await createUser(db);
    await as(db, guest, tx => tx.query(`select * from submit_queue_report('ust-espana', 'high', $1)`, [randomUUID()]));
  }
  const estimates = await as(db, null, tx => rows(tx, 'select * from get_queue_estimates()'));
  const wire = estimates.map(row => ({ ...row, latest_reported_at: row.latest_reported_at?.toISOString() ?? null, next_change_at: row.next_change_at?.toISOString() ?? null }));
  const { reports, noReport } = mapQueueEstimates(wire);
  assert.deepEqual(reports.map(report => [report.place, report.level, report.source, report.sampleCount]), [['UST España', 'high', 'community-aggregate', 3]]);
  assert.ok(noReport.includes('PITX'));
  const now = Date.now();
  const ust = { originId: 'ust-frassati', destinationId: 'sm-north', passenger: 'regular', priority: 'time' };
  const pitx = { originId: 'pitx', destinationId: 'sm-moa', passenger: 'regular', priority: 'time' };
  assert.notDeepEqual(summary(analyzeRouteRecommendations(ust, reports, now, live.network)), summary(analyzeRouteRecommendations(ust, [], now, live.network)));
  assert.deepEqual(summary(analyzeRouteRecommendations(pitx, reports, now, live.network)), summary(analyzeRouteRecommendations(pitx, [], now, live.network)));
});
