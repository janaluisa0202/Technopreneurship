import { createClientId } from '../src/apps/commuter/lib/clientId';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isPassenger,isWatch,isAlertPreferences,isSavedTrips,isQueueReports,isRouteSnapshot,readStoredValue,writeStoredValue } from '../src/apps/commuter/lib/storageValidation';
import { recommendRoutes } from '../src/apps/commuter/lib/routeEngine';
import { demoNetworkService,demoRouteInformationService,demoFareMatrixService,createDemoQueueService } from '../src/apps/commuter/services/demoServices';
import { queueReportTerminals } from '../src/apps/commuter/services/demoCatalog';
import { DataAccessError } from '../src/apps/commuter/services/contracts';
import type { QueueReport,SavedTrip } from '../src/apps/commuter/types';
const route=()=>recommendRoutes({originId:'ust-frassati',destinationId:'sm-north',passenger:'student',priority:'time'},[],Date.parse('2026-11-10T02:00:00Z'))[0];
const guide=():SavedTrip=>({key:'network:test',tripId:'ust-frassati:sm-north',ix:0,from:'UST Frassati (España)',to:'SM North EDSA / Annex',name:'Test guide',price:20,passenger:'student',steps:[['Board','Demo stop']],savedAt:'2026-11-10T02:00:00Z',route:route()});
test('all formerly unchecked commuter storage keys reject malformed types',()=>{
  for(const value of [null,{},[],17,true,'invalid']){assert.equal(isSavedTrips(value),Array.isArray(value));assert.equal(isQueueReports(value),Array.isArray(value));assert.equal(isAlertPreferences(value),false);assert.equal(isPassenger(value),false);}
  assert.ok(isAlertPreferences({route:true,queue:false,price:true}));assert.ok(isPassenger('pwd'));assert.ok(isWatch(null));assert.equal(isWatch({}),false);assert.equal(isWatch(''),false);
});
test('storage parsing safely falls back for broken JSON, null, shape errors and read exceptions',()=>{
  for(const raw of ['bad','null','{}','[{}]'])assert.deepEqual(readStoredValue({getItem:()=>raw},'savedTrips',[],isSavedTrips),[]);
  assert.equal(readStoredValue({getItem:()=>{throw new Error('blocked');}},'passenger','regular',isPassenger),'regular');
});
test('real computed and legacy guides survive validation while malformed snapshots cannot reach rendering',()=>{
  const saved=guide();assert.ok(isRouteSnapshot(saved.route));assert.ok(isSavedTrips([saved]));const legacy={...saved};delete legacy.route;assert.ok(isSavedTrips([legacy]));
  for(const change of [{legs:[{}]},{legs:null},{metrics:{fare:'bad'}},{advisoryImpacts:[{}]},{computedAt:'invalid'}])assert.equal(isSavedTrips([{...saved,route:{...saved.route,...change}}]),false);
});
test('invalid queue levels, progress or timestamps are rejected before affecting route arithmetic',()=>{
  const item:QueueReport={id:'test',place:'UST España',where:'Demo',level:'low',estimate:'Example',updated:'Example',progress:27,isLocal:true,reportedAt:'2026-11-10T02:00:00Z'};assert.ok(isQueueReports([item]));for(const change of [{level:'critical'},{progress:101},{progress:-1},{reportedAt:'not a date'}])assert.equal(isQueueReports([{...item,...change}]),false);
});
test('typed demo network and fare services use the same segment-specific entries and return copies',async()=>{
  const response=await demoNetworkService.getNetwork();assert.equal(response.provenance,'illustrative-demo');const fares=await demoFareMatrixService.getMatrices();for(const segment of response.data.segments)assert.deepEqual(fares.data.segmentFares[segment.id],segment.fares);response.data.segments[0].travelMinutes=999;assert.notEqual((await demoNetworkService.getNetwork()).data.segments[0].travelMinutes,999);assert.equal(fares.data.segmentFares['pasay-libertad-tricycle'].student,undefined);
});
test('route catalog resolves stable IDs, unknown services return empty and aborts do not return stale data',async()=>{
  const catalog=await demoRouteInformationService.getCatalog();assert.ok(catalog.data.places.some(place=>place.id==='ust-frassati'));assert.equal((await demoRouteInformationService.getRouteInformation('unknown')).data,null);const network=(await demoNetworkService.getNetwork()).data;const serviceId=network.segments.find(item=>item.serviceId)!.serviceId!;assert.ok((await demoRouteInformationService.getRouteInformation(serviceId)).data!.segments.length);const controller=new AbortController();controller.abort();await assert.rejects(()=>demoNetworkService.getNetwork({signal:controller.signal}));
});
test('queue adapter preserves every existing form choice, timestamping and idempotency without another store',async()=>{
  const reports:QueueReport[]=[];const service=createDemoQueueService({list:()=>reports,save:report=>reports.unshift(report)},()=>Date.parse('2026-11-10T02:00:00Z'));
  for(const terminal of queueReportTerminals){const saved=await service.submitReport({terminal,level:'high',requestId:terminal});assert.equal(saved.data.place,terminal);assert.equal(saved.data.reportedAt,'2026-11-10T02:00:00.000Z');assert.equal(saved.provenance,'illustrative-demo');}
  await service.submitReport({terminal:queueReportTerminals[0],level:'high',requestId:queueReportTerminals[0]});assert.equal(reports.length,queueReportTerminals.length);assert.ok((await service.getReports()).data.length>=reports.length);
});
test('queue adapter rejects unknown terminals and reports persistence failure instead of claiming success',async()=>{
  const service=createDemoQueueService({list:()=>[],save:()=>{throw new Error('quota');}});await assert.rejects(()=>service.submitReport({terminal:'imaginary',level:'low',requestId:'1'}),error=>error instanceof DataAccessError && error.code==='invalid-input');await assert.rejects(()=>service.submitReport({terminal:'UST España',level:'low',requestId:'2'}),error=>error instanceof DataAccessError && error.code==='storage');
});

test('persistence writes are namespaced and storage failures are surfaced without deleting unrelated data',()=>{
  const values=new Map([['sakaywise:settings:v1','KEEP']]);assert.equal(writeStoredValue({setItem:(key,value)=>{values.set(key,value);}},'passenger','student'),true);assert.equal(values.get('sakaywise-v3:passenger'),'"student"');assert.equal(values.get('sakaywise:settings:v1'),'KEEP');assert.equal(writeStoredValue({setItem:()=>{throw new Error('quota');}},'passenger','pwd'),false);assert.equal(isPassenger({toString:'not callable'}),false);
});

test('local IDs work without secure-context randomUUID using cryptographic random bytes',()=>{
  const source={getRandomValues:(bytes:Uint8Array)=>{bytes.fill(7);return bytes;}} as Pick<Crypto,'getRandomValues'>;assert.match(createClientId(source),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('native local UUID generation is retained when available',()=>{
  const source={randomUUID:()=> 'native-id',getRandomValues:()=>{throw new Error('should not be called');}} as unknown as Crypto;assert.equal(createClientId(source),'native-id');
});
