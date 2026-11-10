import { useI18n } from '../../../../shared/i18n';
import { Icon } from '../Icon';
import { RouteMetrics } from '../RouteDetails';
import type { RouteItinerary } from '../../types/route';
import type { RoadAdvisory, RoadWatchDataStatus } from '../../types/roadwatch';
export const NO_ALTERNATIVE_MESSAGE='No verified alternative is available in the current route dataset. Please check the advisory before traveling.';
interface Props{advisories:RoadAdvisory[];dataStatus:RoadWatchDataStatus;reference?:RouteItinerary;alternative?:RouteItinerary;onAdvisory:(id:string)=>void;onAlternative:()=>void;onFeed:()=>void;}
export function RoadWatchBanner({advisories,dataStatus,reference,alternative,onAdvisory,onAlternative,onFeed}:Props){
  const {t,text}=useI18n();

  if(dataStatus!=='ready')return <div className="rw-quiet" role="status"><Icon name="info" size={16}/>{dataStatus==='loading'?t("Loading RoadWatch data…"):dataStatus==='outdated'?text('RoadWatch data is outdated; current conditions cannot be established.'):text('RoadWatch data is unavailable; current conditions cannot be established.')}</div>;
  if(!advisories.length)return <div className="rw-quiet"><Icon name="info" size={16}/>{t("No matching advisories in the available data.")}</div>;
  const impacts=reference?.advisoryImpacts || [];
  const first=impacts[0];
  return <section className="rw-route-banner" aria-label={t("RoadWatch route advisory")}><div className="rw-banner-heading"><Icon name="warning" size={19}/><div><h2>{t("RoadWatch Alert")}</h2><p>{advisories.length} {t("advisor")}{advisories.length===1?t("y"):t("ies")} {t("may affect your commute.")}</p></div></div><div className="rw-banner-actions"><button type="button" onClick={()=>onAdvisory(first?.advisoryId || advisories[0].id)}>{t("View Advisory")}</button><button type="button" onClick={alternative?onAlternative:onFeed}>{alternative?t("See Alternatives"):t("Open RoadWatch")}</button></div>
    {first && <details className="rw-selected-impact"><summary>{t("Travel Advisory Affecting Your Route")}</summary><p><b>{text(first.title)}</b></p><p>{t("Original route:")}{' '}{text(reference?.name)}</p><p>{text(reference?.unavailable?t("Unavailable in the current simulated / confirmed dataset."):first.explanation)}</p><p className="input-hint">{t("Affected:")}{' '}{text(reference?.legs.filter(leg=>first.segmentIds.includes(leg.segment.id)).map(leg=>leg.segment.service).join(' → '))}</p>
      {alternative?<><h3>{t("Suggested Alternative Route")}</h3><p>{text(alternative.name)}</p><RouteMetrics route={alternative}/><p className="input-hint">{t("Uses mapped connections outside this advisory’s affected segments. Times and fares are demo estimates.")}</p><button type="button" className="small-outline" onClick={onAlternative}>{t("Open alternative details")}</button></>:null}
    </details>}
    {first && alternative && <p className="rw-alternative-preview">{t("Suggested Alternative Route:")}{' '}{text(alternative.name)}</p>}
    {first && !alternative && <p className="rw-no-alternative">{text(NO_ALTERNATIVE_MESSAGE)}</p>}
  </section>;
}
