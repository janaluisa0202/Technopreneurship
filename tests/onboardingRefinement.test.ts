import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { INTRODUCTION_KEY, completeIntroduction, hasCompletedIntroduction, introductionSlides } from '../src/apps/commuter/lib/onboarding';
import { swapJourneyLocations, selectPlace } from '../src/apps/commuter/lib/locations';
import { demoPlaces } from '../src/apps/commuter/data/locations';
import { recommendRoutes } from '../src/apps/commuter/lib/routeEngine';
import { translate } from '../src/shared/i18n/translate';
function store(initial:Record<string,string>={}){const data=new Map(Object.entries(initial));return {data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}

test('first run requires introduction and completed returning sessions bypass it',()=>{
  const storage=store();assert.equal(hasCompletedIntroduction(storage),false);assert.equal(completeIntroduction(storage),true);assert.equal(hasCompletedIntroduction(storage),true);assert.deepEqual(JSON.parse(storage.getItem(INTRODUCTION_KEY)!),{version:1,completed:true});
});
test('malformed or incompatible introduction flags cannot silently bypass first run',()=>{
  for(const value of ['invalid','null','true','{}','{"version":1,"completed":"true"}','{"version":2,"completed":true}'])assert.equal(hasCompletedIntroduction(store({[INTRODUCTION_KEY]:value})),false);
});
test('replaying or skipping completion writes only the introduction key',()=>{
  const storage=store({'sakaywise:settings:v1':'preferences','sakaywise-v3:savedTrips':'guides','sakaywise:support:v1':'messages'});completeIntroduction(storage);completeIntroduction(storage);assert.equal(storage.getItem('sakaywise:settings:v1'),'preferences');assert.equal(storage.getItem('sakaywise-v3:savedTrips'),'guides');assert.equal(storage.getItem('sakaywise:support:v1'),'messages');assert.equal(storage.data.size,4);
});
test('unavailable storage fails safely without claiming persisted completion',()=>{
  assert.equal(hasCompletedIntroduction({getItem:()=>{throw new Error('blocked');}}),false);assert.equal(completeIntroduction({setItem:()=>{throw new Error('quota');}}),false);
});
test('all four onboarding steps have distinct titles and bilingual descriptions',()=>{
  assert.equal(introductionSlides.length,4);assert.equal(new Set(introductionSlides.map(item=>item.title)).size,4);for(const slide of introductionSlides){assert.equal(translate('en',slide.title),slide.title);assert.notEqual(translate('fil',slide.title),slide.title);assert.notEqual(translate('fil',slide.description),slide.description);}assert.equal(translate('fil','Step {current} of {total}',{current:2,total:4}),'Hakbang 2 sa 4');
});
test('swapping exchanges entire location values, including optional details, without mutation',()=>{
  const from=selectPlace(demoPlaces[0]),to=selectPlace(demoPlaces[1]);from.details.notes='Near the safe crossing';to.details.landmark='Main gate';const original={from,to};const swapped=swapJourneyLocations(original);assert.equal(swapped.from,to);assert.equal(swapped.to,from);assert.equal(swapped.to!.details.notes,'Near the safe crossing');assert.equal(swapped.from!.details.landmark,'Main gate');assert.deepEqual(swapJourneyLocations(swapped),original);assert.equal(original.from,from);
});
test('swapping handles empty and partial endpoints without creating invented places',()=>{
  assert.deepEqual(swapJourneyLocations({from:null,to:null}),{from:null,to:null});const from=selectPlace(demoPlaces[0]);assert.deepEqual(swapJourneyLocations({from,to:null}),{from:null,to:from});
});
test('a reversed unsupported journey does not reuse the forward itinerary',()=>{
  const from=selectPlace(demoPlaces[0]),to=selectPlace(demoPlaces[1]);const first=recommendRoutes({originId:from.place.id,destinationId:to.place.id,passenger:'regular',priority:'time'},[],Date.now());assert.ok(first.length>0);const swapped=swapJourneyLocations({from,to});const reversed=recommendRoutes({originId:swapped.from!.place.id,destinationId:swapped.to!.place.id,passenger:'regular',priority:'time'},[],Date.now());assert.equal(reversed.length,0);
});
