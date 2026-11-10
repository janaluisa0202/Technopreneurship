import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {defaultSettings,readSettings,isAppSettings,resolveTheme,watchSystemTheme,SETTINGS_KEY} from '../src/shared/settings/settings';
import {translate} from '../src/shared/i18n/translate';
import {en} from '../src/shared/i18n/en';
import {fil} from '../src/shared/i18n/fil';
import {createLocalSupportService,emptySupportDraft,SupportError,SUPPORT_STORAGE_KEY,validateSupportDraft} from '../src/apps/commuter/lib/supportService';
function memoryStore(initial:Record<string,string>={}){const values=new Map(Object.entries(initial));return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},values};}
function setup(){let time=Date.parse('2026-11-10T02:00:00Z'),sequence=0;const store=memoryStore();const service=createLocalSupportService(store,()=>time,()=>`test-${++sequence}`);return {store,service,advance:(ms:number)=>{time+=ms;}};}
const draft={...emptySupportDraft(),message:'Paano po ang sakayan sa demo?',category:'route' as const};

test('guest settings restore valid preferences and safely fall back for malformed or invalid data',()=>{
  for(const stored of ['not JSON','null','{}',JSON.stringify({...defaultSettings,textSize:999}),JSON.stringify({...defaultSettings,textSize:'130'})])assert.deepEqual(readSettings(memoryStore({[SETTINGS_KEY]:stored})),defaultSettings);
  const settings={language:'fil',appearance:'dark',textSize:130};assert.ok(isAppSettings(settings));assert.deepEqual(readSettings(memoryStore({[SETTINGS_KEY]:JSON.stringify(settings)})),settings);
});
test('appearance follows system changes while explicit light and dark remain independent',()=>{
  assert.equal(resolveTheme('system',true),'dark');assert.equal(resolveTheme('system',false),'light');assert.equal(resolveTheme('light',true),'light');assert.equal(resolveTheme('dark',false),'dark');
  const listeners=new Set<()=>void>();const media={matches:false,addEventListener:(_type:string,listener:()=>void)=>listeners.add(listener),removeEventListener:(_type:string,listener:()=>void)=>listeners.delete(listener)};
  const values:boolean[]=[];const stop=watchSystemTheme(media as unknown as Pick<MediaQueryList,'matches'|'addEventListener'|'removeEventListener'>,value=>values.push(value));media.matches=true;for(const listener of listeners)listener();stop();assert.deepEqual(values,[false,true]);assert.equal(listeners.size,0);
});
test('English and Filipino resources share typed keys, support fallback, and preserve proper locations',()=>{
  assert.deepEqual(Object.keys(en).sort(),Object.keys(fil).sort());assert.equal(translate('en','Recommended Routes'),'Recommended Routes');assert.equal(translate('fil','Recommended Routes'),'Mga Iminungkahing Ruta');assert.equal(translate('fil','Origin'),'Pinagmulan');assert.equal(translate('fil','A future English fallback'),'A future English fallback');assert.equal(translate('fil','UST Frassati (España)'),'UST Frassati (España)');
});
test('dynamic navigation, instructions and fare errors retain numeric values and named places',()=>{
  assert.equal(translate('fil','Saved trip guides, 3 saved'),'Mga na-save na gabay, 3 naka-save');assert.equal(translate('fil','Select LRT + MRT, 57 minutes'),'Piliin ang LRT + MRT, 57 minuto');
  const instruction=translate('fil','Board the sample España–SM North UV Express service; confirm the actual stop and signboard with the operator.');assert.ok(instruction.startsWith('Sumakay'));assert.ok(instruction.includes('España–SM North UV Express'));
  assert.ok(translate('fil','Difference: ₱15.00. This is not proof of overcharging; verify the current official route-specific tariff.').includes('₱15.00'));
  assert.equal(translate('fil','s'),'');assert.equal(translate('fil','Hello {name}',{name:'Ana'}),'Hello Ana');
});
test('support validation rejects empty, oversized, or invalid email submissions without requiring personal details',()=>{
  assert.equal(validateSupportDraft({...draft,message:'   '}),'empty');assert.equal(validateSupportDraft({...draft,message:'x'.repeat(2001)}),'too-long');assert.equal(validateSupportDraft({...draft,email:'invalid'}),'email');assert.equal(validateSupportDraft(draft),undefined);
});
test('local messages are saved truthfully with no admin delivery, replies or read receipts',async()=>{
  const {service}=setup();const conversation=await service.createConversation(draft);const message=await service.sendMessage(conversation.id,draft.message,'request-1');assert.equal(service.mode,'local-demo');assert.equal(message.deliveryStatus,'saved-local');assert.equal(message.senderType,'commuter');assert.equal(message.readAt,undefined);await service.markConversationRead(conversation.id);const list=await service.getConversationMessages(conversation.id);assert.equal(list.length,1);assert.equal(list[0].readAt,undefined);assert.equal(list[0].message,draft.message);
});
test('draft and conversation history restore after creating a fresh adapter',async()=>{
  const {store,service}=setup();await service.saveDraft({...draft,message:'Hindi pa tapos na draft'});const conversation=await service.createConversation(draft);await service.sendMessage(conversation.id,draft.message,'request-1');await service.saveDraft({...draft,message:'Bagong draft'});const restored=createLocalSupportService(store);assert.equal((await restored.getDraft()).message,'Bagong draft');assert.equal((await restored.getConversationsForSession()).length,1);assert.equal((await restored.getConversationMessages(conversation.id))[0].message,draft.message);
});
test('repeated submission is idempotent per request and duplicate text is rejected briefly',async()=>{
  const {service,advance}=setup();const conversation=await service.createConversation(draft);const first=await service.sendMessage(conversation.id,draft.message,'request-1');const repeated=await service.sendMessage(conversation.id,draft.message,'request-1');assert.equal(repeated.id,first.id);await assert.rejects(()=>service.sendMessage(conversation.id,draft.message,'request-2'),error=>error instanceof SupportError && error.code==='duplicate');advance(6000);await service.sendMessage(conversation.id,draft.message,'request-3');assert.equal((await service.getConversationMessages(conversation.id)).length,2);
});
test('optional metadata can be updated without inventing contact delivery',async()=>{
  const {service}=setup();const conversation=await service.createConversation(draft);await service.updateConversationMetadata(conversation.id,{...draft,category:'bug',nickname:'Test commuter',email:'commuter@example.test',relatedTrip:'Demo trip'});const updated=(await service.getConversationsForSession())[0];assert.equal(updated.category,'bug');assert.equal(updated.email,'commuter@example.test');assert.equal(updated.status,'open');assert.equal((await service.getConversationMessages(conversation.id)).length,0);
});
test('storage failure does not falsely commit a message and inaccessible conversations are rejected',async()=>{
  const {store,service}=setup();const conversation=await service.createConversation(draft);const failing=createLocalSupportService({getItem:store.getItem,setItem:()=>{throw new Error('quota');}});await assert.rejects(()=>failing.sendMessage(conversation.id,'Not saved','request-1'),error=>error instanceof SupportError && error.code==='storage');assert.equal((await service.getConversationMessages(conversation.id)).length,0);await assert.rejects(()=>service.getConversationMessages('other-guest'),error=>error instanceof SupportError && error.code==='conversation');
});
test('malformed local storage is recovered, and unrelated saved-route data is untouched',async()=>{
  const store=memoryStore({[SUPPORT_STORAGE_KEY]:'{broken','sakaywise-v3:savedTrips':'KEEP'});const service=createLocalSupportService(store);assert.deepEqual(await service.getConversationsForSession(),[]);await service.saveDraft(draft);assert.equal(store.getItem('sakaywise-v3:savedTrips'),'KEEP');
});
test('subscriptions notify local changes, unsubscribe cleanly, and returned records cannot mutate saved delivery state',async()=>{
  const {service}=setup();let count=0;const unsubscribe=service.subscribeToMessages(()=>count++);const conversation=await service.createConversation(draft);const message=await service.sendMessage(conversation.id,draft.message,'request-1');message.deliveryStatus='delivered';await service.saveDraft(draft);assert.equal(count,1);unsubscribe();assert.equal(count,1);assert.equal((await service.getConversationMessages(conversation.id))[0].deliveryStatus,'saved-local');
});
test('invalid persisted timestamps cannot crash support history rendering',async()=>{
  const {store,service}=setup();const conversation=await service.createConversation(draft);await service.sendMessage(conversation.id,draft.message,'request-1');const state=JSON.parse(store.getItem(SUPPORT_STORAGE_KEY)!);state.messages[0].createdAt='invalid date';store.setItem(SUPPORT_STORAGE_KEY,JSON.stringify(state));assert.deepEqual(await createLocalSupportService(store).getConversationsForSession(),[]);
});
