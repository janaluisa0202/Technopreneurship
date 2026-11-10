import { useI18n } from '../../../shared/i18n';
import type { RouteItinerary } from '../types/route';
import { Icon } from './Icon';
import { fareText, modeIcons } from './RouteDetails';
import { modeNames } from '../lib/routeEngine';
interface Props {route:RouteItinerary;recommended:boolean;selected:boolean;saved:boolean;onSelect:()=>void;onDetails:()=>void;onSave:()=>void;onAdvisory:(id:string)=>void;}
export function JourneyRouteCard({route,recommended,selected,saved,onSelect,onDetails,onSave,onAdvisory}:Props){
  const {t,text,locale}=useI18n();
  const rides=route.legs.filter(leg=>leg.segment.mode!=='walk');const modes=[...new Set(rides.map(leg=>leg.segment.mode))];
  const queue=route.legs.some(leg=>leg.queue.source==='community')?'Community report · Demo estimate':route.legs.some(leg=>leg.queue.source==='stale')?'Stale reports · Demo baseline':'Demo queue estimates';
  return <article className={`card recommendation-card ${selected?'is-selected':''} ${recommended?'is-recommended':'is-alternative'}`}>
    <button type="button" className="route-select" aria-pressed={selected} aria-label={text(`Select ${route.name}, ${route.metrics.totalMinutes} minutes`)} onClick={onSelect}>
      <span className="route-card-top"><span className={recommended?'route-rank':'route-alternative-label'}>{recommended?t('Recommended'):t('Alternative')}</span>{selected && <span className="route-selected-label"><Icon name="check" size={14}/>{t('Selected')}</span>}</span>
      <span className="route-card-modes">{modes.map(mode=><span key={mode}><Icon name={modeIcons[mode]} size={19}/>{text(modeNames[mode])}</span>)}</span>
      <span className="route-signboards"><span>{t('Signboard:')}</span> {rides.map(leg=>leg.segment.signboard).filter(Boolean).join(' → ') || text(route.name)}</span>
      <span className="route-eta-fare"><strong>{route.metrics.totalMinutes}<small> {t('min total')}</small></strong><b>{text(fareText(route.metrics.fare,locale))}</b></span>
      <span className="route-card-facts"><span><Icon name="clock" size={14}/>{route.metrics.waitingMinutes} {t('min waiting')}</span><span><Icon name="switch" size={14}/>{route.metrics.transfers} {route.metrics.transfers===1?t('transfer'):t('transfers')}</span><span><Icon name="walk" size={14}/>{route.metrics.walkingMinutes} {t('min walking')}</span></span>
    </button>
    {recommended?<><p className="route-reason">{text(route.reason)}</p><p className="queue-detail route-card-queue">{text(queue)}</p></>:<details className="alternative-reason"><summary>{t('Why this option?')}</summary><p>{text(route.reason)}</p><p>{text(queue)}</p></details>}
    {!!route.advisoryImpacts?.length && <div className="rw-card-impacts">{route.advisoryImpacts.map(impact=><button type="button" key={impact.advisoryId} onClick={()=>onAdvisory(impact.advisoryId)}><Icon name="warning" size={15}/><span>{text(impact.title)}{impact.appliedDelayMinutes>0?` · +${impact.appliedDelayMinutes} min`:''}</span></button>)}</div>}
    <div className="route-actions"><button type="button" className="text-btn" onClick={onDetails} aria-label={text(`View Route Details: ${route.name}`)} aria-haspopup="dialog">{t('Commute steps')}<Icon name="arrow" size={15}/></button><button type="button" className="text-btn secondary" onClick={onSave} aria-label={text(`Save trip: ${route.name}`)}><Icon name="bookmark" size={15}/>{saved?t('Update saved'):t('Save trip')}</button></div>
  </article>;
}
