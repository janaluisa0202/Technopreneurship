import type { AdvisoryCategory, AdvisoryFilters, AdvisorySeverity, AdvisoryStatus, RoadAdvisory, RoadWatchPreferences } from '../types/roadwatch';
import { normalizeLocationText } from './locations';
import { transportNetwork } from '../services/catalog';

export const ADVISORY_FRESHNESS_MS = 24 * 60 * 60 * 1000;
export const categoryLabels: Record<AdvisoryCategory,string> = { traffic:'Traffic', closure:'Road Closures', flooding:'Flooding', transport:'Public Transport', roadworks:'Roadworks' };
export const severityOrder: Record<AdvisorySeverity,number> = { low:0, moderate:1, high:2, critical:3 };
export const defaultAdvisoryFilters: AdvisoryFilters = { query:'', category:'all', severity:'all', status:'all', sort:'recent' };
export const defaultRoadWatchPreferences: RoadWatchPreferences = { closure:true, traffic:true, flooding:true, transport:true, roadworks:true, savedTrips:true };
const record = (value:unknown):value is Record<string,unknown>=>typeof value==='object' && value!==null;
export function advisoryTimestamp(value:unknown):number|undefined {
  if(typeof value!=='string')return undefined;
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if(!match)return undefined;
  const [,year,month,day,hour,minute,second]=match.map(Number);
  if(month<1 || month>12 || day<1 || day>new Date(Date.UTC(year,month,0)).getUTCDate() || hour>23 || minute>59 || second>59)return undefined;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?parsed:undefined;
}
export function isRoadAdvisory(value:unknown):value is RoadAdvisory {
  if(!record(value))return false;
  if(!['id','title','description','areaName','sourceName'].every(key=>typeof value[key]==='string' && (value[key] as string).trim()))return false;
  if(!['traffic','closure','flooding','transport','roadworks'].includes(String(value.category)) || !['low','moderate','high','critical'].includes(String(value.severity)) || !['active','scheduled','resolved','expired','unknown'].includes(String(value.status)))return false;
  if(!['demo','official','community','unknown'].includes(String(value.sourceType)) || !['simulated','verified','unverified'].includes(String(value.verificationStatus)))return false;
  if(!['informational','delay','service-interruption','segment-closure','unknown'].includes(String(value.impactType)) || typeof value.effectConfirmed!=='boolean')return false;
  if(!['affectedRouteIds','affectedSegmentIds','affectedStopIds','affectedServiceIds'].every(key=>Array.isArray(value[key]) && (value[key] as unknown[]).every(item=>typeof item==='string' && item.length>0)))return false;
  const published=advisoryTimestamp(value.publishedAt), updated=advisoryTimestamp(value.updatedAt);
  if(published===undefined || updated===undefined || updated<published)return false;
  const start=value.startsAt===undefined?undefined:advisoryTimestamp(value.startsAt);
  const end=value.endsAt===undefined?undefined:advisoryTimestamp(value.endsAt);
  if((value.startsAt!==undefined && start===undefined) || (value.endsAt!==undefined && end===undefined) || (start!==undefined && end!==undefined && end<=start))return false;
  if(value.status==='scheduled' && start===undefined)return false;
  if(value.estimatedDelayMinutes!==undefined && (typeof value.estimatedDelayMinutes!=='number' || !Number.isFinite(value.estimatedDelayMinutes) || value.estimatedDelayMinutes<0))return false;
  if(value.delayBasis!==undefined && !['additional-travel','queue-overlap','unknown'].includes(String(value.delayBasis)))return false;
  if(value.delayEvidence!==undefined && !['simulation','source-estimate'].includes(String(value.delayEvidence)))return false;
  if(value.sourceUrl!==undefined && typeof value.sourceUrl!=='string')return false;
  if(value.incidentId!==undefined && (typeof value.incidentId!=='string' || !value.incidentId.trim()))return false;
  if(value.suggestedAction!==undefined && typeof value.suggestedAction!=='string')return false;
  return true;
}
export function validatedAdvisories(values:unknown[]):RoadAdvisory[]{
  const unique=new Map<string,RoadAdvisory>();
  for(const item of values.filter(isRoadAdvisory))if(!unique.has(item.id) || advisoryTimestamp(item.updatedAt)!>advisoryTimestamp(unique.get(item.id)!.updatedAt)!)unique.set(item.id,item);
  return [...unique.values()];
}
export function advisoryState(advisory:RoadAdvisory,now:number):{status:AdvisoryStatus;stale:boolean;applicable:boolean} {
  if(!isRoadAdvisory(advisory))return {status:'unknown',stale:true,applicable:false};
  const updated=advisoryTimestamp(advisory.updatedAt)!;
  const published=advisoryTimestamp(advisory.publishedAt)!;
  const stale=now-updated>=ADVISORY_FRESHNESS_MS || updated>now || published>now;
  let status=advisory.status;
  const start=advisoryTimestamp(advisory.startsAt), end=advisoryTimestamp(advisory.endsAt);
  if(updated>now || published>now)status='unknown';
  else if(status==='resolved' || status==='expired' || status==='unknown'){ /* Explicit terminal / unknown statuses are retained. */ }
  else if(end!==undefined && end<=now)status='expired';
  else if(start!==undefined && start>now)status='scheduled';
  else if(status==='scheduled')status=start!==undefined && start<=now?'active':'unknown';
  return {status,stale,applicable:status==='active' && !stale};
}
export function trustedSourceUrl(advisory:RoadAdvisory):string|undefined {
  if(advisory.sourceType!=='official' || advisory.verificationStatus!=='verified' || !advisory.sourceUrl)return undefined;
  try {
    const url=new URL(advisory.sourceUrl);
    const hosts=['mmda.gov.ph','dotr.gov.ph','pagasa.dost.gov.ph'];
    if(url.protocol!=='https:' || url.username || url.password || !hosts.some(host=>url.hostname===host || url.hostname.endsWith(`.${host}`)))return undefined;
    return url.href;
  }catch{return undefined;}
}
export function advisorySourceLabel(advisory:RoadAdvisory):string {
  return advisory.sourceType==='demo'?'Demo advisory':trustedSourceUrl(advisory)?'Official Advisory':'Unverified advisory';
}
export function canApplyOperationalEffect(advisory:RoadAdvisory):boolean {
  return advisory.effectConfirmed && ((advisory.sourceType==='demo' && advisory.verificationStatus==='simulated') || !!trustedSourceUrl(advisory));
}
export function filterAdvisories(advisories:RoadAdvisory[],filters:AdvisoryFilters,now:number,relevantIds:Set<string>=new Set()):RoadAdvisory[] {
  const query=normalizeLocationText(filters.query);
  return advisories.filter(advisory=>{
    const connections=transportNetwork.segments.filter(segment=>advisory.affectedSegmentIds.includes(segment.id) || (!!segment.serviceId && advisory.affectedServiceIds.includes(segment.serviceId)) || advisory.affectedStopIds.includes(segment.from) || advisory.affectedStopIds.includes(segment.to));
    const text=normalizeLocationText(`${advisory.title} ${advisory.description} ${advisory.areaName} ${categoryLabels[advisory.category]} ${connections.map(segment=>`${segment.mode} ${segment.service} ${segment.signboard} ${segment.boarding} ${segment.alighting}`).join(' ')}`);
    return query.split(' ').every(token=>text.includes(token)) && (filters.category==='all' || advisory.category===filters.category) && (filters.severity==='all' || advisory.severity===filters.severity) && (filters.status==='all' || advisoryState(advisory,now).status===filters.status);
  }).sort((first,second)=>{
    const recent=(advisoryTimestamp(second.updatedAt) || 0)-(advisoryTimestamp(first.updatedAt) || 0);
    return (filters.sort==='relevant'?Number(relevantIds.has(second.id))-Number(relevantIds.has(first.id)):filters.sort==='severity'?severityOrder[second.severity]-severityOrder[first.severity]:0) || recent || first.id.localeCompare(second.id);
  });
}
export function isRoadWatchPreferences(value:unknown):value is RoadWatchPreferences {
  return record(value) && Object.keys(defaultRoadWatchPreferences).every(key=>typeof value[key]==='boolean');
}
export function formatAdvisoryTime(value?:string,locale='en-PH'):string {
  const timestamp=advisoryTimestamp(value);
  return timestamp===undefined?'Not provided':new Date(timestamp).toLocaleString(locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
