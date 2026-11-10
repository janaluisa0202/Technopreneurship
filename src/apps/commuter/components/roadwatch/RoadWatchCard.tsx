import { useI18n } from '../../../../shared/i18n';
import { Icon, type IconName } from '../Icon';
import { advisorySourceLabel, advisoryState, categoryLabels, formatAdvisoryTime } from '../../lib/roadwatchService';
import type { AdvisoryCategory, RoadAdvisory } from '../../types/roadwatch';

export const categoryIcons:Record<AdvisoryCategory,IconName>={traffic:'road',closure:'closure',flooding:'weather',transport:'bus',roadworks:'tools'};
export function RoadWatchCard({advisory,now,relevant,watched,saved,onDetails}:{advisory:RoadAdvisory;now:number;relevant?:boolean;watched?:boolean;saved?:boolean;onDetails:()=>void}){
  const {t,text,locale}=useI18n();

  const state=advisoryState(advisory,now);
  return <article className={`card roadwatch-card ${watched?'watched-advisory':''}`}>
    <div className="rw-card-top"><span className="rw-category"><Icon name={categoryIcons[advisory.category]} size={17}/>{text(categoryLabels[advisory.category])}</span><span className={`rw-severity severity-${advisory.severity}`}>{text(advisory.severity)}</span></div>
    <h3>{text(advisory.title)}</h3><p className="rw-area"><Icon name="map" size={14}/>{text(advisory.areaName)}</p><p className="rw-description">{text(advisory.description)}</p>
    <div className="rw-tags"><span className={`rw-status status-${state.status}`}>{text(state.status)}</span><span>{text(advisorySourceLabel(advisory))}</span>{state.stale && <span>{t("Update outdated")}</span>}</div>
    {watched && <p className="rw-match"><Icon name="bell" size={14}/>{t("Matches your watched route")}</p>}{saved && <p className="rw-match"><Icon name="bookmark" size={14}/>{t("Affects a saved trip")}</p>}{relevant && !watched && <p className="rw-match">{t("Matches your selected journey")}</p>}
    <div className="rw-card-footer"><span>{t("Updated")}{' '}{text(formatAdvisoryTime(advisory.updatedAt,locale))}</span><button type="button" className="small-outline" onClick={onDetails} aria-label={text(`View Details: ${advisory.title}`)} aria-haspopup="dialog">{t("View Details")}{' '}<Icon name="arrow" size={14}/></button></div>
  </article>;
}
