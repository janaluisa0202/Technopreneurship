import { useI18n } from '../../../../shared/i18n';
import { Icon } from '../Icon';
import { RouteMetrics } from '../RouteDetails';
import { transportNetwork } from '../../services/demoCatalog';
import { advisorySourceLabel, advisoryState, categoryLabels, formatAdvisoryTime, trustedSourceUrl } from '../../lib/roadwatchService';
import { NO_ALTERNATIVE_MESSAGE } from './RoadWatchBanner';
import type { AdvisoryTripContext, RoadAdvisory } from '../../types/roadwatch';
export function RoadWatchDetails({advisory,context,now,onAlternative}:{advisory:RoadAdvisory;context:AdvisoryTripContext;now:number;onAlternative:()=>void}){
  const {t,text,locale}=useI18n();

  const state=advisoryState(advisory,now),url=trustedSourceUrl(advisory);
  const affectedIds=new Set(context.affected.flatMap(route=>route.advisoryImpacts?.filter(impact=>impact.advisoryId===advisory.id).flatMap(impact=>impact.segmentIds) || []));
  const segments=transportNetwork.segments.filter(segment=>advisory.affectedSegmentIds.includes(segment.id) || (!!segment.serviceId && advisory.affectedServiceIds.includes(segment.serviceId)) || affectedIds.has(segment.id));
  const stops=transportNetwork.nodes.filter(node=>advisory.affectedStopIds.includes(node.id));
  return <div className="rw-details"><div className="rw-tags"><span>{text(categoryLabels[advisory.category])}</span><span className={`rw-severity severity-${advisory.severity}`}>{text(advisory.severity)}</span><span className={`rw-status status-${state.status}`}>{text(state.status)}</span></div><h3>{text(advisory.title)}</h3><p className="rw-area"><Icon name="map" size={16}/>{text(advisory.areaName)}</p><p>{text(advisory.description)}</p>
    {advisory.sourceType==='demo' && <p className="rw-simulation-note">{t("This advisory is simulated for prototype demonstration.")}</p>}
    <dl className="rw-detail-list"><div><dt>{t("Starts")}</dt><dd>{text(formatAdvisoryTime(advisory.startsAt,locale))}</dd></div><div><dt>{t("Expected end")}</dt><dd>{text(formatAdvisoryTime(advisory.endsAt,locale))}</dd></div><div><dt>{t("Published")}</dt><dd>{text(formatAdvisoryTime(advisory.publishedAt,locale))}</dd></div><div><dt>{t("Last updated")}</dt><dd>{text(formatAdvisoryTime(advisory.updatedAt,locale))}{state.stale?t(" · Outdated"):''}</dd></div><div><dt>{t("Source")}</dt><dd>{advisory.sourceName} · {text(advisorySourceLabel(advisory))}</dd></div><div><dt>{t("Verification")}</dt><dd>{text(advisory.verificationStatus)}</dd></div></dl>
    {url && <a className="rw-source-link" href={url} target="_blank" rel="noopener noreferrer">{t("View Official Source")}{' '}<Icon name="arrow" size={15}/></a>}
    <section className="rw-impact-section"><h4>{t("Possible commute impact")}</h4><p>{!state.applicable?text(`This advisory is ${state.stale?'outdated':state.status}; no current operational effect is applied.`):context.affected.length?text(context.affected[0].advisoryImpacts?.find(item=>item.advisoryId===advisory.id)?.explanation):text('No affected journey has been identified for your current selection. Select a mapped trip to check alternatives.')}</p>{advisory.suggestedAction && <p>{text(advisory.suggestedAction)}</p>}</section>
    <section className="rw-impact-section"><h4>{t("Affected mapped connections")}</h4>{segments.length||stops.length?<ul>{segments.map(segment=><li key={segment.id}>{text(segment.service)}<small>{text(segment.boarding)} → {text(segment.alighting)}</small></li>)}{stops.map(stop=><li key={stop.id}>{stop.name}</li>)}</ul>:<p>{t("No mapped stop or segment identifiers are available for this advisory.")}</p>}
      {context.affected.length>0 && <><h4>{t("Affected routes for your selected trip")}</h4><ul>{context.affected.map(route=><li key={route.id}>{text(route.name)}{route.unavailable?t(" · Unavailable"):''}</li>)}</ul></>}
    </section>
    {context.affected.length>0 && <section className="rw-impact-section"><h4>{t("Available alternative")}</h4>{context.alternative?<><p>{text(context.alternative.name)}</p><RouteMetrics route={context.alternative}/><button type="button" className="submit" onClick={onAlternative}>{t("Find Alternative Route")}{' '}<Icon name="arrow" size={16}/></button><p className="input-hint">{t("Mapped demo connections and estimates; verify actual service and conditions.")}</p></>:<p className="rw-no-alternative">{text(NO_ALTERNATIVE_MESSAGE)}</p>}</section>}
    <p className="demo-note">{t("Advisory severity does not establish road passability. No map marker is placed without reliable geometry; no commute map is connected in this version.")}</p>
  </div>;
}
