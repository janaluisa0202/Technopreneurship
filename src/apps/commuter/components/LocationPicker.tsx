import { useI18n } from '../../../shared/i18n';
import { useLayoutEffect, useRef, useState } from 'react';
import { AddressDetailsForm } from './AddressDetailsForm';
import { Icon } from './Icon';
import { useLocationSearch } from '../hooks/useLocationSearch';
import { useModalFocus } from '../hooks/useModalFocus';
import { manualPlace, matchesSavedLocation, samePlace, selectPlace } from '../lib/locations';
import type { LocationField, LocationSearchProvider, Place, SelectedLocation } from '../types';

interface Props {
  field: LocationField;
  current: SelectedLocation | null;
  other: SelectedLocation | null;
  recent: SelectedLocation[];
  savedLocations?:SelectedLocation[];
  provider?: LocationSearchProvider;
  onClose: () => void;
  onConfirm: (location: SelectedLocation | null) => void;
}

function LocationResult({ place, label, onClick }: { place: Place; label?: string; onClick: () => void }) {
  return <button type="button" className="location-result" onClick={onClick} aria-label={label}>
    <span className="location-symbol"><Icon name="map" size={20}/></span>
    <span className="location-result-copy"><strong>{place.name}</strong><span>{place.formattedAddress}</span></span>
    <Icon name="arrow" size={17}/>
  </button>;
}

export function LocationPicker({ field, current, other, recent, savedLocations=[], provider, onClose, onConfirm }: Props) {
  const {t,text}=useI18n();

  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<SelectedLocation | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { places, loading, error, retry } = useLocationSearch(query, provider);
  const isOrigin = field === 'from';
  const title = draft ? `${isOrigin ? 'Origin' : 'Destination'} address details` : isOrigin ? 'Where are you coming from?' : 'Where are you heading?';
  useModalFocus(panelRef, true, '#location-search', `[data-location-field="${field}"]`);

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    if (draft) panelRef.current?.querySelector<HTMLElement>('#location-title')?.focus({ preventScroll: true });
    else searchRef.current?.focus({ preventScroll: true });
  }, [draft]);
  useLayoutEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [query]);

  function pick(place: Place) {
    const previous = current && samePlace(current.place, place) ? current : recent.find(item => samePlace(item.place, place));
    setDraft(previous || selectPlace(place));
  }
  function back() {
    if (draft) setDraft(null);
    else onClose();
  }
  const matchingRecent = recent.filter(item => matchesSavedLocation(item, query));
  const searchResults = [...matchingRecent.map(item => item.place), ...places]
    .filter((place, index, list) => list.findIndex(candidate => samePlace(candidate, place)) === index);
  const count = query.trim() ? searchResults.length : places.length;

  return <div className="location-overlay">
    <section className="location-screen" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="location-title"
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); back(); } }}>
      <header className="location-header">
        <button type="button" className="location-back" aria-label={draft ? t("Back to location search") : t("Back to Routes")} onClick={back}><Icon name="back" size={22}/></button>
        <h2 id="location-title" tabIndex={-1}>{text(title)}</h2>
        <button type="button" className="close" aria-label={t("Cancel location selection")} onClick={onClose}><Icon name="x" size={20}/></button>
      </header>
      {draft ? <AddressDetailsForm field={field} initial={draft} other={other} onChangePlace={() => setDraft(null)} onConfirm={onConfirm}/> : <>
        <div className="location-search-area">
          <div className="location-search-box">
            <Icon name="search" size={20}/>
            <input id="location-search" ref={searchRef} type="search" enterKeyHint="search" autoComplete="off" maxLength={240}
              aria-label={t("Search locations")} placeholder={t("Place, street, building, landmark…")} value={query} onChange={event => setQuery(event.target.value)}/>
            {query && <button type="button" aria-label={t("Clear location search")} onClick={() => { setQuery(''); searchRef.current?.focus(); }}><Icon name="x" size={18}/></button>}
          </div>
          <p className="location-demo-note">{t("Local demo search · Sample addresses · No live GPS")}</p>
        </div>
        <div className="location-scroll" ref={scrollRef}>
          {!query.trim() && <>
            {current && <section className="current-location" aria-label={text(`Current ${isOrigin ? 'origin' : 'destination'}`)}>
              <div className="location-section-title"><h3>{t("Current")}{' '}{isOrigin ? t("origin") : t("destination")}</h3><button type="button" className="clear-location" onClick={() => onConfirm(null)}>{t("Clear")}{' '}{isOrigin ? t("origin") : t("destination")}</button></div>
              <LocationResult place={current.place} label={t(isOrigin ? 'Edit origin details' : 'Edit destination details')} onClick={() => setDraft(current)}/>
              <p className="input-hint">{t("Tap to edit address details, or search to replace this location.")}</p>
            </section>}
            {savedLocations.length>0 && <section className="location-section" aria-label={t('From saved trips')}><h3><Icon name="bookmark" size={16}/>{t('From saved trips')}</h3>{savedLocations.map(item=><LocationResult key={item.place.id} place={item.place} onClick={()=>setDraft(item)}/>)}</section>}
            {recent.length > 0 && <section className="location-section" aria-label={t("Recent locations")}><h3><Icon name="clock" size={16}/>{t("Recent locations")}</h3>
              {recent.map(item => <LocationResult key={item.place.id} place={item.place} onClick={() => pick(item.place)}/>)}
            </section>}
          </>}
          <section className="location-section" aria-label={query.trim() ? t("Search results") : t("Demo places")}>
            <h3>{query.trim() ? t("Search results") : t("Demo places")}<span aria-live="polite">{loading ? t("Searching…") : text(`${count} ${count===1?'place':'places'}`)}</span></h3>
            {error && <div role="status" className="location-empty"><p>{t("Search is unavailable. Try again or enter an address manually.")}</p><button type="button" className="small-outline" onClick={retry}>{text("Retry")}</button></div>}
            {!loading && !error && query.trim() && searchResults.length === 0 && <div className="location-empty" role="status"><Icon name="search" size={27}/><strong>{t("No matching demo places")}</strong><p>{t("Try a street, building, landmark, barangay, or city. You can also save your own address below.")}</p></div>}
            {(query.trim() ? searchResults : places).map(place => <LocationResult key={place.id} place={place} onClick={() => pick(place)}/>)}
          </section>
        </div>
        <footer className="location-footer">
          <button type="button" className="manual-address" onClick={() => setDraft(selectPlace(manualPlace(query)))}><Icon name="plus" size={19}/>{query.trim() ? t("Use this address manually") : t("Enter an address manually")}</button>
          <p className="input-hint">{t("Custom addresses are saved without route or fare estimates.")}</p>
        </footer>
      </>}
    </section>
  </div>;
}
