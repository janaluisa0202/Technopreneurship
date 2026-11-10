import { createClientId } from '../lib/clientId';
import { useEffect, useRef, useState } from 'react';
import { emptySupportDraft, getSupportService, SupportError, supportErrorMessages, validateSupportDraft } from '../lib/supportService';
import type { SupportConversation, SupportDraft, SupportMessage, SupportService } from '../types/support';
export function useSupportCenter(service:SupportService=getSupportService()){
  const [draft,setDraft]=useState<SupportDraft>(emptySupportDraft);
  const [conversations,setConversations]=useState<SupportConversation[]>([]);
  const [conversationId,setConversationId]=useState<string>();
  const [messages,setMessages]=useState<SupportMessage[]>([]);
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const sending=useRef(false);const draftLoaded=useRef(false);
  useEffect(()=>{let active=true;Promise.all([service.getDraft(),service.getConversationsForSession()]).then(([savedDraft,list])=>{if(!active)return;setDraft(savedDraft);setConversations(list);setConversationId(list[0]?.id);draftLoaded.current=true;setReady(true);}).catch(()=>{if(active){setError(supportErrorMessages.storage);setReady(true);}});return()=>{active=false;};},[service]);
  useEffect(()=>{if(!conversationId){setMessages([]);return;}let active=true;const refresh=()=>service.getConversationMessages(conversationId).then(list=>{if(active)setMessages(list);}).catch(()=>{if(active)setError(supportErrorMessages.conversation);});refresh();const unsubscribe=service.subscribeToMessages(refresh);return()=>{active=false;unsubscribe();};},[conversationId,service]);
  useEffect(()=>{if(!ready || !draftLoaded.current)return;service.saveDraft(draft).catch(()=>setError(supportErrorMessages.storage));},[draft,ready,service]);
  async function send(){
    if(sending.current)return;
    const invalid=validateSupportDraft(draft);if(invalid){setError(supportErrorMessages[invalid]);return;}
    sending.current=true;setBusy(true);setError('');
    try{let id=conversationId;if(!id){const conversation=await service.createConversation(draft);id=conversation.id;setConversationId(id);}await service.updateConversationMetadata(id,draft);await service.sendMessage(id,draft.message,createClientId());setMessages(await service.getConversationMessages(id));setConversations(await service.getConversationsForSession());setDraft(previous=>({...previous,message:''}));}catch(cause){setError(cause instanceof SupportError?supportErrorMessages[cause.code]:supportErrorMessages.storage);}finally{sending.current=false;setBusy(false);}
  }
  return {draft,setDraft,conversations,conversationId,setConversationId,messages,ready,busy,error,send};
}
