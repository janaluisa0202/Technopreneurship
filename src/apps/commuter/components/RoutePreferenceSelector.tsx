import { useI18n } from '../../../shared/i18n';
import type { Priority } from '../types';
const options=[['time','Fastest'],['cost','Cheapest'],['wait','Less Waiting'],['transfers','Fewest Transfers']] as const;
export function RoutePreferenceSelector({value,onChange}:{value:Priority;onChange:(value:Priority)=>void}){
  const {t}=useI18n();
  return <div className="route-preferences" role="group" aria-label={t('Commute priorities')}>{options.map(([id,label])=><button type="button" key={id} className={value===id?'active':''} aria-pressed={value===id} onClick={()=>onChange(id)}>{t(label)}</button>)}</div>;
}
