import type { AlertPreferences, Passenger, QueueReport, SavedTrip } from '../types';
import type { RouteItinerary, TransportSegment } from '../types/route';
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object' && value!==null && !Array.isArray(value);
const strings=(value:Record<string,unknown>,keys:string[])=>keys.every(key=>typeof value[key]==='string');
const finite=(value:unknown):value is number=>typeof value==='number' && Number.isFinite(value) && value>=0;
const date=(value:unknown)=>typeof value==='string' && Number.isFinite(Date.parse(value));
const oneOf=(value:unknown,options:string[])=>typeof value==='string' && options.includes(value);
export const isPassenger=(value:unknown):value is Passenger=>oneOf(value,['regular','student','senior','pwd']);
export const isWatch=(value:unknown):value is string|null=>value===null || typeof value==='string' && value.length>0 && value.length<=300;
export const isAlertPreferences=(value:unknown):value is AlertPreferences=>record(value) && ['route','queue','price'].every(key=>typeof value[key]==='boolean');
const modes=['walk','jeepney','modern-jeepney','uv','bus','mrt','lrt','tricycle'];
export function isTransportSegment(value:unknown):value is TransportSegment {
  if(!record(value) || !strings(value,['id','from','to','mode','service','signboard','boarding','alighting','instruction']) || !oneOf(value.mode,modes) || !['travelMinutes','transferMinutes','boardingWaitMinutes'].every(key=>finite(value[key])) || !record(value.fares) || !Object.values(value.fares).every(finite))return false;
  if(value.queue!==undefined){const queue=value.queue;if(!record(queue) || typeof queue.terminal!=='string' || !oneOf(queue.defaultLevel,['low','mid','high']) || !record(queue.minutes) || !['low','mid','high'].every(key=>finite((queue.minutes as Record<string,unknown>)[key])))return false;}
  return value.serviceId===undefined || typeof value.serviceId==='string';
}
export function isRouteSnapshot(value:unknown):value is RouteItinerary {
  if(!record(value) || !strings(value,['id','originId','destinationId','name','reason']) || !date(value.computedAt) || !isPassenger(value.passenger) || !record(value.metrics) || !Array.isArray(value.legs) || value.legs.length===0 || value.legs.length>10)return false;
  const metrics=value.metrics;
  if(!['walkingMinutes','ridingMinutes','queueMinutes','boardingWaitMinutes','waitingMinutes','transferMinutes','totalMinutes','transfers','knownFare','missingFares'].every(key=>finite(metrics[key])) || !(metrics.fare===null || finite(metrics.fare)) || !(metrics.advisoryDelayMinutes===undefined || finite(metrics.advisoryDelayMinutes)))return false;
  if(value.unavailable!==undefined && typeof value.unavailable!=='boolean')return false;
  if(value.advisoryImpacts!==undefined && (!Array.isArray(value.advisoryImpacts) || !value.advisoryImpacts.every(item=>record(item) && strings(item,['advisoryId','title','impactType','explanation']) && Array.isArray(item.segmentIds) && item.segmentIds.every(id=>typeof id==='string') && typeof item.blocking==='boolean' && typeof item.simulated==='boolean' && finite(item.appliedDelayMinutes))))return false;
  return value.legs.every(leg=>record(leg) && isTransportSegment(leg.segment) && (leg.fare===null || finite(leg.fare)) && finite(leg.transferMinutes) && record(leg.queue) && finite(leg.queue.minutes) && oneOf(leg.queue.level,['low','mid','high']) && oneOf(leg.queue.source,['community','sample','stale']) && typeof leg.queue.label==='string' && (leg.queue.reportedAt===undefined || date(leg.queue.reportedAt)));
}
export function isSavedTrips(value:unknown):value is SavedTrip[] {
  return Array.isArray(value) && value.length<=12 && value.every(item=>record(item) && strings(item,['key','tripId','from','to','name']) && finite(item.ix) && (item.price===null || finite(item.price)) && isPassenger(item.passenger) && date(item.savedAt) && Array.isArray(item.steps) && item.steps.every(step=>Array.isArray(step) && step.length===2 && step.every(text=>typeof text==='string')) && (item.route===undefined || isRouteSnapshot(item.route)));
}
export function isQueueReports(value:unknown):value is QueueReport[] {
  return Array.isArray(value) && value.length<=15 && value.every(item=>record(item) && strings(item,['id','place','where','estimate','updated']) && oneOf(item.level,['low','mid','high']) && finite(item.progress) && item.progress<=100 && (item.isLocal===undefined || typeof item.isLocal==='boolean') && (item.reportedAt===undefined || date(item.reportedAt)) && (item.segmentId===undefined || typeof item.segmentId==='string'));
}
export function readStoredValue<T>(storage:Pick<Storage,'getItem'>,key:string,fallback:T,validate:(value:unknown)=>value is T):T {
  try{const value:unknown=JSON.parse(storage.getItem(`sakaywise-v3:${key}`) || 'null');return validate(value)?value:fallback;}catch{return fallback;}
}

export function writeStoredValue<T>(storage:Pick<Storage,'setItem'>,key:string,value:T):boolean {
  try{storage.setItem(`sakaywise-v3:${key}`,JSON.stringify(value));return true;}catch{return false;}
}
