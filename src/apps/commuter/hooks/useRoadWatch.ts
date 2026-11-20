import { useEffect, useMemo, useState } from 'react';
import { ADVISORY_FRESHNESS_MS, advisoryTimestamp, validatedAdvisories } from '../lib/roadwatchService';
import type { RoadAdvisory, RoadWatchDataStatus, RoadWatchProvider } from '../types/roadwatch';

export function useRoadWatch(provider:RoadWatchProvider) {
  const [attempt,setAttempt]=useState(0);
  const [now,setNow]=useState(Date.now);
  const [state,setState]=useState<{advisories:RoadAdvisory[];retrievedAt?:string;label:string;loaded:boolean;error:boolean}>({advisories:[],label:'RoadWatch data',loaded:false,error:false});
  useEffect(()=>{
    let active=true;
    setState(previous=>({...previous,loaded:false,error:false}));
    Promise.resolve().then(()=>provider.load()).then(result=>{
      if(!active)return;
      const valid=validatedAdvisories(result.advisories);
      setState({advisories:valid,retrievedAt:result.retrievedAt,label:result.label,loaded:true,error:result.advisories.length>0 && valid.length===0});setNow(Date.now());
    }).catch(()=>{if(active){setState({advisories:[],label:'RoadWatch data unavailable',loaded:true,error:true});setNow(Date.now());}});
    return ()=>{active=false;};
  },[provider,attempt]);
  useEffect(()=>provider.subscribe?.(()=>setAttempt(value=>value+1)),[provider]);
  useEffect(()=>{
    const boundaries=state.advisories.flatMap(item=>[advisoryTimestamp(item.startsAt),advisoryTimestamp(item.endsAt),(advisoryTimestamp(item.updatedAt) || 0)+ADVISORY_FRESHNESS_MS]);
    boundaries.push((advisoryTimestamp(state.retrievedAt) || 0)+ADVISORY_FRESHNESS_MS);
    const next=boundaries.filter((time):time is number=>time!==undefined && time>now).sort((a,b)=>a-b)[0];
    const timer=next?window.setTimeout(()=>setNow(Date.now()),Math.min(next-Date.now()+1,2147483647)):undefined;
    const refreshClock=()=>setNow(Date.now());
    window.addEventListener('focus',refreshClock);document.addEventListener('visibilitychange',refreshClock);
    return ()=>{if(timer)window.clearTimeout(timer);window.removeEventListener('focus',refreshClock);document.removeEventListener('visibilitychange',refreshClock);};
  },[state.advisories,state.retrievedAt,now]);
  const retrieved=advisoryTimestamp(state.retrievedAt);
  const dataStatus:RoadWatchDataStatus=!state.loaded?'loading':state.error?'unavailable':retrieved===undefined || retrieved>now || now-retrieved>=ADVISORY_FRESHNESS_MS?'outdated':'ready';
  const routingAdvisories=useMemo(()=>dataStatus==='ready'?state.advisories:[],[dataStatus,state.advisories]);
  const latestUpdate=state.advisories.map(item=>item.updatedAt).filter(time=>(advisoryTimestamp(time) ?? Infinity)<=now).sort((a,b)=>(advisoryTimestamp(b) || 0)-(advisoryTimestamp(a) || 0))[0];
  return {retry:()=>setAttempt(value=>value+1),advisories:state.advisories,routingAdvisories,now,dataStatus,latestUpdate,label:state.label};
}
