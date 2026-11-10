import { useCallback, useRef, useState } from 'react';
import { readStoredValue, writeStoredValue } from '../lib/storageValidation';

/** Malformed storage falls back; failed writes keep the session usable and are reported. */
export function useStoredState<T>(key:string,fallback:T,validate:(value:unknown)=>value is T):[T,(value:T|((current:T)=>T))=>boolean,boolean] {
  const [value,setValue]=useState<T>(()=>{try{return readStoredValue(localStorage,key,fallback,validate);}catch{return fallback;}});
  const current=useRef(value);
  const [storageError,setStorageError]=useState(false);
  const update=useCallback((next:T|((previous:T)=>T))=>{
    const resolved=typeof next==='function'?(next as (previous:T)=>T)(current.current):next;
    current.current=resolved;setValue(resolved);
    let persisted=false;try{persisted=writeStoredValue(localStorage,key,resolved);}catch{/* Storage access can itself be blocked. */}setStorageError(!persisted);return persisted;
  },[key]);
  return [value,update,storageError];
}
