import { useMemo, useSyncExternalStore } from 'react';
import type {
  ActivityArea, AdminAccount, AdminQueueReport, AdminState, AdminView, Announcement, AnnouncementDraft, AppUser, Audience,
  ConversationStatus, DirectMessage, Incident, IncidentDraft, IncidentStatus, MessagePurpose, Promo, PromoDraft,
  PromoStatus, QueueReportStatus,
} from '../types';
import { newId } from '../lib/format';
import { createSeedState } from './seed';
import { customerDirectory } from '../../../shared/auth/authService';
import { SupportStoreError, supportStore, useConversations } from '../../../shared/messaging/supportStore';
import { DEMO_MODE } from '../../../shared/auth/authService';
import { sampleTrips } from '../../commuter/data/demo';
import { LiveActionError, liveAdminStore, useLiveAdminState } from './liveStore';
import type { RouteOption, SyncState } from '../types';

/**
 * DEMO data layer (VITE_SAKAYWISE_DATA_MODE=demo). Live mode uses ./liveStore.ts (Supabase) through the
 * `adminStore` / `useAdminState` facade at the bottom of this file; pages do not know which one runs.
 * Local demo data layer. Everything the pages read or change goes through `adminStore`, so swapping in a real
 * backend later means re-implementing these functions with API calls (and enforcing permissions server-side).
 */
export const ADMIN_STORAGE_KEY = 'sakaywise:admin:v2';
const MAX_ACTIVITY = 300;

const isArr = Array.isArray;
function validState(v: unknown): v is AdminState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return s.version === 2 && ['promos', 'incidents', 'messages', 'queueReports', 'announcements', 'activity'].every(k => isArr(s[k]));
}
function load(): AdminState {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || 'null');
    if (validState(parsed)) return parsed;
  } catch { /* fall through to seed */ }
  return createSeedState();
}

let state: AdminState = load();
let actor: AdminAccount | null = null;
const listeners = new Set<() => void>();

function commit(next: AdminState) {
  state = next;
  try { localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(next)); } catch { /* keep working in memory */ }
  listeners.forEach(l => l());
}
function withLog(next: AdminState, area: ActivityArea, action: string, target: string): AdminState {
  const entry = { id: newId('act'), at: new Date().toISOString(), adminId: actor?.id ?? 'system', adminName: actor?.name ?? 'System', area, action, target };
  return { ...next, activity: [entry, ...next.activity].slice(0, MAX_ACTIVITY) };
}
const adminName = () => actor?.name ?? 'Admin';
const now = () => new Date().toISOString();

export class ValidationError extends Error {}

const demoStore = {
  getState: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  setActor(account: AdminAccount | null) { actor = account; },
  logAuth(action: string, account: AdminAccount) { actor = account; commit(withLog(state, 'auth', action, account.email)); },

  /* ---------- Promos ---------- */
  savePromo(draft: PromoDraft, id?: string): Promo {
    const ts = now();
    if (id) {
      const existing = state.promos.find(p => p.id === id);
      if (!existing) throw new ValidationError('That promo no longer exists.');
      const updated: Promo = { ...existing, ...draft, updatedAt: ts };
      commit(withLog({ ...state, promos: state.promos.map(p => (p.id === id ? updated : p)) }, 'promo', 'Edited promo', updated.title));
      return updated;
    }
    const created: Promo = { ...draft, id: newId('promo'), createdBy: adminName(), createdAt: ts, updatedAt: ts };
    commit(withLog({ ...state, promos: [created, ...state.promos] }, 'promo', 'Added promo', created.title));
    return created;
  },
  setPromoStatus(id: string, status: PromoStatus) {
    const p = state.promos.find(x => x.id === id); if (!p) return;
    commit(withLog({ ...state, promos: state.promos.map(x => (x.id === id ? { ...x, status, updatedAt: now() } : x)) }, 'promo', status === 'active' ? 'Activated promo' : 'Deactivated promo', p.title));
  },
  deletePromo(id: string) {
    const p = state.promos.find(x => x.id === id); if (!p) return;
    commit(withLog({ ...state, promos: state.promos.filter(x => x.id !== id) }, 'promo', 'Deleted promo', p.title));
  },

  /* ---------- Help center (conversations live in the shared support store) ---------- */
  markConversationRead(id: string) { supportStore.adminMarkRead(id); },
  markConversationUnread(id: string) { supportStore.adminMarkUnread(id); },
  reply(id: string, text: string) {
    const conv = supportStore.getConversation(id);
    if (!conv) throw new ValidationError('That conversation no longer exists.');
    try { supportStore.adminReply(id, { id: actor?.id ?? 'adm', name: adminName() }, text); }
    catch (e) { throw toValidation(e); }
    commit(withLog(state, 'support', 'Replied to commuter', `${conv.nickname || 'Guest'} · ${conv.subject}`));
  },
  setConversationStatus(id: string, status: ConversationStatus) {
    const conv = supportStore.getConversation(id); if (!conv || conv.status === status) return;
    supportStore.adminSetStatus(id, status);
    commit(withLog(state, 'support', `Marked concern ${status}`, `${conv.nickname || 'Guest'} · ${conv.subject}`));
  },
  setConversationSpam(id: string, flaggedSpam: boolean) {
    const conv = supportStore.getConversation(id); if (!conv) return;
    supportStore.adminSetSpam(id, flaggedSpam);
    commit(withLog(state, 'support', flaggedSpam ? 'Flagged conversation as spam' : 'Removed spam flag', `${conv.nickname || 'Guest'} · ${conv.subject}`));
  },

  /* ---------- Incidents ---------- */
  saveIncident(draft: IncidentDraft, id?: string): Incident {
    const ts = now();
    if (id) {
      const existing = state.incidents.find(i => i.id === id);
      if (!existing) throw new ValidationError('That incident no longer exists.');
      const updated: Incident = { ...existing, ...draft, updatedAt: ts };
      commit(withLog({ ...state, incidents: state.incidents.map(i => (i.id === id ? updated : i)) }, 'incident', 'Edited incident', updated.title));
      return updated;
    }
    const created: Incident = { ...draft, id: newId('inc'), postedAt: ts, updatedAt: ts, postedBy: adminName() };
    commit(withLog({ ...state, incidents: [created, ...state.incidents] }, 'incident', 'Posted incident', created.title));
    return created;
  },
  setIncidentStatus(id: string, status: IncidentStatus) {
    const i = state.incidents.find(x => x.id === id); if (!i) return;
    commit(withLog({ ...state, incidents: state.incidents.map(x => (x.id === id ? { ...x, status, updatedAt: now() } : x)) }, 'incident', status === 'resolved' ? 'Resolved incident' : 'Reactivated incident', i.title));
  },
  deleteIncident(id: string) {
    const i = state.incidents.find(x => x.id === id); if (!i) return;
    commit(withLog({ ...state, incidents: state.incidents.filter(x => x.id !== id) }, 'incident', 'Deleted incident', i.title));
  },

  /* ---------- Direct messages ---------- */
  sendDirectMessage(input: { audience: Audience; recipientId?: string; recipientLabel: string; routeKey?: string; purpose: MessagePurpose; subject: string; body: string; promoId?: string }): DirectMessage {
    if (!input.subject.trim()) throw new ValidationError('Add a subject.');
    if (!input.body.trim()) throw new ValidationError('Write a message.');
    if (input.audience === 'one' && !input.recipientId) throw new ValidationError('Choose who should receive this message.');
    if (input.audience === 'route' && !input.recipientLabel) throw new ValidationError('Choose a route.');
    const ts = now();
    let delivery: DirectMessage['delivery'] = 'saved-demo';
    if (input.audience === 'one' && input.recipientId) {
      // Delivered for real in the demo: it lands in that customer's Help & Support thread.
      try { supportStore.adminMessageUser({ id: input.recipientId, name: input.recipientLabel }, { id: actor?.id ?? 'adm', name: adminName() }, input.subject, input.body); delivery = 'sent'; }
      catch (e) { throw toValidation(e); }
    }
    const { routeKey: _routeKey, ...fields } = input;
    const dm: DirectMessage = { ...fields, subject: input.subject.trim(), body: input.body.trim(), id: newId('dm'), sentAt: ts, sentBy: adminName(), delivery };
    commit(withLog({ ...state, messages: [dm, ...state.messages] }, 'message', `Sent ${input.audience === 'all' ? 'broadcast' : input.audience === 'route' ? 'route message' : 'direct message'}`, `${dm.recipientLabel} · ${dm.subject}`));
    return dm;
  },

  /* ---------- Queue reports ---------- */
  reviewQueueReport(id: string, status: QueueReportStatus) {
    const r = state.queueReports.find(x => x.id === id); if (!r) return;
    const label = status === 'approved' ? 'Approved queue report' : status === 'rejected' ? 'Rejected queue report' : status === 'spam' ? 'Marked report as spam' : 'Returned report to pending';
    const patch: Partial<AdminQueueReport> = status === 'pending' ? { status, reviewedBy: undefined, reviewedAt: undefined } : { status, reviewedBy: adminName(), reviewedAt: now() };
    commit(withLog({ ...state, queueReports: state.queueReports.map(x => (x.id === id ? { ...x, ...patch } : x)) }, 'queue', label, r.terminal));
  },

  /* ---------- Announcements ---------- */
  saveAnnouncement(draft: AnnouncementDraft, id?: string): Announcement {
    const ts = now();
    if (id) {
      const existing = state.announcements.find(a => a.id === id);
      if (!existing) throw new ValidationError('That announcement no longer exists.');
      const publishedAt = draft.status === 'published' ? existing.publishedAt ?? ts : existing.publishedAt;
      const updated: Announcement = { ...existing, ...draft, publishedAt, updatedAt: ts };
      commit(withLog({ ...state, announcements: state.announcements.map(a => (a.id === id ? updated : a)) }, 'announcement', 'Edited announcement', updated.title));
      return updated;
    }
    const created: Announcement = { ...draft, id: newId('ann'), createdBy: adminName(), createdAt: ts, updatedAt: ts, publishedAt: draft.status === 'published' ? ts : undefined };
    commit(withLog({ ...state, announcements: [created, ...state.announcements] }, 'announcement', created.status === 'published' ? 'Published announcement' : 'Saved announcement draft', created.title));
    return created;
  },
  setAnnouncementStatus(id: string, status: Announcement['status']) {
    const a = state.announcements.find(x => x.id === id); if (!a) return;
    const ts = now();
    commit(withLog({ ...state, announcements: state.announcements.map(x => (x.id === id ? { ...x, status, updatedAt: ts, publishedAt: status === 'published' ? x.publishedAt ?? ts : x.publishedAt } : x)) }, 'announcement', status === 'published' ? 'Published announcement' : status === 'archived' ? 'Archived announcement' : 'Moved announcement to draft', a.title));
  },
  deleteAnnouncement(id: string) {
    const a = state.announcements.find(x => x.id === id); if (!a) return;
    commit(withLog({ ...state, announcements: state.announcements.filter(x => x.id !== id) }, 'announcement', 'Deleted announcement', a.title));
  },

  /* ---------- Reset ---------- */
  resetDemoData() {
    supportStore.reset();
    commit(withLog(createSeedState(), 'system', 'Reset demo data', 'All modules'));
  },
};

function toValidation(e: unknown): Error {
  if (e instanceof SupportStoreError) {
    const text = { empty: 'Write a message first.', 'too-long': 'Messages must be 2,000 characters or fewer.', duplicate: 'That message was just sent.', limit: 'This conversation reached its 100-message limit.', 'not-found': 'That conversation no longer exists.', storage: 'Could not save the message.' }[e.code];
    return new ValidationError(text);
  }
  return e instanceof Error ? e : new Error('Something went wrong.');
}

/** Stored admin data + shared conversations + customer accounts, as one object for the pages. */
const demoRoutes: RouteOption[] = Array.from(new Set(sampleTrips.map(t => `${t.from} → ${t.to}`))).map(label => ({ key: label, label }));
const demoSync: SyncState = { mode: 'demo', status: 'ready', refresh: () => {} };
function useDemoAdminState(): AdminView {
  const base = useSyncExternalStore(demoStore.subscribe, demoStore.getState, demoStore.getState);
  const conversations = useConversations();
  const customers = useSyncExternalStore(customerDirectory.subscribe, customerDirectory.getSnapshot, customerDirectory.getSnapshot);
  return useMemo(() => {
    const users: AppUser[] = customers.map(c => {
      const lastMessage = conversations.filter(x => x.userId === c.id).reduce((t, x) => Math.max(t, Date.parse(x.lastMessageAt)), 0);
      const lastLogin = c.lastLoginAt ? Date.parse(c.lastLoginAt) : 0;
      const last = Math.max(lastMessage, lastLogin, Date.parse(c.createdAt) || 0);
      return { id: c.id, nickname: c.name, email: c.email, kind: 'account', lastActiveAt: new Date(last).toISOString(), joinedAt: c.createdAt };
    });
    return { ...base, conversations, users, routes: demoRoutes, sync: demoSync };
  }, [base, conversations, customers]);
}

/* ---------- Facade: same API in both modes; every action is async so pages can show server errors ---------- */
export type AdminStore = typeof liveAdminStore;
function asyncify(api: Record<string, unknown>): AdminStore {
  return Object.fromEntries(Object.entries(api).map(([key, fn]) => [key, typeof fn === 'function'
    ? (...args: unknown[]) => { try { return Promise.resolve((fn as (...a: unknown[]) => unknown).apply(api, args)); } catch (error) { return Promise.reject(error); } }
    : fn])) as unknown as AdminStore;
}
export const adminStore: AdminStore = DEMO_MODE ? asyncify(demoStore as unknown as Record<string, unknown>) : liveAdminStore;
/** Demo store internals for tests/reset tooling. */
export const demoAdminStore = demoStore;
export const useAdminState: () => AdminView = DEMO_MODE ? useDemoAdminState : useLiveAdminState;
/** User-facing message for a failed admin action (validation or server). */
export function actionMessage(error: unknown, fallback: string): string {
  return error instanceof ValidationError || error instanceof LiveActionError ? error.message : fallback;
}
