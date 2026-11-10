export type SupportCategory='route'|'fare'|'roadwatch'|'queue'|'bug'|'general'|'other';
export interface SupportConversation {id:string;guestSessionId:string;category:SupportCategory;subject:string;status:'open'|'pending'|'resolved'|'closed';createdAt:string;updatedAt:string;lastMessageAt?:string;nickname?:string;email?:string;relatedTrip?:string;}
export interface SupportMessage {id:string;conversationId:string;senderType:'commuter'|'admin'|'system';senderId:string;message:string;createdAt:string;deliveryStatus:'saved-local'|'pending'|'sent'|'delivered'|'failed';readAt?:string;requestId?:string;}
export interface SupportDraft {message:string;category:SupportCategory;nickname:string;email:string;relatedTrip:string;}
export interface SupportService {
  mode:'local-demo'|'remote';
  createConversation:(draft:SupportDraft)=>Promise<SupportConversation>;
  updateConversationMetadata:(conversationId:string,draft:SupportDraft)=>Promise<void>;
  sendMessage:(conversationId:string,message:string,requestId:string)=>Promise<SupportMessage>;
  getConversationMessages:(conversationId:string)=>Promise<SupportMessage[]>;
  getConversationsForSession:()=>Promise<SupportConversation[]>;
  subscribeToMessages:(listener:()=>void)=>()=>void;
  markConversationRead:(conversationId:string)=>Promise<void>;
  getDraft:()=>Promise<SupportDraft>;
  saveDraft:(draft:SupportDraft)=>Promise<void>;
}
