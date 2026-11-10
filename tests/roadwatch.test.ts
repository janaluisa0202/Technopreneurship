import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createRoadWatchDemoData } from '../src/apps/commuter/data/roadwatchDemoData';
import { transportNetwork } from '../src/apps/commuter/data/transportNetwork';
import { advisoryTimestamp, advisoryState, isRoadAdvisory, defaultAdvisoryFilters, defaultRoadWatchPreferences, filterAdvisories, trustedSourceUrl, advisorySourceLabel, validatedAdvisories, ADVISORY_FRESHNESS_MS } from '../src/apps/commuter/lib/roadwatchService';
import { advisoryMatchesRoute, advisoryTripContext, applyAdvisoryImpacts } from '../src/apps/commuter/lib/advisoryImpact';
import { analyzeRouteRecommendations, recommendRoutes } from '../src/apps/commuter/lib/routeEngine';
import { personalAdvisoryMatches } from '../src/apps/commuter/lib/roadwatchPersonalization';
import type { RoadAdvisory } from '../src/apps/commuter/types/roadwatch';
import type { QueueReport, SavedTrip } from '../src/apps/commuter/types';
const now=Date.parse('2026-11-10T02:00:00Z');
const iso=(minutes:number)=>new Date(now+minutes*60000).toISOString();
const data=createRoadWatchDemoData(now);
const request={originId:'ust-frassati',destinationId:'sm-north',passenger:'regular' as const,priority:'time' as const};
const closure=data.find(item=>item.id==='rw-espanaclosure')!;
const traffic=data.find(item=>item.id==='rw-traffic')!;
const analyze=(advisories:RoadAdvisory[])=>analyzeRouteRecommendations(request,[],now,transportNetwork,advisories);

test('all presentation fixtures are deterministic, simulated, timestamp-valid, and geometry-free',()=>{
  for(const scenario of ['standard','clear','closure','no-alternative'] as const){
    const records=createRoadWatchDemoData(now,scenario);
    assert.deepEqual(records,createRoadWatchDemoData(now,scenario));
    for(const item of records){assert.ok(isRoadAdvisory(item));assert.equal(item.sourceType,'demo');assert.equal(item.verificationStatus,'simulated');assert.equal(item.sourceUrl,undefined);assert.equal(item.geometry,undefined);}
  }
});
test('invalid calendar dates, timestamp order, statuses and scheduled records without starts are rejected',()=>{
  for(const value of ['not-a-date','2026-02-30T02:00:00Z','2026-11-10T25:00:00Z','2026-13-01T02:00:00Z'])assert.equal(advisoryTimestamp(value),undefined);
  assert.equal(isRoadAdvisory({...closure,status:'made-up'}),false);
  assert.equal(isRoadAdvisory({...closure,publishedAt:iso(1),updatedAt:iso(-1)}),false);
  assert.equal(isRoadAdvisory({...closure,status:'scheduled',startsAt:undefined}),false);
  assert.equal(isRoadAdvisory({...closure,endsAt:closure.startsAt}),false);
});
test('scheduled effects apply exactly at start and stop at end',()=>{
  const item={...closure,status:'scheduled' as const,startsAt:iso(10),endsAt:iso(20)};
  assert.equal(advisoryState(item,now).status,'scheduled');assert.equal(advisoryState(item,now).applicable,false);
  assert.equal(advisoryState(item,now+10*60000).applicable,true);
  assert.equal(advisoryState(item,now+20*60000).status,'expired');
  assert.equal(advisoryState({...item,status:'active'},now).status,'scheduled');
});
test('resolved, expired, unknown, outdated, or future-updated records have no current operational effect',()=>{
  for(const item of [{...closure,status:'resolved' as const},{...closure,status:'expired' as const},{...closure,status:'unknown' as const},{...closure,endsAt:iso(-1)},{...closure,publishedAt:new Date(now-ADVISORY_FRESHNESS_MS-60000).toISOString(),updatedAt:new Date(now-ADVISORY_FRESHNESS_MS).toISOString()},{...closure,updatedAt:iso(1)}]){
    assert.equal(advisoryState(item,now).applicable,false);
    assert.equal(analyze([item]).routes.length,3);
  }
});
test('strict segment, stop, service and route IDs match; identical descriptive text alone does not',()=>{
  const route=recommendRoutes(request,[],now)[0];
  assert.ok(advisoryMatchesRoute({...closure,affectedSegmentIds:['ust-north-uv']},route));
  assert.ok(advisoryMatchesRoute({...closure,affectedSegmentIds:[],affectedStopIds:['ust-road']},route));
  assert.ok(advisoryMatchesRoute({...closure,affectedSegmentIds:[],affectedServiceIds:['srv:ust-north-uv']},route));
  assert.ok(advisoryMatchesRoute({...closure,affectedSegmentIds:[],affectedRouteIds:[route.id]},route));
  assert.equal(advisoryMatchesRoute({...closure,title:route.name,affectedSegmentIds:[]},route),false);
});
test('confirmed closure removes only matched journeys and returns an actual mapped alternative',()=>{
  const result=analyze([closure]);
  assert.equal(result.routes.length,2);assert.ok(result.routes.every(route=>!route.legs.some(leg=>leg.segment.id==='ust-north-jeep')));
  assert.ok(result.routes.some(route=>route.name==='UV Express'));assert.ok(result.routes.some(route=>route.name==='LRT + MRT'));
  const context=advisoryTripContext(closure,result.allRoutes,result.routes,now);
  assert.equal(context.affected.length,1);assert.ok(context.alternative);assert.ok(!advisoryMatchesRoute(closure,context.alternative!));
});
test('closure presentation routes through rail; no-alternative fixture retains affected journeys but returns none usable',()=>{
  const result=analyze(createRoadWatchDemoData(now,'closure'));
  assert.equal(result.routes.length,1);assert.equal(result.routes[0].name,'LRT + MRT');
  const allClosed=analyze(createRoadWatchDemoData(now,'no-alternative'));
  assert.ok(allClosed.baselineRoutes.length>0);assert.equal(allClosed.routes.length,0);assert.ok(allClosed.allRoutes.every(route=>route.unavailable));
});
test('confirmed service interruption targets only its service',()=>{
  const interruption=data.find(item=>item.id==='rw-service')!;
  const result=analyzeRouteRecommendations({...request,originId:'pasay-rotonda',destinationId:'sm-moa'},[],now,transportNetwork,[interruption]);
  assert.ok(result.allRoutes.some(route=>route.unavailable));
  assert.ok(result.routes.every(route=>!route.legs.some(leg=>leg.segment.serviceId==='srv:pasay-moa-bus')));
  assert.ok(result.routes.some(route=>route.name==='Modern Jeepney'));
});
test('critical severity or uncertain flooding alone never closes or delays a route',()=>{
  const flood=data.find(item=>item.id==='rw-flood-warning')!;
  const baseline=analyzeRouteRecommendations({...request,originId:'pasay-rotonda',destinationId:'sm-moa'},[],now);
  const result=analyzeRouteRecommendations({...request,originId:'pasay-rotonda',destinationId:'sm-moa'},[],now,transportNetwork,[flood]);
  assert.deepEqual(result.routes.map(route=>route.metrics),baseline.routes.map(route=>route.metrics));assert.ok(result.routes.every(route=>!route.unavailable));assert.ok(result.routes.some(route=>route.advisoryImpacts?.length));
});
test('unconfirmed or unverified closure remains a warning without blocking',()=>{
  for(const item of [{...closure,effectConfirmed:false},{...closure,sourceType:'community' as const,verificationStatus:'unverified' as const}]){
    const result=analyze([item]);assert.equal(result.routes.length,3);assert.ok(result.allRoutes.every(route=>!route.unavailable));
  }
});
test('grounded delay changes total duration once, without changing queue or boarding waiting',()=>{
  const route=recommendRoutes(request,[],now)[0];
  const delayed=applyAdvisoryImpacts(route,[traffic],now);
  assert.equal(delayed.metrics.totalMinutes,route.metrics.totalMinutes+3);assert.equal(delayed.metrics.advisoryDelayMinutes,3);assert.equal(delayed.metrics.waitingMinutes,route.metrics.waitingMinutes);
  assert.equal(applyAdvisoryImpacts(delayed,[traffic],now).metrics.totalMinutes,delayed.metrics.totalMinutes);
});
test('unsupported delays, queue overlap and missing evidence never invent extra minutes',()=>{
  const route=recommendRoutes(request,[],now)[0];
  for(const item of [{...traffic,estimatedDelayMinutes:undefined},{...traffic,delayEvidence:undefined},{...traffic,delayBasis:'queue-overlap' as const},{...traffic,delayBasis:'unknown' as const}])assert.equal(applyAdvisoryImpacts(route,[item],now).metrics.totalMinutes,route.metrics.totalMinutes);
});
test('duplicate records and related incident estimates cannot multiply the same delay',()=>{
  const route=recommendRoutes(request,[],now)[0];
  assert.equal(applyAdvisoryImpacts(route,[traffic,traffic],now).metrics.advisoryDelayMinutes,3);
  assert.equal(applyAdvisoryImpacts(route,[traffic,{...traffic,id:'related',estimatedDelayMinutes:5}],now).metrics.advisoryDelayMinutes,5);
  assert.equal(validatedAdvisories([traffic,{...traffic,updatedAt:iso(-1),estimatedDelayMinutes:4}])[0].estimatedDelayMinutes,4);
});
test('queue reports and an independent travel advisory remain separate metrics',()=>{
  const report:QueueReport={id:'queue',place:'UST España',where:'test',level:'high',estimate:'test',updated:'test',progress:89,isLocal:true,reportedAt:iso(0)};
  const baseline=recommendRoutes(request,[report],now).find(route=>route.name==='UV Express')!;
  const delayed=recommendRoutes(request,[report],now,transportNetwork,[traffic]).find(route=>route.name==='UV Express')!;
  assert.equal(delayed.metrics.totalMinutes,baseline.metrics.totalMinutes+3);assert.equal(delayed.metrics.waitingMinutes,32);assert.equal(delayed.metrics.advisoryDelayMinutes,3);
});
test('unrelated notices cannot alter metrics or rankings',()=>{
  const unrelated=data.find(item=>item.id==='rw-unrelated')!;
  assert.deepEqual(analyze([unrelated]).routes.map(route=>[route.id,route.metrics]),analyze([]).routes.map(route=>[route.id,route.metrics]));
});
test('search indexes mapped transportation labels and location names; category, status, severity and sorting work',()=>{
  assert.ok(filterAdvisories(data,{...defaultAdvisoryFilters,query:'LRT'},now).some(item=>item.id==='rw-expired'));
  assert.ok(filterAdvisories(data,{...defaultAdvisoryFilters,query:'paranaque'},now).some(item=>item.id==='rw-resolved'));
  assert.equal(filterAdvisories(data,{...defaultAdvisoryFilters,query:'no-such-road-987'},now).length,0);
  assert.ok(filterAdvisories(data,{...defaultAdvisoryFilters,category:'closure'},now).every(item=>item.category==='closure'));
  assert.equal(filterAdvisories(data,{...defaultAdvisoryFilters,severity:'critical'},now)[0].id,'rw-flood-warning');
  assert.ok(filterAdvisories(data,{...defaultAdvisoryFilters,status:'scheduled'},now).every(item=>advisoryState(item,now).status==='scheduled'));
  assert.equal(filterAdvisories(data,{...defaultAdvisoryFilters,sort:'severity'},now)[0].severity,'critical');
  assert.equal(filterAdvisories(data,{...defaultAdvisoryFilters,sort:'relevant'},now,new Set(['rw-traffic']))[0].id,'rw-traffic');
});
test('official source actions require HTTPS, verified official provenance and a trusted host',()=>{
  assert.equal(trustedSourceUrl(closure),undefined);assert.equal(advisorySourceLabel(closure),'Demo advisory');
  const official={...closure,sourceType:'official' as const,verificationStatus:'verified' as const,sourceName:'MMDA',sourceUrl:'https://mmda.gov.ph/'};
  assert.equal(trustedSourceUrl(official),'https://mmda.gov.ph/');
  for(const sourceUrl of ['javascript:alert(1)','https://mmda.gov.ph.evil.example/','http://mmda.gov.ph/','https://user:password@mmda.gov.ph/'])assert.equal(trustedSourceUrl({...official,sourceUrl}),undefined);
  assert.equal(trustedSourceUrl({...official,verificationStatus:'unverified'}),undefined);
});
test('personal highlights and badge obey category preferences without disabling routing effects',()=>{
  const matches=personalAdvisoryMatches(data,'ust-frassati:sm-north',[],defaultRoadWatchPreferences,'regular',[],now);
  assert.ok(matches.watchedIds.has(closure.id));assert.ok(matches.watchedIds.has(traffic.id));
  const filtered=personalAdvisoryMatches(data,'ust-frassati:sm-north',[],{...defaultRoadWatchPreferences,closure:false},'regular',[],now);
  assert.equal(filtered.watchedIds.has(closure.id),false);assert.equal(analyze([closure]).routes.length,2);
});
test('saved snapshot matching uses IDs, while old guides stay readable without invented exact matches',()=>{
  const route=recommendRoutes(request,[],now)[0];
  const guide:SavedTrip={key:'x',tripId:'ust-north',ix:0,from:'UST',to:'North',name:route.name,price:45,passenger:'regular',steps:[],savedAt:iso(0),route};
  const matches=personalAdvisoryMatches(data,null,[guide],defaultRoadWatchPreferences,'regular',[],now);
  assert.ok(matches.savedIds.has(traffic.id));assert.equal(matches.savedIds.has(closure.id),false);
  assert.equal(personalAdvisoryMatches(data,null,[{...guide,route:undefined}],defaultRoadWatchPreferences,'regular',[],now).badgeCount,0);
  assert.equal(personalAdvisoryMatches(data,null,[guide],{...defaultRoadWatchPreferences,savedTrips:false},'regular',[],now).badgeCount,0);
});
test('a closed walking approach does not hide a valid alternative approach to the same vehicle',()=>{
  const first=transportNetwork.segments.find(segment=>segment.id==='ust-road-walk')!;
  const detour={...first,id:'demo-detour',travelMinutes:9};
  const walkingClosure={...closure,affectedSegmentIds:['ust-road-walk']};
  const result=analyzeRouteRecommendations(request,[],now,{nodes:transportNetwork.nodes,segments:[...transportNetwork.segments,detour]},[walkingClosure]);
  assert.ok(result.routes.some(route=>route.legs.some(leg=>leg.segment.id==='demo-detour')));
  assert.ok(result.routes.every(route=>!route.legs.some(leg=>leg.segment.id==='ust-road-walk')));
});
