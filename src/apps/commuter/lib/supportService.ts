import { createClientId } from './clientId';
import type { SupportCategory, SupportConversation, SupportDraft, SupportMessage, SupportService } from '../types/support';
export const SUPPORT_STORAGE_KEY='sakaywise:support:v1';
export const supportCategories:Record<SupportCategory,string>={route:'Route problems',fare:'Incorrect fares',roadwatch:'RoadWatch advisories',queue:'Queue reports',bug:'Application bugs',general:'General questions',other:'Other concerns'};
export const emptySupportDraft=():SupportDraft=>({message:'',category:'general',nickname:'',email:'',relatedTrip:''});
export type SupportErrorCode='empty'|'too-long'|'email'|'duplicate'|'storage'|'conversation'|'limit';
export class SupportError extends Error {constructor(public code:SupportErrorCode){super(code);}}
export const supportErrorMessages:Record<SupportErrorCode,string>={empty:'Write a message before saving.', 'too-long':'Messages must be 2,000 characters or fewer.', email:'Enter a valid email address or leave it blank.', duplicate:'This message was just saved. Please wait before saving it again.', storage:'Unable to save on this device. Your draft remains available in this session.', conversation:'This local conversation is unavailable.', limit:'This demo conversation has reached its 100-message limit.'};
export function validateSupportDraft(draft:SupportDraft):SupportErrorCode|undefined {
  if(!draft.message.trim())return 'empty';if(draft.message.trim().length>2000)return 'too-long';if(draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))return 'email';return undefined;
}
interface State {version:1;guestSessionId:string;conversations:SupportConversation[];messages:SupportMessage[];draft:SupportDraft;}
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object' && value!==null;
function isDraft(value:unknown):value is SupportDraft {return object(value) && ['message','nickname','email','relatedTrip'].every(key=>typeof value[key]==='string') && Object.hasOwn(supportCategories,String(value.category));}
const validDate=(value:unknown)=>typeof value==='string' && Number.isFinite(Date.parse(value));
function validState(value:unknown):value is State {
  if(!object(value) || value.version!==1 || typeof value.guestSessionId!=='string' || !isDraft(value.draft) || !Array.isArray(value.conversations) || !Array.isArray(value.messages))return false;
  if(!value.conversations.every(item=>object(item) && ['id','guestSessionId','subject','createdAt','updatedAt'].every(key=>typeof item[key]==='string') && item.guestSessionId===value.guestSessionId && validDate(item.createdAt) && validDate(item.updatedAt) && ['nickname','email','relatedTrip'].every(key=>item[key]===undefined || typeof item[key]==='string') && ['open','pending','resolved','closed'].includes(String(item.status)) && Object.hasOwn(supportCategories,String(item.category))))return false;
  return value.messages.every(item=>object(item) && ['id','conversationId','senderId','message','createdAt'].every(key=>typeof item[key]==='string') && validDate(item.createdAt) && item.senderType==='commuter' && item.senderId===value.guestSessionId && item.deliveryStatus==='saved-local' && item.readAt===undefined && (value.conversations as SupportConversation[]).some(conversation=>conversation.id===item.conversationId));
}
export function createLocalSupportService(storage:Pick<Storage,'getItem'|'setItem'>,clock=()=>Date.now(),makeId:()=>string=()=>createClientId()):SupportService {
  let state:State;
  try{const parsed:unknown=JSON.parse(storage.getItem(SUPPORT_STORAGE_KEY) || 'null');state=validState(parsed)?parsed:{version:1,guestSessionId:makeId(),conversations:[],messages:[],draft:emptySupportDraft()};}catch{state={version:1,guestSessionId:makeId(),conversations:[],messages:[],draft:emptySupportDraft()};}
  const listeners=new Set<()=>void>();
  function commit(next:State,notify=false){try{storage.setItem(SUPPORT_STORAGE_KEY,JSON.stringify(next));state=next;if(notify)for(const listener of listeners)listener();}catch{throw new SupportError('storage');}}
  const conversationFor=(id:string)=>{const item=state.conversations.find(item=>item.id===id && item.guestSessionId===state.guestSessionId);if(!item)throw new SupportError('conversation');return item;};
  return {
    mode:'local-demo',
    async createConversation(draft){const error=validateSupportDraft(draft);if(error)throw new SupportError(error);const now=new Date(clock()).toISOString();const conversation:SupportConversation={id:makeId(),guestSessionId:state.guestSessionId,category:draft.category,subject:supportCategories[draft.category],status:'open',createdAt:now,updatedAt:now,nickname:draft.nickname.trim().slice(0,80)||undefined,email:draft.email.trim().slice(0,254)||undefined,relatedTrip:draft.relatedTrip.trim().slice(0,200)||undefined};commit({...state,conversations:[conversation,...state.conversations]});return {...conversation};},
    async updateConversationMetadata(id,draft){conversationFor(id);const error=validateSupportDraft(draft);if(error)throw new SupportError(error);commit({...state,conversations:state.conversations.map(item=>item.id===id?{...item,category:draft.category,subject:supportCategories[draft.category],nickname:draft.nickname.trim().slice(0,80)||undefined,email:draft.email.trim().slice(0,254)||undefined,relatedTrip:draft.relatedTrip.trim().slice(0,200)||undefined,updatedAt:new Date(clock()).toISOString()}:item)});},
    async sendMessage(id,message,requestId){conversationFor(id);const trimmed=message.trim();if(!trimmed)throw new SupportError('empty');if(trimmed.length>2000)throw new SupportError('too-long');const existing=state.messages.find(item=>item.conversationId===id && item.requestId===requestId);if(existing)return {...existing};const messages=state.messages.filter(item=>item.conversationId===id);if(messages.length>=100)throw new SupportError('limit');const last=messages.at(-1);if(last?.message===trimmed && clock()-Date.parse(last.createdAt)<5000)throw new SupportError('duplicate');const now=new Date(clock()).toISOString();const saved:SupportMessage={id:makeId(),conversationId:id,senderType:'commuter',senderId:state.guestSessionId,message:trimmed,createdAt:now,deliveryStatus:'saved-local',requestId};commit({...state,messages:[...state.messages,saved],draft:{...state.draft,message:''},conversations:state.conversations.map(item=>item.id===id?{...item,updatedAt:now,lastMessageAt:now}:item)},true);return {...saved};},
    async getConversationMessages(id){conversationFor(id);return state.messages.filter(item=>item.conversationId===id).map(item=>({...item}));},
    async getConversationsForSession(){return state.conversations.filter(item=>item.guestSessionId===state.guestSessionId).map(item=>({...item}));},
    subscribeToMessages(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    async markConversationRead(id){conversationFor(id);/* Viewing a local demo never claims an administrator read a message. */},
    async getDraft(){return {...state.draft};},
    async saveDraft(draft){commit({...state,draft:{...draft}});},
  };
}
let service:SupportService|undefined;
export function getSupportService(){if(!service){let storage:Pick<Storage,'getItem'|'setItem'>;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw new Error('Storage unavailable');}};}service=createLocalSupportService(storage);}return service;}
