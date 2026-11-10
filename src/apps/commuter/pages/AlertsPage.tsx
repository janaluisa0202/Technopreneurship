import { useI18n } from '../../../shared/i18n';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { RoadWatchCard } from '../components/roadwatch/RoadWatchCard';
import { RoadWatchFilters } from '../components/roadwatch/RoadWatchFilters';
import { RoadWatchSummary } from '../components/roadwatch/RoadWatchSummary';
import { catalogPlaces, legacyTrips } from '../services/catalog';
import { defaultAdvisoryFilters, filterAdvisories } from '../lib/roadwatchService';
import type { AlertPreferences } from '../types';
import type { RoadAdvisory, RoadWatchDataStatus, RoadWatchPreferences } from '../types/roadwatch';

interface Props {
  onRetry:()=>void;
  watchedTrip:string|null; preferences:AlertPreferences;
  onToggle:(key:keyof AlertPreferences)=>void; onStopWatch:()=>void; onGoRoutes:()=>void;
  advisories:RoadAdvisory[]; now:number; dataStatus:RoadWatchDataStatus; latestUpdate?:string; sourceLabel:string;
  relevantIds:Set<string>; watchedIds:Set<string>; savedIds:Set<string>;
  roadPreferences:RoadWatchPreferences; onRoadPreference:(key:keyof RoadWatchPreferences)=>void;
  onAdvisory:(id:string)=>void; onWatch:()=>void; canWatch:boolean; watchCurrent:boolean;
}
const oldSettings:{key:keyof AlertPreferences;title:string;description:string}[]=[
  {key:'route',title:'Route disruptions',description:'Route diversions and service changes'},
  {key:'queue',title:'Terminal queues',description:'Queue report changes near your journey'},
  {key:'price',title:'Fare announcements',description:'Fare schedule changes and discount reminders'},
];
const roadSettings:{key:keyof RoadWatchPreferences;title:string;description:string}[]=[
  {key:'closure',title:'Road closures',description:'Closures and restricted access notices'},
  {key:'traffic',title:'Traffic disruptions',description:'Congestion and supported delay estimates'},
  {key:'flooding',title:'Flooding',description:'Weather and uncertain road access warnings'},
  {key:'transport',title:'Public transport interruptions',description:'Mapped service and terminal advisories'},
  {key:'roadworks',title:'Roadworks',description:'Scheduled construction and maintenance'},
  {key:'savedTrips',title:'Advisories affecting saved trips',description:'Match active notices to locally saved guides'},
];
export function AlertsPage(props:Props){
  const {t,text}=useI18n();

  const {onRetry,watchedTrip,preferences,onToggle,onStopWatch,onGoRoutes,advisories,now,dataStatus,latestUpdate,sourceLabel,relevantIds,watchedIds,savedIds,roadPreferences,onRoadPreference,onAdvisory,onWatch,canWatch,watchCurrent}=props;
  const [section,setSection]=useState<'roadwatch'|'my-alerts'>('roadwatch');
  const [filters,setFilters]=useState(defaultAdvisoryFilters);
  const filtered=useMemo(()=>filterAdvisories(advisories,filters,now,relevantIds),[advisories,filters,now,relevantIds]);
  const [originId,destinationId]=(watchedTrip || '').split(':');
  const origin=catalogPlaces.find(place=>place.id===originId),destination=catalogPlaces.find(place=>place.id===destinationId);
  const trip=origin && destination?{from:origin.name,to:destination.name}:legacyTrips.find(item=>item.id===watchedTrip);
  const myAdvisories=advisories.filter(item=>watchedIds.has(item.id) || savedIds.has(item.id));
  return <div className="fade">
    {(dataStatus==='unavailable' || dataStatus==='outdated') && <button type="button" className="small-outline" onClick={onRetry}>{text("Retry advisory data")}</button>}
    <div className="segment rw-section-tabs" role="group" aria-label={t("Para Alerts sections")}><button type="button" className={section==='roadwatch'?'on':''} aria-pressed={section==='roadwatch'} onClick={()=>setSection('roadwatch')}>{t("RoadWatch")}</button><button type="button" aria-label={text(`My Alerts${myAdvisories.length?`, ${myAdvisories.length} matching advisories`:''}`)} className={section==='my-alerts'?'on':''} aria-pressed={section==='my-alerts'} onClick={()=>setSection('my-alerts')}>{t("My Alerts")}{myAdvisories.length>0 && <span className="rw-inline-count" aria-hidden="true">{myAdvisories.length}</span>}</button></div>
    {section==='roadwatch'?<>
      <RoadWatchSummary advisories={advisories} now={now} dataStatus={dataStatus} latestUpdate={latestUpdate} label={sourceLabel}/>
      <RoadWatchFilters filters={filters} onChange={setFilters} onReset={()=>setFilters({...defaultAdvisoryFilters})}/>
      <p className="rw-result-count" role="status">{filtered.length} {t("advisor")}{filtered.length===1?t("y"):t("ies")} {t("match your filters.")}</p>
      {!filtered.length && <div className="card rw-empty"><Icon name="search" size={26}/><h2>{t("No matching advisories")}</h2><p>{t("Try another road, terminal, transport type, or filter. A lack of reports does not establish that roads are clear.")}</p><button type="button" className="small-outline" onClick={()=>setFilters({...defaultAdvisoryFilters})}>{t("Reset advisory filters")}</button></div>}
      {filtered.map(advisory=><RoadWatchCard key={advisory.id} advisory={advisory} now={now} relevant={relevantIds.has(advisory.id)} watched={watchedIds.has(advisory.id)} saved={savedIds.has(advisory.id)} onDetails={()=>onAdvisory(advisory.id)}/>)}
    </>:<>
      <header className="section-head"><span className="back-overline">{t("PARA ALERTS · MY ALERTS")}</span><h1>{t("Your commute, on watch.")}</h1><p>{t("Guest preferences are stored on this device. Matches are shown while the app is open; background push notifications are not active.")}</p></header>
      <section className="card section-card"><h2 className="card-title">{t("Watched journey")}</h2>{trip?<><div className="watched"><b>{trip.from}</b><Icon name="arrow" size={15}/><b>{trip.to}</b></div><button type="button" className="small-outline" onClick={onStopWatch}>{t("Stop watching route")}</button></>:<p className="card-desc">{t("Choose a mapped journey in Routes, then watch its advisory matches.")}</p>}<button type="button" className="small-outline" disabled={!canWatch} aria-pressed={watchCurrent} onClick={watchCurrent?onStopWatch:onWatch}><Icon name="bell" size={15}/>{t("Watch My Route")}</button><button type="button" className="small-outline" onClick={onGoRoutes}>{t("Go to Routes")}</button>{!canWatch && <p className="input-hint">{t("Select a mapped origin and destination to watch a journey.")}</p>}</section>
      <section className="card section-card"><h2 className="card-title">{t("RoadWatch preferences")}</h2><p className="card-desc">{t("These control personal highlights and the Para Alerts badge. Route closures and grounded impacts still apply to routing.")}</p>{roadSettings.map(item=><div className="toggle-row" key={item.key}><div>{text(item.title)}<small>{text(item.description)}</small></div><button type="button" role="switch" aria-label={text(item.title)} aria-checked={roadPreferences[item.key]} className={`toggle ${roadPreferences[item.key]?'on':''}`} onClick={()=>onRoadPreference(item.key)}/></div>)}</section>
      <section className="card section-card"><h2 className="card-title">{t("Existing alert preferences")}</h2><p className="card-desc">{t("Retained for future notification integration. Phone notifications are not active.")}</p>{oldSettings.map(item=><div className="toggle-row" key={item.key}><div>{text(item.title)}<small>{text(item.description)}</small></div><button type="button" role="switch" aria-label={text(item.title)} aria-checked={preferences[item.key]} className={`toggle ${preferences[item.key]?'on':''}`} onClick={()=>onToggle(item.key)}/></div>)}</section>
      <div className="eyebrow-row"><h2>{t("Matching advisories")}</h2><span>{myAdvisories.length} {t("available matches")}</span></div>{!myAdvisories.length && <p className="rw-quiet">{t("No current advisory matches your watched or saved journeys and selected categories. Available data does not establish road safety.")}</p>}{myAdvisories.map(advisory=><RoadWatchCard key={advisory.id} advisory={advisory} now={now} watched={watchedIds.has(advisory.id)} saved={savedIds.has(advisory.id)} onDetails={()=>onAdvisory(advisory.id)}/>)}
    </>}
  </div>;
}
