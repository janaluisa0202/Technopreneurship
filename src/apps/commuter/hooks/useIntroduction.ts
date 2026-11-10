import { useState } from 'react';
import { completeIntroduction, hasCompletedIntroduction } from '../lib/onboarding';
export function useIntroduction() {
  const [open,setOpen]=useState(()=>{try{return !hasCompletedIntroduction(localStorage);}catch{return true;}});
  const [replaying,setReplaying]=useState(false);
  const [storageError,setStorageError]=useState(false);
  function finish(){let saved=false;try{saved=completeIntroduction(localStorage);}catch{/* Accessible for this session even without storage. */}setStorageError(!saved);setOpen(false);setReplaying(false);}
  return {open,replaying,storageError,finish,replay:()=>{setReplaying(true);setOpen(true);},closeReplay:()=>{setOpen(false);setReplaying(false);}};
}
