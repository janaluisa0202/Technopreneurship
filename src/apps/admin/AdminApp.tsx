import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './components/Icon';
import { ToastProvider } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { Promos } from './pages/Promos';
import { HelpCenter } from './pages/HelpCenter';
import { Incidents } from './pages/Incidents';
import { Messages } from './pages/Messages';
import { QueueReports } from './pages/QueueReports';
import { Announcements } from './pages/Announcements';
import { Users } from './pages/Users';
import { ActivityLog } from './pages/ActivityLog';
import { Settings } from './pages/Settings';
import { adminStore, useAdminState } from './services/store';
import { href, useHashRoute, type RouteKey } from './lib/router';
import { initials } from './lib/format';
import { useAppearance } from './theme';
import type { AdminAccount } from './types';
import './admin.css';

const nav: { key: RouteKey; label: string; icon: IconName }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' }, { key: 'promos', label: 'Promos', icon: 'promo' },
  { key: 'help', label: 'Help Center', icon: 'help' }, { key: 'incidents', label: 'Incidents / RoadWatch', icon: 'incident' },
  { key: 'messages', label: 'Direct Messages', icon: 'send' }, { key: 'queue', label: 'Queue Reports', icon: 'queue' },
  { key: 'announcements', label: 'Announcements', icon: 'announce' }, { key: 'users', label: 'Users', icon: 'users' },
  { key: 'activity', label: 'Activity Log', icon: 'log' }, { key: 'settings', label: 'Settings', icon: 'settings' },
];

/** Rendered by src/admin-main.tsx once the shared session says the user is an admin. */
export function AdminApp({ account, onSignOut }: { account: AdminAccount; onSignOut: () => void }) {
  const [appearance, setAppearance] = useAppearance();
  // Registered during the first render: child effects (the live data loader) run before this component's effects.
  useState(() => { void adminStore.setActor(account); });
  useEffect(() => { void adminStore.setActor(account); }, [account]);
  return (
    <ToastProvider>
      <Shell admin={account} onSignOut={() => { void adminStore.logAuth('Signed out', account); onSignOut(); }} appearance={appearance} onAppearance={setAppearance} />
    </ToastProvider>
  );
}

function Shell({ admin, onSignOut, appearance, onAppearance }: { admin: AdminAccount; onSignOut: () => void; appearance: ReturnType<typeof useAppearance>[0]; onAppearance: ReturnType<typeof useAppearance>[1] }) {
  const route = useHashRoute();
  const state = useAdminState();
  const [menu, setMenu] = useState(false);
  const main = useRef<HTMLElement>(null);

  const current = nav.find(n => n.key === route.key) ?? nav[0];
  useEffect(() => { document.title = `${current.label} · SakayWise Admin`; setMenu(false); main.current?.focus({ preventScroll: true }); }, [current.label, route.key, route.param]);

  const badges: Partial<Record<RouteKey, number>> = {
    help: state.conversations.filter(c => c.unread && !c.flaggedSpam).length,
    queue: state.queueReports.filter(r => r.status === 'pending').length,
    incidents: state.incidents.filter(i => i.status === 'active').length,
  };
  const dark = document.documentElement.dataset.theme === 'dark';

  return (
    <div className={`shell${menu ? ' menu-open' : ''}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="sidebar" aria-label="Main">
        <div className="side-brand"><div className="wordmark">Sakay<span>Wise</span></div><small>Admin console</small></div>
        <nav>
          <ul>
            {nav.map(item => (
              <li key={item.key}>
                <a href={href(item.key)} className={item.key === route.key ? 'active' : ''} aria-current={item.key === route.key ? 'page' : undefined}>
                  <Icon name={item.icon} size={20} /><span>{item.label}</span>
                  {!!badges[item.key] && <span className={`nav-badge${item.key === 'incidents' ? ' red' : ''}`}>{badges[item.key]}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" className="logout" onClick={onSignOut}><Icon name="logout" size={20} />Logout</button>
      </aside>
      {menu && <button type="button" className="scrim" aria-label="Close menu" onClick={() => setMenu(false)} />}
      <div className="main-col">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(m => !m)} aria-label="Open menu" aria-expanded={menu}><Icon name="menu" size={22} /></button>
          <div className="wordmark top-mark">Sakay<span>Wise</span></div>
          <span className="top-spacer" />
          <button type="button" className="icon-btn" onClick={() => onAppearance(dark ? 'light' : 'dark')} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={appearance === 'system' ? 'Following system theme' : undefined}><Icon name={dark ? 'sun' : 'moon'} size={20} /></button>
          <div className="admin-chip"><span className="avatar">{initials(admin.name)}</span><span className="admin-chip-text"><strong>{admin.name}</strong><small>{admin.role === 'owner' ? 'Owner' : 'Moderator'}</small></span></div>
        </header>
        <main id="main" className="content" tabIndex={-1} ref={main}>
          {state.sync.mode === 'live' && state.sync.status === 'loading' && <div className="notice" role="status"><Icon name="info" size={18} /><span>Loading live data from the SakayWise server…</span></div>}
          {state.sync.mode === 'live' && state.sync.status === 'error' && <div className="notice" role="alert"><Icon name="info" size={18} /><span>{state.sync.error}</span> <button type="button" className="btn small ghost" onClick={state.sync.refresh}>Retry</button></div>}
          {route.key === 'dashboard' && <Dashboard admin={admin} />}
          {route.key === 'promos' && <Promos />}
          {route.key === 'help' && <HelpCenter selectedId={route.param} />}
          {route.key === 'incidents' && <Incidents />}
          {route.key === 'messages' && <Messages />}
          {route.key === 'queue' && <QueueReports />}
          {route.key === 'announcements' && <Announcements />}
          {route.key === 'users' && <Users />}
          {route.key === 'activity' && <ActivityLog />}
          {route.key === 'settings' && <Settings admin={admin} appearance={appearance} onAppearance={onAppearance} />}
        </main>
      </div>
    </div>
  );
}
