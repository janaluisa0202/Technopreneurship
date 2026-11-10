import { queueReportTerminals } from '../services/demoCatalog';
import { useI18n } from '../../../shared/i18n';
import { useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Icon } from './Icon';
import { useModalFocus } from '../hooks/useModalFocus';
import { RouteDetails, fareText } from './RouteDetails';
import { RoadWatchDetails } from './roadwatch/RoadWatchDetails';
import type { RoadAdvisory, AdvisoryTripContext } from '../types/roadwatch';
import { repriceItinerary } from '../lib/fares';
import type { Passenger, QueueLevel, SavedTrip, Sheet } from '../types';
import type { RouteItinerary } from '../types/route';

interface Props {
  sheet: Exclude<Sheet, {type:'location'}>;
  saved: SavedTrip[];
  passenger: Passenger;
  advisories:RoadAdvisory[];
  advisoryContext:AdvisoryTripContext;
  now:number;
  onAdvisory:(id:string)=>void;
  onAlternative:(id:string)=>void;
  onPassenger: (value:Passenger) => void;
  onSaveRoute: (route:RouteItinerary) => void;
  onClose: () => void;
  onSavedTrip: (key:string) => void;
  onRemoveSaved: (key:string) => void;
  onSavedList: () => void;
  onReport: (place:string,level:QueueLevel,details:string) => Promise<void>;
}

export function Sheets({sheet,saved,advisories,advisoryContext,now,onAdvisory,onAlternative,passenger,onPassenger,onSaveRoute,onClose,onSavedTrip,onRemoveSaved,onSavedList,onReport}: Props) {
  const {t,text,locale}=useI18n();

  const [reportBusy,setReportBusy]=useState(false);
  const [reportError,setReportError]=useState(false);
  const submitting=useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const isOpen = sheet !== null;
  const panelKey = sheet?.type==='route' ? `route:${sheet.route.id}` : sheet?.type==='saved-trip' ? `saved:${sheet.key}` : sheet?.type==='advisory'?`advisory:${sheet.id}`:sheet?.type;

  useModalFocus(panelRef,isOpen);

  useLayoutEffect(() => {
    if (!panelKey) return;
    bodyRef.current?.scrollTo(0,0);
    panelRef.current?.querySelector<HTMLButtonElement>('.close')?.focus({preventScroll:true});
  }, [panelKey]);

  if (!sheet) return null;
  const selectedGuide = sheet.type==='saved-trip' ? saved.find(item=>item.key===sheet.key) : undefined;
  async function submitReport(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const place = String(form.get('terminal') || 'UST España');
    const level = String(form.get('level') || 'low') as QueueLevel;
    const details = String(form.get('details') || '').trim().slice(0,150);
    if(submitting.current)return;submitting.current=true;setReportBusy(true);setReportError(false);
    try{await onReport(place,level,details);}catch{setReportError(true);}finally{submitting.current=false;setReportBusy(false);}
  }
  return <div className="overlay show" onMouseDown={(event:MouseEvent<HTMLDivElement>)=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="sheet" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="handle" aria-hidden="true"/>
      <header className="sheet-head"><h2 id="sheet-title">{sheet.type==='advisory'?t("RoadWatch advisory"):sheet.type==='route'?text('Your commute'):sheet.type==='report'?text('Report terminal queue'):sheet.type==='saved-trip'?text('Saved boarding guide'):text('Saved trip guides')}</h2><button type="button" className="close" aria-label={t("Close panel")} onClick={onClose}><Icon name="x" size={20}/></button></header>
      <div className="sheet-body" ref={bodyRef}>
      {sheet.type==='advisory' && (advisories.find(item=>item.id===sheet.id)?<RoadWatchDetails advisory={advisories.find(item=>item.id===sheet.id)!} context={advisoryContext} now={now} onAlternative={()=>onAlternative(sheet.id)}/>:<p className="empty-state">{t("This advisory is no longer available in the current data.")}</p>)}
      {sheet.type==='route' && <RouteDetails onAdvisory={onAdvisory} route={sheet.route} from={sheet.route.legs[0]?.segment.boarding || 'Origin'} to={sheet.route.legs.at(-1)?.segment.alighting || 'Destination'} onPassenger={onPassenger} onSave={()=>onSaveRoute(sheet.route)} isSaved={saved.some(item=>item.route?.id===sheet.route.id)}/>}
      {sheet.type==='saved' && <>
        <p className="sheet-note">{t("These trip instructions are stored in this browser. They may remain readable offline after the app has been loaded, but offline mapping and navigation are not included.")}</p>
        {saved.length ? saved.map(item=><div className="saved-pack" key={item.key}><div className="pack-top"><strong>{item.from} → {item.to}</strong><span>{text(fareText(item.price,locale))}</span></div><p>{text(item.name)} · {text(item.passenger)} {t("· Sample fare")}</p><button type="button" className="small-outline" onClick={()=>onSavedTrip(item.key)}>{t("View steps")}</button><button type="button" className="small-outline danger" onClick={()=>onRemoveSaved(item.key)}>{t("Remove")}</button></div>) :
        <div className="empty-pack">{t("No guides saved yet. Select a route and tap “Save trip.”")}</div>}
      </>}
      {sheet.type==='saved-trip' && <>
        {selectedGuide?.route ? <RouteDetails onAdvisory={onAdvisory} route={repriceItinerary(selectedGuide.route,passenger)} from={selectedGuide.from} to={selectedGuide.to} savedSnapshot savedAt={selectedGuide.savedAt} onPassenger={onPassenger} onSave={()=>onSaveRoute(repriceItinerary(selectedGuide.route!,passenger))} isSaved/> : selectedGuide ? <>
          <p className="sheet-note"><b>{selectedGuide.from} → {selectedGuide.to}</b></p>
          <p className="sheet-note">{text(selectedGuide.name)} {t("· Fare when saved:")}{' '}{text(fareText(selectedGuide.price,locale))} {t("(demo)")}</p>
          <div className="saved-step-list">{selectedGuide.steps.map(([instruction,detail],index)=><div className="step" key={index}><span className="step-num">{index+1}</span><div><strong>{text(instruction)}</strong><span>{text(detail)}</span></div></div>)}</div>
          <p className="matrix-note">{t("Saved data may become outdated. Verify route, boarding bay, and fare before traveling.")}</p>
        </>:<div className="empty-state">{t("This guide was removed.")}</div>}
        <button type="button" className="submit" onClick={onSavedList}>{t("Back to saved guides")}</button>
      </>}
      {sheet.type==='report' && <>
        <p className="sheet-note">{t("Submit a simulated community report. It will affect your route estimate on this device only and will not be shared publicly.")}</p>
        <form id="queueForm" onSubmit={submitReport}>
          <label htmlFor="terminal">{t("Terminal or stop")}</label>
          <select name="terminal" id="terminal" required>{queueReportTerminals.map(terminal=><option key={terminal} value={terminal}>{terminal}</option>)}</select>
          <label htmlFor="level">{t("Current queue")}</label>
          <select id="level" name="level"><option value="low">{t("Low — moving quickly")}</option><option value="mid">{t("Moderate — some waiting")}</option><option value="high">{t("High — long lines")}</option></select>
          <label htmlFor="details">{t("Details (optional)")}</label>
          <textarea id="details" name="details" maxLength={150} placeholder={t("e.g., a long queue at northbound jeepney stop")} />
          <button type="submit" className="submit" disabled={reportBusy}>{reportBusy?t("Saving..."):t("Submit demo report")}</button>{reportError && <p role="alert" className="location-validation">{text("Unable to save the queue report. Please retry.")}</p>}
        </form>
      </>}
      </div>
    </section>
  </div>;
}
