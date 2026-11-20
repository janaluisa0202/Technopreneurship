// Live admin data layer: the same operations the demo `adminStore` offers, backed by Supabase.
// Authorization is NOT decided here — every query/RPC is checked by Row-Level Security and the
// security-definer RPCs in supabase/migrations. This module only loads, maps and refreshes.
import { useEffect, useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLiveClient } from '../../../shared/backend/runtime';
import type {
  AdminAccount, AdminView, Announcement, AnnouncementDraft, Audience, ConversationStatus, DirectMessage, Incident, IncidentDraft,
  IncidentStatus, MessagePurpose, Promo, PromoDraft, PromoStatus, QueueReportStatus, RouteOption,
} from '../types';
import {
  toActivity, toAnnouncement, toAppUser, toConversations, toDirectMessage, toIncident, toModerationStatus, toPromo, toQueueReport,
  type AdminMessageRow, type AdvisoryRow, type AnnouncementRow, type AuditRow, type ConversationRow, type MessageRow, type Names,
  type ProfileRow, type PromoRow, type QueueReportRow, type UserRow,
} from './liveMappers';

export class LiveActionError extends Error {}

type Module = 'promos' | 'incidents' | 'announcements' | 'messages' | 'queue' | 'support' | 'users' | 'activity' | 'routes';
const ALL: Module[] = ['promos', 'incidents', 'announcements', 'messages', 'queue', 'support', 'users', 'activity', 'routes'];
const QUEUE_WINDOW_DAYS = 7;
const LIMITS = { promos: 500, incidents: 300, announcements: 500, messages: 200, queue: 500, conversations: 200, threadMessages: 5000, users: 500, activity: 300 };

let actor: AdminAccount | null = null;
const names: Names = new Map();
const emails = new Map<string, string>();
const terminals = new Map<string, string>();
const errors = new Map<Module, string>();
let view: AdminView = {
  version: 2, promos: [], incidents: [], messages: [], queueReports: [], announcements: [], activity: [], conversations: [], users: [], routes: [],
  sync: { mode: 'live', status: 'loading', refresh: () => { void refresh(ALL); } },
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
let firstLoadDone = false;
function patch(next: Partial<AdminView>) {
  const merged = { ...view, ...next };
  merged.sync = { ...merged.sync, status: !firstLoadDone ? 'loading' : errors.size ? 'error' : 'ready',
    error: errors.size ? `Could not refresh: ${[...errors.keys()].join(', ')}. Showing the last loaded data.` : undefined };
  view = merged;
  emit();
}

function friendly(error: unknown): LiveActionError {
  const message = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error);
  // An UPDATE/DELETE that RLS filters to zero rows surfaces as PGRST116 from .single().
  if (/PGRST116|0 rows|no rows|multiple \(or no\) rows/i.test(message)) return new LiveActionError('Not saved: the item no longer exists or your admin role does not allow this change.');
  if (/forbidden|permission denied|row-level security|42501/i.test(message)) return new LiveActionError('Your admin role does not allow this action.');
  if (/conversation_not_found/.test(message)) return new LiveActionError('That conversation no longer exists.');
  if (/conversation_closed/.test(message)) return new LiveActionError('This conversation is closed.');
  if (/unknown_recipient/.test(message)) return new LiveActionError('That commuter account was not found.');
  if (/unknown_route/.test(message)) return new LiveActionError('Choose a valid route.');
  if (/unknown_promo/.test(message)) return new LiveActionError('Choose an existing promo.');
  if (/empty_message|invalid_input|check constraint|violates/i.test(message)) return new LiveActionError('The server rejected these values. Check the form and try again.');
  if (/fetch|network|failed to/i.test(message)) return new LiveActionError('Could not reach the server. Check your connection and try again.');
  return new LiveActionError('The action could not be completed. Please try again.');
}
async function data<T>(request: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data: rows, error } = await request;
  if (error) throw error;
  return rows as T;
}
async function must(request: PromiseLike<{ data: unknown; error: unknown }>): Promise<unknown> {
  const { data: result, error } = await request;
  if (error) throw friendly(error);
  return result;
}

/** Display names for staff and commuters referenced by any loaded row (staff can read profiles). */
async function loadNames(supabase: SupabaseClient, ids: (string | null | undefined)[]) {
  const missing = [...new Set(ids.filter((id): id is string => !!id && !names.has(id)))];
  for (let i = 0; i < missing.length; i += 200) {
    const rows = await data<ProfileRow[]>(supabase.from('profiles').select('user_id,display_name,email').in('user_id', missing.slice(i, i + 200)));
    for (const row of rows) {
      names.set(row.user_id, row.display_name || row.email?.split('@')[0] || 'SakayWise user');
      if (row.email) emails.set(row.user_id, row.email);
    }
  }
}

const loaders: Record<Module, (supabase: SupabaseClient) => Promise<Partial<AdminView>>> = {
  async promos(supabase) {
    const rows = await data<PromoRow[]>(supabase.from('promos').select('*').order('updated_at', { ascending: false }).limit(LIMITS.promos));
    await loadNames(supabase, rows.map(r => r.created_by));
    return { promos: rows.map(r => toPromo(r, names)) };
  },
  async incidents(supabase) {
    const rows = await data<AdvisoryRow[]>(supabase.from('road_advisories')
      .select('id,title,description,category,severity,status,area_name,suggested_action,starts_at,ends_at,published_at,updated_at,created_by,source_type,source_name,is_published')
      .order('updated_at', { ascending: false }).limit(LIMITS.incidents));
    await loadNames(supabase, rows.map(r => r.created_by));
    return { incidents: rows.map(r => toIncident(r, names)) };
  },
  async announcements(supabase) {
    const rows = await data<AnnouncementRow[]>(supabase.from('announcements').select('*').order('updated_at', { ascending: false }).limit(LIMITS.announcements));
    await loadNames(supabase, rows.map(r => r.created_by));
    return { announcements: rows.map(r => toAnnouncement(r, names)) };
  },
  async messages(supabase) {
    const rows = await data<AdminMessageRow[]>(supabase.from('admin_messages').select('*').order('sent_at', { ascending: false }).limit(LIMITS.messages));
    await loadNames(supabase, rows.map(r => r.sent_by));
    return { messages: rows.map(r => toDirectMessage(r, names)) };
  },
  async queue(supabase) {
    if (!terminals.size) {
      for (const t of await data<{ id: string; name: string }[]>(supabase.from('queue_terminals').select('id,name'))) terminals.set(t.id, t.name);
    }
    const since = new Date(Date.now() - QUEUE_WINDOW_DAYS * 86400000).toISOString();
    const rows = await data<QueueReportRow[]>(supabase.from('queue_reports')
      .select('id,terminal_id,queue_level,details,created_at,reporter_id,moderation_status,moderated_by,moderated_at,report_source')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(LIMITS.queue));
    await loadNames(supabase, rows.map(r => r.moderated_by));
    return { queueReports: rows.map(r => toQueueReport(r, terminals, names)) };
  },
  async support(supabase) {
    const rows = await data<ConversationRow[]>(supabase.from('support_conversations')
      .select('id,owner_id,category,subject,status,nickname,contact_email,related_trip,created_at,updated_at,last_message_at,flagged_spam')
      .order('updated_at', { ascending: false }).limit(LIMITS.conversations));
    const messages = rows.length ? await data<MessageRow[]>(supabase.from('support_messages')
      .select('id,conversation_id,sender_type,sender_id,message,created_at,read_at,request_id')
      .in('conversation_id', rows.map(r => r.id)).order('created_at', { ascending: true }).limit(LIMITS.threadMessages)) : [];
    await loadNames(supabase, [...rows.map(r => r.owner_id), ...messages.map(m => m.sender_id)]);
    return { conversations: toConversations(rows, messages, names, emails) };
  },
  async users(supabase) {
    const rows = await data<UserRow[]>(supabase.rpc('admin_list_users', { p_limit: LIMITS.users }));
    for (const r of rows) { if (r.display_name) names.set(r.user_id, r.display_name); if (r.email) emails.set(r.user_id, r.email); }
    return { users: rows.map(toAppUser) };
  },
  async activity(supabase) {
    const restricted = !(actor?.roles ?? []).some(role => role === 'admin' || role === 'super_admin');
    if (restricted) return { activity: [], sync: { ...view.sync, activityRestricted: true } };
    const rows = await data<AuditRow[]>(supabase.from('admin_audit_log')
      .select('id,actor_id,table_name,record_id,action,detail,old_data,new_data,changed_at').order('changed_at', { ascending: false }).limit(LIMITS.activity));
    if (!terminals.size) for (const t of await data<{ id: string; name: string }[]>(supabase.from('queue_terminals').select('id,name'))) terminals.set(t.id, t.name);
    await loadNames(supabase, rows.map(r => r.actor_id));
    return { activity: rows.map(r => toActivity(r, names, terminals)) };
  },
  async routes(supabase) {
    const [pairs, places] = await Promise.all([
      data<{ origin_place_id: string; destination_place_id: string }[]>(supabase.from('popular_journeys').select('origin_place_id,destination_place_id').eq('is_active', true).order('sort_order')),
      data<{ id: string; name: string }[]>(supabase.from('transport_places').select('id,name').eq('is_active', true)),
    ]);
    const placeName = new Map(places.map(p => [p.id, p.name]));
    const routes: RouteOption[] = pairs.filter(p => placeName.has(p.origin_place_id) && placeName.has(p.destination_place_id)).map(p => ({
      key: `${p.origin_place_id}>${p.destination_place_id}`, label: `${placeName.get(p.origin_place_id)} → ${placeName.get(p.destination_place_id)}`,
      originId: p.origin_place_id, destinationId: p.destination_place_id,
    }));
    return { routes };
  },
};

const inFlight = new Map<Module, Promise<void>>();
async function refresh(modules: Module[]) {
  const supabase = await getLiveClient();
  await Promise.all(modules.map(module => {
    const running = inFlight.get(module);
    if (running) return running;
    const job = loaders[module](supabase)
      .then(next => { errors.delete(module); patch(next); })
      .catch(() => { errors.set(module, module); patch({}); })
      .finally(() => inFlight.delete(module));
    inFlight.set(module, job);
    return job;
  }));
  firstLoadDone = true;
  patch({ sync: { ...view.sync, loadedAt: new Date().toISOString() } });
}

// Realtime where available, polling + focus refresh as the reliable fallback.
const tableModules: Record<string, Module[]> = {
  promos: ['promos', 'activity'], announcements: ['announcements', 'activity'], admin_messages: ['messages', 'activity'],
  queue_reports: ['queue', 'activity'], road_advisories: ['incidents', 'activity'], support_conversations: ['support'], support_messages: ['support', 'users'],
};
let started = 0;
let cleanup: (() => void)[] = [];
function start() {
  started += 1;
  if (started > 1) return;
  void refresh(ALL);
  const pending = new Set<Module>();
  let timer: number | undefined;
  const schedule = (modules: Module[]) => {
    modules.forEach(m => pending.add(m));
    window.clearTimeout(timer);
    timer = window.setTimeout(() => { const list = [...pending]; pending.clear(); void refresh(list); }, 400);
  };
  void getLiveClient().then(supabase => {
    if (!started) return;
    const channel = supabase.channel(`admin-console-${Math.random().toString(36).slice(2)}`);
    for (const table of Object.keys(tableModules)) channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => schedule(tableModules[table]));
    channel.subscribe();
    cleanup.push(() => { void supabase.removeChannel(channel); });
  });
  const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(ALL); }, 45000);
  const onFocus = () => schedule(ALL);
  window.addEventListener('focus', onFocus);
  cleanup.push(() => window.clearInterval(poll), () => window.removeEventListener('focus', onFocus), () => window.clearTimeout(timer));
}
function release() {
  started = Math.max(0, started - 1);
  if (!started) { cleanup.forEach(fn => fn()); cleanup = []; }
}

export function useLiveAdminState(): AdminView {
  useEffect(() => { start(); return release; }, []);
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => view, () => view);
}

/** Runs a mutation, then reloads the affected modules so every page shows the stored result. */
async function mutate<T>(modules: Module[], run: (supabase: SupabaseClient) => Promise<T>): Promise<T> {
  const supabase = await getLiveClient();
  let result: T;
  try { result = await run(supabase); } catch (error) { throw error instanceof LiveActionError ? error : friendly(error); }
  await refresh(modules);
  return result;
}
const requestId = () => crypto.randomUUID();
const find = <T extends { id: string }>(list: T[], id: string) => list.find(item => item.id === id);

export const liveAdminStore = {
  setActor(account: AdminAccount | null) { actor = account; },
  /** Sign-in/out are recorded by the auth service (admin_log_event) in live mode. */
  async logAuth(_action?: string, _account?: AdminAccount) { /* recorded server-side */ },

  savePromo: (draft: PromoDraft, id?: string) => mutate(['promos', 'activity'], async supabase => {
    const row = { title: draft.title, description: draft.description, promo_type: draft.type, start_date: draft.startDate, end_date: draft.endDate, applies_to: draft.appliesTo, status: draft.status };
    const saved = await must(id ? supabase.from('promos').update(row).eq('id', id).select().single() : supabase.from('promos').insert(row).select().single());
    return toPromo(saved as PromoRow, names);
  }),
  setPromoStatus: (id: string, status: PromoStatus) => mutate(['promos', 'activity'], async supabase => { await must(supabase.from('promos').update({ status }).eq('id', id).select('id').single()); }),
  deletePromo: (id: string) => mutate(['promos', 'activity'], async supabase => { await must(supabase.from('promos').delete().eq('id', id).select('id').single()); }),

  markConversationRead: (id: string) => mutate(['support'], async supabase => { await must(supabase.rpc('support_mark_read', { p_conversation_id: id })); }),
  markConversationUnread: (id: string) => mutate(['support'], async supabase => { await must(supabase.rpc('support_mark_unread', { p_conversation_id: id })); }),
  reply: (id: string, text: string) => mutate(['support', 'activity'], async supabase => {
    if (!text.trim()) throw new LiveActionError('Write a message first.');
    if (text.trim().length > 2000) throw new LiveActionError('Messages must be 2,000 characters or fewer.');
    await must(supabase.rpc('support_send_message', { p_conversation_id: id, p_message: text, p_request_id: requestId() }));
  }),
  setConversationStatus: (id: string, status: ConversationStatus) => mutate(['support', 'activity'], async supabase => {
    if (find(view.conversations, id)?.status === status) return;
    await must(supabase.rpc('support_set_status', { p_conversation_id: id, p_status: status }));
  }),
  setConversationSpam: (id: string, flagged: boolean) => mutate(['support', 'activity'], async supabase => { await must(supabase.rpc('support_set_spam', { p_conversation_id: id, p_flagged: flagged })); }),

  saveIncident: (draft: IncidentDraft, id?: string) => mutate(['incidents', 'activity'], async supabase => {
    const row = { title: draft.title, description: draft.description, category: draft.category, severity: draft.severity, status: draft.status,
      area_name: draft.areaName, suggested_action: draft.suggestedAction || null, starts_at: draft.startsAt, ends_at: draft.endsAt };
    const saved = await must(id
      ? supabase.from('road_advisories').update(row).eq('id', id).select().single()
      // Posted by SakayWise staff: never labelled official/verified; information only (no routing effect without explicit mappings).
      : supabase.from('road_advisories').insert({ ...row, source_type: 'operator', source_name: 'SakayWise Operations', verification_status: 'unverified',
        impact_type: 'informational', effect_confirmed: false, is_published: true }).select().single());
    return toIncident(saved as AdvisoryRow, names);
  }),
  setIncidentStatus: (id: string, status: IncidentStatus) => mutate(['incidents', 'activity'], async supabase => { await must(supabase.from('road_advisories').update({ status }).eq('id', id).select('id').single()); }),
  deleteIncident: (id: string) => mutate(['incidents', 'activity'], async supabase => { await must(supabase.from('road_advisories').delete().eq('id', id).select('id').single()); }),

  sendDirectMessage: (input: { audience: Audience; recipientId?: string; recipientLabel: string; routeKey?: string; purpose: MessagePurpose; subject: string; body: string; promoId?: string }) =>
    mutate(['messages', 'support', 'activity'], async supabase => {
      if (!input.subject.trim()) throw new LiveActionError('Add a subject.');
      if (!input.body.trim()) throw new LiveActionError('Write a message.');
      const route = view.routes.find(r => r.key === input.routeKey);
      if (input.audience === 'route' && !route) throw new LiveActionError('Choose a route.');
      const sent = await must(supabase.rpc('admin_send_message', {
        p_audience: input.audience, p_purpose: input.purpose, p_subject: input.subject, p_body: input.body, p_request_id: requestId(),
        p_recipient_user_id: input.audience === 'one' ? input.recipientId : null,
        p_route_origin_place_id: route?.originId ?? null, p_route_destination_place_id: route?.destinationId ?? null,
        p_promo_id: input.purpose === 'promo' ? input.promoId ?? null : null,
      }));
      return toDirectMessage((Array.isArray(sent) ? sent[0] : sent) as AdminMessageRow, names) as DirectMessage;
    }),

  reviewQueueReport: (id: string, status: QueueReportStatus) => mutate(['queue', 'activity'], async supabase => {
    await must(supabase.from('queue_reports').update({ moderation_status: toModerationStatus(status) }).eq('id', id).select('id').single());
  }),

  saveAnnouncement: (draft: AnnouncementDraft, id?: string) => mutate(['announcements', 'activity'], async supabase => {
    const row = { title: draft.title, body: draft.body, channel: draft.channel, status: draft.status };
    const saved = await must(id ? supabase.from('announcements').update(row).eq('id', id).select().single() : supabase.from('announcements').insert(row).select().single());
    return toAnnouncement(saved as AnnouncementRow, names) as Announcement;
  }),
  setAnnouncementStatus: (id: string, status: Announcement['status']) => mutate(['announcements', 'activity'], async supabase => { await must(supabase.from('announcements').update({ status }).eq('id', id).select('id').single()); }),
  deleteAnnouncement: (id: string) => mutate(['announcements', 'activity'], async supabase => { await must(supabase.from('announcements').delete().eq('id', id).select('id').single()); }),

  async resetDemoData() { throw new LiveActionError('Demo data reset is not available in live mode.'); },
};

export type LiveIncident = Incident;
export type LivePromo = Promo;
