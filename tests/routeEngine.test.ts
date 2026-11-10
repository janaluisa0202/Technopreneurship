import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { transportNetwork, popularJourneys } from '../src/apps/commuter/data/transportNetwork';
import { recommendRoutes, evaluatePath } from '../src/apps/commuter/lib/routeEngine';
import { fareForPassenger, repriceItinerary, sampleDistanceFare } from '../src/apps/commuter/lib/fares';
import { QUEUE_REPORT_TTL_MS, queueForSegment } from '../src/apps/commuter/lib/queues';
import type { QueueReport } from '../src/apps/commuter/types';
import type { TransportNetwork } from '../src/apps/commuter/types/route';

const now=Date.parse('2026-11-10T02:00:00Z');
const request={originId:'ust-frassati',destinationId:'sm-north',passenger:'regular' as const,priority:'time' as const};
const report=(place:string,level:QueueReport['level'],reportedAt=new Date(now).toISOString(),segmentId?:string):QueueReport=>({id:'test',place,level,reportedAt,segmentId,isLocal:true,where:'test',estimate:'test',updated:'test',progress:20});

test('all published demo pairs contain a recommendation and at least two alternative itineraries',()=>{
  for(const pair of popularJourneys){
    const routes=recommendRoutes({...request,...pair},[],now);
    assert.ok(routes.length>=3,`${pair.originId} -> ${pair.destinationId}`);
    assert.equal(new Set(routes.map(route=>route.id)).size,routes.length);
    for(const route of routes){
      assert.equal(route.legs[0].segment.from,pair.originId);
      assert.equal(route.legs.at(-1)!.segment.to,pair.destinationId);
      for(let ix=1;ix<route.legs.length;ix++)assert.equal(route.legs[ix-1].segment.to,route.legs[ix].segment.from);
    }
  }
});
test('fastest, cheapest, waiting and transfer rankings use the corresponding complete metrics',()=>{
  for(const priority of ['time','cost','wait','transfers'] as const){
    const routes=recommendRoutes({...request,priority},[],now);
    const values=routes.map(route=>priority==='time'?route.metrics.totalMinutes:priority==='cost'?route.metrics.fare??Infinity:priority==='wait'?route.metrics.waitingMinutes:route.metrics.transfers);
    assert.deepEqual(values,[...values].sort((a,b)=>a-b));
    assert.ok(routes[0].reason.startsWith('Recommended because'));
  }
  assert.equal(recommendRoutes(request,[],now)[0].name,'UV Express');
  assert.equal(recommendRoutes({...request,priority:'cost'},[],now)[0].name,'Jeepney');
});
test('duration, waiting, transfers, and fares are added once in consistent units',()=>{
  const route=recommendRoutes(request,[],now).find(route=>route.name==='LRT + MRT')!;
  assert.deepEqual(route.metrics,{advisoryDelayMinutes:0,walkingMinutes:25,ridingMinutes:22,queueMinutes:5,boardingWaitMinutes:2,waitingMinutes:7,transferMinutes:3,totalMinutes:57,transfers:1,fare:45,knownFare:45,missingFares:0});
  assert.equal(route.legs.filter(leg=>leg.transferMinutes>0).length,1);
});
test('a heavy matching terminal report changes the fastest route, unrelated terminal reports do not',()=>{
  const baseline=recommendRoutes(request,[],now);
  const heavy=recommendRoutes(request,[report('UST España','high')],now);
  assert.equal(heavy[0].name,'LRT + MRT');
  const unaffected=recommendRoutes(request,[report('PITX','high')],now);
  assert.deepEqual(unaffected.map(route=>route.metrics),baseline.map(route=>route.metrics));
  const scoped=recommendRoutes(request,[report('UST España','high',undefined,'ust-north-jeep')],now);
  assert.equal(scoped.find(route=>route.name==='UV Express')!.metrics.totalMinutes,41);
  assert.ok(scoped.find(route=>route.name==='Jeepney')!.metrics.totalMinutes>44);
});
test('old, untimestamped, or future reports never appear as current queue information',()=>{
  const segment=transportNetwork.segments.find(segment=>segment.id==='ust-north-uv')!;
  for(const timestamp of [new Date(now-QUEUE_REPORT_TTL_MS).toISOString(),'',new Date(now+1000).toISOString()]){
    const queue=queueForSegment(segment,[report('UST España','high',timestamp)],now);
    assert.equal(queue.source,'stale'); assert.equal(queue.minutes,8);
  }
  assert.equal(queueForSegment(segment,[],now).source,'sample');
});
test('passenger tables price each leg, and a missing tricycle fare keeps the total unavailable',()=>{
  const routes=recommendRoutes({...request,originId:'pasay-rotonda',destinationId:'sm-moa'},[],now);
  const tricycle=routes.find(route=>route.legs.some(leg=>leg.segment.mode==='tricycle'))!;
  assert.equal(tricycle.metrics.fare,44);
  const student=repriceItinerary(tricycle,'student');
  assert.equal(student.metrics.fare,null);assert.equal(student.metrics.knownFare,11);assert.equal(student.metrics.missingFares,1);
  assert.equal(fareForPassenger({regular:30},'student'),null);
  assert.equal(sampleDistanceFare('uv',6,'student'),17.8);
});
test('changing passenger can change cheapest ranking without a universal discount',()=>{
  const segments=transportNetwork.segments.filter(segment=>['ust-road-walk','ust-north-jeep','ust-north-uv','north-jeep-entry','north-uv-entry'].includes(segment.id)).map(segment=>segment.id==='ust-north-uv'?{...segment,fares:{regular:45,student:15}}:segment);
  const network={nodes:transportNetwork.nodes,segments};
  assert.equal(recommendRoutes({...request,priority:'cost'},[],now,network)[0].name,'Jeepney');
  assert.equal(recommendRoutes({...request,priority:'cost',passenger:'student'},[],now,network)[0].name,'UV Express');
});
test('unknown locations, unsupported reverse directions and same-place trips produce no invented result',()=>{
  for(const pair of [{originId:'manual:home',destinationId:'sm-north'},{originId:'sm-north',destinationId:'ust-frassati'},{originId:'ust-frassati',destinationId:'ust-frassati'},{originId:'gateway-cubao',destinationId:'sm-north'}])assert.deepEqual(recommendRoutes({...request,...pair},[],now),[]);
});
test('paths cannot revisit a node or re-enter an earlier geographic area',()=>{
  for(const pair of popularJourneys)for(const route of recommendRoutes({...request,...pair},[],now)){
    const nodes=[route.originId,...route.legs.map(leg=>leg.segment.to)];
    assert.equal(new Set(nodes).size,nodes.length);
    const areas=nodes.map(id=>transportNetwork.nodes.find(node=>node.id===id)!.areaId || id).filter((id,index,list)=>index===0 || id!==list[index-1]);
    assert.equal(new Set(areas).size,areas.length);
  }
});
test('equivalent rides deduplicate, choosing the shorter walking approach',()=>{
  const first=transportNetwork.segments.find(segment=>segment.id==='ust-road-walk')!;
  const network:TransportNetwork={nodes:transportNetwork.nodes,segments:[{...first,id:'slow-walk',travelMinutes:20},...transportNetwork.segments]};
  const routes=recommendRoutes(request,[],now,network);
  assert.equal(routes.filter(route=>route.name==='UV Express').length,1);
  assert.equal(routes.find(route=>route.name==='UV Express')!.metrics.totalMinutes,41);
});
test('invalid or disconnected segment definitions are not traversed',()=>{
  const segment=transportNetwork.segments.find(segment=>segment.id==='ust-north-uv')!;
  const network={nodes:transportNetwork.nodes,segments:[{...segment,from:'ust-frassati',to:'sm-north',travelMinutes:NaN},{...segment,from:'missing-node',to:'sm-north'}]};
  assert.deepEqual(recommendRoutes(request,[],now,network),[]);
});
test('saved itinerary snapshots reprice consistently after JSON restoration',()=>{
  const route=recommendRoutes(request,[],now)[0];
  const restored=JSON.parse(JSON.stringify(route)) as typeof route;
  assert.equal(repriceItinerary(restored,'student').metrics.fare,34);
  const recomputed=evaluatePath(restored.legs.map(leg=>leg.segment),restored.originId,restored.destinationId,'student',[],now);
  assert.equal(recomputed.metrics.fare,repriceItinerary(restored,'student').metrics.fare);
});
