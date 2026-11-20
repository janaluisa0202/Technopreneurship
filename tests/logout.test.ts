import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {signOutSession,createLogoutAction,clearAccountDrafts} from '../src/shared/auth/logout';
import {translate} from '../src/shared/i18n/translate';
import {createRemoteSupportService} from '../src/apps/commuter/services/supabase/remoteServices';

test('returned Supabase sign-out errors preserve authenticated state and never announce success',async()=>{
  let signedIn=true;const failure={message:'offline'};
  await assert.rejects(()=>signOutSession({signOut:async()=>({error:failure})},()=>{signedIn=false;}),error=>error===failure);assert.equal(signedIn,true);
});
test('rejected sign-out requests preserve state and allow an explicit retry',async()=>{
  let attempts=0,success=0;const logout=createLogoutAction(async()=>{if(++attempts===1)throw new Error('network');},()=>{success++;});await assert.rejects(logout,/network/);assert.equal(success,0);await logout();assert.equal(success,1);
});
test('repeated logout taps share one pending sign-out operation and wait for completion',async()=>{
  let finish!:()=>void;let calls=0,success=0;const logout=createLogoutAction(()=>{calls++;return new Promise<void>(resolve=>{finish=resolve;});},()=>{success++;});const first=logout(),second=logout();assert.equal(first,second);await Promise.resolve();assert.equal(calls,1);assert.equal(success,0);finish();await first;assert.equal(success,1);
});
test('already absent/expired sessions can successfully transition to guest using the same SDK sign-out',async()=>{
  let calls=0,committed=0;await signOutSession({signOut:async()=>{calls++;return {error:null};}},()=>{committed++;});assert.equal(calls,1);assert.equal(committed,1);
});
test('logout cleanup removes only signed-out account drafts, preserving settings, introduction, public trips and other accounts',()=>{
  const values=new Map([
    ['sakaywise:support:draft:v2:customer-1','private draft'],['sakaywise:support-remote-draft:v1:customer-1','private remote draft'],
    ['sakaywise:support:draft:v2:customer-2','other account'],['sakaywise:settings:v1','preferences'],['sakaywise:introduction:v1','complete'],
    ['sakaywise-v3:savedTrips','device demo guides'],['sakaywise:auth:v1','SDK managed token'],['sakaywise:session:v1','service managed session'],
  ]);assert.ok(clearAccountDrafts('customer-1',[{removeItem:key=>{values.delete(key);}}]));assert.equal(values.size,6);assert.equal(values.get('sakaywise:auth:v1'),'SDK managed token');assert.equal(values.get('sakaywise:settings:v1'),'preferences');assert.equal(values.get('sakaywise-v3:savedTrips'),'device demo guides');assert.equal(values.get('sakaywise:support:draft:v2:customer-2'),'other account');
});
test('private-draft cleanup attempts both stores and reports failure without clearing unrelated keys',()=>{
  const removed:string[]=[];assert.equal(clearAccountDrafts('u',[{removeItem:()=>{throw new Error('blocked');}},{removeItem:key=>{removed.push(key);}}]),false);assert.equal(removed.length,2);assert.ok(removed.every(key=>key.endsWith(':u')));
});
test('logout translations include confirmation, pending, error, success and optional guest continuation',()=>{
  for(const key of ['Log Out','Log Out of SakayWise?','Are you sure you want to log out? You can continue using SakayWise as a guest.','Logging out...','Unable to log out. Please try again.','You have successfully logged out.'])assert.notEqual(translate('fil',key),key);
});
test('support teardown prevents a late session lookup from reopening a private realtime channel',async()=>{
  let resolve!: (value:unknown)=>void,channels=0,unsubscribed=0;
  const client={auth:{getSession:()=>new Promise(done=>{resolve=done;}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:()=>{unsubscribed++;}}}})},channel:()=>{channels++;throw new Error('must not start');}};
  const service=createRemoteSupportService(client as never,{getItem:()=>null,setItem:()=>{}});const off=service.subscribeToMessages(()=>{});off();resolve({data:{session:{user:{id:'account-1'}}}});await Promise.resolve();await Promise.resolve();assert.equal(channels,0);assert.equal(unsubscribed,1);
});
test('sign-out preserves the shared SDK default scope for both commuter and administrator callers',async()=>{
  const calls:unknown[][]=[];let committed=0;
  for(const _role of ['customer','admin'])await signOutSession({signOut:async(...args:unknown[])=>{calls.push(args);return {error:null};}},()=>{committed++;});
  assert.deepEqual(calls,[[],[]]);assert.equal(committed,2);
});
test('a sign-out event blocks a stale support session lookup even before view teardown',async()=>{
  let resolve!:(value:unknown)=>void;let authChanged!:(_event:string,session:unknown)=>void;let channels=0;
  const client={auth:{getSession:()=>new Promise(done=>{resolve=done;}),onAuthStateChange:(callback:typeof authChanged)=>{authChanged=callback;return {data:{subscription:{unsubscribe:()=>{}}}};}},channel:()=>{channels++;throw new Error('must not start');}};
  const service=createRemoteSupportService(client as never,{getItem:()=>null,setItem:()=>{}},{id:'account-1',name:'Test commuter',email:'test@example.test'});const off=service.subscribeToMessages(()=>{});authChanged('SIGNED_OUT',null);resolve({data:{session:{user:{id:'account-1'}}}});await Promise.resolve();await Promise.resolve();off();assert.equal(channels,0);
});
