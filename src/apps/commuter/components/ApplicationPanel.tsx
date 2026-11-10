import { useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useModalFocus } from '../hooks/useModalFocus';
import { useI18n } from '../../../shared/i18n';
export function ApplicationPanel({title,onBack,children,returnFocus}:{title:string;onBack:()=>void;children:ReactNode;returnFocus?:string}){
  const panelRef=useRef<HTMLElement>(null);
  const {text}=useI18n();
  useModalFocus(panelRef,true,'.panel-back',returnFocus);
  return <section className="application-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="application-panel-title" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onBack();}}}>
    <header className="application-panel-header"><button type="button" className="panel-back location-back" aria-label={text('Back')} onClick={onBack}><Icon name="back" size={22}/></button><h2 id="application-panel-title">{text(title)}</h2></header>{children}
  </section>;
}
