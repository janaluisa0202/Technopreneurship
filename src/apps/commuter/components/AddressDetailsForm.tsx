import { useI18n } from '../../../shared/i18n';
import { useRef, useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { finalizeLocation, samePlace } from '../lib/locations';
import type { AddressDetails, LocationField, SelectedLocation } from '../types';

interface Props {
  field: LocationField;
  initial: SelectedLocation;
  other: SelectedLocation | null;
  onChangePlace: () => void;
  onConfirm: (location: SelectedLocation) => void;
}

export function AddressDetailsForm({ field, initial, other, onChangePlace, onConfirm }: Props) {
  const {t,text}=useI18n();

  const addressRef=useRef<HTMLInputElement>(null);
  const [place, setPlace] = useState(initial.place);
  const [details, setDetails] = useState(initial.details);
  const [error, setError] = useState('');
  const isOrigin = field === 'from';
  const confirmed = finalizeLocation({ place, details });
  const duplicate = other && samePlace(confirmed.place, other.place);
  const updateDetail = (key: keyof AddressDetails, value: string) => setDetails(previous => ({ ...previous, [key]: value }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!place.formattedAddress.trim()) {
      setError('Enter a main address before confirming.');addressRef.current?.focus();
      return;
    }
    if (duplicate) return;
    onConfirm(confirmed);
  }

  return <form noValidate className="location-form" onSubmit={submit}>
    <div className="location-scroll">
      <div className="selected-place">
        <span className={`location-symbol ${isOrigin ? '' : 'destination'}`}><Icon name={isOrigin ? 'map' : 'flag'} size={21}/></span>
        <div><strong>{place.name || text('Your custom location')}</strong><span>{place.source === 'demo' ? t("Demo location · Sample address") : t("Custom address · Not geocoded")}</span></div>
      </div>
      <button type="button" className="change-place" onClick={onChangePlace}>{t("Change location")}{' '}<Icon name="arrow" size={15}/></button>
      {place.source === 'manual' && <div className="address-input">
        <label htmlFor="location-name">{t("Location name")}{' '}<span>{t("(optional)")}</span></label>
        <input id="location-name" autoComplete="off" maxLength={120} value={place.name}
          placeholder={t("e.g., Home or your building name")} onChange={event => setPlace(previous => ({ ...previous, name: event.target.value }))}/>
      </div>}
      <div className="address-input">
        <label htmlFor="main-address">{t("Main address")}{' '}<span>{t("(required)")}</span></label>
        <input ref={addressRef} id="main-address" required maxLength={240} autoComplete="off" readOnly={place.source === 'demo'}
          value={place.formattedAddress} placeholder={t("Street, barangay, city or municipality")}
          aria-invalid={!!error || !!duplicate} aria-describedby={duplicate ? 'location-duplicate' : error ? 'address-error' : 'main-address-help'}
          onChange={event => { setPlace(previous => ({ ...previous, formattedAddress: event.target.value })); setError(''); }}/>
        <p className="input-hint" id="main-address-help">{place.source === 'demo' ? t("To choose another main address, tap Change location.") : t("Saved for your reference. No route, fare, or GPS estimate is generated.")}</p>
      </div>
      {duplicate && <p className="location-validation" role="alert" id="location-duplicate"><Icon name="warning" size={17}/>{t("Origin and destination must be different places. Choose another location.")}</p>}
      {error && <p className="location-validation" role="alert" id="address-error">{text(error)}</p>}
      <div className="address-input">
        <label htmlFor="address-landmark">{t("Nearby landmark")}{' '}<span>{t("(optional)")}</span></label>
        <input id="address-landmark" autoComplete="off" maxLength={150} placeholder={t("e.g., Main gate, pharmacy, or footbridge")}
          value={details.landmark} onChange={event => updateDetail('landmark', event.target.value)}/>
      </div>
      <div className="address-input">
        <label htmlFor="address-notes">{isOrigin ? t("Pickup / Boarding Instructions") : t("Drop-off Instructions")} <span>{t("(optional)")}</span></label>
        <textarea id="address-notes" rows={3} maxLength={500} value={details.notes}
          placeholder={isOrigin ? t("Example: Near the main gate, beside the jeepney stop.") : t("Example: Drop me off near the Annex entrance.")}
          onChange={event => updateDetail('notes', event.target.value)}/>
        <p className="input-hint">{t("For your own trip reference. These instructions are not sent to an operator.")}</p>
      </div>
      <details className="address-extra">
        <summary>{t("More address details")}{' '}<span>{t("Optional")}</span><Icon name="chevron" size={17}/></summary>
        <fieldset>
          <legend className="sr-only">{t("Optional address details")}</legend>
          <div className="address-grid">
            {([
              ['streetNumber', 'Street / House number', 'e.g., 123'],
              ['unit', 'Unit / Floor / Room', 'e.g., Room 302, 3rd floor'],
              ['building', 'Building / Condominium / Establishment', 'e.g., Frassati Building'],
              ['street', 'Street details', 'e.g., España Boulevard, side entrance'],
              ['barangay', 'Barangay', 'e.g., Barangay San Roque'],
              ['city', 'City / Municipality', 'e.g., Manila'],
            ] as const).map(([key, label, placeholder]) => <div className={`address-input ${key === 'building' || key === 'street' ? 'address-wide' : ''}`} key={key}>
              <label htmlFor={`address-${key}`}>{text(label)} <span>{t("(optional)")}</span></label>
              <input id={`address-${key}`} autoComplete="off" maxLength={150} placeholder={placeholder}
                value={details[key]} onChange={event => updateDetail(key, event.target.value)}/>
            </div>)}
          </div>
        </fieldset>
      </details>
      <p className="location-privacy"><Icon name="info" size={15}/>{t("Address details stay in this browser. Search uses local demo data; live GPS and maps are not connected.")}</p>
    </div>
    <footer className="location-footer">
      <button type="submit" className="submit" disabled={!!duplicate}>{t("Confirm")}{' '}{isOrigin ? t("Origin") : t("Destination")}</button>
    </footer>
  </form>;
}
