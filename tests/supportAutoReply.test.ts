import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { composeAutoReply, contactHref, demoAutoReply, messageTime, shouldAutoReply, validateAutoReply, type AutoReplyConfig } from '../src/shared/messaging/autoReply';
import { supportStore } from '../src/shared/messaging/supportStore';
import { toConversations } from '../src/apps/admin/services/liveMappers';

const config = (patch: Partial<AutoReplyConfig> = {}): AutoReplyConfig => ({ ...demoAutoReply(), ...patch });

test('auto-reply text matches the database format: message, active channels, then hours', () => {
  assert.equal(composeAutoReply(config()),
    'Thanks for contacting SakayWise Support. We received your message, and a support administrator will reply in this chat as soon as possible.'
    + '\n\nOther ways to reach us:\n• Email (demo): support@sakaywise.example\n• Hotline (demo placeholder): +63 2 0000 0000\n• Facebook Messenger (demo): m.me/sakaywise.example'
    + '\n\nSupport hours: Monday to Saturday, 8:00 AM – 6:00 PM (demo)');
  const bare = composeAutoReply(config({ supportHours: '  ', channels: config().channels.map(c => ({ ...c, active: false })) }));
  assert.equal(bare, config().message, 'nothing is invented when no channel is active');
});

test('auto-reply rule: once per 24 hours, never while staff are replying, never when disabled', () => {
  const now = Date.parse('2026-11-20T10:00:00Z');
  const at = (hoursAgo: number, senderType: string) => ({ senderType, createdAt: new Date(now - hoursAgo * 3600000).toISOString() });
  assert.equal(shouldAutoReply(config(), [], now), true);
  assert.equal(shouldAutoReply(config(), [at(1, 'commuter'), at(1, 'system')], now), false);
  assert.equal(shouldAutoReply(config(), [at(2, 'admin')], now), false);
  assert.equal(shouldAutoReply(config(), [at(30, 'system'), at(25, 'admin'), at(1, 'commuter')], now), true);
  assert.equal(shouldAutoReply(config({ enabled: false }), [], now), false);
});

test('auto-reply settings validation and safe contact links', () => {
  assert.equal(validateAutoReply(config()), null);
  assert.match(validateAutoReply(config({ message: ' ' })) ?? '', /Write/);
  assert.match(validateAutoReply(config({ message: 'x'.repeat(601) })) ?? '', /600/);
  assert.match(validateAutoReply(config({ channels: [{ id: 'n', kind: 'email', label: '', value: 'a@b.co', active: true }] })) ?? '', /label/);
  assert.equal(contactHref({ kind: 'email', value: 'help@sakaywise.example' }), 'mailto:help@sakaywise.example');
  assert.equal(contactHref({ kind: 'phone', value: '+63 (2) 8123-4567' }), 'tel:+63281234567');
  assert.equal(contactHref({ kind: 'messenger', value: 'm.me/sakaywise' }), 'https://m.me/sakaywise');
  assert.equal(contactHref({ kind: 'website', value: 'javascript:alert(1)' }), undefined, 'no script links');
  assert.equal(contactHref({ kind: 'other', value: 'Visit the UST office' }), undefined);
});

test('message times show the clock for today and the date otherwise', () => {
  const now = new Date('2026-11-20T15:00:00');
  assert.match(messageTime(new Date('2026-11-20T13:05:00').toISOString(), 'en-PH', now), /^1:05\s?PM$/i);
  assert.match(messageTime(new Date('2026-11-18T13:05:00').toISOString(), 'en-PH', now), /Nov 18/);
});

test('demo store: first message gets the automated reply; seen receipts are set once and survive "Mark unread"', () => {
  const user = 'demo-user-auto';
  const convo = supportStore.createConversation(user, { category: 'route' });
  supportStore.customerSend(user, convo.id, 'Ana', 'Hello support', 'r-1');
  supportStore.customerSend(user, convo.id, 'Ana', 'One more detail', 'r-2');
  let thread = supportStore.getConversation(convo.id)!.messages;
  assert.deepEqual(thread.map(m => m.senderType), ['commuter', 'system', 'commuter']);
  assert.ok(Date.parse(thread[1].createdAt) > Date.parse(thread[0].createdAt));
  assert.match(thread[1].message, /Other ways to reach us/);
  assert.equal(supportStore.unreadForCustomer(user), 1, 'the automated reply counts as unread for the commuter');
  supportStore.markReadByCustomer(user, convo.id);
  assert.equal(supportStore.unreadForCustomer(user), 0);

  supportStore.adminMarkRead(convo.id);
  thread = supportStore.getConversation(convo.id)!.messages;
  const seen = thread.filter(m => m.senderType === 'commuter').map(m => m.readAt);
  assert.ok(seen.every(Boolean), 'opening the conversation marks commuter messages seen');
  supportStore.adminMarkUnread(convo.id);
  assert.equal(supportStore.getConversation(convo.id)!.unread, true);
  assert.deepEqual(supportStore.getConversation(convo.id)!.messages.filter(m => m.senderType === 'commuter').map(m => m.readAt), seen, 'Mark unread keeps the receipt');
});

test('live mapper: "Mark unread" flag keeps a conversation unread; the automated reply is labelled', () => {
  const [c] = toConversations([{ id: 'c1', owner_id: 'u1', category: 'fare', subject: 'Incorrect fares', status: 'open', nickname: 'Ana', contact_email: null, related_trip: null, created_at: '2026-11-20T01:00:00Z', updated_at: '2026-11-20T01:00:00Z', last_message_at: '2026-11-20T01:00:00Z', flagged_spam: false, staff_unread: true }],
    [{ id: 'm1', conversation_id: 'c1', sender_type: 'commuter', sender_id: 'u1', message: 'Hi', created_at: '2026-11-20T01:00:00Z', read_at: '2026-11-20T01:10:00Z', request_id: 'r1' },
     { id: 'm2', conversation_id: 'c1', sender_type: 'system', sender_id: null, message: 'Thanks', created_at: '2026-11-20T01:00:00.001Z', read_at: null, request_id: 'r2' }],
    new Map(), new Map());
  assert.equal(c.unread, true);
  assert.equal(c.messages[0].readAt, '2026-11-20T01:10:00.000Z');
  assert.equal(c.messages[1].senderName, 'Automated reply');
});

test('LAN fallback SHA-256 matches Web Crypto output (demo sign-in over http://<LAN-IP>)', async () => {
  const { sha256Hex } = await import('../src/shared/auth/sha256');
  const { createHash } = await import('node:crypto');
  for (const text of ['', 'abc', 'demo-password:salt', 'ñ España – ₱15', 'x'.repeat(1000)]) assert.equal(sha256Hex(text), createHash('sha256').update(text).digest('hex'));
});
