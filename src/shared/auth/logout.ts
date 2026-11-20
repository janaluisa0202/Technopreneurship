/** Supabase returns sign-out errors in the result as well as by rejection. */
export async function signOutSession(auth:{signOut:()=>Promise<{error:unknown}>},commit:()=>void):Promise<void> {
  const {error}=await auth.signOut();
  if(error)throw error;
  commit();
}
/** One in-flight operation, with no success callback on failure. */
export function createLogoutAction(signOut:()=>Promise<void>,onSuccess:()=>void){
  let pending:Promise<void>|undefined;
  return ()=>{
    pending??=Promise.resolve().then(signOut).then(onSuccess).finally(()=>{pending=undefined;});
    return pending;
  };
}
export function clearAccountDrafts(userId:string,stores:Pick<Storage,'removeItem'>[]):boolean {
  let complete=true;
  for(const store of stores)for(const key of [`sakaywise:support:draft:v2:${userId}`,`sakaywise:support-remote-draft:v1:${userId}`]){
    try{store.removeItem(key);}catch{complete=false;}
  }
  return complete;
}
