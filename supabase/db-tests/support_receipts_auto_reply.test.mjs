// Seen receipts and the automated support reply (migration 20261120120000).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { as, createDatabase, createUser, grantRole, randomUUID, rows } from './harness.mjs';

const db = await createDatabase();   // with the demo seed (demo contact channels)
const staff = await createUser(db, 'registered', { name: 'Ops Moderator' });
const transport = await createUser(db, 'registered');
await grantRole(db, staff, 'support_staff');
await grantRole(db, transport, 'transport_data_manager');

const open = user => as(db, user, async tx => (await rows(tx, `select * from support_create_conversation('route', $1)`, [randomUUID()]))[0]);
const send = (user, id, text) => as(db, user, async tx => (await rows(tx, 'select * from support_send_message($1, $2, $3)', [id, text, randomUUID()]))[0]);
const thread = (user, id) => as(db, user, tx => rows(tx, 'select sender_type, sender_id, message, created_at, read_at from support_messages where conversation_id = $1 order by created_at, id', [id]));
const age = (id, hours) => db.query(`update support_messages set created_at = created_at - make_interval(hours => ${hours}) where conversation_id = $1`, [id]);

test('the first commuter message gets one automated reply with the configured contact channels, strictly after it', async () => {
  const commuter = await createUser(db, 'registered');
  const convo = await open(commuter);
  await send(commuter, convo.id, 'My jeepney route changed?');
  const messages = await thread(commuter, convo.id);
  assert.deepEqual(messages.map(m => m.sender_type), ['commuter', 'system']);
  const reply = messages[1];
  assert.equal(reply.sender_id, null);
  assert.ok(reply.created_at > messages[0].created_at, 'ordered after the commuter message');
  assert.match(reply.message, /^Thanks for contacting SakayWise Support/);
  assert.match(reply.message, /Other ways to reach us:\n• Email \(demo\): support@sakaywise\.example\n• Hotline \(demo placeholder\): \+63 2 0000 0000\n• Facebook Messenger \(demo\): m\.me\/sakaywise\.example/);
  assert.match(reply.message, /Support hours: Monday to Saturday/);
  const [conversation] = await as(db, commuter, tx => rows(tx, 'select status from support_conversations where id = $1', [convo.id]));
  assert.equal(conversation.status, 'open', 'the automated reply does not count as a staff answer');
});

test('no repeated auto-replies: not for follow-ups, not while staff are replying; again after 24 quiet hours', async () => {
  const commuter = await createUser(db, 'registered');
  const convo = await open(commuter);
  await send(commuter, convo.id, 'First');
  await send(commuter, convo.id, 'Second');
  assert.equal((await thread(commuter, convo.id)).filter(m => m.sender_type === 'system').length, 1);
  await send(staff, convo.id, 'We are checking.');
  await age(convo.id, 25);
  await send(staff, convo.id, 'Any update from you?');
  await send(commuter, convo.id, 'Still waiting');
  assert.equal((await thread(commuter, convo.id)).filter(m => m.sender_type === 'system').length, 1, 'staff replied within 24 h');
  await age(convo.id, 25);
  await send(commuter, convo.id, 'Hello again after a day');
  assert.equal((await thread(commuter, convo.id)).filter(m => m.sender_type === 'system').length, 2);
});

test('auto-reply can be disabled; without channels it is just the acknowledgement (nothing invented)', async () => {
  await as(db, staff, tx => tx.query(`update support_contact_channels set is_active = false`));
  await as(db, staff, tx => tx.query(`update support_auto_reply_settings set support_hours = '' where id`));
  const [{ text }] = await as(db, null, tx => rows(tx, 'select support_auto_reply_text() as text'));
  assert.equal(text, 'Thanks for contacting SakayWise Support. We received your message, and a support administrator will reply in this chat as soon as possible.');
  await as(db, staff, tx => tx.query(`update support_auto_reply_settings set enabled = false where id`));
  const commuter = await createUser(db, 'registered');
  const convo = await open(commuter);
  await send(commuter, convo.id, 'Hello');
  assert.deepEqual((await thread(commuter, convo.id)).map(m => m.sender_type), ['commuter']);
  await as(db, staff, tx => tx.exec(`update support_auto_reply_settings set enabled = true where id; update support_contact_channels set is_active = true`));
});

test('contact channels: public reads active ones; only support staff edit; edits are audited', async () => {
  assert.equal((await as(db, null, tx => rows(tx, 'select * from support_contact_channels'))).length, 3);
  for (const user of [null, await createUser(db, 'registered'), transport]) {
    try {
      const result = await as(db, user, tx => tx.query(`update support_contact_channels set value = 'scam@evil.example'`));
      assert.equal(result.affectedRows ?? 0, 0);
    } catch (error) { assert.match(error.message, /permission denied|row-level/); }
    await assert.rejects(as(db, user, tx => tx.query(`insert into support_contact_channels (kind, label, value) values ('phone', 'Fake', '1')`)), /permission denied|row-level/);
  }
  const [added] = await as(db, staff, tx => rows(tx, `insert into support_contact_channels (kind, label, value, sort_order) values ('website', 'Website', 'sakaywise.example', 40) returning id`));
  await as(db, staff, tx => tx.query(`update support_auto_reply_settings set message = 'Salamat! We got your message.' where id`));
  const [settings] = await rows(db, 'select message, updated_by from support_auto_reply_settings');
  assert.deepEqual(settings, { message: 'Salamat! We got your message.', updated_by: staff.id });
  assert.ok((await rows(db, `select 1 from admin_audit_log where table_name = 'support_contact_channels' and record_id = $1`, [added.id])).length);
  await assert.rejects(as(db, staff, tx => tx.query(`update support_auto_reply_settings set id = false`)), /permission denied/);
});

test('seen receipts: set by the reader, timestamped by the server, never cleared or moved', async () => {
  const commuter = await createUser(db, 'registered');
  const convo = await open(commuter);
  await send(commuter, convo.id, 'Seen test');
  assert.equal((await thread(commuter, convo.id)).find(m => m.sender_type === 'commuter').read_at, null, '"Sent" only until staff open it');
  await as(db, staff, tx => tx.query('select support_mark_read($1)', [convo.id]));
  const seen = (await thread(commuter, convo.id)).find(m => m.sender_type === 'commuter').read_at;
  assert.ok(seen);
  await as(db, staff, tx => tx.query('select support_mark_unread($1)', [convo.id]));
  await db.query(`update support_messages set read_at = null where conversation_id = $1`, [convo.id]);   // even a direct write cannot clear it
  assert.equal((await thread(commuter, convo.id)).find(m => m.sender_type === 'commuter').read_at.getTime(), seen.getTime());
  const [flag] = await as(db, staff, tx => rows(tx, 'select staff_unread from support_conversations where id = $1', [convo.id]));
  assert.equal(flag.staff_unread, true);
  await as(db, staff, tx => tx.query('select support_mark_read($1)', [convo.id]));
  assert.equal((await rows(db, 'select staff_unread from support_conversations where id = $1', [convo.id]))[0].staff_unread, false);
  await assert.rejects(as(db, transport, tx => tx.query('select support_mark_unread($1)', [convo.id])), /forbidden/);
  // The commuter's own read of the automated reply is a receipt too.
  await as(db, commuter, tx => tx.query('select support_mark_read($1)', [convo.id]));
  assert.ok((await thread(commuter, convo.id)).find(m => m.sender_type === 'system').read_at);
});
