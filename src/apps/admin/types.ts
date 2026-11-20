import type { SupportCategory } from '../commuter/types/support';
import type { Conversation } from '../../shared/messaging/types';
import type { AdvisoryCategory, AdvisorySeverity } from '../commuter/types/roadwatch';
import type { QueueLevel } from '../commuter/types';

export type { SupportCategory, AdvisoryCategory, AdvisorySeverity, QueueLevel };

export interface AdminAccount { id: string; name: string; email: string; role: 'owner' | 'moderator'; /** Live mode: server role names. */ roles?: string[]; }

/* Promos */
export type PromoType = 'student' | 'route-discount' | 'partner' | 'seasonal';
export type PromoStatus = 'active' | 'inactive';
export interface Promo {
  id: string; title: string; description: string; type: PromoType;
  startDate: string; endDate: string; appliesTo: string; status: PromoStatus;
  createdBy: string; createdAt: string; updatedAt: string;
}
export type PromoDraft = Omit<Promo, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

/* Help center — conversations live in the shared support store */
export type { Conversation, ConversationStatus, ThreadMessage } from '../../shared/messaging/types';

/* Incidents / RoadWatch */
export type IncidentStatus = 'active' | 'scheduled' | 'resolved';
export interface Incident {
  id: string; title: string; description: string; category: AdvisoryCategory; severity: AdvisorySeverity;
  status: IncidentStatus; areaName: string; suggestedAction: string; startsAt: string; endsAt: string;
  postedAt: string; updatedAt: string; postedBy: string;
  /** Live mode: advisory source ('operator' = posted here, 'demo' = simulated seed, 'official' = agency feed). */
  sourceType?: string; published?: boolean;
}
export type IncidentDraft = Omit<Incident, 'id' | 'postedAt' | 'updatedAt' | 'postedBy'>;

/* Direct messages */
export type Audience = 'one' | 'all' | 'route';
export type MessagePurpose = 'announcement' | 'advisory' | 'promo' | 'general';
export interface DirectMessage {
  id: string; audience: Audience; recipientId?: string; recipientLabel: string; purpose: MessagePurpose;
  /** Live mode route targeting (popular journey place ids). */
  routeKey?: string;
  subject: string; body: string; promoId?: string; sentAt: string; sentBy: string;
  /** 'sent' = placed in the customer's Help & Support thread; 'saved-demo' = recorded only (needs the backend). */
  delivery: 'saved-demo' | 'queued' | 'sent' | 'broadcast';
}

/* Queue reports */
export type QueueReportStatus = 'pending' | 'approved' | 'rejected' | 'spam';
export interface AdminQueueReport {
  id: string; terminal: string; level: QueueLevel; details: string; reportedAt: string;
  reporterId: string; status: QueueReportStatus; reviewedBy?: string; reviewedAt?: string;
}

/* Announcements */
export type AnnouncementChannel = 'para-alerts' | 'roadwatch' | 'promo' | 'general';
export type AnnouncementStatus = 'draft' | 'published' | 'archived';
export interface Announcement {
  id: string; title: string; body: string; channel: AnnouncementChannel; status: AnnouncementStatus;
  createdBy: string; createdAt: string; publishedAt?: string; updatedAt: string;
}
export type AnnouncementDraft = Pick<Announcement, 'title' | 'body' | 'channel' | 'status'>;

/* Users */
export interface AppUser {
  id: string; nickname: string; email?: string; kind: 'guest' | 'account';
  lastActiveAt: string; joinedAt: string;
  /** Live mode: server-side count (all conversations, not only the loaded page). */
  conversationCount?: number;
}

/* Activity */
export type ActivityArea = 'auth' | 'promo' | 'support' | 'incident' | 'message' | 'queue' | 'announcement' | 'system';
export interface ActivityEntry { id: string; at: string; adminId: string; adminName: string; area: ActivityArea; action: string; target: string; }

/** What the admin store persists itself. Conversations and customer accounts come from the shared modules. */
export interface AdminState {
  version: 2;
  promos: Promo[]; incidents: Incident[]; messages: DirectMessage[];
  queueReports: AdminQueueReport[]; announcements: Announcement[]; activity: ActivityEntry[];
}
/** What pages read: the stored state plus the shared conversations and customer accounts. */
export interface RouteOption { key: string; label: string; originId?: string; destinationId?: string; }
export interface SyncState {
  mode: 'demo' | 'live';
  status: 'loading' | 'ready' | 'error';
  error?: string;
  loadedAt?: string;
  /** Live: the signed-in admin's role does not include reading the audit log. */
  activityRestricted?: boolean;
  refresh: () => void;
}
export interface AdminView extends AdminState { conversations: Conversation[]; users: AppUser[]; routes: RouteOption[]; sync: SyncState; }
