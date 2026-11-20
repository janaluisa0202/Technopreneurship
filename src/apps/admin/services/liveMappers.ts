// Pure mapping from Supabase rows to the admin page models. No SDK import (unit-tested).
import type {
  ActivityArea, ActivityEntry, AdminQueueReport, Announcement, AppUser, Conversation, DirectMessage, Incident,
  IncidentStatus, Promo, QueueReportStatus, ThreadMessage,
} from '../types';
import type { SupportCategory } from '../../commuter/types/support';
import type { AdvisoryCategory, AdvisorySeverity } from '../../commuter/types/roadwatch';
import type { QueueLevel } from '../../commuter/types';

export type Names = Map<string, string>;
const nameOf = (names: Names, id: string | null | undefined, fallback: string) => (id && names.get(id)) || fallback;
const iso = (value: string | null | undefined) => (value ? new Date(value).toISOString() : '');

export interface PromoRow { id: string; title: string; description: string; promo_type: Promo['type']; start_date: string; end_date: string; applies_to: string; status: Promo['status']; created_by: string | null; created_at: string; updated_at: string; }
export const toPromo = (r: PromoRow, names: Names): Promo => ({
  id: r.id, title: r.title, description: r.description, type: r.promo_type, startDate: r.start_date, endDate: r.end_date,
  appliesTo: r.applies_to, status: r.status, createdBy: nameOf(names, r.created_by, 'SakayWise staff'), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});

export interface AdvisoryRow { id: string; title: string; description: string; category: AdvisoryCategory; severity: AdvisorySeverity; status: string; area_name: string; suggested_action: string | null; starts_at: string | null; ends_at: string | null; published_at: string; updated_at: string; created_by: string | null; source_type: string; source_name: string; is_published: boolean; }
/** The admin form knows active/scheduled/resolved. Stored 'expired' shows as resolved, 'unknown' as active. */
export const incidentStatus = (status: string): IncidentStatus => status === 'scheduled' ? 'scheduled' : status === 'resolved' || status === 'expired' ? 'resolved' : 'active';
export const toIncident = (r: AdvisoryRow, names: Names): Incident => ({
  id: r.id, title: r.title, description: r.description, category: r.category, severity: r.severity, status: incidentStatus(r.status),
  areaName: r.area_name, suggestedAction: r.suggested_action ?? '', startsAt: iso(r.starts_at ?? r.published_at), endsAt: iso(r.ends_at),
  postedAt: iso(r.published_at), updatedAt: iso(r.updated_at), postedBy: nameOf(names, r.created_by, r.source_name),
  sourceType: r.source_type, published: r.is_published,
});

export interface AnnouncementRow { id: string; title: string; body: string; channel: Announcement['channel']; status: Announcement['status']; created_by: string | null; created_at: string; updated_at: string; published_at: string | null; }
export const toAnnouncement = (r: AnnouncementRow, names: Names): Announcement => ({
  id: r.id, title: r.title, body: r.body, channel: r.channel, status: r.status, createdBy: nameOf(names, r.created_by, 'SakayWise staff'),
  createdAt: iso(r.created_at), updatedAt: iso(r.updated_at), ...(r.published_at ? { publishedAt: iso(r.published_at) } : {}),
});

export interface AdminMessageRow { id: string; audience: DirectMessage['audience']; recipient_user_id: string | null; route_origin_place_id: string | null; route_destination_place_id: string | null; recipient_label: string; purpose: DirectMessage['purpose']; subject: string; body: string; promo_id: string | null; sent_by: string | null; sent_at: string; }
export const toDirectMessage = (r: AdminMessageRow, names: Names): DirectMessage => ({
  id: r.id, audience: r.audience, ...(r.recipient_user_id ? { recipientId: r.recipient_user_id } : {}), recipientLabel: r.recipient_label,
  purpose: r.purpose, subject: r.subject, body: r.body, ...(r.promo_id ? { promoId: r.promo_id } : {}), sentAt: iso(r.sent_at),
  sentBy: nameOf(names, r.sent_by, 'SakayWise staff'), delivery: r.audience === 'one' ? 'sent' : 'broadcast',
});

export interface QueueReportRow { id: string; terminal_id: string; queue_level: QueueLevel; details: string | null; created_at: string; reporter_id: string | null; moderation_status: 'unreviewed' | 'approved' | 'rejected' | 'spam'; moderated_by: string | null; moderated_at: string | null; report_source: string; }
export const toQueueStatus = (status: QueueReportRow['moderation_status']): QueueReportStatus => status === 'unreviewed' ? 'pending' : status;
export const toModerationStatus = (status: QueueReportStatus): QueueReportRow['moderation_status'] => status === 'pending' ? 'unreviewed' : status;
export const toQueueReport = (r: QueueReportRow, terminals: Map<string, string>, names: Names): AdminQueueReport => ({
  id: r.id, terminal: terminals.get(r.terminal_id) ?? r.terminal_id, level: r.queue_level, details: r.details ?? '', reportedAt: iso(r.created_at),
  // Pseudonymous: moderators see a stable short code, never a name.
  reporterId: r.report_source === 'terminal-staff' ? 'terminal staff' : r.reporter_id ? `#${r.reporter_id.slice(0, 8)}` : 'deleted account',
  status: toQueueStatus(r.moderation_status),
  ...(r.moderation_status !== 'unreviewed' && r.moderated_at ? { reviewedBy: nameOf(names, r.moderated_by, 'SakayWise staff'), reviewedAt: iso(r.moderated_at) } : {}),
});

export interface ConversationRow { id: string; owner_id: string; category: SupportCategory; subject: string; status: Conversation['status']; nickname: string | null; contact_email: string | null; related_trip: string | null; created_at: string; updated_at: string; last_message_at: string | null; flagged_spam: boolean; }
export interface MessageRow { id: string; conversation_id: string; sender_type: ThreadMessage['senderType']; sender_id: string | null; message: string; created_at: string; read_at: string | null; request_id: string; }
export interface ProfileRow { user_id: string; display_name: string | null; email: string | null; }
export function toConversations(rows: ConversationRow[], messages: MessageRow[], names: Names, emails: Map<string, string>): Conversation[] {
  const byConversation = new Map<string, MessageRow[]>();
  for (const m of messages) byConversation.set(m.conversation_id, [...(byConversation.get(m.conversation_id) ?? []), m]);
  return rows.map(r => {
    const nickname = r.nickname || names.get(r.owner_id) || undefined;
    const thread = (byConversation.get(r.id) ?? []).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
    return {
      id: r.id, userId: r.owner_id, category: r.category, subject: r.subject, status: r.status,
      ...(nickname ? { nickname } : {}), ...((r.contact_email || emails.get(r.owner_id)) ? { email: r.contact_email || emails.get(r.owner_id) } : {}),
      ...(r.related_trip ? { relatedTrip: r.related_trip } : {}),
      createdAt: iso(r.created_at), lastMessageAt: iso(r.last_message_at ?? r.created_at),
      // Unread for staff = a commuter message no admin has opened yet (server read receipt).
      unread: thread.some(m => m.sender_type === 'commuter' && !m.read_at),
      flaggedSpam: r.flagged_spam,
      messages: thread.map(m => ({
        id: m.id, senderType: m.sender_type, senderId: m.sender_id ?? '',
        senderName: m.sender_type === 'commuter' ? (nickname ?? 'Commuter') : m.sender_type === 'admin' ? nameOf(names, m.sender_id, 'SakayWise support') : 'System',
        message: m.message, createdAt: iso(m.created_at), ...(m.read_at ? { readAt: iso(m.read_at) } : {}), requestId: m.request_id,
      })),
    };
  });
}

export interface UserRow { user_id: string; display_name: string | null; email: string | null; is_anonymous: boolean; created_at: string; last_seen_at: string | null; conversation_count: number; last_message_at: string | null; }
export const toAppUser = (r: UserRow): AppUser => {
  const last = Math.max(Date.parse(r.last_seen_at ?? '') || 0, Date.parse(r.last_message_at ?? '') || 0, Date.parse(r.created_at) || 0);
  return {
    id: r.user_id, nickname: r.display_name || r.email?.split('@')[0] || 'Guest commuter', ...(r.email ? { email: r.email } : {}),
    kind: r.is_anonymous ? 'guest' : 'account', lastActiveAt: new Date(last).toISOString(), joinedAt: iso(r.created_at), conversationCount: r.conversation_count,
  };
};

export interface AuditRow { id: number; actor_id: string | null; table_name: string; record_id: string | null; action: 'INSERT' | 'UPDATE' | 'DELETE' | 'EVENT'; detail: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; changed_at: string; }
const areas: Record<string, [ActivityArea, string]> = {
  promos: ['promo', 'promo'], announcements: ['announcement', 'announcement'], road_advisories: ['incident', 'incident'],
  road_advisory_impacts: ['incident', 'incident mapping'], queue_reports: ['queue', 'queue report'], support_conversations: ['support', 'conversation'],
  support_messages: ['support', 'message'], admin_messages: ['message', 'message'], auth: ['auth', 'session'],
  admin_role_assignments: ['system', 'admin role'], fare_matrices: ['system', 'fare matrix'], fare_rules: ['system', 'fare rule'],
};
const str = (value: unknown) => (typeof value === 'string' ? value : undefined);
export function toActivity(r: AuditRow, names: Names, terminals: Map<string, string>): ActivityEntry {
  const [area, noun] = areas[r.table_name] ?? ['system', r.table_name.replace(/_/g, ' ').replace(/s$/, '')];
  const now = r.new_data ?? {}, before = r.old_data ?? {};
  let action = r.detail ?? `${r.action === 'INSERT' ? 'Added' : r.action === 'DELETE' ? 'Deleted' : 'Edited'} ${noun}`;
  if (!r.detail && r.action === 'UPDATE') {
    if (r.table_name === 'queue_reports' && now.moderation_status !== before.moderation_status) {
      action = ({ approved: 'Approved queue report', rejected: 'Rejected queue report', spam: 'Marked report as spam', unreviewed: 'Returned report to pending' } as Record<string, string>)[String(now.moderation_status)] ?? action;
    } else if (r.table_name === 'road_advisories' && now.status !== before.status) {
      action = now.status === 'resolved' ? 'Resolved incident' : 'Reactivated incident';
    } else if (r.table_name === 'announcements' && now.status !== before.status) {
      action = now.status === 'published' ? 'Published announcement' : now.status === 'archived' ? 'Archived announcement' : 'Moved announcement to draft';
    } else if (r.table_name === 'promos' && now.status !== before.status) {
      action = now.status === 'active' ? 'Activated promo' : 'Deactivated promo';
    }
  }
  if (!r.detail && r.table_name === 'admin_messages' && r.action === 'INSERT') {
    action = now.audience === 'all' ? 'Sent broadcast' : now.audience === 'route' ? 'Sent route message' : 'Sent direct message';
  }
  const row = r.action === 'DELETE' ? before : now;
  const target = r.table_name === 'queue_reports' ? terminals.get(String(row.terminal_id)) ?? String(row.terminal_id ?? '')
    : r.table_name === 'admin_messages' ? `${str(row.recipient_label) ?? ''} · ${str(row.subject) ?? ''}`
    : r.table_name === 'auth' ? nameOf(names, r.actor_id, 'Admin')
    : str(row.title) ?? str(row.name) ?? str(row.subject) ?? r.record_id ?? '';
  if (r.detail?.includes(' · ')) {
    const [label, ...rest] = r.detail.split(' · ');
    return { id: `audit-${r.id}`, at: iso(r.changed_at), adminId: r.actor_id ?? 'system', adminName: nameOf(names, r.actor_id, 'System'), area, action: label, target: rest.join(' · ') };
  }
  return { id: `audit-${r.id}`, at: iso(r.changed_at), adminId: r.actor_id ?? 'system', adminName: nameOf(names, r.actor_id, 'System'), area, action, target };
}
