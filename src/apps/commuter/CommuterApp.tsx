import { createClientId } from './lib/clientId';
import { useEffect, useMemo, useState } from 'react';
import { MobileShell } from './components/MobileShell';
import { Sheets } from './components/Sheets';
import { LocationPicker } from './components/LocationPicker';
import { roadWatchDemoProvider } from './services/demoCatalog';
import { catalogPlaces as demoPlaces, getActiveCatalog, isLiveCatalog, popularJourneys } from './services/catalog';
import { requireSupabaseClient, serverErrorCode } from './services/supabase/client';
import { createRemoteQueueService, createRemoteRoadWatchProvider, QueueSubmitError } from './services/supabase/remoteServices';
import { useLiveQueues } from './hooks/useLiveQueues';
import { useRoadWatch } from './hooks/useRoadWatch';
import { applyAdvisoryImpacts, advisoryMatchesRoute, advisoryTripContext } from './lib/advisoryImpact';
import { defaultRoadWatchPreferences, isRoadWatchPreferences } from './lib/roadwatchService';
import { personalAdvisoryMatches } from './lib/roadwatchPersonalization';
import type { RoadWatchPreferences, RoadWatchScenario } from './types/roadwatch';
import { isPassenger, isQueueReports, isSavedTrips, isWatch, isAlertPreferences } from './lib/storageValidation';
import { useStoredState } from './hooks/useStoredState';
import { useRouteRecommendations } from './hooks/useRouteRecommendations';
import { createDemoQueueService } from './services/demoServices';
import { finalizeLocation, findDemoTrip, isJourneyLocations, isRecentLocations, swapJourneyLocations, samePlace, selectPlace } from './lib/locations';
import { evaluatePath, rankRoutes } from './lib/routeEngine';
import { repriceItinerary } from './lib/fares';
import { AlertsPage } from './pages/AlertsPage';
import { FareMatrixPage } from './pages/FareMatrixPage';
import { QueuesPage } from './pages/QueuesPage';
import { RoutesPage } from './pages/RoutesPage';
import { SettingsPage } from './pages/SettingsPage';
import { SupportCenter } from './pages/SupportCenter';
import { useCustomerUnread } from '../../shared/messaging/supportStore';
import type { AuthUser } from '../../shared/auth/types';
import { MapOverview } from './pages/MapOverview';
import { Introduction } from './components/onboarding/Introduction';
import { useIntroduction } from './hooks/useIntroduction';
import type { AlertPreferences, JourneyLocations, LocationField, Passenger, Priority, QueueLevel, QueueReport, SavedTrip, SelectedLocation, Sheet, Tab } from './types';
import type { RouteItinerary } from './types/route';

const fixtureParam=import.meta.env.DEV?new URLSearchParams(window.location.search).get('roadwatchDemo'):null;
const fixture:RoadWatchScenario=fixtureParam==='clear' || fixtureParam==='closure' || fixtureParam==='no-alternative'?fixtureParam:'standard';
const roadWatchProvider=roadWatchDemoProvider(fixture);

// Default journey = first popular pair of the ACTIVE catalog (demo: UST Frassati -> SM North, as before).
function initialJourney(): JourneyLocations {
  const pair=popularJourneys[0];
  const from=demoPlaces.find(place=>place.id===pair?.originId), to=demoPlaces.find(place=>place.id===pair?.destinationId);
  return { from: from?selectPlace(from):null, to: to?selectPlace(to):null };
}
const queueSubmitMessages:Record<string,string>={
  rate_limited:'You have sent several reports recently. Please wait a few minutes before reporting again.',
  duplicate_report:'You reported this terminal a moment ago. Please wait 3 minutes before reporting it again.',
  guest_session_unavailable:'Queue reporting is not available right now. Please try again later.',
};
function userFacingError(message:string){const error=new Error(message);error.name='UserFacingError';return error;}
export function CommuterApp({account,onSignOut}:{account:AuthUser;onSignOut:()=>void}) {
  const introduction=useIntroduction();
  // The shared browser support store is demo-only. Live mode uses the Supabase support adapter instead.
  const localSupportUnread=useCustomerUnread(account.id);
  const supportUnread=isLiveCatalog()?0:localSupportUnread;
  const [tab,setTab] = useState<Tab>('routes');
  // Live adapters exist only when CommuterDataGate installed a database snapshot.
  const [remote]=useState(()=>isLiveCatalog()?{queues:createRemoteQueueService(requireSupabaseClient()),roadwatch:createRemoteRoadWatchProvider(requireSupabaseClient())}:undefined);
  const liveQueues=useLiveQueues(remote?.queues);
  const [journey,setJourney,journeyStorageError] = useStoredState<JourneyLocations>('journeyLocations',initialJourney(),isJourneyLocations);
  const [recentLocations,setRecentLocations,recentLocationsStorageError] = useStoredState<SelectedLocation[]>('recentLocations',[],isRecentLocations);
  const [passenger,setPassenger,passengerStorageError] = useStoredState<Passenger>('passenger','regular',isPassenger);
  const [priority,setPriority] = useState<Priority>('time');
  const [selection,setSelection] = useState<{key:string;id:string}|null>(null);
  const [localReports,setLocalReports,reportsStorageError] = useStoredState<QueueReport[]>('localReports',[],isQueueReports);
  // Live mode: server aggregates only. Device-local demo reports are never uploaded or mixed in.
  const reports=remote?liveQueues.reports:localReports;
  const [saved,setSaved,savedStorageError] = useStoredState<SavedTrip[]>('savedTrips',[],isSavedTrips);
  const [watchedTrip,setWatchedTrip,watchedTripStorageError] = useStoredState<string|null>('watchedTrip',null,isWatch);
  const [preferences,setPreferences,preferencesStorageError] = useStoredState<AlertPreferences>('alertPrefs',{route:true,queue:true,price:false},isAlertPreferences);
  const [roadPreferences,setRoadPreferences,roadPreferencesStorageError]=useStoredState<RoadWatchPreferences>('roadwatchPrefs',defaultRoadWatchPreferences,isRoadWatchPreferences);
  const persistenceError=journeyStorageError || recentLocationsStorageError || passengerStorageError || reportsStorageError || savedStorageError || watchedTripStorageError || preferencesStorageError || roadPreferencesStorageError;
  const roadwatch=useRoadWatch(remote?.roadwatch ?? roadWatchProvider);
  const [sheet,setSheet] = useState<Sheet>(null);
  const [panel,setPanel]=useState<'settings'|'support'|'map'|null>(null);
  const [supportReturn,setSupportReturn]=useState<'settings'|null>(null);
  const [toast,setToast] = useState('');
  const recommendations = useRouteRecommendations(journey.from?.place.id,journey.to?.place.id,passenger,priority,reports,roadwatch.routingAdvisories,roadwatch.now);
  const selectionKey = JSON.stringify([journey.from?.place.id,journey.to?.place.id,priority]);
  const availableAll=useMemo(()=>rankRoutes(recommendations.allRoutes.filter(route=>!route.unavailable),priority),[recommendations.allRoutes,priority]);
  const currentRoute = availableAll.find(route=>selection?.key===selectionKey && route.id===selection.id) || recommendations.routes[0];
  const fareRoute = currentRoute || recommendations.previousRoutes.find(route=>selection?.key===selectionKey && route.id===selection.id) || recommendations.previousRoutes[0];
  const watchId = recommendations.baselineRoutes[0] ? `${recommendations.baselineRoutes[0].originId}:${recommendations.baselineRoutes[0].destinationId}` : null;
  const isWatched = watchId!==null && (watchedTrip===watchId || (!!watchedTrip && findDemoTrip(journey)?.id===watchedTrip));
  const visibleRoutes=currentRoute && !recommendations.routes.some(route=>route.id===currentRoute.id)?[...recommendations.routes.slice(0,2),currentRoute]:recommendations.routes;
  const reference=selection?.key===selectionKey?recommendations.allRoutes.find(route=>route.id===selection.id) || recommendations.allRoutes[0]:recommendations.allRoutes[0];
  const matchingIds=new Set(recommendations.allRoutes.flatMap(route=>route.advisoryImpacts?.map(impact=>impact.advisoryId) || []));
  const matchingAdvisories=roadwatch.advisories.filter(item=>matchingIds.has(item.id));
  const referenceIds=new Set(reference?.advisoryImpacts?.map(impact=>impact.advisoryId) || []);
  const alternative=availableAll.find(route=>referenceIds.size>0?!route.advisoryImpacts?.some(impact=>referenceIds.has(impact.advisoryId)):!route.advisoryImpacts?.length);
  const relevantIds=new Set(roadwatch.advisories.filter(item=>recommendations.baselineRoutes.some(route=>advisoryMatchesRoute(item,route))).map(item=>item.id));
  const personal=useMemo(()=>personalAdvisoryMatches(roadwatch.routingAdvisories,watchedTrip,saved,roadPreferences,passenger,reports,roadwatch.now),[roadwatch.routingAdvisories,watchedTrip,saved,roadPreferences,passenger,reports,roadwatch.now]);
  const contextFor=(id:string)=>{const advisory=roadwatch.advisories.find(item=>item.id===id);return advisory && roadwatch.dataStatus==='ready'?advisoryTripContext(advisory,recommendations.allRoutes,availableAll,roadwatch.now):{affected:[]};};
  const displaySheet = useMemo(()=>{
    if(sheet?.type==='location')return null;
    return sheet?.type==='route' ? {...sheet,route:{...applyAdvisoryImpacts(evaluatePath(sheet.route.legs.map(leg=>leg.segment),sheet.route.originId,sheet.route.destinationId,passenger,reports,Date.now()),roadwatch.routingAdvisories,roadwatch.now),reason:sheet.route.reason}} : sheet;
  },[sheet,passenger,reports,recommendations.now,roadwatch.routingAdvisories,roadwatch.now]);
  function openAlternative(id?:string){
    const route=id?contextFor(id).alternative:alternative;
    if(!route)return;
    setSelection({key:selectionKey,id:route.id});setTab('routes');setSheet({type:'route',route});
  }
  const openAdvisory=(id:string)=>setSheet({type:'advisory',id});


  useEffect(()=>{
    if (!toast) return;
    const timeout=window.setTimeout(()=>setToast(''),2800);
    return ()=>window.clearTimeout(timeout);
  },[toast]);
  useEffect(()=>{
    if (!sheet || sheet.type==='location') return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setSheet(null);};
    document.addEventListener('keydown',escape);
    return ()=>document.removeEventListener('keydown',escape);
  },[sheet]);

  const savedLocations=useMemo(()=>{
    const ids=saved.flatMap(guide=>guide.route?[guide.route.originId,guide.route.destinationId]:[]);
    return [...new Set(ids)].flatMap(id=>{const known=[journey.from,journey.to,...recentLocations].find(item=>item?.place.id===id);const place=demoPlaces.find(item=>item.id===id);return known?[known]:place?[selectPlace(place)]:[];}).slice(0,8);
  },[saved,journey,recentLocations]);
  function finishIntroduction(){introduction.finish();setPanel(null);setSheet(null);setTab('routes');}
  function swapLocations(){setJourney(swapJourneyLocations(journey));setSelection(null);setSheet(null);setToast('Locations swapped. Supported routes are recalculated.');}
  function rememberLocations(locations:SelectedLocation[]) {
    setRecentLocations(previous=>[...locations,...previous].filter((item,index,list)=>list.findIndex(candidate=>samePlace(candidate.place,item.place))===index).slice(0,8));
  }
  function chooseLocation(field:LocationField,value:SelectedLocation|null) {
    const confirmed=value?finalizeLocation(value):null;
    const other=journey[field==='from'?'to':'from'];
    if(confirmed && other && samePlace(confirmed.place,other.place)){setToast('Origin and destination must be different places.');return;}
    setJourney(previous=>({...previous,[field]:confirmed}));
    if(confirmed)rememberLocations([confirmed]);
    setSelection(null);setSheet(null);
    setToast(`${field==='from'?'Origin':'Destination'} ${confirmed?'saved on this device':'cleared'}.`);
  }
  function chooseDestination(id:string) {
    const place=demoPlaces.find(item=>item.id===id);
    const recent=recentLocations.find(item=>item.place.id===id);
    if(place || recent)chooseLocation('to',journey.to?.place.id===id?journey.to:recent || selectPlace(place!));
  }
  function chooseSample(originId:string,destinationId:string) {
    const from=demoPlaces.find(place=>place.id===originId);
    const to=demoPlaces.find(place=>place.id===destinationId);
    if(!from || !to)return;
    const next={from:journey.from?.place.id===originId?journey.from:selectPlace(from),to:journey.to?.place.id===destinationId?journey.to:selectPlace(to)};
    setJourney(next);rememberLocations([next.from,next.to]);setSelection(null);
  }
  function saveGuide(route:RouteItinerary) {
    const snapshot=repriceItinerary(route,passenger);
    const key=`network:${route.id}`;
    const guide:SavedTrip={key,tripId:`${route.originId}:${route.destinationId}`,ix:0,
      from:demoPlaces.find(place=>place.id===route.originId)?.name || route.legs[0].segment.boarding,
      to:demoPlaces.find(place=>place.id===route.destinationId)?.name || route.legs.at(-1)!.segment.alighting,
      name:route.name,price:snapshot.metrics.fare,passenger,route:snapshot,
      steps:route.legs.map(leg=>[leg.segment.instruction,`${leg.segment.boarding} → ${leg.segment.alighting}`]),savedAt:new Date().toISOString()};
    setSaved(previous=>[guide,...previous.filter(item=>item.key!==key)].slice(0,12));
    setToast('Demo commute guide saved on this device.');
  }
  async function submitReport(place:string,level:QueueLevel,details:string) {
    if(remote){
      try{
        const terminalId=getActiveCatalog().queueTerminalIds[place];
        if(!terminalId)throw new QueueSubmitError('unknown_terminal');
        await remote.queues.submit(terminalId,level,details,createClientId());
      }catch(cause){
        const code=cause instanceof QueueSubmitError?cause.code:serverErrorCode(cause);
        throw userFacingError(queueSubmitMessages[code] || 'Unable to send the queue report. Please retry.');
      }
      liveQueues.retry();
      setTab('queues');setSheet(null);setSelection(null);setToast('Report sent as unverified community information. It counts for 30 minutes.');
      return;
    }
    const service=createDemoQueueService({list:()=>localReports,save:report=>{if(!setLocalReports(previous=>[report,...previous].slice(0,15)))throw new Error('Storage unavailable');}});
    await service.submitReport({terminal:place,level,details,requestId:createClientId()});
    setTab('queues');setSheet(null);setSelection(null);setToast('Local community report saved. Estimates recalculated.');
  }
  function watchRoute() {
    if(!watchId)return;
    setWatchedTrip(watchId);setToast('Route watch saved. Push alerts are not active.');
  }
  function togglePreference(key:keyof AlertPreferences) {
    setPreferences(previous=>({...previous,[key]:!previous[key]}));setToast('Preference saved locally.');
  }
  return <MobileShell supportUnread={supportUnread} onSettings={()=>{setSheet(null);setPanel('settings');}} onSupport={()=>{setSheet(null);setSupportReturn(null);setPanel('support');}} alertCount={personal.badgeCount} tab={tab} onTab={setTab} toast={persistenceError?'':toast} notice={persistenceError?'Changes are available for this session only. Browser storage is unavailable.':introduction.storageError?'Introduction could not be saved on this device. It may appear again after reload.':undefined} overlayOpen={introduction.open || sheet!==null || panel!==null} savedCount={saved.length} onSaved={()=>setSheet({type:'saved'})}
    overlay={introduction.open?<Introduction onFinish={finishIntroduction} replaying={introduction.replaying} onClose={introduction.closeReplay}/>:panel==='settings'?<SettingsPage account={account} onSignOut={onSignOut} onIntroduction={()=>{setToast('');introduction.replay();}} onBack={()=>setPanel(null)} onSupport={()=>{setSupportReturn('settings');setPanel('support');}}/>:panel==='support'?<SupportCenter onBack={()=>setPanel(supportReturn)} returnFocus={supportReturn?'.settings-trigger':'.support-fab'}/>:panel==='map'?<MapOverview route={currentRoute} onBack={()=>setPanel(null)} onSave={saveGuide} onPassenger={setPassenger} onAdvisory={id=>{setPanel(null);openAdvisory(id);}} isSaved={saved.some(item=>item.route?.id===currentRoute?.id)}/>:sheet?.type==='location'?<LocationPicker key={sheet.field} field={sheet.field} current={journey[sheet.field]} other={journey[sheet.field==='from'?'to':'from']} recent={recentLocations} savedLocations={savedLocations} onClose={()=>setSheet(null)} onConfirm={location=>chooseLocation(sheet.field,location)}/>:
      <Sheets sheet={displaySheet} advisories={roadwatch.advisories} advisoryContext={sheet?.type==='advisory'?contextFor(sheet.id):{affected:[]}} now={roadwatch.now} onAdvisory={openAdvisory} onAlternative={openAlternative} saved={saved} passenger={passenger} onPassenger={setPassenger} onSaveRoute={saveGuide} onClose={()=>setSheet(null)} onSavedTrip={key=>setSheet({type:'saved-trip',key})} onRemoveSaved={key=>{setSaved(previous=>previous.filter(item=>item.key!==key));setToast('Saved guide removed.');}} onSavedList={()=>setSheet({type:'saved'})} onReport={submitReport} liveReports={!!remote}/> }>
    {tab==='routes' && <RoutesPage onRetry={recommendations.retry} roadwatch={{advisories:matchingAdvisories,dataStatus:roadwatch.dataStatus,reference,alternative}} onAdvisory={openAdvisory} onAlternative={()=>openAlternative()} onRoadWatch={()=>setTab('alerts')} from={journey.from} to={journey.to} passenger={passenger} onPassenger={setPassenger} priority={priority} onPriority={value=>{setPriority(value);setSelection(null);}} routes={visibleRoutes} selectedRoute={currentRoute} status={recommendations.status} change={recommendations.change} recent={recentLocations} saved={saved} watched={isWatched} onSwap={swapLocations} onClearLocation={field=>chooseLocation(field,null)} onMap={()=>setPanel('map')} onPickLocation={field=>{setToast('');setSheet({type:'location',field});}} onDestination={chooseDestination} onSample={chooseSample} onSelectRoute={route=>setSelection({key:selectionKey,id:route.id})} onDetails={route=>{setSelection({key:selectionKey,id:route.id});setSheet({type:'route',route});}} onSave={saveGuide} onFareGuard={()=>setTab('fares')} onWatch={watchRoute}/>}
    {tab==='fares' && <FareMatrixPage passenger={passenger} onPassenger={setPassenger} route={fareRoute}/>}
    {tab==='queues' && <QueuesPage reports={reports} now={recommendations.now} onReport={()=>setSheet({type:'report'})} live={remote?{noReport:liveQueues.noReport,status:liveQueues.status,onRetry:liveQueues.retry}:undefined}/>}
    {tab==='alerts' && <AlertsPage onRetry={roadwatch.retry} advisories={roadwatch.advisories} now={roadwatch.now} dataStatus={roadwatch.dataStatus} latestUpdate={roadwatch.latestUpdate} sourceLabel={roadwatch.label} relevantIds={relevantIds} watchedIds={personal.watchedIds} savedIds={personal.savedIds} roadPreferences={roadPreferences} onRoadPreference={key=>{setRoadPreferences(previous=>({...previous,[key]:!previous[key]}));setToast('RoadWatch preference saved locally.');}} onAdvisory={openAdvisory} onWatch={watchRoute} canWatch={!!watchId} watchCurrent={isWatched} watchedTrip={watchedTrip} preferences={preferences} onToggle={togglePreference} onStopWatch={()=>{setWatchedTrip(null);setToast('Route watch removed.');}} onGoRoutes={()=>setTab('routes')}/>}
  </MobileShell>;
}
