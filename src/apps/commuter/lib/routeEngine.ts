import { transportNetwork } from '../services/demoCatalog';
import { fareForPassenger, totalFares } from './fares';
import { queueForSegment } from './queues';
import { applyAdvisoryImpacts } from './advisoryImpact';
import type { RoadAdvisory } from '../types/roadwatch';
import type { Passenger, Priority, QueueReport } from '../types';
import type { EvaluatedLeg, RouteItinerary, RouteRequest, TransportMode, TransportNetwork, TransportSegment } from '../types/route';

export const modeNames: Record<TransportMode, string> = {
  walk: 'Walking', jeepney: 'Jeepney', 'modern-jeepney': 'Modern Jeepney', uv: 'UV Express', bus: 'City Bus', mrt: 'MRT', lrt: 'LRT', tricycle: 'Tricycle',
};
export const preferenceLabels: Record<Priority, string> = { time: 'Fastest route', cost: 'Cheapest route', wait: 'Less waiting', transfers: 'Fewest transfers' };
export function evaluatePath(segments: TransportSegment[], originId: string, destinationId: string, passenger: Passenger, reports: QueueReport[], now: number): RouteItinerary {
  let boardings = 0;
  const legs: EvaluatedLeg[] = segments.map(segment => {
    const riding = segment.mode !== 'walk';
    const transferMinutes = riding && boardings > 0 ? segment.transferMinutes : 0;
    if (riding) boardings++;
    return { segment, transferMinutes, fare: riding ? fareForPassenger(segment.fares, passenger) : 0, queue: queueForSegment(segment, reports, now) };
  });
  const sum = (metric: (leg: EvaluatedLeg) => number) => legs.reduce((total, leg) => total + metric(leg), 0);
  const walkingMinutes = sum(leg => leg.segment.mode === 'walk' ? leg.segment.travelMinutes : 0);
  const ridingMinutes = sum(leg => leg.segment.mode !== 'walk' ? leg.segment.travelMinutes : 0);
  const queueMinutes = sum(leg => leg.queue.minutes);
  const boardingWaitMinutes = sum(leg => leg.segment.boardingWaitMinutes);
  const transferMinutes = sum(leg => leg.transferMinutes);
  const modes = segments.filter(segment => segment.mode !== 'walk').map(segment => modeNames[segment.mode]);
  return {
    id: segments.map(segment => segment.id).join('|'), originId, destinationId, name: modes.join(' + ') || 'Walking', legs, passenger, computedAt: new Date(now).toISOString(), reason: '',
    metrics: { advisoryDelayMinutes:0, walkingMinutes, ridingMinutes, queueMinutes, boardingWaitMinutes, waitingMinutes: queueMinutes + boardingWaitMinutes, transferMinutes, totalMinutes: walkingMinutes + ridingMinutes + queueMinutes + boardingWaitMinutes + transferMinutes, transfers: Math.max(0, boardings - 1), ...totalFares(legs.map(leg => leg.fare)) },
  };
}
export function rankRoutes(routes: RouteItinerary[], priority: Priority): RouteItinerary[] {
  const metric = (route: RouteItinerary) => priority === 'time' ? route.metrics.totalMinutes : priority === 'cost' ? route.metrics.fare ?? Infinity : priority === 'wait' ? route.metrics.waitingMinutes : route.metrics.transfers;
  const ranked = [...routes].sort((first, second) => {
    const firstScore = metric(first), secondScore = metric(second);
    return (firstScore === secondScore ? 0 : firstScore < secondScore ? -1 : 1) || first.metrics.totalMinutes - second.metrics.totalMinutes || first.id.localeCompare(second.id);
  });
  return ranked.map((route, index) => ({ ...route, reason: index > 0 ? 'Alternative mapped demo journey. Compare its fare, walking, and waiting before boarding.' :
    priority === 'cost' && route.metrics.fare === null ? 'No complete passenger-specific fare is available for these routes. A cheapest route cannot be established.' :
    `Recommended because this route has the ${priority === 'time' ? 'shortest estimated total journey time, including walking, waiting, and transfers' : priority === 'cost' ? 'lowest complete sample transportation fare for your passenger category' : priority === 'wait' ? 'shortest estimated queue and boarding wait' : 'fewest vehicle transfers; total time breaks ties'}.` }));
}

// Bounded simple-path enumeration: only directed, explicit graph edges are
// traversed. No node can be revisited. Bounds prevent runaway path generation.
// Ranking happens over complete connected journeys, never guessed connections.
export function analyzeRouteRecommendations(request: RouteRequest, reports: QueueReport[] = [], now = Date.now(), network: TransportNetwork = transportNetwork, advisories: RoadAdvisory[] = []) {
  const { originId, destinationId, passenger, priority } = request;
  if (originId === destinationId || !network.nodes.some(node => node.placeId === originId) || !network.nodes.some(node => node.placeId === destinationId)) return {routes:[] as RouteItinerary[],allRoutes:[] as RouteItinerary[],baselineRoutes:[] as RouteItinerary[]};
  const outgoing = new Map<string, TransportSegment[]>();
  const nodeIds = new Set(network.nodes.map(node=>node.id));
  for (const segment of network.segments) {
    if (!nodeIds.has(segment.from) || !nodeIds.has(segment.to) || ![segment.travelMinutes,segment.boardingWaitMinutes,segment.transferMinutes].every(value=>Number.isFinite(value) && value>=0)) continue;
    outgoing.set(segment.from, [...(outgoing.get(segment.from) || []), segment]);
  }
  const paths: TransportSegment[][] = [];
  const areaOf = (id:string)=>network.nodes.find(node=>node.id===id)?.areaId || id;
  const frontier = [{ node: originId, path: [] as TransportSegment[], seen: new Set([originId]), areas:new Set([areaOf(originId)]), rides: 0 }];
  let explored = 0;
  while (frontier.length && explored++ < 10000 && paths.length < 256) {
    const state = frontier.shift()!;
    if (state.node === destinationId) { paths.push(state.path); continue; }
    if (state.path.length >= 10) continue;
    for (const segment of outgoing.get(state.node) || []) {
      const rides = state.rides + (segment.mode === 'walk' ? 0 : 1);
      const nextArea=areaOf(segment.to);
      if (state.seen.has(segment.to) || rides > 3 || (state.areas.has(nextArea) && nextArea!==areaOf(state.node))) continue;
      frontier.push({ node: segment.to, path: [...state.path, segment], seen: new Set([...state.seen, segment.to]), areas:new Set([...state.areas,nextArea]), rides });
    }
  }
  const unique = new Map<string, RouteItinerary>();
  for (const path of paths) {
    const rides=path.filter(segment=>segment.mode!=='walk');
    const route=evaluatePath(path, originId, destinationId, passenger, reports, now);
    // Different walking approaches are distinct when one avoids a matched
    // advisory. Do not discard the usable approach before closure evaluation.
    const impactSignature=applyAdvisoryImpacts(route,advisories,now).advisoryImpacts?.map(impact=>impact.advisoryId).sort().join(',') || '';
    const signature = (rides.length?rides:path).map(segment => [segment.mode, segment.service, segment.from, segment.to].join(':')).join('|')+`#${impactSignature}`;
    if (!unique.has(signature) || route.metrics.totalMinutes<unique.get(signature)!.metrics.totalMinutes) unique.set(signature,route);
  }
  const baselineRoutes=rankRoutes([...unique.values()],priority);
  const allRoutes=baselineRoutes.map(route=>applyAdvisoryImpacts(route,advisories,now));
  return {routes:rankRoutes(allRoutes.filter(route=>!route.unavailable),priority).slice(0,3),allRoutes,baselineRoutes};
}

export function recommendRoutes(request:RouteRequest,reports:QueueReport[]=[],now=Date.now(),network:TransportNetwork=transportNetwork,advisories:RoadAdvisory[]=[]):RouteItinerary[]{
  return analyzeRouteRecommendations(request,reports,now,network,advisories).routes;
}
