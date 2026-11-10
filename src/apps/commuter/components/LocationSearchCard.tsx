import { useI18n } from '../../../shared/i18n';
import { hasAddressDetails } from '../lib/locations';
import { Icon } from './Icon';
import type { LocationField, SelectedLocation } from '../types';
export function LocationSearchCard({field,location,onEdit,onClear}:{field:LocationField;location:SelectedLocation|null;onEdit:()=>void;onClear:()=>void}){
  const {t}=useI18n();const origin=field==='from';
  return <div className="location-card-row"><button type="button" className="place-field" data-location-field={field} onClick={onEdit} aria-haspopup="dialog">
    <span className={`place-symbol ${origin?'':'target'}`}><Icon name={origin?'map':'flag'} size={21}/></span><span className="field-copy"><span className="field-label">{origin?t('Origin'):t('Destination')}<Icon name="edit" size={13}/></span><span className="field-main">{location?location.place.name:origin?t('Choose origin'):t('Choose destination')}</span>{location && <><span className="field-address">{location.place.formattedAddress}</span>{hasAddressDetails(location) && <span className="address-added"><Icon name="check" size={12}/>{t('Address details added')}</span>}</>}</span>
  </button>{location && <button type="button" className="location-clear" aria-label={origin?t('Clear origin'):t('Clear destination')} onClick={onClear}><Icon name="x" size={16}/></button>}</div>;
}
