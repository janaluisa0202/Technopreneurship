import { test } from 'node:test';
import assert from 'node:assert/strict';
import { as, createDatabase, createUser, grantRole, rows } from './harness.mjs';

const db = await createDatabase();
const guest = await createUser(db, 'anonymous');
const registered = await createUser(db, 'registered');
const dataManager = await createUser(db, 'registered');
const support = await createUser(db, 'registered');
const superAdmin = await createUser(db, 'registered');
await grantRole(db, dataManager, 'transport_data_manager');
await grantRole(db, support, 'support_staff');
await grantRole(db, superAdmin, 'super_admin');

const deny = /permission denied|row-level security|violates row-level|anonymous_user_cannot_be_admin/;
/** A write is blocked if Postgres refuses it, or if RLS silently filters it to zero rows. */
async function assertBlocked(user, sql, params = []) {
  let affected = 0;
  try {
    await as(db, user, async tx => { affected = (await tx.query(sql, params)).affectedRows ?? 0; });
  } catch (error) {
    assert.match(error.message, deny);
    return;
  }
  assert.equal(affected, 0, `write should have been blocked: ${sql}`);
}

test('the public can read network, fares and published advisories without signing in', async () => {
  await as(db, null, async tx => {
    assert.equal((await rows(tx, 'select count(*)::int n from transport_segments'))[0].n, 39);
    assert.ok((await rows(tx, 'select count(*)::int n from get_current_fare_rules()'))[0].n > 0);
    assert.equal((await rows(tx, 'select count(*)::int n from road_advisories'))[0].n, 8);
    assert.ok((await rows(tx, 'select * from get_queue_estimates()')).length > 0);
  });
});

test('public users cannot modify fares', async () => {
  for (const user of [null, guest, registered, support]) {
    await assertBlocked(user, `update fare_rules set fare_amount = 1`);
    await assertBlocked(user, `delete from fare_matrices`);
    await assertBlocked(user, `insert into fare_matrices (name, matrix_type, mode, effective_from, source_name) values ('x', 'segment', 'bus', now(), 'x')`);
  }
  assert.equal((await rows(db, 'select count(*)::int n from fare_rules where fare_amount = 1'))[0].n, 0);
});

test('public users cannot create or publish official advisories', async () => {
  const insert = `insert into road_advisories (id, title, description, category, severity, status, source_type, source_name, source_url, verification_status, area_name, impact_type, is_published)
    values ('rw-forged', 'Closed', 'd', 'closure', 'high', 'active', 'official', 'MMDA', 'https://mmda.gov.ph/x', 'verified', 'EDSA', 'segment-closure', true)`;
  for (const user of [null, guest, registered, support]) await assertBlocked(user, insert);
  await as(db, dataManager, tx => tx.query(insert));
  assert.equal((await rows(db, `select created_by from road_advisories where id = 'rw-forged'`))[0].created_by, dataManager.id);
});

test('unpublished advisories and their impacts are hidden from the public', async () => {
  await db.query(`insert into road_advisories (id, title, description, category, severity, status, source_type, source_name, verification_status, area_name, impact_type)
    values ('rw-draft', 'Draft', 'd', 'traffic', 'low', 'active', 'demo', 'demo', 'simulated', 'a', 'informational')`);
  await db.query(`insert into road_advisory_impacts (advisory_id, target_type, segment_id) values ('rw-draft', 'segment', 'ust-north-jeep')`);
  await as(db, guest, async tx => {
    assert.equal((await rows(tx, `select * from road_advisories where id = 'rw-draft'`)).length, 0);
    assert.equal((await rows(tx, `select * from road_advisory_impacts where advisory_id = 'rw-draft'`)).length, 0);
  });
  await as(db, dataManager, async tx => assert.equal((await rows(tx, `select * from road_advisories where id = 'rw-draft'`)).length, 1));
});

test('unauthorised users cannot read admin data', async () => {
  for (const user of [null, guest, registered, dataManager]) {
    const read = as(db, user, tx => rows(tx, 'select * from admin_audit_log'));
    if (user === null) await assert.rejects(read, deny);
    else assert.equal((await read).length, 0);
  }
  await as(db, registered, async tx => assert.equal((await rows(tx, 'select * from admin_role_assignments')).length, 0));
  await as(db, superAdmin, async tx => assert.ok((await rows(tx, 'select * from admin_audit_log')).length > 0));
});

test('no privilege escalation: only super admins grant roles; guests can never be admins', async () => {
  for (const user of [guest, registered, dataManager, support]) {
    await assertBlocked(user, `insert into admin_role_assignments (user_id, role) values ($1, 'super_admin')`, [user.id]);
    await assertBlocked(user, `update admin_role_assignments set role = 'super_admin'`);
  }
  await assert.rejects(as(db, superAdmin, tx => tx.query(`insert into admin_role_assignments (user_id, role) values ($1, 'admin')`, [guest.id])), /anonymous_user_cannot_be_admin/);
  // A forged JWT claim cannot help an anonymous session even if a role row existed.
  const forged = { id: dataManager.id, kind: 'anonymous' };
  await assertBlocked(forged, `update fare_rules set fare_amount = fare_amount`);
  await as(db, superAdmin, tx => tx.query(`insert into admin_role_assignments (user_id, role) values ($1, 'support_staff')`, [registered.id]));
  await as(db, registered, async tx => assert.deepEqual(await rows(tx, 'select my_admin_roles() as role'), [{ role: 'support_staff' }]));
});

test('the last active super admin cannot be removed', async () => {
  await assert.rejects(as(db, superAdmin, tx => tx.query(`update admin_role_assignments set is_active = false where user_id = $1 and role = 'super_admin'`, [superAdmin.id])), /last_super_admin/);
});

test('transport managers can maintain data and every change is audited', async () => {
  await as(db, dataManager, tx => tx.query(`update transport_segments set travel_minutes = 31 where id = 'ust-north-jeep'`));
  const [entry] = await rows(db, `select actor_id, action from admin_audit_log where table_name = 'transport_segments' and record_id = 'ust-north-jeep' order by id desc limit 1`);
  assert.deepEqual(entry, { actor_id: dataManager.id, action: 'UPDATE' });
});

test('RPCs that write are not callable with only the public key', async () => {
  await assert.rejects(as(db, null, tx => tx.query(`select * from submit_queue_report('pitx', 'low', gen_random_uuid())`)), /permission denied/);
  await assert.rejects(as(db, null, tx => tx.query(`select * from support_create_conversation('general', gen_random_uuid())`)), /permission denied/);
});

test('anonymous guests cannot create account-synced preference rows', async () => {
  await assert.rejects(as(db, guest, tx => tx.query(`insert into commuter_preferences (user_id) values ($1)`, [guest.id])), deny);
  await as(db, registered, tx => tx.query(`insert into commuter_preferences (user_id, language) values ($1, 'fil')`, [registered.id]));
  await assert.rejects(as(db, registered, tx => tx.query(`insert into commuter_preferences (user_id) values ($1)`, [guest.id])), deny);
});
