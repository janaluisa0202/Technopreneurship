import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClientId } from '../../lib/clientId';
import { emptySupportDraft, SupportError, supportCategories, type SupportErrorCode } from '../../lib/supportService';
import type { QueueLevel } from '../../types';
import type { RoadWatchProvider } from '../../types/roadwatch';
import type { SupportConversation, SupportDraft, SupportMessage, SupportService } from '../../types/support';
import type { CommuterCatalog } from '../catalog';
import { currentUserId, ensureGuestSession, serverErrorCode } from './session';
import {
  advisoryColumns, advisoryFeedLabel, advisoryImpactColumns, buildRemoteCatalog, catalogColumns, mapAdvisoryRows, mapQueueEstimates,
  type AdvisoryRow, type CatalogRows, type QueueEstimateRow,
} from './remoteCatalog';

async function data<T>(request: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data: rows, error } = await request;
  if (error) throw error;
  return rows as T;
}

// ---------------------------------------------------------------------------- network + fares
export async function loadRemoteCatalog(supabase: SupabaseClient, signal?: AbortSignal): Promise<CommuterCatalog> {
  const from = (table: string, columns: string) => {
    const query = supabase.from(table).select(columns).eq('is_active', true);
    return signal ? query.abortSignal(signal) : query;
  };
  const fareQuery = supabase.rpc('get_current_fare_rules');
  const [places, stops, services, terminals, segments, journeys, fareRules] = await Promise.all([
    data<CatalogRows['places']>(from('transport_places', catalogColumns.transport_places)),
    data<CatalogRows['stops']>(from('transport_stops', catalogColumns.transport_stops)),
    data<CatalogRows['services']>(from('transport_services', catalogColumns.transport_services)),
    data<CatalogRows['terminals']>(from('queue_terminals', catalogColumns.queue_terminals)),
    data<CatalogRows['segments']>(from('transport_segments', catalogColumns.transport_segments)),
    data<CatalogRows['journeys']>(from('popular_journeys', catalogColumns.popular_journeys)),
    data<CatalogRows['fareRules']>(signal ? fareQuery.abortSignal(signal) : fareQuery),
  ]);
  return buildRemoteCatalog({ places, stops, services, terminals, segments, journeys, fareRules }, new Date().toISOString());
}

// ---------------------------------------------------------------------------- QueueSense
export interface RemoteQueueService {
  load: (signal?: AbortSignal) => Promise<ReturnType<typeof mapQueueEstimates>>;
  submit: (terminalId: string, level: QueueLevel, details: string, requestId: string) => Promise<void>;
  subscribe: (onChange: () => void) => () => void;
}
export function createRemoteQueueService(supabase: SupabaseClient): RemoteQueueService {
  return {
    async load(signal) {
      const query = supabase.rpc('get_queue_estimates');
      return mapQueueEstimates(await data<QueueEstimateRow[]>(signal ? query.abortSignal(signal) : query));
    },
    async submit(terminalId, level, details, requestId) {
      await ensureGuestSession(supabase);
      const { error } = await supabase.rpc('submit_queue_report', {
        p_terminal_id: terminalId, p_queue_level: level, p_request_id: requestId, p_details: details.trim() || null,
      });
      if (error) throw new QueueSubmitError(serverErrorCode(error));
    },
    subscribe(onChange) {
      const channel = supabase.channel(`queue-signals-${createClientId()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_terminal_signals' }, () => onChange())
        .subscribe(status => { if (status === 'SUBSCRIBED') onChange(); });
      return () => { void supabase.removeChannel(channel); };
    },
  };
}
export class QueueSubmitError extends Error {
  constructor(public code: string) { super(code); }
}

// ---------------------------------------------------------------------------- RoadWatch
const ADVISORY_COLUMNS = `${advisoryColumns},road_advisory_impacts(${advisoryImpactColumns})`;

/** Adapter for the existing RoadWatchProvider contract. useRoadWatch validates every record. */
export function createRemoteRoadWatchProvider(supabase: SupabaseClient, clock = () => Date.now()): RoadWatchProvider {
  return {
    async load() {
      // Keep the feed bounded: open-ended or recently ended advisories, newest first.
      const cutoff = new Date(clock() - 24 * 60 * 60 * 1000).toISOString();
      const rows = await data<AdvisoryRow[]>(supabase.from('road_advisories').select(ADVISORY_COLUMNS)
        .eq('is_published', true).or(`ends_at.is.null,ends_at.gt.${cutoff}`)
        .order('updated_at', { ascending: false }).limit(200));
      return { advisories: mapAdvisoryRows(rows), retrievedAt: new Date(clock()).toISOString(), label: advisoryFeedLabel(rows) };
    },
    subscribe(onChange) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const debounced = () => { clearTimeout(timer); timer = setTimeout(onChange, 400); };
      const channel = supabase.channel(`roadwatch-${createClientId()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'road_advisories' }, debounced)
        .subscribe();
      return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
    },
  };
}

// ---------------------------------------------------------------------------- Support
const REMOTE_DRAFT_KEY = 'sakaywise:support-remote-draft:v1';
const MESSAGE_PAGE = 200;
interface ConversationRow { id: string; owner_id: string; category: SupportConversation['category']; subject: string; status: SupportConversation['status']; created_at: string; updated_at: string; last_message_at: string | null; nickname: string | null; contact_email: string | null; related_trip: string | null; }
interface MessageRow { id: string; conversation_id: string; sender_type: SupportMessage['senderType']; sender_id: string | null; message: string; created_at: string; read_at: string | null; request_id: string; }

const toConversation = (row: ConversationRow): SupportConversation => ({
  id: row.id, guestSessionId: row.owner_id, category: row.category, subject: row.subject, status: row.status,
  createdAt: row.created_at, updatedAt: row.updated_at, ...(row.last_message_at ? { lastMessageAt: row.last_message_at } : {}),
  ...(row.nickname ? { nickname: row.nickname } : {}), ...(row.contact_email ? { email: row.contact_email } : {}),
  ...(row.related_trip ? { relatedTrip: row.related_trip } : {}),
});
// 'sent' means the server accepted and stored the message — nothing more is claimed.
const toMessage = (row: MessageRow): SupportMessage => ({
  id: row.id, conversationId: row.conversation_id, senderType: row.sender_type, senderId: row.sender_id ?? '',
  message: row.message, createdAt: row.created_at, deliveryStatus: row.sender_type === 'commuter' ? 'sent' : 'delivered',
  ...(row.read_at ? { readAt: row.read_at } : {}), requestId: row.request_id,
});
const supportCodes: Record<string, SupportErrorCode> = {
  empty_message: 'empty', message_too_long: 'too-long', invalid_email: 'email', duplicate_message: 'duplicate',
  conversation_not_found: 'conversation', conversation_limit: 'limit', conversation_closed: 'closed', rate_limited: 'rate-limited',
  guest_session_unavailable: 'unavailable', authentication_required: 'unavailable',
};
function supportError(error: unknown): SupportError {
  if (error instanceof SupportError) return error;
  return new SupportError(supportCodes[serverErrorCode(error)] ?? 'network');
}
async function rpcRow<T>(supabase: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data: rows, error } = await supabase.rpc(fn, args);
  if (error) throw supportError(error);
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new SupportError('network');
  return row as T;
}

export function createRemoteSupportService(supabase: SupabaseClient, storage: Pick<Storage, 'getItem' | 'setItem'>): SupportService {
  const metadata = (draft: SupportDraft) => ({ p_category: draft.category, p_nickname: draft.nickname, p_contact_email: draft.email, p_related_trip: draft.relatedTrip });
  return {
    mode: 'remote',
    async createConversation(draft) {
      try { await ensureGuestSession(supabase); } catch (error) { throw supportError(error); }
      return toConversation(await rpcRow<ConversationRow>(supabase, 'support_create_conversation', { ...metadata(draft), p_request_id: createClientId() }));
    },
    async updateConversationMetadata(conversationId, draft) {
      await rpcRow<ConversationRow>(supabase, 'support_update_conversation', { p_conversation_id: conversationId, ...metadata(draft) });
    },
    async sendMessage(conversationId, message, requestId) {
      return toMessage(await rpcRow<MessageRow>(supabase, 'support_send_message', { p_conversation_id: conversationId, p_message: message, p_request_id: requestId }));
    },
    async getConversationMessages(conversationId) {
      const { data: rows, error } = await supabase.from('support_messages').select('id,conversation_id,sender_type,sender_id,message,created_at,read_at,request_id')
        .eq('conversation_id', conversationId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(MESSAGE_PAGE);
      if (error) throw supportError(error);
      return (rows as MessageRow[]).reverse().map(toMessage);
    },
    async getConversationsForSession() {
      // Listing never creates a guest account; no session simply means no conversations yet.
      if (!(await currentUserId(supabase))) return [];
      const { data: rows, error } = await supabase.from('support_conversations')
        .select('id,owner_id,category,subject,status,created_at,updated_at,last_message_at,nickname,contact_email,related_trip')
        .order('updated_at', { ascending: false }).limit(50);
      if (error) throw supportError(error);
      return (rows as ConversationRow[]).map(toConversation);
    },
    subscribeToMessages(listener) {
      let channel: RealtimeChannel | undefined;
      const start = () => {
        if (channel) return;
        // RLS limits these events to conversations this session owns.
        channel = supabase.channel(`support-${createClientId()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => listener())
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_conversations' }, () => listener())
          // Fires after every (re)connection, so messages missed while offline are refetched.
          .subscribe(status => { if (status === 'SUBSCRIBED') listener(); });
      };
      void currentUserId(supabase).then(id => { if (id) start(); });
      const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => { if (session) start(); });
      return () => { auth.subscription.unsubscribe(); if (channel) void supabase.removeChannel(channel); };
    },
    async markConversationRead(conversationId) {
      const { error } = await supabase.rpc('support_mark_read', { p_conversation_id: conversationId });
      if (error) throw supportError(error);
    },
    async getDraft() {
      try {
        const parsed: unknown = JSON.parse(storage.getItem(REMOTE_DRAFT_KEY) || 'null');
        const draft = parsed as SupportDraft;
        if (parsed && typeof parsed === 'object' && ['message', 'nickname', 'email', 'relatedTrip'].every(key => typeof (parsed as Record<string, unknown>)[key] === 'string')
          && Object.hasOwn(supportCategories, draft.category)) return { ...draft };
      } catch { /* fall through */ }
      return emptySupportDraft();
    },
    async saveDraft(draft) {
      try { storage.setItem(REMOTE_DRAFT_KEY, JSON.stringify(draft)); } catch { throw new SupportError('storage'); }
    },
  };
}
