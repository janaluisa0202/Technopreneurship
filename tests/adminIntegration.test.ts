import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { incidentStatus, toActivity, toAppUser, toConversations, toDirectMessage, toModerationStatus, toQueueReport, toQueueStatus } from '../src/apps/admin/services/liveMappers';
import { mapUpdates, visibleUpdates } from '../src/apps/commuter/services/supabase/updatesService';
import { userFrom } from '../src/shared/auth/roles';
import { advisorySourceLabel, validatedAdvisories } from '../src/apps/commuter/lib/roadwatchService';
import { createRoadWatchDemoData } from '../src/apps/commuter/data/roadwatchDemoData';

const names = new Map([['admin-1', 'Ops Moderator'], ['user-1', 'Mika Santos']]);

test('server roles map to the admin console labels; no role means customer', () => {
  const session = { user: { id: 'u', email: 'mika@example.com', user_metadata: { display_name: 'Mika' } } } as never;
  assert.deepEqual(userFrom(session, [], { display_name: 'Mika Santos' }), { id: 'u', name: 'Mika Santos', email: 'mika@example.com', role: 'customer' });
  assert.equal(userFrom(session, ['super_admin'], null).adminRole, 'owner');
  const moderator = userFrom(session, ['support_staff'], null);
  assert.deepEqual([moderator.role, moderator.adminRole, moderator.adminRoles, moderator.name], ['admin', 'moderator', ['support_staff'], 'Mika']);
});

test('conversations: unread means an unopened commuter message; threads are ordered; names resolved', () => {
  const [c] = toConversations([{ id: 'c1', owner_id: 'user-1', category: 'fare', subject: 'Incorrect fares', status: 'pending', nickname: null, contact_email: null, related_trip: null, created_at: '2026-11-12T01:00:00Z', updated_at: '2026-11-12T02:00:00Z', last_message_at: '2026-11-12T02:00:00Z', flagged_spam: false }],
    [{ id: 'm2', conversation_id: 'c1', sender_type: 'admin', sender_id: 'admin-1', message: 'Yes', created_at: '2026-11-12T02:00:00Z', read_at: null, request_id: 'r2' },
     { id: 'm1', conversation_id: 'c1', sender_type: 'commuter', sender_id: 'user-1', message: 'Hi', created_at: '2026-11-12T01:00:00Z', read_at: '2026-11-12T01:30:00Z', request_id: 'r1' }],
    names, new Map([['user-1', 'mika@example.com']]));
  assert.equal(c.nickname, 'Mika Santos');
  assert.equal(c.email, 'mika@example.com');
  assert.equal(c.unread, false, 'the commuter message was opened; an unread admin reply does not count for staff');
  assert.deepEqual(c.messages.map(m => [m.id, m.senderName]), [['m1', 'Mika Santos'], ['m2', 'Ops Moderator']]);
});

test('queue moderation status round-trips between admin and database vocabularies', () => {
  for (const status of ['pending', 'approved', 'rejected', 'spam'] as const) assert.equal(toQueueStatus(toModerationStatus(status)), status);
  const report = toQueueReport({ id: 'q', terminal_id: 'pitx', queue_level: 'high', details: null, created_at: '2026-11-12T01:00:00Z', reporter_id: '12345678-aaaa-bbbb-cccc-1234567890ab', moderation_status: 'unreviewed', moderated_by: null, moderated_at: null, report_source: 'community' }, new Map([['pitx', 'PITX']]), names);
  assert.deepEqual([report.terminal, report.status, report.reporterId, report.reviewedBy], ['PITX', 'pending', '#12345678', undefined]);
});

test('advisory statuses outside the admin form are shown honestly', () => {
  assert.deepEqual(['active', 'scheduled', 'resolved', 'expired', 'unknown'].map(incidentStatus), ['active', 'scheduled', 'resolved', 'resolved', 'active']);
});

test('activity entries are derived from the audit trail with readable actions', () => {
  const at = '2026-11-12T03:00:00Z';
  const entry = (row: object) => toActivity({ id: 1, actor_id: 'admin-1', record_id: 'x', detail: null, old_data: null, new_data: null, changed_at: at, ...row } as never, names, new Map([['pitx', 'PITX']]));
  assert.deepEqual(entry({ table_name: 'queue_reports', action: 'UPDATE', old_data: { moderation_status: 'unreviewed', terminal_id: 'pitx' }, new_data: { moderation_status: 'spam', terminal_id: 'pitx' } }),
    { id: 'audit-1', at: new Date(at).toISOString(), adminId: 'admin-1', adminName: 'Ops Moderator', area: 'queue', action: 'Marked report as spam', target: 'PITX' });
  assert.equal(entry({ table_name: 'promos', action: 'UPDATE', old_data: { status: 'inactive', title: 'T' }, new_data: { status: 'active', title: 'T' } }).action, 'Activated promo');
  const reply = entry({ table_name: 'support_messages', action: 'EVENT', detail: 'Replied to commuter · Incorrect fares' });
  assert.deepEqual([reply.area, reply.action, reply.target], ['support', 'Replied to commuter', 'Incorrect fares']);
  assert.equal(entry({ table_name: 'admin_messages', action: 'INSERT', new_data: { audience: 'all', recipient_label: 'All users', subject: 'Hi' } }).action, 'Sent broadcast');
  assert.equal(entry({ table_name: 'auth', action: 'EVENT', detail: 'Signed in', actor_id: null }).adminName, 'System');
});

test('users and sent messages map to admin models', () => {
  const user = toAppUser({ user_id: 'u', display_name: null, email: 'carlo@example.com', is_anonymous: false, created_at: '2026-11-01T00:00:00Z', last_seen_at: '2026-11-12T00:00:00Z', conversation_count: 3, last_message_at: '2026-11-10T00:00:00Z' });
  assert.deepEqual([user.nickname, user.kind, user.conversationCount, user.lastActiveAt], ['carlo', 'account', 3, '2026-11-12T00:00:00.000Z']);
  assert.equal(toDirectMessage({ id: 'm', audience: 'route', recipient_user_id: null, route_origin_place_id: 'a', route_destination_place_id: 'b', recipient_label: 'A → B', purpose: 'advisory', subject: 's', body: 'b', promo_id: null, sent_by: 'admin-1', sent_at: '2026-11-12T00:00:00Z' }, names).delivery, 'broadcast');
});

test('commuter updates: newest first; route messages only for matching journeys', () => {
  const items = mapUpdates(
    [{ id: 'a1', title: 'Traffic advisory', body: 'b', channel: 'roadwatch', published_at: '2026-11-12T01:00:00Z', updated_at: '2026-11-12T01:00:00Z' }],
    [{ id: 'p1', title: 'Student promo', description: 'd', promo_type: 'student', start_date: '2026-11-01', end_date: '2026-12-31', applies_to: 'Jeepney', updated_at: '2026-11-10T00:00:00Z' }],
    [{ id: 'm1', audience: 'route', route_origin_place_id: 'ust-frassati', route_destination_place_id: 'sm-north', recipient_label: 'UST → SM North', purpose: 'advisory', subject: 'Flooding', body: 'b', sent_at: '2026-11-12T02:00:00Z' },
     { id: 'm2', audience: 'all', route_origin_place_id: null, route_destination_place_id: null, recipient_label: 'All users', purpose: 'general', subject: 'Welcome', body: 'b', sent_at: '2026-11-11T00:00:00Z' },
     { id: 'm3', audience: 'one', route_origin_place_id: null, route_destination_place_id: null, recipient_label: 'Mika', purpose: 'general', subject: 'Private', body: 'b', sent_at: '2026-11-12T03:00:00Z' }]);
  assert.deepEqual(items.map(i => i.id), ['msg:m1', 'ann:a1', 'msg:m2', 'promo:p1'], 'one-to-one messages never appear in the broadcast feed');
  assert.equal(items.find(i => i.kind === 'promo')?.detail, 'Until 2026-12-31 · Jeepney');
  assert.deepEqual(visibleUpdates(items, new Set()).map(i => i.id), ['ann:a1', 'msg:m2', 'promo:p1']);
  assert.deepEqual(visibleUpdates(items, new Set(['ust-frassati:sm-north'])).map(i => i.id), ['msg:m1', 'ann:a1', 'msg:m2', 'promo:p1']);
});

test('staff-posted (operator) advisories validate and are labelled as SakayWise advisories, never official', () => {
  const [base] = createRoadWatchDemoData(Date.parse('2026-11-12T00:00:00Z'));
  const [operator] = validatedAdvisories([{ ...base, sourceType: 'operator', verificationStatus: 'unverified', delayEvidence: undefined, effectConfirmed: false }]);
  assert.ok(operator);
  assert.equal(advisorySourceLabel(operator), 'SakayWise advisory');
});
