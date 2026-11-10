import { useI18n } from '../../../shared/i18n';
import { useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { fareText } from '../components/RouteDetails';
import { peso } from '../lib/commute';
import { repriceItinerary, sampleDistanceFare } from '../lib/fares';
import type { FareMode, Passenger } from '../types';
import type { RouteItinerary } from '../types/route';

interface Props { passenger: Passenger; onPassenger: (value:Passenger)=>void; route?: RouteItinerary; }
const modes: {id:FareMode;label:string}[] = [{id:'jeep',label:'Jeepney'},{id:'bus',label:'Bus'},{id:'uv',label:'UV Express'}];
export function FareMatrixPage({passenger,onPassenger,route}:Props) {
  const {t,text,locale}=useI18n();

  const [mode,setMode] = useState<FareMode>('jeep');
  const [distance,setDistance] = useState(6);
  const [context,setContext] = useState<'route'|'calculator'>('route');
  const [quote,setQuote] = useState('');
  const [quoteError,setQuoteError]=useState('');
  const [checkedKey,setCheckedKey] = useState('');
  const selected = route ? repriceItinerary(route,passenger) : undefined;
  const useRoute = context==='route' && !!selected;
  const benchmark = useRoute ? selected!.metrics.fare : sampleDistanceFare(mode,distance,passenger);
  const regular = useRoute ? repriceItinerary(route!,'regular').metrics.fare : sampleDistanceFare(mode,distance,'regular');
  const comparisonKey = JSON.stringify([context,useRoute?selected?.id:mode,useRoute?null:distance,passenger,benchmark,quote]);
  const numericQuote = Number(quote);
  const validQuote = Number.isFinite(numericQuote) && numericQuote>0;
  const difference = benchmark===null ? null : numericQuote-benchmark;
  const isAbove = difference!==null && difference>.01;
  const change = ()=>{setCheckedKey('');setQuoteError('');};
  return <div className="fade">
    <header className="section-head"><span className="back-overline">{t("FAREGUARD · COMMUTER PROTECTION")}</span><h1>{t("Know your fare.")}</h1><p>{t("Compare a quoted amount with your selected journey or a separate distance-based sample.")}</p></header>
    {selected && <div className="segment fare-context" role="group" aria-label={t("Fare comparison source")}><button type="button" className={context==='route'?'on':''} aria-pressed={context==='route'} onClick={()=>{setContext('route');change();}}>{t("Selected journey")}</button><button type="button" className={context==='calculator'?'on':''} aria-pressed={context==='calculator'} onClick={()=>{setContext('calculator');change();}}>{t("Sample calculator")}</button></div>}
    <section className="summary-tile"><div className="tile-label">{t("YOUR DEMO FARE BENCHMARK")}</div><div className="tile-money">{text(fareText(benchmark,locale))}</div><p>{text(passenger).toUpperCase()} · {useRoute ? text(selected!.name) : `${distance} km · ${text(modes.find(item=>item.id===mode)?.label)}`}</p></section>
    <section className="card passenger-box"><label htmlFor="fare-passenger">{t("Passenger type")}</label><select id="fare-passenger" value={passenger} onChange={event=>{onPassenger(event.target.value as Passenger);change();}}><option value="regular">{t("Regular")}</option><option value="student">{t("Student")}</option><option value="senior">{t("Senior Citizen")}</option><option value="pwd">{t("PWD")}</option></select></section>
    {useRoute ? <section className="card section-card"><h2 className="card-title">{t("Selected journey fares")}</h2><p className="card-desc">{t("Same passenger-specific sample entries used in Recommended Routes and saved guides.")}</p>{selected!.legs.filter(leg=>leg.segment.mode!=='walk').map(leg=><div className="fare-row" key={leg.segment.id}><span>{text(leg.segment.service)}</span><b>{text(fareText(leg.fare,locale))}</b></div>)}{benchmark===null && <p className="queue-warning">{t("A passenger fare is missing for at least one leg. A complete benchmark and overcharge comparison are unavailable.")}</p>}</section> :
      <section className="card section-card"><h2 className="card-title">{t("Fare calculator")}</h2><p className="card-desc">{t("A separate sample calculation. It does not calculate a route or an official fare.")}</p><div className="segment" role="group" aria-label={t("Vehicle type")}>{modes.map(item=><button key={item.id} type="button" className={mode===item.id?'on':''} aria-pressed={mode===item.id} onClick={()=>{setMode(item.id);change();}}>{text(item.label)}</button>)}</div><div className="calculator-line"><span>{t("Approx. distance")}</span><span>{distance} {t("km")}</span></div><input type="range" min="1" max="24" step="1" value={distance} onChange={event=>{setDistance(Number(event.target.value));change();}} aria-label={t("Sample distance in kilometers")}/><p className="calc-discount">{t("Each mode and passenger category has its own illustrative base and distance entries. No universal discount is assumed.")}</p></section>}
    <section className="card section-card fareguard-card"><div className="fareguard-title"><Icon name="shield" size={19}/><div><strong>{t("FareGuard checker")}</strong><small>{t("Compare against the displayed demo benchmark.")}</small></div></div><label className="quoted-label" htmlFor="quoted">{t("Amount quoted by driver / operator (₱)")}</label><form noValidate className="quote-entry" onSubmit={(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(validQuote && benchmark!==null){setQuoteError('');setCheckedKey(comparisonKey);}else setQuoteError('Enter a valid amount greater than zero.');}}><span>₱</span><input id="quoted" inputMode="decimal" type="number" min="0.01" step="0.01" placeholder={t("e.g. 45.00")} value={quote} onChange={event=>{setQuote(event.target.value);change();}} required/><button type="submit" disabled={benchmark===null}>{t("Check")}</button></form>
      {quoteError && <p className="location-validation" role="alert">{text(quoteError)}</p>}
      {checkedKey===comparisonKey && validQuote && difference!==null && <div role="status" className={`quote-result ${isAbove?'over':''}`}><Icon name={isAbove?'warning':'check'} size={20}/><div><b>{isAbove?t("Above demo benchmark"):t("At or below demo benchmark")}</b><small>{isAbove?text(`Difference: ${peso(difference,locale)}. This is not proof of overcharging; verify the current official route-specific tariff.`):t("This is a sample comparison only. Verify the actual fare and eligibility before boarding.")}</small></div></div>}
      <p className="matrix-note"><Icon name="info" size={14}/>{t("No official LTFRB matrix is connected. Sample entries do not determine a legal fare.")}</p>
    </section>
    <section className="card section-card"><h2 className="card-title">{t("Example calculation")}</h2><div className="fare-row"><span>{t("Regular sample fare")}</span><b>{text(fareText(regular,locale))}</b></div><div className="fare-row"><span>{t("Selected category:")}{' '}{text(passenger)}</span><b>{text(fareText(benchmark,locale))}</b></div><div className="fare-row total"><span>{t("Demo benchmark")}</span><b>{text(fareText(benchmark,locale))}</b></div></section>
    <p className="demo-note">{t("All amounts are illustrative. Missing passenger fares stay unavailable. Actual fare eligibility and rules depend on the mode, operator, and verified tariff.")}</p>
  </div>;
}
