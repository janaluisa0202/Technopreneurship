import { test } from 'node:test';
import assert from 'node:assert/strict';
import { as, createDatabase, createUser, grantRole, randomUUID, rows } from './harness.mjs';

const db = await createDatabase();
const manager = await createUser(db, 'registered');
await grantRole(db, manager, 'transport_data_manager');
const submit = (user, terminal, level, extra = {}) => as(db, user, tx => rows(tx,
  `select * from submit_queue_report($1, $2, $3, $4, $5, null, $6)`,
  [terminal, level, extra.requestId ?? randomUUID(), extra.details ?? null, extra.segment ?? null, extra.source ?? 'community']));
const estimate = async (terminal, at) => (await rows(db, `select * from get_queue_estimates(coalesce($1::timestamptz, now())) where terminal_id = $2`, [at ?? null, terminal]))[0];
const age = (minutes, where = 'true') => db.query(`update queue_reports set created_at = created_at - make_interval(mins => ${minutes}), expires_at = expires_at - make_interval(mins => ${minutes}) where ${where}`);

test('a guest can submit a valid report; server controls identity, time, expiry and moderation', async () => {
  const guest = await createUser(db);
  const [report] = await submit(guest, 'ust-espana', 'high', { details: '  Long line near the gate  ' });
  assert.equal(report.moderation_status, 'unreviewed');
  assert.equal(report.report_source, 'community');
  assert.equal(new Date(report.expires_at) - new Date(report.created_at), 30 * 60 * 1000);
  const [stored] = await rows(db, 'select reporter_id, details from queue_reports where id = $1', [report.id]);
  assert.deepEqual(stored, { reporter_id: guest.id, details: 'Long line near the gate' });
});

test('invalid reports are rejected', async () => {
  const guest = await createUser(db);
  await assert.rejects(submit(guest, 'atlantis', 'low'), /unknown_terminal/);
  await assert.rejects(submit(guest, 'ust-espana', 'extreme'), /invalid input value for enum/);
  await assert.rejects(submit(guest, 'ust-espana', 'low', { details: 'x'.repeat(151) }), /invalid_input/);
  await assert.rejects(submit(guest, 'ust-espana', 'low', { segment: 'pitx-moa-bus' }), /segment_not_at_terminal/);
  await assert.rejects(submit(guest, 'ust-espana', 'low', { source: 'terminal-staff' }), /forbidden/);
  await assert.rejects(as(db, guest, tx => tx.query(`insert into queue_reports (terminal_id, request_id, queue_level, expires_at) values ('pitx', gen_random_uuid(), 'low', now() + interval '1 day')`)), /permission denied/);
});

test('retrying with the same request id is idempotent', async () => {
  const guest = await createUser(db);
  const requestId = randomUUID();
  const [first] = await submit(guest, 'pitx', 'mid', { requestId });
  const [again] = await submit(guest, 'pitx', 'mid', { requestId });
  assert.equal(again.id, first.id);
  assert.equal((await rows(db, 'select count(*)::int n from queue_reports where reporter_id = $1', [guest.id]))[0].n, 1);
});

test('rate limits stop duplicate and excessive submissions', async () => {
  const guest = await createUser(db);
  await submit(guest, 'one-ayala', 'low');
  await assert.rejects(submit(guest, 'one-ayala', 'high'), /duplicate_report/);
  for (const terminal of ['pitx', 'cubao-mrt', 'legarda-lrt', 'ayala-mrt', 'pasay-mrt']) await submit(guest, terminal, 'low');
  await assert.rejects(submit(guest, 'libertad-bus', 'low'), /rate_limited/);
  await age(11, `reporter_id = '${guest.id}'`);
  await submit(guest, 'libertad-bus', 'low');
});

test('one reporter cannot outvote others; estimates aggregate independent reporters', async () => {
  const spammer = await createUser(db);
  await submit(spammer, 'sm-north-edsa', 'high');
  await age(4, `reporter_id = '${spammer.id}'`);
  await submit(spammer, 'sm-north-edsa', 'high');
  let e = await estimate('sm-north-edsa');
  assert.equal(e.sample_count, 1);
  assert.equal(e.confidence, 'low');
  for (let i = 0; i < 4; i++) await submit(await createUser(db), 'sm-north-edsa', 'low');
  e = await estimate('sm-north-edsa');
  assert.equal(e.source, 'community');
  assert.equal(e.sample_count, 5);
  assert.equal(e.queue_level, 'low');
  assert.equal(e.confidence, 'high');
});

test('a single report never becomes verified terminal data', async () => {
  await submit(await createUser(db), 'moa-terminal', 'high');
  const e = await estimate('moa-terminal');
  assert.equal(e.source, 'community');
  assert.equal(e.confidence, 'low');
  await submit(manager, 'moa-terminal', 'low', { source: 'terminal-staff' });
  const staff = await estimate('moa-terminal');
  assert.equal(staff.source, 'terminal-staff');
  assert.equal(staff.queue_level, 'low');
});

test('stale reports do not affect current estimates', async () => {
  await submit(await createUser(db), 'pasay-rotonda', 'high');
  assert.equal((await estimate('pasay-rotonda')).queue_level, 'high');
  const later = new Date(Date.now() + 31 * 60 * 1000).toISOString();
  const e = await estimate('pasay-rotonda', later);
  assert.equal(e.queue_level, null);
  assert.equal(e.source, 'none');
  assert.equal(e.sample_count, 0);
});

test('moderation: only moderators update; rejected reports are excluded', async () => {
  const reporter = await createUser(db);
  const [report] = await submit(reporter, 'pasay-local-tricycle', 'high');
  await as(db, reporter, tx => tx.query(`update queue_reports set moderation_status = 'approved' where id = $1`, [report.id]));
  assert.equal((await rows(db, 'select moderation_status from queue_reports where id = $1', [report.id]))[0].moderation_status, 'unreviewed');
  await assert.rejects(as(db, manager, tx => tx.query(`update queue_reports set queue_level = 'low' where id = $1`, [report.id])), /permission denied/);
  await as(db, manager, tx => tx.query(`update queue_reports set moderation_status = 'rejected', moderation_note = 'spam' where id = $1`, [report.id]));
  const [stored] = await rows(db, 'select moderated_by from queue_reports where id = $1', [report.id]);
  assert.equal(stored.moderated_by, manager.id);
  assert.equal((await estimate('pasay-local-tricycle')).source, 'none');
});

test('reporters see only their own raw reports; the public sees none', async () => {
  const a = await createUser(db), b = await createUser(db);
  await submit(a, 'cubao-mrt', 'mid');
  await as(db, b, async tx => assert.equal((await rows(tx, `select * from queue_reports where reporter_id = $1`, [a.id])).length, 0));
  await assert.rejects(as(db, null, tx => tx.query('select * from queue_reports')), /permission denied/);
  await as(db, null, async tx => assert.ok((await rows(tx, 'select * from queue_terminal_signals')).length > 0));
});
