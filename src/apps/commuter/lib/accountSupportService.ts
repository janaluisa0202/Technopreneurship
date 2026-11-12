import { authService } from '../../../shared/auth/authService';
import type { AuthUser } from '../../../shared/auth/types';
import { SupportStoreError, supportStore } from '../../../shared/messaging/supportStore';
import type { Conversation, ThreadMessage } from '../../../shared/messaging/types';
import { emptySupportDraft, getSupportService, SupportError, validateSupportDraft, type SupportErrorCode } from './supportService';
import type { SupportConversation, SupportDraft, SupportMessage, SupportService } from '../types/support';

/**
 * Support chat for the signed-in customer. Messages go through the shared support store, which is the same store the
 * admin Help Center reads, so replies from the admin show up here.
 * Backend handoff: keep this file's shape (it implements SupportService) and make each method call your API.
 */
const toConversation = (c: Conversation): SupportConversation => ({
  id: c.id, guestSessionId: c.userId, category: c.category, subject: c.subject, status: c.status,
  createdAt: c.createdAt, updatedAt: c.lastMessageAt, lastMessageAt: c.lastMessageAt, nickname: c.nickname, email: c.email, relatedTrip: c.relatedTrip,
});
const toMessage = (m: ThreadMessage, conversationId: string): SupportMessage => ({
  id: m.id, conversationId, senderType: m.senderType, senderId: m.senderId, message: m.message, createdAt: m.createdAt,
  deliveryStatus: m.senderType === 'commuter' ? 'sent' : 'delivered', readAt: m.readAt, requestId: m.requestId,
});
const mapError = (e: unknown): never => {
  if (e instanceof SupportStoreError) {
    const code: Record<SupportStoreError['code'], SupportErrorCode> = { empty: 'empty', 'too-long': 'too-long', duplicate: 'duplicate', limit: 'limit', 'not-found': 'conversation', storage: 'storage' };
    throw new SupportError(code[e.code]);
  }
  throw e;
};
const clean = (value: string, max: number) => value.trim().slice(0, max) || undefined;

function createAccountSupportService(user: AuthUser): SupportService {
  const draftKey = `sakaywise:support:draft:v2:${user.id}`;
  const defaults = (): SupportDraft => ({ ...emptySupportDraft(), nickname: user.name, email: user.email });
  const ownConversation = (id: string) => { const c = supportStore.getConversation(id); if (!c || c.userId !== user.id) throw new SupportError('conversation'); return c; };
  const fields = (draft: SupportDraft) => ({ category: draft.category, nickname: clean(draft.nickname, 80), email: clean(draft.email, 254), relatedTrip: clean(draft.relatedTrip, 200) });
  return {
    mode: 'local-demo',
    async createConversation(draft) {
      const error = validateSupportDraft(draft); if (error) throw new SupportError(error);
      return toConversation(supportStore.createConversation(user.id, fields(draft)));
    },
    async updateConversationMetadata(id, draft) {
      const error = validateSupportDraft(draft); if (error) throw new SupportError(error);
      try { supportStore.updateMetadata(user.id, id, fields(draft)); } catch (e) { mapError(e); }
    },
    async sendMessage(id, message, requestId) {
      try { return toMessage(supportStore.customerSend(user.id, id, user.name, message, requestId), id); } catch (e) { return mapError(e); }
    },
    async getConversationMessages(id) { return ownConversation(id).messages.map(m => toMessage(m, id)); },
    async getConversationsForSession() { return supportStore.forUser(user.id).map(toConversation).sort((a, b) => Date.parse(b.lastMessageAt ?? b.createdAt) - Date.parse(a.lastMessageAt ?? a.createdAt)); },
    subscribeToMessages: listener => supportStore.subscribe(listener),
    async markConversationRead(id) { ownConversation(id); supportStore.markReadByCustomer(user.id, id); },
    async getDraft() {
      try {
        const raw = JSON.parse(localStorage.getItem(draftKey) || 'null') as Partial<SupportDraft> | null;
        if (raw && typeof raw.message === 'string') return { ...defaults(), ...raw };
      } catch { /* use defaults */ }
      return defaults();
    },
    async saveDraft(draft) { try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch { throw new SupportError('storage'); } },
  };
}

const cache = new Map<string, SupportService>();
/** Stable per user: the support hook keeps this object in effect dependencies. */
export function getAccountSupportService(): SupportService {
  const user = authService.restoreSession();
  if (!user || user.role !== 'customer') return getSupportService();
  let service = cache.get(user.id);
  if (!service) { service = createAccountSupportService(user); cache.set(user.id, service); }
  return service;
}
