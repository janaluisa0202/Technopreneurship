import { useRef } from 'react';
import { useI18n } from '../../../shared/i18n';
import { ApplicationPanel } from '../components/ApplicationPanel';
import { Icon } from '../components/Icon';
import { RouteDetails, fareText } from '../components/RouteDetails';
import type { RouteItinerary } from '../types/route';
import type { Passenger } from '../types';
export function MapOverview({route,onBack,onSave,onPassenger,onAdvisory,isSaved}:{route?:RouteItinerary;onBack:()=>void;onSave:(route:RouteItinerary)=>void;onPassenger:(passenger:Passenger)=>void;onAdvisory:(id:string)=>void;isSaved:boolean}){
  const {t,text,locale}=useI18n();const stepsRef=useRef<HTMLHeadingElement>(null);
  return <ApplicationPanel title="Journey map" onBack={onBack} returnFocus=".map-expand"><div className="application-panel-scroll map-overview">
    <div className="map-unavailable" role="status"><Icon name="mapFold" size={45}/><h3>{t('Map currently unavailable')}</h3><p>{t('This dataset has no verified coordinates or route geometry. No markers or transport paths are drawn.')}</p><p>{t('You can still follow the computed boarding guide below. No network map request is made.')}</p></div>
    {route?<><div className="card map-route-summary"><b>{text(route.name)}</b><span>{route.metrics.totalMinutes} {t('min')} · {text(fareText(route.metrics.fare,locale))}</span><button type="button" className="small-outline" onClick={()=>{stepsRef.current?.scrollIntoView({block:'start',behavior:'instant'});stepsRef.current?.focus({preventScroll:true});}}>{t('Open commute steps')}<Icon name="arrow" size={16}/></button></div><h3 ref={stepsRef} tabIndex={-1}>{t('Commute steps')}</h3><RouteDetails route={route} from={route.legs[0]?.segment.boarding || ''} to={route.legs.at(-1)?.segment.alighting || ''} onPassenger={onPassenger} onSave={()=>onSave(route)} isSaved={isSaved} onAdvisory={onAdvisory}/></>:<p className="empty-state">{t('Select a supported route to view commute steps.')}</p>}
  </div></ApplicationPanel>;
}
