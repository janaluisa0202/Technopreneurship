import { useI18n } from '../../../../shared/i18n';
import { Icon } from '../Icon';
import { advisoryState, formatAdvisoryTime } from '../../lib/roadwatchService';
import type { RoadAdvisory, RoadWatchDataStatus } from '../../types/roadwatch';
export function RoadWatchSummary({advisories,now,dataStatus,latestUpdate,label}:{advisories:RoadAdvisory[];now:number;dataStatus:RoadWatchDataStatus;latestUpdate?:string;label:string}){
  const {t,text,locale}=useI18n();

  const active=advisories.filter(item=>advisoryState(item,now).applicable).length;
  return <header className="rw-summary"><div className="rw-title"><span><Icon name="road" size={23}/></span><div><h1>{t("SakayWise RoadWatch")}</h1><p>{t("Know the road before you go.")}</p></div></div><div className="rw-summary-meta"><strong>{text(label)}</strong><span>{active} {t("active ·")}{' '}{advisories.length} {t("available")}</span></div><p>{dataStatus==='loading'?t("Loading available advisory data…"):dataStatus==='unavailable'?text('Advisory data is unavailable. Route conditions cannot be established.'):dataStatus==='outdated'?text('Available data is outdated. Operational effects are not applied.'):text(`Latest available update: ${latestUpdate?formatAdvisoryTime(latestUpdate,locale):'No advisory records'}`)}</p><p className="rw-source-notice">{t("Simulated local scenarios. No official feed or live road conditions are connected.")}</p></header>;
}
