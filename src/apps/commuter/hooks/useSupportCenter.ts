import { createClientId } from '../lib/clientId';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccountSupportService } from '../lib/accountSupportService';
import { emptySupportDraft, getSupportService, SupportError, supportErrorMessages, validateSupportDraft } from '../lib/supportService';
import { isLiveCatalog } from '../services/catalog';
import type { SupportConversation, SupportDraft, SupportMessage, SupportService } from '../types/support';

function defaultSupportService(): SupportService {
  // The frontend account/admin inbox shares local storage in demo mode. Live mode must use the Supabase adapter.
  return isLiveCatalog() ? getSupportService() : getAccountSupportService();
}

export function useSupportCenter(service: SupportService = defaultSupportService()) {
  const [draft, setDraft] = useState<SupportDraft>(emptySupportDraft);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const draftLoaded = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([service.getDraft(), service.getConversationsForSession()])
      .then(([savedDraft, list]) => {
        if (!active) return;
        setDraft(savedDraft);
        setConversations(list);
        setConversationId(list[0]?.id);
        draftLoaded.current = true;
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError(supportErrorMessages.storage);
          setReady(true);
        }
      });
    return () => { active = false; };
  }, [service]);

  // Refresh both the conversation list and the currently selected thread on updates.
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const list = await service.getConversationsForSession();
        if (!active) return;
        setConversations(list);
        const selectedId = conversationId ?? list[0]?.id;
        if (!conversationId && selectedId) setConversationId(selectedId);
        if (!selectedId) {
          setMessages([]);
          return;
        }
        const thread = await service.getConversationMessages(selectedId);
        if (active) setMessages(thread);
      } catch {
        if (active) setError(supportErrorMessages.conversation);
      }
    };
    void refresh();
    const unsubscribe = service.subscribeToMessages(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [conversationId, service]);

  useEffect(() => {
    if (!ready || !draftLoaded.current) return;
    service.saveDraft(draft).catch(() => setError(supportErrorMessages.storage));
  }, [draft, ready, service]);

  async function send() {
    if (sending.current) return;
    const invalid = validateSupportDraft(draft);
    if (invalid) {
      setError(supportErrorMessages[invalid]);
      return;
    }
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      let id = conversationId;
      const current = conversations.find(item => item.id === id);
      if (!id || current?.status === 'closed') {
        const conversation = await service.createConversation(draft);
        id = conversation.id;
        setConversationId(id);
      }
      await service.updateConversationMetadata(id, draft);
      await service.sendMessage(id, draft.message, createClientId());
      setMessages(await service.getConversationMessages(id));
      setConversations(await service.getConversationsForSession());
      setDraft(previous => ({ ...previous, message: '' }));
    } catch (cause) {
      setError(cause instanceof SupportError ? supportErrorMessages[cause.code] : supportErrorMessages.storage);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const markRead = useCallback(async (id: string) => {
    try {
      await service.markConversationRead(id);
      const [thread, list] = await Promise.all([
        service.getConversationMessages(id),
        service.getConversationsForSession(),
      ]);
      if (id === conversationId) setMessages(thread);
      setConversations(list);
    } catch {
      // Read receipts are best-effort; do not block the support conversation UI.
    }
  }, [service, conversationId]);

  return { mode: service.mode, draft, setDraft, conversations, conversationId, setConversationId, messages, ready, busy, error, send, markRead };
}
