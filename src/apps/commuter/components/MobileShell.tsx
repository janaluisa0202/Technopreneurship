import { useI18n } from '../../../shared/i18n';
import { useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useKeyboardViewport } from '../hooks/useKeyboardViewport';
import type { Tab } from '../types';

interface Props {
  tab: Tab;
  onTab: (value: Tab) => void;
  children: ReactNode;
  overlay: ReactNode;
  toast: string;
  notice?:string;
  overlayOpen: boolean;
  savedCount: number;
  onSaved: () => void;
  alertCount?: number;
  onSettings:()=>void;
  onSupport:()=>void;
  supportUnread?:number;
}

const tabs = [
  {id:'routes',label:'Routes',icon:'compass'},
  {id:'fares',label:'Fare Matrix',icon:'calc'},
  {id:'queues',label:'Queues',icon:'users'},
  {id:'alerts',label:'Para Alerts',icon:'bell'},
] as const;

export function MobileShell({tab,onTab,children,overlay,toast,notice,overlayOpen,savedCount,onSaved,alertCount=0,onSettings,onSupport,supportUnread=0}:Props) {
  const {t,text}=useI18n();

  const frameRef = useRef<HTMLDivElement>(null);
  useKeyboardViewport(frameRef);
  return <main className="workspace">
    <div className="phone" ref={frameRef} aria-label={t("SakayWise mobile commuter app")}>
      <div className="app-content" inert={overlayOpen}>
        <div className="status" aria-hidden="true"><span>9:41</span><div className="island"/><div className="status-icons"><span>◕</span><span>▰</span></div></div>
        <header className="brand-banner">
          <div className="brand-copy">
            <div className="wordmark">Sakay<span>Wise</span></div>
            <div className="brand-demo">{t("Demo · Illustrative transit data")}</div>
          </div>
          <div className="header-actions"><button className="saved-button" type="button" onClick={onSaved}
            aria-label={text(`Saved trip guides, ${savedCount} saved`)} aria-haspopup="dialog">
            <Icon name="bookmark" size={18}/><b>{savedCount}</b>
          </button><button type="button" className="settings-trigger" aria-label={t("Settings")} onClick={onSettings}><Icon name="settings" size={22}/></button></div>
        </header>
        <div className="view" key={tab} tabIndex={0} role="region"
          aria-label={text(`${tabs.find(item=>item.id===tab)?.label} content`)}>{notice && <p className="queue-warning" role="status">{text(notice)}</p>}{children}</div>
        {!overlayOpen && <div className="support-dock"><button type="button" className="support-fab" aria-label={supportUnread>0?`${t("Help & Support")} (${supportUnread})`:t("Help & Support")} onClick={onSupport}><Icon name="message" size={22}/>{supportUnread>0 && <span className="support-badge" aria-hidden="true">{Math.min(supportUnread,9)}</span>}</button></div>}
        <nav className="nav" aria-label={t("Commuter navigation")}>
          {tabs.map(item => <button key={item.id} type="button" className={`nav-button ${tab === item.id ? 'active' : ''}`}
            aria-label={text(item.id==='alerts' && alertCount>0?`${item.label}, ${alertCount} matching advisories`:item.label)}
            onClick={() => onTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}>
            <span className="nav-icon"><Icon name={item.icon} size={23}/></span>
            <span>{text(item.label)}</span>
            {item.id==='alerts' && alertCount>0 && <span className="rw-nav-count" aria-hidden="true">{Math.min(alertCount,99)}</span>}
          </button>)}
        </nav>
      </div>
      {overlay}
      <div className={`toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">{text(toast)}</div>
    </div>
  </main>;
}
