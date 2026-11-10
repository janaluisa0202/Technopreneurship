import { useI18n } from '../../../shared/i18n';
import { Icon, type IconName } from './Icon';
import { peso } from '../lib/commute';
import { modeNames } from '../lib/routeEngine';
import { formatReportTime } from '../lib/queues';
import type { Passenger } from '../types';
import type { RouteItinerary, TransportMode } from '../types/route';

export const modeIcons: Record<TransportMode, IconName> = { walk:'walk', jeepney:'jeep', 'modern-jeepney':'jeep', uv:'van', bus:'bus', mrt:'train', lrt:'train', tricycle:'tricycle' };
export const fareText = (fare: number | null,locale='en-PH') => fare === null ? 'Fare unavailable' : peso(fare,locale);
export function RouteMetrics({route}: {route: RouteItinerary}) {
  const {t,text,locale}=useI18n();

  const metrics = route.metrics;
  return <dl className="journey-metrics">
    <div><dt>{t("Total duration")}</dt><dd>{metrics.totalMinutes} {t("min")}</dd></div>
    <div><dt>{t("Sample fare")}</dt><dd>{text(fareText(metrics.fare,locale))}</dd></div>
    <div><dt>{t("Queue + boarding")}</dt><dd>{metrics.waitingMinutes} {t("min")}</dd></div>
    <div><dt>{t("Transfers")}</dt><dd>{metrics.transfers}</dd></div>
    {!!metrics.advisoryDelayMinutes && <div><dt>{t("Additional advisory delay")}</dt><dd>{metrics.advisoryDelayMinutes} {t("min")}</dd></div>}
  </dl>;
}
interface Props {
  route: RouteItinerary;
  from: string;
  to: string;
  savedSnapshot?: boolean;
  savedAt?: string;
  onPassenger: (passenger: Passenger) => void;
  onSave: () => void;
  isSaved: boolean;
  onAdvisory?:(id:string)=>void;
}
export function RouteDetails({route,from,to,savedSnapshot,savedAt,onPassenger,onSave,isSaved,onAdvisory}:Props) {
  const {t,text,locale}=useI18n();

  return <div className="route-details">
    <p className="back-overline">{t("YOUR COMMUTE ·")}{' '}{savedSnapshot?t("SAVED DEMO SNAPSHOT"):t("ILLUSTRATIVE JOURNEY")}</p>
    <div className="detail-endpoints"><b>{from}</b><Icon name="arrow" size={16}/><b>{to}</b></div>
    <RouteMetrics route={route}/>
    {route.unavailable && <p className="rw-no-alternative">{savedSnapshot?t("Saved availability reflects the saved advisory snapshot."):t("This mapped journey is unavailable during the current confirmed / simulated advisory period.")}</p>}
    {!!route.advisoryImpacts?.length && <div className="rw-detail-impacts">{route.advisoryImpacts.map(impact=><div key={impact.advisoryId}><b>{text(impact.title)}</b><p>{text(impact.explanation)}</p>{onAdvisory && <button type="button" className="small-outline" onClick={()=>onAdvisory(impact.advisoryId)}>{t("View Advisory")}</button>}</div>)}</div>}
    <div className="address-input detail-passenger"><label htmlFor="detail-passenger">{t("Passenger category")}</label><select id="detail-passenger" value={route.passenger} onChange={event=>onPassenger(event.target.value as Passenger)}><option value="regular">{t("Regular")}</option><option value="student">{t("Student")}</option><option value="senior">{t("Senior Citizen")}</option><option value="pwd">{t("PWD")}</option></select></div>
    <p className="input-hint">{t("Passenger-specific sample entries only. No official fare matrix is connected.")}</p>
    {route.metrics.missingFares>0 && <p className="queue-warning"><Icon name="info" size={17}/>{route.metrics.missingFares} {t("transport leg(s) have no fare for this passenger category. Known subtotal:")}{' '}{peso(route.metrics.knownFare,locale)}{t("; total fare unavailable.")}</p>}
    <p className="route-reason">{savedSnapshot ? t("Saved walking and queue estimates are a snapshot, not current conditions.") : text(route.reason)}</p>
    <ol className="commute-timeline">
      {route.legs.map((leg,index)=><li className="commute-leg" key={leg.segment.id}>
        <div className="timeline-marker"><Icon name={modeIcons[leg.segment.mode]} size={18}/></div>
        <div className="leg-copy">
          <span className="back-overline">{t("STEP")}{' '}{index+1} · {leg.segment.mode==='walk'?t("WALK"):leg.transferMinutes>0?text('TRANSFER & RIDE'):text('RIDE')}</span>
          <h3>{text(leg.segment.service)}</h3><p>{text(leg.segment.instruction)}</p>
          <dl className="leg-locations"><div><dt>{leg.segment.mode==='walk'?t("From"):t("Board at")}</dt><dd>{text(leg.segment.boarding)}</dd></div><div><dt>{leg.segment.mode==='walk'?t("To"):t("Alight at")}</dt><dd>{text(leg.segment.alighting)}</dd></div></dl>
          {leg.segment.mode!=='walk' && <p className="leg-signboard"><b>{t("Signboard:")}</b> {leg.segment.signboard}</p>}
          <div className="leg-values"><span>{text(modeNames[leg.segment.mode])} · {leg.segment.travelMinutes} {t("min")}</span>{leg.segment.mode!=='walk' && <span>{text(fareText(leg.fare,locale))}</span>}</div>
          {leg.segment.mode!=='walk' && <>
            <p className="input-hint">{t("Queue")}{' '}{leg.queue.minutes} {t("min + boarding")}{' '}{leg.segment.boardingWaitMinutes} {t("min")}{text(leg.transferMinutes>0?` + transfer ${leg.transferMinutes} min`:'')}</p>
            <p className={`queue-detail ${leg.queue.source==='stale'?'is-stale':''}`}>{text(leg.queue.label)}{leg.queue.reportedAt && <> {t("· Last updated")}{' '}{text(formatReportTime(leg.queue.reportedAt,locale))}</>}</p>
          </>}
        </div>
      </li>)}
      <li className="commute-leg arrival-leg"><div className="timeline-marker"><Icon name="flag" size={18}/></div><div className="leg-copy"><span className="back-overline">{t('STEP')} {route.legs.length+1} · {t('ARRIVE')}</span><h3>{t('Arrive at your destination')}</h3><p>{to}</p><p className="input-hint">{t('End of the computed demo journey. Confirm safe access before traveling.')}</p></div></li>
    </ol>
    <p className="demo-note">{route.metrics.walkingMinutes} {t("min walking +")}{' '}{route.metrics.ridingMinutes} {t("min riding +")}{' '}{route.metrics.waitingMinutes} {t("min waiting +")}{' '}{route.metrics.transferMinutes} {t("min transfer time +")}{' '}{route.metrics.advisoryDelayMinutes || 0} {t("min additional advisory delay =")}{' '}{route.metrics.totalMinutes} {t("min. Waiting includes")}{' '}{route.metrics.queueMinutes} {t("min of queue estimates.")}</p>
    {savedSnapshot && <p className="demo-note">{t("Saved")}{' '}{savedAt ? new Date(savedAt).toLocaleString(locale) : t("on this device")}{t(". Fare totals above use the selected passenger category and the saved sample fare entries.")}</p>}
    <button type="button" className="submit" onClick={onSave}><Icon name="bookmark" size={17}/> {isSaved?t("Update saved trip"):t("Save Trip")}</button>
    <p className="demo-note">{t("All connections, stop instructions, times, queues, and fares are demo examples. Verify the actual service, safe walking access, and fare before traveling.")}</p>
  </div>;
}
