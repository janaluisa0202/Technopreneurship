import type { RouteItinerary, TransportSegment } from '../types/route';
import type { AdvisoryRouteImpact, AdvisoryTripContext, RoadAdvisory } from '../types/roadwatch';
import { advisoryState, canApplyOperationalEffect, validatedAdvisories } from './roadwatchService';
import { transportNetwork } from '../services/catalog';

export function advisoryMatchesSegment(advisory:RoadAdvisory,segment:TransportSegment):boolean {
  const serviceId=segment.serviceId || transportNetwork.segments.find(item=>item.id===segment.id)?.serviceId;
  return advisory.affectedSegmentIds.includes(segment.id) || advisory.affectedStopIds.includes(segment.from) || advisory.affectedStopIds.includes(segment.to) || (!!serviceId && advisory.affectedServiceIds.includes(serviceId));
}
export function advisoryMatchesRoute(advisory:RoadAdvisory,route:RouteItinerary):boolean {
  return advisory.affectedRouteIds.includes(route.id) || route.legs.some(leg=>advisoryMatchesSegment(advisory,leg.segment));
}
export function applyAdvisoryImpacts(route:RouteItinerary,advisories:RoadAdvisory[],now:number):RouteItinerary {
  const matches=validatedAdvisories(advisories).filter(advisory=>advisoryState(advisory,now).applicable && advisoryMatchesRoute(advisory,route));
  const delayWinners=new Map<string,{id:string;minutes:number}>();
  const impacts:AdvisoryRouteImpact[]=matches.map(advisory=>{
    const operational=canApplyOperationalEffect(advisory);
    const blocking=operational && (advisory.impactType==='segment-closure' || advisory.impactType==='service-interruption');
    const grounded=advisory.delayBasis==='additional-travel' && operational && ((advisory.sourceType==='demo' && advisory.delayEvidence==='simulation') || (advisory.sourceType==='official' && advisory.delayEvidence==='source-estimate'));
    const minutes=advisory.impactType==='delay' && grounded ? advisory.estimatedDelayMinutes || 0 : 0;
    const group=advisory.incidentId || advisory.id;
    if(minutes>0 && minutes>(delayWinners.get(group)?.minutes || 0))delayWinners.set(group,{id:advisory.id,minutes});
    return {advisoryId:advisory.id,title:advisory.title,impactType:advisory.impactType,segmentIds:route.legs.filter(leg=>advisoryMatchesSegment(advisory,leg.segment) || advisory.affectedRouteIds.includes(route.id)).map(leg=>leg.segment.id),blocking,appliedDelayMinutes:minutes,
      explanation:blocking?'Unavailable during the confirmed effective period in this dataset.':minutes>0?`${minutes} min of explicitly supplied additional travel delay.`:advisory.delayBasis==='queue-overlap'?'Queue-related estimate is not added again to QueueSense waiting.':advisory.impactType==='informational'?'Information only; route calculations are unchanged.':'Warning only; no confirmed closure or supported additional delay is applied.',simulated:advisory.sourceType==='demo'};
  });
  for(const impact of impacts){
    const advisory=matches.find(item=>item.id===impact.advisoryId)!;
    if(impact.appliedDelayMinutes>0 && delayWinners.get(advisory.incidentId || advisory.id)?.id!==advisory.id){impact.appliedDelayMinutes=0;impact.explanation='Related incident delay already represented once in this journey.';}
  }
  const delay=impacts.reduce((sum,impact)=>sum+impact.appliedDelayMinutes,0);
  const baseline=route.metrics.totalMinutes-(route.metrics.advisoryDelayMinutes || 0);
  return {...route,advisoryImpacts:impacts,unavailable:impacts.some(impact=>impact.blocking),metrics:{...route.metrics,advisoryDelayMinutes:delay,totalMinutes:baseline+delay}};
}
export function advisoryTripContext(advisory:RoadAdvisory,allRoutes:RouteItinerary[],availableRoutes:RouteItinerary[],now:number):AdvisoryTripContext {
  const affected=advisoryState(advisory,now).applicable?allRoutes.filter(route=>advisoryMatchesRoute(advisory,route)):[];
  return {affected,alternative:affected.length?availableRoutes.find(route=>!route.unavailable && !advisoryMatchesRoute(advisory,route)):undefined};
}
