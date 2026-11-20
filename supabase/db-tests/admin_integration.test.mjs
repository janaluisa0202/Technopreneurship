// Admin dashboard ⇄ commuter integration (migration 20261112120000).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { as, createDatabase, createUser, grantRole, randomUUID, rows } from './harness.mjs';

const db = await createDatabase();
const commuter = await createUser(db, 'registered', { name: 'Mika Santos', email: 'mika@example.com' });
const other = await createUser(db, 'registered', { name: 'Carlo Reyes', email: 'carlo@example.com' });
const guest = await createUser(db, 'anonymous');
const support = await createUser(db, 'registered', { name: 'Ops Moderator', email: 'ops@example.com' });
const transport = await createUser(db, 'registered', { name: 'Data Manager', email: 'data@example.com' });
const owner = await createUser(db, 'registered', { name: 'Admin Owner', email: 'owner@example.com' });
await grantRole(db, support, 'support_staff');
await grantRole(db, transport, 'transport_data_manager');
await grantRole(db, owner, 'super_admin');

const deny = /permission denied|row-level security|forbidden/;
async function blocked(user, sql, params = []) {
  try {
    const result = await as(db, user, tx => tx.query(sql, params));
    assert.equal(result.affectedRows ?? 0, 0, `should be blocked: ${sql}`);
  } catch (error) { assert.match(error.message, deny); }
}
const sendAdmin = (user, args) => as(db, user, async tx => (await rows(tx,
  `select * from admin_send_message($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  [args.audience, args.purpose ?? 'general', args.subject ?? 'Subject', args.body ?? 'Body', args.requestId ?? randomUUID(),
    args.recipient ?? null, args.origin ?? null, args.destination ?? null, args.promo ?? null]))[0]);

test('profiles are created from auth users, readable by the owner and staff only', async () => {
  const [mine] = await as(db, commuter, tx => rows(tx, 'select display_name, email, is_anonymous from profiles'));
  assert.deepEqual(mine, { display_name: 'Mika Santos', email: 'mika@example.com', is_anonymous: false });
  assert.equal((await as(db, other, tx => rows(tx, 'select * from profiles where user_id = $1', [commuter.id]))).length, 0);
  assert.ok((await as(db, support, tx => rows(tx, 'select * from profiles'))).length >= 6);
  await assert.rejects(as(db, null, tx => tx.query('select * from profiles')), /permission denied/);
  await blocked(commuter, `update profiles set email = 'x@y.z' where user_id = $1`, [commuter.id]);
  await as(db, commuter, tx => tx.query(`update profiles set display_name = 'Mika S.' where user_id = $1`, [commuter.id]));
  const [touched] = await as(db, commuter, tx => rows(tx, 'select display_name, last_seen_at from touch_profile()'));
  assert.equal(touched.display_name, 'Mika S.');
  assert.ok(touched.last_seen_at);
});

test('admin user list: staff only, commuters only (no staff, no idle guests)', async () => {
  for (const user of [commuter, guest]) await assert.rejects(as(db, user, tx => tx.query('select * from admin_list_users()')), /forbidden/);
  const list = await as(db, transport, tx => rows(tx, 'select user_id, display_name, conversation_count from admin_list_users()'));
  const ids = list.map(row => row.user_id);
  assert.ok(ids.includes(commuter.id) && ids.includes(other.id));
  assert.ok(!ids.includes(support.id) && !ids.includes(owner.id) && !ids.includes(guest.id));
  assert.deepEqual((await as(db, support, tx => rows(tx, `select user_id from admin_list_users('carlo')`))).map(r => r.user_id), [other.id]);
});

test('Help Center: a commuter message reaches staff; reply, unread, spam and status round-trip', async () => {
  const convo = await as(db, commuter, async tx => (await rows(tx, `select * from support_create_conversation('fare', $1)`, [randomUUID()]))[0]);
  await as(db, commuter, tx => tx.query('select * from support_send_message($1, $2, $3)', [convo.id, 'Is the student fare applied?', randomUUID()]));
  const inbox = await as(db, support, tx => rows(tx, `select c.id, c.flagged_spam, m.message, m.read_at from support_conversations c join support_messages m on m.conversation_id = c.id where c.id = $1`, [convo.id]));
  assert.deepEqual(inbox.map(r => [r.message, r.read_at, r.flagged_spam]), [['Is the student fare applied?', null, false]]);

  await as(db, support, tx => tx.query('select support_mark_read($1)', [convo.id]));
  await as(db, support, tx => tx.query('select support_mark_unread($1)', [convo.id]));
  assert.equal((await rows(db, `select read_at from support_messages where conversation_id = $1 and sender_type = 'commuter'`, [convo.id]))[0].read_at, null);

  await as(db, support, tx => tx.query('select * from support_send_message($1, $2, $3)', [convo.id, 'Yes, with a valid ID.', randomUUID()]));
  const thread = await as(db, commuter, tx => rows(tx, 'select sender_type, message from support_messages where conversation_id = $1 order by created_at, id', [convo.id]));
  assert.deepEqual(thread.map(m => m.sender_type), ['commuter', 'admin']);

  await as(db, support, tx => tx.query('select * from support_set_spam($1, true)', [convo.id]));
  await assert.rejects(as(db, commuter, tx => tx.query('select * from support_set_spam($1, false)', [convo.id])), /forbidden/);
  await assert.rejects(as(db, transport, tx => tx.query('select support_mark_unread($1)', [convo.id])), /forbidden/);
  await as(db, support, tx => tx.query(`select * from support_set_status($1, 'resolved')`, [convo.id]));
  const activity = await rows(db, `select actor_id, action, detail from admin_audit_log where record_id = $1 order by id`, [convo.id]);
  assert.deepEqual(activity.map(a => a.detail), ['Replied to commuter · Incorrect fares', 'Flagged conversation as spam · Incorrect fares', 'Marked concern resolved · Incorrect fares']);
  assert.ok(activity.every(a => a.actor_id === support.id && a.action === 'EVENT'));
  assert.ok(!JSON.stringify(activity).includes('student fare'), 'message bodies are not copied into the audit log');
});

test('direct message to one commuter lands in their support thread (and nobody else\'s)', async () => {
  const message = await sendAdmin(support, { audience: 'one', recipient: other.id, subject: 'Your queue report', body: 'Thanks, we updated One Ayala.' });
  assert.equal(message.recipient_label, 'Carlo Reyes');
  assert.ok(message.conversation_id);
  const thread = await as(db, other, tx => rows(tx, 'select m.sender_type, m.message, c.status from support_messages m join support_conversations c on c.id = m.conversation_id'));
  assert.deepEqual(thread, [{ sender_type: 'admin', message: 'Your queue report\n\nThanks, we updated One Ayala.', status: 'pending' }]);
  assert.equal((await as(db, commuter, tx => rows(tx, 'select * from support_messages where conversation_id = $1', [message.conversation_id]))).length, 0);
  assert.equal((await as(db, other, tx => rows(tx, 'select * from admin_messages'))).length, 0, '"one" messages are not part of the broadcast feed');
  await assert.rejects(sendAdmin(support, { audience: 'one', recipient: owner.id }), /unknown_recipient/, 'staff are not commuter recipients');
  await assert.rejects(sendAdmin(transport, { audience: 'one', recipient: other.id }), /forbidden/, 'only support roles write into support threads');
  const requestId = randomUUID();
  const first = await sendAdmin(support, { audience: 'all', requestId, subject: 'Welcome' });
  assert.equal((await sendAdmin(support, { audience: 'all', requestId, subject: 'Welcome' })).id, first.id, 'idempotent');
});

test('broadcasts: all-user and route messages are readable by signed-in commuters, not the public; only staff send', async () => {
  const route = await sendAdmin(transport, { audience: 'route', origin: 'ust-frassati', destination: 'sm-north', purpose: 'advisory', subject: 'Flooding near España' });
  assert.equal(route.recipient_label, 'UST Frassati (España) → SM North EDSA / Annex');
  await assert.rejects(sendAdmin(transport, { audience: 'route', origin: 'ust-frassati', destination: 'nowhere' }), /unknown_route/);
  const feed = await as(db, commuter, tx => rows(tx, 'select audience, subject from admin_messages order by sent_at'));
  assert.ok(feed.some(m => m.audience === 'route' && m.subject === 'Flooding near España'));
  await assert.rejects(as(db, null, tx => tx.query('select * from admin_messages')), /permission denied/);
  await assert.rejects(sendAdmin(commuter, { audience: 'all' }), /forbidden/);
  await assert.rejects(as(db, commuter, tx => tx.query(`insert into admin_messages (audience, recipient_label, purpose, subject, body, request_id) values ('all', 'All users', 'general', 'Fake', 'Fake', gen_random_uuid())`)), /permission denied/);
  await assert.rejects(sendAdmin(support, { audience: 'all', purpose: 'promo' }), /unknown_promo/);
});

test('promos: staff manage; commuters see only active, in-date promos', async () => {
  const today = (await rows(db, `select private.manila_today()::text d`))[0].d;
  const insert = (status, start, end, title) => as(db, support, tx => rows(tx,
    `insert into promos (title, description, promo_type, start_date, end_date, status) values ($1, 'd', 'student', $2::date, $3::date, $4) returning id, created_by`, [title, start, end, status]));
  const [live] = await insert('active', today, today, 'Live today');
  assert.equal(live.created_by, support.id);
  await insert('inactive', today, today, 'Hidden');
  await insert('active', '2020-01-01', '2020-01-31', 'Expired');
  await as(db, support, tx => tx.query(`insert into promos (title, description, promo_type, start_date, end_date, status) values ('Upcoming', 'd', 'seasonal', $1::date + 3, $1::date + 9, 'active')`, [today]));
  for (const user of [null, commuter]) {
    assert.deepEqual((await as(db, user, tx => rows(tx, 'select title from promos'))).map(r => r.title), ['Live today']);
  }
  assert.equal((await as(db, support, tx => rows(tx, 'select * from promos'))).length, 4);
  await blocked(commuter, `update promos set status = 'active'`);
  await blocked(null, `delete from promos`);
  await assert.rejects(as(db, support, tx => tx.query(`insert into promos (title, description, promo_type, start_date, end_date) values ('Bad', 'd', 'student', '2026-02-01', '2026-01-01')`)), /check/);
});

test('announcements: drafts stay internal; publishing stamps published_at and reaches commuters', async () => {
  const [draft] = await as(db, transport, tx => rows(tx, `insert into announcements (title, body, channel) values ('Heavy queue at One Ayala', 'Draft text', 'para-alerts') returning id, published_at`));
  assert.equal(draft.published_at, null);
  assert.equal((await as(db, commuter, tx => rows(tx, 'select * from announcements'))).length, 0);
  await as(db, transport, tx => tx.query(`update announcements set status = 'published' where id = $1`, [draft.id]));
  const [seen] = await as(db, null, tx => rows(tx, 'select title, published_at from announcements'));
  assert.equal(seen.title, 'Heavy queue at One Ayala');
  assert.ok(seen.published_at);
  await blocked(commuter, `insert into announcements (title, body, channel, status) values ('Fake', 'Fake', 'general', 'published')`);
  const audit = await rows(db, `select action from admin_audit_log where table_name = 'announcements' and record_id = $1 order by id`, [draft.id]);
  assert.deepEqual(audit.map(a => a.action), ['INSERT', 'UPDATE']);
});

test('queue moderation: spam is a real outcome and is excluded from commuter estimates', async () => {
  const reporter = await createUser(db, 'registered');
  const [report] = await as(db, reporter, tx => rows(tx, `select * from submit_queue_report('pitx', 'high', $1, 'Buy followers at example.invalid')`, [randomUUID()]));
  assert.equal((await rows(db, `select queue_level from get_queue_estimates() where terminal_id = 'pitx'`))[0].queue_level, 'high');
  await blocked(support, `update queue_reports set moderation_status = 'spam' where id = $1`, [report.id]);
  await as(db, transport, tx => tx.query(`update queue_reports set moderation_status = 'spam' where id = $1`, [report.id]));
  const [estimate] = await rows(db, `select source, queue_level from get_queue_estimates() where terminal_id = 'pitx'`);
  assert.deepEqual(estimate, { source: 'none', queue_level: null });
  await assert.rejects(as(db, transport, tx => tx.query(`update queue_reports set moderation_status = 'deleted' where id = $1`, [report.id])), /check/);
});

test('staff-posted advisories use the operator source type and reach the public feed', async () => {
  await as(db, transport, tx => tx.query(`insert into road_advisories (id, title, description, category, severity, status, source_type, source_name, verification_status, area_name, impact_type, starts_at, ends_at, is_published)
    values ('rw-ops-test', 'Flooding near España', 'Water on the boarding area', 'flooding', 'high', 'active', 'operator', 'SakayWise Operations', 'unverified', 'España', 'informational', now(), now() + interval '2 hours', true)`));
  const [row] = await as(db, commuter, tx => rows(tx, `select source_type, created_by from road_advisories where id = 'rw-ops-test'`));
  assert.deepEqual(row, { source_type: 'operator', created_by: transport.id });
  await assert.rejects(as(db, transport, tx => tx.query(`update road_advisories set verification_status = 'verified' where id = 'rw-ops-test'`)), /check/, 'operator posts cannot claim official verification');
  await blocked(support, `update road_advisories set status = 'resolved' where id = 'rw-ops-test'`);
});

test('activity log: staff sign-in events; only admins read the log', async () => {
  await as(db, support, tx => tx.query(`select admin_log_event('Signed in')`));
  await assert.rejects(as(db, support, tx => tx.query(`select admin_log_event('Deleted everything')`)), /invalid_input/);
  await assert.rejects(as(db, commuter, tx => tx.query(`select admin_log_event('Signed in')`)), /forbidden/);
  assert.equal((await as(db, support, tx => rows(tx, 'select * from admin_audit_log'))).length, 0, 'support staff cannot read the audit log');
  const entries = await as(db, owner, tx => rows(tx, `select table_name, detail from admin_audit_log where table_name = 'auth'`));
  assert.deepEqual(entries, [{ table_name: 'auth', detail: 'Signed in' }]);
});
