import { useI18n } from '../../../../shared/i18n';
import { Icon } from '../Icon';
import { categoryLabels } from '../../lib/roadwatchService';
import type { AdvisoryCategory, AdvisoryFilters } from '../../types/roadwatch';
export function RoadWatchFilters({filters,onChange,onReset}:{filters:AdvisoryFilters;onChange:(next:AdvisoryFilters)=>void;onReset:()=>void}){
  const {t,text}=useI18n();

  return <section className="rw-filters" aria-label={t("Advisory filters")}>
    <div className="rw-search"><Icon name="search" size={19}/><input type="search" aria-label={t("Search road or transport advisories")} placeholder={t("Search road or transport advisories...")} value={filters.query} onChange={event=>onChange({...filters,query:event.target.value})}/>{filters.query && <button type="button" aria-label={t("Clear advisory search")} onClick={()=>onChange({...filters,query:''})}><Icon name="x" size={17}/></button>}</div>
    <div className="rw-category-filters" role="group" aria-label={t("Advisory category")}>{(['all','traffic','closure','flooding','transport','roadworks'] as const).map(category=><button type="button" key={category} className={filters.category===category?'active':''} aria-pressed={filters.category===category} onClick={()=>onChange({...filters,category})}>{category==='all'?t("All"):text(categoryLabels[category as AdvisoryCategory])}</button>)}</div>
    <div className="rw-filter-grid"><label>{t("Severity")}<select aria-label={t("Advisory severity")} value={filters.severity} onChange={event=>onChange({...filters,severity:event.target.value as AdvisoryFilters['severity']})}>{['all','low','moderate','high','critical'].map(value=><option key={value} value={value}>{value==='all'?t("All severities"):text(value)}</option>)}</select></label><label>{t("Status")}<select aria-label={t("Advisory status")} value={filters.status} onChange={event=>onChange({...filters,status:event.target.value as AdvisoryFilters['status']})}>{['all','active','scheduled','resolved','expired','unknown'].map(value=><option key={value} value={value}>{value==='all'?t("All statuses"):text(value)}</option>)}</select></label></div>
    <div className="rw-sort-row"><label>{t("Sort by")}<select aria-label={t("Sort advisories")} value={filters.sort} onChange={event=>onChange({...filters,sort:event.target.value as AdvisoryFilters['sort']})}><option value="recent">{t("Most recent")}</option><option value="severity">{t("Highest severity")}</option><option value="relevant">{t("Relevant to my route")}</option></select></label><button type="button" className="rw-reset" onClick={onReset}>{t("Reset filters")}</button></div>
  </section>;
}
