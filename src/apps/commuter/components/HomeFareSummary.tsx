import { useI18n } from '../../../shared/i18n';
import { repriceItinerary, roundFare } from '../lib/fares';
import { getActiveCatalog } from '../services/catalog';
import { fareText } from './RouteDetails';
import { Icon } from './Icon';
import type { RouteItinerary } from '../types/route';
export function HomeFareSummary({route,onDetails}:{route:RouteItinerary;onDetails:()=>void}){
  const {text,locale}=useI18n();const regular=repriceItinerary(route,'regular').metrics.fare;
  const saving=regular!==null && route.metrics.fare!==null?roundFare(Math.max(0,regular-route.metrics.fare)):null;
  return <section className="card home-fare" aria-labelledby="home-fare-title">
    <h2 id="home-fare-title">{text('How much will I pay?')}</h2>
    <p className="home-fare-total">{text(fareText(route.metrics.fare,locale))}<span>{text('Estimated total')}</span></p>
    <p>{text(route.name)} · {text(({regular:'Regular',student:'Student',senior:'Senior Citizen',pwd:'PWD'} as const)[route.passenger])}</p>
    <p className="home-fare-source">{text(getActiveCatalog().provenance==='illustrative-demo'?'Sample fare · Not an official tariff':'Estimated fare · Confirm with the operator')}</p>
    <details className="data-notice"><summary>{text('Fare breakdown and discount')}</summary>
      {route.legs.filter(leg=>leg.segment.mode!=='walk').map(leg=><div className="fare-row" key={leg.segment.id}><span>{text(leg.segment.service)}</span><b>{text(fareText(leg.fare,locale))}</b></div>)}
      <p>{text(route.passenger==='regular'?'Regular passenger fare':saving===null?'Discount unavailable: a fare entry is missing.':'Passenger saving compared with the listed regular fare:')}{route.passenger!=='regular' && saving!==null && <> {text(fareText(saving,locale))}</>}</p>
      <p>{text('No discount percentage is assumed. Confirm eligibility and the current fare before travel.')}</p>
    </details>
    <button type="button" className="small-outline" onClick={onDetails}><Icon name="shield" size={18}/>{text('Check Fare Details')}</button>
  </section>;
}
