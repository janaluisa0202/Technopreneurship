import { useI18n } from '../../../shared/i18n';
import { Icon } from './Icon';
/** No geographic data/provider exists in the current dataset. Never draw synthetic paths. */
export function RouteMapPreview({onExpand,hasRoute}:{onExpand:()=>void;hasRoute:boolean}){
  const {t}=useI18n();
  return <section className="card route-map-preview" aria-label={t('Map preview')}><div className="map-preview-heading"><Icon name="mapFold" size={22}/><h2>{t('Your journey map')}</h2><span className="demo-tag">{t('Demo')}</span></div><p>{t('Map unavailable: this demo has no verified coordinates or map provider.')}</p><button type="button" className="small-outline map-expand" onClick={onExpand} disabled={!hasRoute}><Icon name="expand" size={17}/>{t('Expand Map')}<span className="sr-only"> · {t('Map unavailable; view the computed commute guide instead.')}</span></button></section>;
}
