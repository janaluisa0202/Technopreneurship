import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDatabase, rows } from './harness.mjs';

const db = await createDatabase();
const rejects = (sql, pattern) => assert.rejects(db.query(sql), pattern);

test('migrations and seed apply; seed is re-runnable without duplicates', async () => {
  const before = await rows(db, 'select (select count(*) from transport_segments)::int s, (select count(*) from fare_rules)::int f, (select count(*) from road_advisory_impacts)::int i');
  await db.exec(readFileSync(new URL('../seed.sql', import.meta.url), 'utf8'));
  const after = await rows(db, 'select (select count(*) from transport_segments)::int s, (select count(*) from fare_rules)::int f, (select count(*) from road_advisory_impacts)::int i');
  assert.deepEqual(after, before);
  assert.equal(before[0].s, 39);
});

test('every seeded record is labelled as demo / sample / simulated', async () => {
  for (const table of ['transport_places', 'transport_stops', 'transport_services', 'queue_terminals', 'transport_segments']) {
    const [{ n }] = await rows(db, `select count(*)::int n from ${table} where provenance <> 'illustrative-demo'`);
    assert.equal(n, 0, table);
  }
  assert.deepEqual(await rows(db, `select distinct verification_status from fare_matrices`), [{ verification_status: 'illustrative-sample' }]);
  assert.deepEqual(await rows(db, `select distinct source_type, verification_status from road_advisories`), [{ source_type: 'demo', verification_status: 'simulated' }]);
  const [{ n }] = await rows(db, 'select (select count(*) from queue_reports) + (select count(*) from support_messages) + (select count(*) from admin_role_assignments) as n');
  assert.equal(Number(n), 0, 'no fake reports, messages or admins are seeded');
});

test('foreign keys resolve and place endpoints use the place id as node id', async () => {
  const [{ n }] = await rows(db, `select count(*)::int n from transport_stops where place_id is not null and place_id <> id`);
  assert.equal(n, 0);
  const [{ orphans }] = await rows(db, `select count(*)::int orphans from transport_segments s
    left join transport_stops a on a.id = s.from_stop_id left join transport_stops b on b.id = s.to_stop_id where a.id is null or b.id is null`);
  assert.equal(orphans, 0);
});

test('constraints reject invalid network records', async () => {
  await rejects(`insert into transport_segments (id, from_stop_id, to_stop_id, mode, signboard, instruction, travel_minutes, provenance)
    values ('loop', 'legarda', 'legarda', 'walk', 's', 'i', 1, 'illustrative-demo')`, /check/);
  await rejects(`insert into transport_segments (id, from_stop_id, to_stop_id, mode, signboard, instruction, travel_minutes, provenance)
    values ('ride-without-service', 'legarda', 'cubao-lrt', 'lrt', 's', 'i', 1, 'illustrative-demo')`, /check/);
  await rejects(`insert into transport_segments (id, from_stop_id, to_stop_id, mode, service_id, signboard, instruction, travel_minutes, provenance)
    values ('mode-mismatch', 'legarda', 'cubao-lrt', 'bus', 'srv:legarda-cubao', 's', 'i', 1, 'illustrative-demo')`, /foreign key/);
  await rejects(`insert into transport_segments (id, from_stop_id, to_stop_id, mode, signboard, instruction, travel_minutes, provenance)
    values ('neg', 'legarda', 'cubao-lrt', 'walk', 's', 'i', -1, 'illustrative-demo')`, /check/);
  await rejects(`insert into transport_segments (id, from_stop_id, to_stop_id, mode, signboard, instruction, travel_minutes, provenance)
    values ('ghost', 'legarda', 'nowhere', 'walk', 's', 'i', 1, 'illustrative-demo')`, /foreign key/);
  await rejects(`insert into transport_stops (id, name, place_id, area_id, stop_type, provenance)
    values ('other-id', 'x', 'pitx', 'pitx', 'place-endpoint', 'illustrative-demo')`, /check/);
  await rejects(`insert into transport_places (id, name, formatted_address, provenance) values ('manual:abc', 'x', 'y', 'illustrative-demo')`, /check/);
});

test('constraints reject invalid fares and advisories', async () => {
  await rejects(`insert into fare_matrices (name, matrix_type, mode, effective_from, source_name, verification_status)
    values ('x', 'segment', 'bus', now(), 'x', 'verified')`, /check/);
  await rejects(`insert into fare_rules (fare_matrix_id, passenger_category, segment_id, fare_amount)
    values ('00000000-0000-4000-8000-000000000001', 'regular', 'ust-road-walk', 1)`, /walking_segments_have_no_fare|fare_rule_does_not_match/);
  await rejects(`insert into fare_rules (fare_matrix_id, passenger_category, segment_id, fare_amount)
    values ((select id from fare_matrices where matrix_type='segment' and mode='bus'), 'regular', 'ust-north-jeep', 1)`, /fare_rule_does_not_match/);
  await rejects(`insert into fare_rules (fare_matrix_id, passenger_category, segment_id, fare_amount)
    values ((select id from fare_matrices where matrix_type='segment' and mode='jeepney'), 'regular', 'ust-north-jeep', -5)`, /check/);
  const advisory = (patch) => `insert into road_advisories (id, title, description, category, severity, status, source_type, source_name, verification_status, area_name, impact_type ${patch[0]})
    values ('rw-bad', 't', 'd', 'traffic', 'low', 'active', 'demo', 's', 'simulated', 'a', 'informational' ${patch[1]})`;
  await rejects(advisory([', starts_at, ends_at', ", now(), now() - interval '1 hour'"]), /check/);
  await rejects(`insert into road_advisories (id, title, description, category, severity, status, source_type, source_name, verification_status, area_name, impact_type)
    values ('rw-sched', 't', 'd', 'traffic', 'low', 'scheduled', 'demo', 's', 'simulated', 'a', 'informational')`, /check/);
  await rejects(`insert into road_advisories (id, title, description, category, severity, status, source_type, source_name, verification_status, area_name, impact_type)
    values ('rw-fake-official', 't', 'd', 'traffic', 'low', 'active', 'official', 's', 'verified', 'a', 'informational')`, /check/);
  await rejects(`insert into road_advisories (id, title, description, category, severity, status, source_type, source_name, verification_status, area_name, impact_type)
    values ('rw-sim-community', 't', 'd', 'traffic', 'low', 'active', 'community', 's', 'simulated', 'a', 'informational')`, /check/);
  await rejects(`insert into road_advisory_impacts (advisory_id, target_type, stop_id) values ('rw-traffic', 'segment', 'pitx')`, /check/);
});
