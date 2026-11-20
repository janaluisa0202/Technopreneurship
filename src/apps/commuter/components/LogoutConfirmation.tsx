import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../shared/i18n';
import { useModalFocus } from '../hooks/useModalFocus';
import { Icon } from './Icon';
export function LogoutConfirmation({onCancel,onConfirm}:{onCancel:()=>void;onConfirm:()=>Promise<void>}){
  const {t}=useI18n();const panel=useRef<HTMLElement>(null);const running=useRef(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(false);
  useModalFocus(panel,true,'.logout-cancel','.commuter-logout');
  useEffect(()=>{if(busy)panel.current?.focus({preventScroll:true});},[busy]);
  async function confirm(){
    if(running.current)return;running.current=true;setBusy(true);setError(false);
    try{await onConfirm();}catch{setError(true);}finally{running.current=false;setBusy(false);}
  }
  return <div className={`logout-overlay ${busy?'is-logging-out':''}`}>
    <section className="logout-dialog" tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="logout-title" aria-describedby="logout-description" aria-busy={busy} ref={panel} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape' && !running.current){event.preventDefault();onCancel();}}}>
      <span className="logout-emblem" aria-hidden="true"><Icon name="logout" size={26}/></span>
      <h2 id="logout-title">{t('Log Out of SakayWise?')}</h2>
      <p id="logout-description">{t('Are you sure you want to log out? You can continue using SakayWise as a guest.')}</p>
      {error && <p className="logout-error" role="alert">{t('Unable to log out. Please try again.')}</p>}
      {busy && <p role="status">{t('Logging out...')}</p>}
      <div className="logout-actions"><button type="button" className="logout-cancel small-outline" disabled={busy} onClick={onCancel}>{t('Cancel')}</button><button type="button" className="logout-confirm" disabled={busy} onClick={()=>void confirm()}><Icon name="logout" size={18}/>{busy?t('Logging out...'):t('Log Out')}</button></div>
    </section>
  </div>;
}
