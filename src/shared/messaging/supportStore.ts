import { useSyncExternalStore } from 'react';
import type { Conversation, ConversationStatus, SupportCategory, ThreadMessage } from './types';
import { createSeedConversations } from './seed';

/**
 * ONE place that holds every customer ⇄ admin conversation, so both apps see the same data.
 * It saves to localStorage and listens for the `storage` event, so a message sent in one tab shows up in the
 * other tab of the same browser. To connect the backend, keep these function names and replace the bodies with API
 * calls (and push updates with websockets / realtime instead of the storage event).
 */
export const SUPPORT_STORE_KEY = 'sakaywise:support:v2';
export const MAX_MESSAGES = 100;

export class SupportStoreError extends Error {
  constructor(public code: 'empty' | 'too-long' | 'duplicate' | 'limit' | 'not-found' | 'storage') { super(code); }
}

interface Stored { version: 2; conversations: Conversation[]; }
const newId = (prefix: string) => `${prefix}-${Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join('')}`;
const nowIso = () => new Date().toISOString();

function valid(v: unknown): v is Stored {
  return typeof v === 'object' && v !== null && (v as Stored).version === 2 && Array.isArray((v as Stored).conversations)
    && (v as Stored).conversations.every(c => c && typeof c.id === 'string' && typeof c.userId === 'string' && Array.isArray(c.messages));
}
function load(): Conversation[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SUPPORT_STORE_KEY) || 'null');
    if (valid(parsed)) return parsed.conversations;
  } catch { /* fall through to seed */ }
  return createSeedConversations();
}

let conversations: Conversation[] = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

function commit(next: Conversation[]) {
  conversations = next;
  try { localStorage.setItem(SUPPORT_STORE_KEY, JSON.stringify({ version: 2, conversations: next } satisfies Stored)); } catch { /* stays in memory for this tab */ }
  emit();
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key === SUPPORT_STORE_KEY) { conversations = load(); emit(); } });
}

const patch = (id: string, fn: (c: Conversation) => Conversation) => commit(conversations.map(c => (c.id === id ? fn(c) : c)));
const find = (id: string) => conversations.find(c => c.id === id);

function checkText(text: string): string {
  const body = text.trim();
  if (!body) throw new SupportStoreError('empty');
  if (body.length > 2000) throw new SupportStoreError('too-long');
  return body;
}
const subjectFor: Record<SupportCategory, string> = { route: 'Route problems', fare: 'Incorrect fares', roadwatch: 'RoadWatch advisories', queue: 'Queue reports', bug: 'Application bugs', general: 'General questions', other: 'Other concerns' };

export const supportStore = {
  getConversations: () => conversations,
  getConversation: (id: string) => find(id),
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  reset() { commit(createSeedConversations()); },

  /* ---------- customer side (always scoped to the signed-in customer's id) ---------- */
  forUser: (userId: string) => conversations.filter(c => c.userId === userId),

  createConversation(userId: string, fields: { category: SupportCategory; nickname?: string; email?: string; relatedTrip?: string }): Conversation {
    const ts = nowIso();
    const created: Conversation = { id: newId('conv'), userId, category: fields.category, subject: subjectFor[fields.category], status: 'open', nickname: fields.nickname, email: fields.email, relatedTrip: fields.relatedTrip, createdAt: ts, lastMessageAt: ts, unread: false, flaggedSpam: false, messages: [] };
    commit([created, ...conversations]);
    return created;
  },
  updateMetadata(userId: string, id: string, fields: { category: SupportCategory; nickname?: string; email?: string; relatedTrip?: string }) {
    const c = find(id); if (!c || c.userId !== userId) throw new SupportStoreError('not-found');
    patch(id, x => ({ ...x, category: fields.category, subject: subjectFor[fields.category], nickname: fields.nickname, email: fields.email, relatedTrip: fields.relatedTrip }));
  },
  customerSend(userId: string, id: string, senderName: string, text: string, requestId: string): ThreadMessage {
    const c = find(id); if (!c || c.userId !== userId) throw new SupportStoreError('not-found');
    const body = checkText(text);
    const same = c.messages.find(m => m.requestId === requestId);
    if (same) return same;
    if (c.messages.length >= MAX_MESSAGES) throw new SupportStoreError('limit');
    const last = c.messages.at(-1);
    if (last?.senderType === 'commuter' && last.message === body && Date.now() - Date.parse(last.createdAt) < 5000) throw new SupportStoreError('duplicate');
    const ts = nowIso();
    const message: ThreadMessage = { id: newId('msg'), senderType: 'commuter', senderId: userId, senderName, message: body, createdAt: ts, requestId };
    patch(id, x => ({ ...x, messages: [...x.messages, message], lastMessageAt: ts, unread: true, status: x.status === 'resolved' ? 'open' : x.status }));
    return message;
  },
  markReadByCustomer(userId: string, id: string) {
    const c = find(id); if (!c || c.userId !== userId) return;
    if (!c.messages.some(m => m.senderType === 'admin' && !m.readAt)) return;
    const ts = nowIso();
    patch(id, x => ({ ...x, messages: x.messages.map(m => (m.senderType === 'admin' && !m.readAt ? { ...m, readAt: ts } : m)) }));
  },
  unreadForCustomer: (userId: string) => conversations.filter(c => c.userId === userId).reduce((n, c) => n + c.messages.filter(m => m.senderType === 'admin' && !m.readAt).length, 0),

  /* ---------- admin side ---------- */
  adminMarkRead(id: string) { if (find(id)?.unread) patch(id, c => ({ ...c, unread: false })); },
  adminMarkUnread(id: string) { if (find(id)) patch(id, c => ({ ...c, unread: true })); },
  adminReply(id: string, admin: { id: string; name: string }, text: string): ThreadMessage {
    const c = find(id); if (!c) throw new SupportStoreError('not-found');
    const body = checkText(text);
    if (c.messages.length >= MAX_MESSAGES) throw new SupportStoreError('limit');
    const ts = nowIso();
    const message: ThreadMessage = { id: newId('msg'), senderType: 'admin', senderId: admin.id, senderName: admin.name, message: body, createdAt: ts };
    patch(id, x => ({ ...x, messages: [...x.messages, message], lastMessageAt: ts, unread: false, status: x.status === 'open' ? 'pending' : x.status }));
    return message;
  },
  adminSetStatus(id: string, status: ConversationStatus) { if (find(id)) patch(id, c => ({ ...c, status })); },
  adminSetSpam(id: string, flaggedSpam: boolean) { if (find(id)) patch(id, c => ({ ...c, flaggedSpam })); },
  /** Sends a message to one customer: adds it to their latest conversation, or starts a new one so they can see it. */
  adminMessageUser(user: { id: string; name: string }, admin: { id: string; name: string }, subject: string, text: string): Conversation {
    const body = checkText(`${subject.trim()}\n\n${text.trim()}`);
    const latest = [...conversations].filter(c => c.userId === user.id && !c.flaggedSpam).sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt))[0];
    const ts = nowIso();
    const message: ThreadMessage = { id: newId('msg'), senderType: 'admin', senderId: admin.id, senderName: admin.name, message: body, createdAt: ts };
    if (latest) { patch(latest.id, x => ({ ...x, messages: [...x.messages, message], lastMessageAt: ts })); return find(latest.id)!; }
    const created: Conversation = { id: newId('conv'), userId: user.id, category: 'general', subject: subject.trim().slice(0, 80) || subjectFor.general, status: 'pending', nickname: user.name, createdAt: ts, lastMessageAt: ts, unread: false, flaggedSpam: false, messages: [message] };
    commit([created, ...conversations]);
    return created;
  },
};

export const useConversations = () => useSyncExternalStore(supportStore.subscribe, supportStore.getConversations, supportStore.getConversations);
export const useCustomerUnread = (userId: string) => useSyncExternalStore(supportStore.subscribe, () => supportStore.unreadForCustomer(userId), () => 0);
