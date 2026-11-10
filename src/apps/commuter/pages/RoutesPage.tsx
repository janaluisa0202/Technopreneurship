import { useI18n } from '../../../shared/i18n';
import { Icon } from '../components/Icon';
import { RouteMetrics } from '../components/RouteDetails';
import { LocationSearchCard } from '../components/LocationSearchCard';
import { RoutePreferenceSelector } from '../components/RoutePreferenceSelector';
import { JourneyRouteCard } from '../components/JourneyRouteCard';
import { RouteMapPreview } from '../components/RouteMapPreview';
import { demoPlaces, popularJourneys } from '../services/demoCatalog';
import { RoadWatchBanner } from '../components/roadwatch/RoadWatchBanner';
import type { RoadAdvisory, RoadWatchDataStatus } from '../types/roadwatch';
import type { LocationField, Passenger, Priority, SavedTrip, SelectedLocation } from '../types';
import type { RouteItinerary } from '../types/route';

interface Props {
  onRetry:()=>void;
  roadwatch:{advisories:RoadAdvisory[];dataStatus:RoadWatchDataStatus;reference?:RouteItinerary;alternative?:RouteItinerary};
  onAdvisory:(id:string)=>void; onAlternative:()=>void; onRoadWatch:()=>void;
  from: SelectedLocation|null; to: SelectedLocation|null;
  passenger: Passenger; onPassenger: (value:Passenger)=>void;
  priority: Priority; onPriority: (value:Priority)=>void;
  routes: RouteItinerary[]; selectedRoute?: RouteItinerary;
  status: 'idle'|'loading'|'ready'|'error'; change: string;
  recent: SelectedLocation[]; saved: SavedTrip[]; watched: boolean;
  onPickLocation: (field:LocationField)=>void;
  onClearLocation:(field:LocationField)=>void; onSwap:()=>void; onMap:()=>void;
  onDestination: (id:string)=>void;
  onSample: (originId:string,destinationId:string)=>void;
  onSelectRoute: (route:RouteItinerary)=>void;
  onDetails: (route:RouteItinerary)=>void;
  onSave: (route:RouteItinerary)=>void;
  onFareGuard: ()=>void; onWatch: ()=>void;
}
export function RoutesPage({onRetry,roadwatch,onAdvisory,onAlternative,onRoadWatch,from,to,passenger,onPassenger,priority,onPriority,routes,selectedRoute,status,change,recent,saved,watched,onPickLocation,onClearLocation,onSwap,onMap,onDestination,onSample,onSelectRoute,onDetails,onSave,onFareGuard,onWatch}:Props) {
  const {t,text}=useI18n();

  const suggestedIds = [...recent.map(item=>item.place.id), ...saved.map(item=>item.route?.destinationId).filter((id):id is string=>!!id), ...popularJourneys.filter(pair=>pair.originId===from?.place.id).map(pair=>pair.destinationId), ...demoPlaces.map(place=>place.id)]
    .filter((id,index,list)=>id!==from?.place.id && list.indexOf(id)===index).slice(0,3);
  const suggestedPlaces = suggestedIds.map(id=>recent.find(item=>item.place.id===id)?.place || demoPlaces.find(place=>place.id===id)).filter(place=>!!place);
  return <div className="fade">
    <section className="card journey-form" aria-label={t('Plan your commute')}>
      <div className="journey-form-title"><h1>{t('Where are you headed?')}</h1><button type="button" className="swap-locations" disabled={!from && !to} onClick={onSwap} aria-label={t('Swap origin and destination')}><Icon name="switch" size={18}/><span>{t('Swap')}</span></button></div>
      <LocationSearchCard field="from" location={from} onEdit={()=>onPickLocation('from')} onClear={()=>onClearLocation('from')}/>
      <LocationSearchCard field="to" location={to} onEdit={()=>onPickLocation('to')} onClear={()=>onClearLocation('to')}/>
      <p className="automatic-search-note"><Icon name="spark" size={14}/>{t('Automatic route search')}</p>
    </section>
    <section className="card passenger-box"><label htmlFor="passenger">{t("Passenger type")}</label><select id="passenger" value={passenger} onChange={event=>onPassenger(event.target.value as Passenger)}><option value="regular">{t("Regular Passenger")}</option><option value="student">{t("Student")}</option><option value="senior">{t("Senior Citizen")}</option><option value="pwd">{t("PWD")}</option></select></section>

    <section className="recommendation-heading" aria-label={t('Route preferences')}><h2>{t('Recommended Routes')}</h2><RoutePreferenceSelector value={priority} onChange={onPriority}/></section>
    {status==='loading' && <div className="route-search-status card" role="status" aria-live="polite"><Icon name="compass" size={22}/>{t("Finding your best commute...")}</div>}
    {status==='error' && <button type="button" className="small-outline" onClick={onRetry}>{text("Retry route search")}</button>}
    {change && <p className="recommendation-change" role="status"><Icon name="info" size={17}/>{text(change)}</p>}
    {status==='ready' && routes.length>0 && <>
      <div className="option-list" aria-label={t('Recommended route')}><JourneyRouteCard route={routes[0]} recommended selected={routes[0].id===selectedRoute?.id} saved={saved.some(item=>item.route?.id===routes[0].id)} onSelect={()=>onSelectRoute(routes[0])} onDetails={()=>onDetails(routes[0])} onSave={()=>onSave(routes[0])} onAdvisory={onAdvisory}/></div>
      <RouteMapPreview onExpand={onMap} hasRoute={!!selectedRoute}/>
      <RoadWatchBanner {...roadwatch} onAdvisory={onAdvisory} onAlternative={onAlternative} onFeed={onRoadWatch}/>
      {routes.length>1 && <section className="alternatives-section" aria-label={t('Alternative routes')}><h2>{t('Alternative routes')}</h2><div className="option-list">{routes.slice(1).map(route=><JourneyRouteCard key={route.id} route={route} recommended={false} selected={route.id===selectedRoute?.id} saved={saved.some(item=>item.route?.id===route.id)} onSelect={()=>onSelectRoute(route)} onDetails={()=>onDetails(route)} onSave={()=>onSave(route)} onAdvisory={onAdvisory}/>)}</div></section>}
      {selectedRoute && <section className="selected-journey-summary card" aria-label={t("Selected journey")}><h2>{t("Your selected commute")}</h2><RouteMetrics route={selectedRoute}/><div className="feature-cta"><button type="button" onClick={onFareGuard}><Icon name="shield" size={16}/>{t("Check quoted fare")}</button><button type="button" onClick={onWatch}><Icon name="bell" size={16}/>{watched?t("Watching route"):t("Watch this route")}</button></div></section>}
    </>}
    {status!=='loading' && routes.length===0 && <RoadWatchBanner {...roadwatch} onAdvisory={onAdvisory} onAlternative={onAlternative} onFeed={onRoadWatch}/>}
    {(status==='idle' || status==='error' || (status==='ready' && routes.length===0)) && <>
      <div className="card no-route" role="status"><Icon name="route" size={30}/><h2>{status==='error'?t("Unable to calculate this sample journey."):roadwatch.reference?.unavailable?text('Mapped routes are unavailable for this period.'):from && to ? text("We haven't mapped a route for this trip yet.") : text('Choose an origin and destination')}</h2><p>{t("Your locations and address details stay saved. Only explicitly mapped demo connections can produce routes, fares, and travel estimates.")}</p><div className="route-actions"><button type="button" className="text-btn" onClick={()=>onPickLocation('from')}>{t("Change origin")}</button><button type="button" className="text-btn" onClick={()=>onPickLocation('to')}>{t("Change destination")}</button></div></div>
      <div className="eyebrow-row"><h2>{t("Try a mapped demo journey")}</h2></div><div className="suggestion-row">{popularJourneys.map(pair=><button key={`${pair.originId}:${pair.destinationId}`} type="button" onClick={()=>onSample(pair.originId,pair.destinationId)}>{demoPlaces.find(place=>place.id===pair.originId)?.name} → {demoPlaces.find(place=>place.id===pair.destinationId)?.name}</button>)}</div>
    </>}
    {from && <details className="destination-suggestions"><summary>{t('Recent, saved & popular destinations')}<Icon name="chevron" size={16}/></summary><div>{suggestedPlaces.map(place=><button type="button" key={place.id} onClick={()=>onDestination(place.id)} aria-pressed={to?.place.id===place.id}><Icon name="flag" size={14}/>{place.name}</button>)}</div></details>}
    <p className="demo-note">{t("All connections, signboards, fares, durations, walking instructions, and queues are illustrative. Community reports are local, unverified, and expire after 30 minutes. No live GPS, official fare feed, transit backend, or push service is connected.")}</p>
  </div>;
}
