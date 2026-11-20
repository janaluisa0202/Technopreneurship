import { test } from 'node:test';
import assert from 'node:assert/strict';
import { as, createDatabase, createUser, grantRole, randomUUID, rows } from './harness.mjs';

const db = await createDatabase({ seed: false });
const staff = await createUser(db, 'registered');
await grantRole(db, staff, 'support_staff');
const transportOnly = await createUser(db, 'registered');
await grantRole(db, transportOnly, 'transport_data_manager');

const create = (user, extra = {}) => as(db, user, async tx => (await rows(tx,
  `select * from support_create_conversation($1, $2, $3, $4, $5)`,
  [extra.category ?? 'route', extra.requestId ?? randomUUID(), extra.nickname ?? null, extra.email ?? null, extra.trip ?? null]))[0]);
const send = (user, conversation, message, requestId = randomUUID()) => as(db, user, async tx => (await rows(tx,
  `select * from support_send_message($1, $2, $3)`, [conversation, message, requestId]))[0]);
const messages = (user, conversation) => as(db, user, tx => rows(tx,
  `select sender_type, message, read_at from support_messages where conversation_id = $1 order by created_at, id`, [conversation]));

test('a guest creates an authorised conversation and the server accepts the message', async () => {
  const guest = await createUser(db);
  const convo = await create(guest, { category: 'fare', nickname: ' Gab ', email: 'gab@example.com' });
  assert.equal(convo.owner_id, guest.id);
  assert.equal(convo.subject, 'Incorrect fares');
  assert.equal(convo.status, 'open');
  assert.equal(convo.nickname, 'Gab');
  const message = await send(guest, convo.id, '  The fare was different.  ');
  assert.equal(message.sender_type, 'commuter');
  assert.equal(message.sender_id, guest.id);
  assert.equal(message.message, 'The fare was different.');
});

test('users cannot read or write other conversations', async () => {
  const owner = await createUser(db), intruder = await createUser(db), registered = await createUser(db, 'registered');
  const convo = await create(owner);
  await send(owner, convo.id, 'Private details here');
  for (const user of [intruder, registered, transportOnly]) {
    assert.equal((await as(db, user, tx => rows(tx, 'select * from support_conversations where id = $1', [convo.id]))).length, 0);
    assert.equal((await messages(user, convo.id)).length, 0);
    await assert.rejects(send(user, convo.id, 'hijack'), /conversation_not_found/);
    await assert.rejects(as(db, user, tx => tx.query('select support_mark_read($1)', [convo.id])), /conversation_not_found/);
    await assert.rejects(as(db, user, tx => tx.query(`select * from support_update_conversation($1, 'other')`, [convo.id])), /conversation_not_found/);
  }
  await assert.rejects(as(db, null, tx => tx.query('select * from support_messages')), /permission denied/);
});

test('guests cannot impersonate administrators or write rows directly', async () => {
  const guest = await createUser(db);
  const convo = await create(guest);
  await assert.rejects(as(db, guest, tx => tx.query(`insert into support_messages (conversation_id, sender_type, sender_id, message, request_id)
    values ($1, 'admin', $2, 'Fake reply', gen_random_uuid())`, [convo.id, staff.id])), /permission denied/);
  await assert.rejects(as(db, guest, tx => tx.query(`update support_conversations set status = 'resolved' where id = $1`, [convo.id])), /permission denied/);
  await assert.rejects(as(db, guest, tx => tx.query(`select * from support_set_status($1, 'closed')`, [convo.id])), /forbidden/);
  // The sender type comes from the server, never from the client.
  assert.equal((await send(guest, convo.id, 'hello')).sender_type, 'commuter');
});

test('admin replies require a support role; status and read receipts follow real events', async () => {
  const guest = await createUser(db);
  const convo = await create(guest);
  await send(guest, convo.id, 'Where do I board?');
  await assert.rejects(send(transportOnly, convo.id, 'Not my job'), /conversation_not_found/);
  const reply = await send(staff, convo.id, 'At the España boarding area.');
  assert.equal(reply.sender_type, 'admin');
  let [c] = await as(db, staff, tx => rows(tx, 'select status, assigned_admin_id from support_conversations where id = $1', [convo.id]));
  assert.deepEqual(c, { status: 'pending', assigned_admin_id: staff.id });
  assert.equal((await messages(guest, convo.id)).find(m => m.sender_type === 'admin').read_at, null);
  assert.equal(await as(db, guest, async tx => (await rows(tx, 'select support_mark_read($1) n', [convo.id]))[0].n), 1);
  assert.equal(await as(db, staff, async tx => (await rows(tx, 'select support_mark_read($1) n', [convo.id]))[0].n), 1);
  await as(db, staff, tx => tx.query(`select * from support_set_status($1, 'resolved')`, [convo.id]));
  await send(guest, convo.id, 'One more question');
  [c] = await as(db, guest, tx => rows(tx, 'select status from support_conversations where id = $1', [convo.id]));
  assert.equal(c.status, 'open', 'a commuter reply reopens a resolved conversation');
  await as(db, staff, tx => tx.query(`select * from support_set_status($1, 'closed')`, [convo.id]));
  await assert.rejects(send(guest, convo.id, 'Hello?'), /conversation_closed/);
});

test('message ordering, idempotency and validation', async () => {
  const guest = await createUser(db);
  const convo = await create(guest);
  const requestId = randomUUID();
  const first = await send(guest, convo.id, 'first', requestId);
  assert.equal((await send(guest, convo.id, 'first', requestId)).id, first.id);
  await send(guest, convo.id, 'second');
  assert.deepEqual((await messages(guest, convo.id)).map(m => m.message), ['first', 'second']);
  await assert.rejects(send(guest, convo.id, '   '), /empty_message/);
  await assert.rejects(send(guest, convo.id, 'x'.repeat(2001)), /message_too_long/);
  await assert.rejects(send(guest, convo.id, 'second'), /duplicate_message/);
  await assert.rejects(create(guest, { email: 'not-an-email' }), /invalid_email/);
  await assert.rejects(create(guest, { category: 'payments' }), /invalid_input/);
});

test('rate limits prevent basic submission abuse', async () => {
  const guest = await createUser(db);
  const convo = await create(guest);
  for (let i = 0; i < 10; i++) await send(guest, convo.id, `message ${i}`);
  await assert.rejects(send(guest, convo.id, 'one too many'), /rate_limited/);
  const spammer = await createUser(db);
  for (let i = 0; i < 5; i++) await create(spammer);
  await assert.rejects(create(spammer), /rate_limited/);
});

test('owners list only their own conversations and can update optional details', async () => {
  const a = await createUser(db), b = await createUser(db);
  const mine = await create(a);
  await create(b);
  const listed = await as(db, a, tx => rows(tx, 'select id from support_conversations'));
  assert.deepEqual(listed.map(r => r.id), [mine.id]);
  const [updated] = await as(db, a, tx => rows(tx, `select * from support_update_conversation($1, 'bug', '', 'a@b.co', 'Pasay to MOA')`, [mine.id]));
  assert.deepEqual([updated.subject, updated.nickname, updated.contact_email], ['Application bugs', null, 'a@b.co']);
});
