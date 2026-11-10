type RandomSource=Pick<Crypto,'getRandomValues'> & Partial<Pick<Crypto,'randomUUID'>>;
/** Local record/request ID only; never an authorization credential.
 * getRandomValues also works in LAN HTTP previews where randomUUID is absent. */
export function createClientId(source:RandomSource=globalThis.crypto):string {
  if(source?.randomUUID)return source.randomUUID();
  if(!source?.getRandomValues)throw new Error('Secure random values are unavailable');
  const bytes=source.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
