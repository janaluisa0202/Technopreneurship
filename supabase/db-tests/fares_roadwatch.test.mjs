import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, rows } from './harness.mjs';

const db = await createDatabase();
const rulesFor = async (segment, at) => rows(db,
  `select passenger_category, fare_amount::float as fare, verification_status from get_current_fare_rules(coalesce($2::timestamptz, now())) where segment_id = $1 order by passenger_category`,
  [segment, at ?? null]);

test('applicable fare rules come from the frontend sample tables', async () => {
  const rules = await rulesFor('ust-north-jeep');
  assert.deepEqual(rules.map(r => [r.passenger_category, r.fare]), [['regular', 25], ['student', 20], ['senior', 20], ['pwd', 20]]);
  assert.ok(rules.every(r => r.verification_status === 'illustrative-sample'));
});

test('missing passenger fares stay missing (no inferred discount)', async () => {
  const rules = await rulesFor('pasay-libertad-tricycle');
  assert.deepEqual(rules.map(r => r.passenger_category), ['regular', 'senior', 'pwd']);
});

test('a verified matrix replaces the sample entirely, never mixing categories', async () => {
  const [{ id }] = await rows(db, `insert into fare_matrices (name, matrix_type, mode, service_id, effective_from, source_name, source_url, verification_status)
    values ('Test verified jeepney', 'segment', 'jeepney', 'srv:ust-north-jeep', now() - interval '1 day', 'Test agency', 'https://example.gov.ph/fares', 'verified') returning id`);
  await db.query(`insert into fare_rules (fare_matrix_id, passenger_category, segment_id, fare_amount) values ($1, 'regular', 'ust-north-jeep', 15)`, [id]);
  const rules = await rulesFor('ust-north-jeep');
  assert.deepEqual(rules.map(r => [r.passenger_category, r.fare, r.verification_status]), [['regular', 15, 'verified']]);
  const [m] = await rows(db, 'select verified_at is not null as stamped from fare_matrices where id = $1', [id]);
  assert.equal(m.stamped, true);
  // Before its effective date, the sample applies again.
  assert.equal((await rulesFor('ust-north-jeep', new Date(Date.now() - 3 * 864e5).toISOString())).length, 4);
  await db.query('delete from fare_matrices where id = $1', [id]);
});

test('pending-review and expired matrices are not served to commuters', async () => {
  const [{ id }] = await rows(db, `insert into fare_matrices (name, matrix_type, mode, effective_from, effective_to, source_name, verification_status)
    values ('Old', 'segment', 'mrt', now() - interval '10 days', now() - interval '1 day', 'x', 'illustrative-sample') returning id`);
  await db.query(`insert into fare_rules (fare_matrix_id, passenger_category, segment_id, fare_amount) values ($1, 'regular', 'cubao-north', 99)`, [id]);
  const [{ id: pending }] = await rows(db, `insert into fare_matrices (name, matrix_type, mode, effective_from, source_name) values ('Draft', 'segment', 'mrt', now(), 'x') returning id`);
  await db.query(`insert into fare_rules (fare_matrix_id, passenger_category, segment_id, fare_amount) values ($1, 'regular', 'cubao-north', 98)`, [pending]);
  const regular = (await rulesFor('cubao-north')).find(r => r.passenger_category === 'regular');
  assert.equal(regular.fare, 20);
});

test('distance calculator profiles are returned per calculator mode', async () => {
  const rules = await rows(db, `select calculator_mode, passenger_category, fare_amount::float base, included_km::float km, per_km_amount::float per_km
    from get_current_fare_rules() where matrix_type = 'distance' and passenger_category = 'regular' order by calculator_mode`);
  assert.deepEqual(rules, [
    { calculator_mode: 'bus', passenger_category: 'regular', base: 15, km: 5, per_km: 2.5 },
    { calculator_mode: 'jeep', passenger_category: 'regular', base: 13, km: 4, per_km: 2.2 },
    { calculator_mode: 'uv', passenger_category: 'regular', base: 16, km: 3, per_km: 2 },
  ]);
});

test('advisory impacts are explicit typed mappings to real network ids', async () => {
  const impacts = await rows(db, `select advisory_id, target_type, coalesce(segment_id, stop_id, service_id, itinerary_id) target from road_advisory_impacts order by advisory_id, target`);
  assert.deepEqual(impacts.find(i => i.advisory_id === 'rw-espanaclosure'), { advisory_id: 'rw-espanaclosure', target_type: 'segment', target: 'ust-north-jeep' });
  assert.deepEqual(impacts.find(i => i.advisory_id === 'rw-service'), { advisory_id: 'rw-service', target_type: 'service', target: 'srv:pasay-moa-bus' });
  assert.equal(impacts.filter(i => i.advisory_id === 'rw-unrelated').length, 1);
  await assert.rejects(db.query(`insert into road_advisory_impacts (advisory_id, target_type, segment_id) values ('rw-traffic', 'segment', 'not-a-segment')`), /foreign key/);
});

test('seeded advisory timing mirrors the frontend simulation (relative to now)', async () => {
  const [a] = await rows(db, `select status, round(extract(epoch from (starts_at - now())) / 60) as starts_in from road_advisories where id = 'rw-roadworks'`);
  assert.equal(a.status, 'scheduled');
  assert.equal(Number(a.starts_in), 60);
  const [expired] = await rows(db, `select ends_at < now() as ended from road_advisories where id = 'rw-expired'`);
  assert.equal(expired.ended, true);
});

test('editing advisory content records an update time; publishing alone does not', async () => {
  const [before] = await rows(db, `select updated_at from road_advisories where id = 'rw-unrelated'`);
  await db.query(`update road_advisories set is_published = false where id = 'rw-unrelated'`);
  const [same] = await rows(db, `select updated_at from road_advisories where id = 'rw-unrelated'`);
  assert.equal(same.updated_at.getTime(), before.updated_at.getTime());
  await db.query(`update road_advisories set title = 'Edited', is_published = true where id = 'rw-unrelated'`);
  const [after] = await rows(db, `select updated_at from road_advisories where id = 'rw-unrelated'`);
  assert.ok(after.updated_at.getTime() > before.updated_at.getTime());
});
