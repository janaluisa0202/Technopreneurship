
import { useEffect, useState } from 'react';
import { CommuterApp } from '../apps/commuter/CommuterApp';
import { CommuterDataGate } from '../apps/commuter/components/CommuterDataGate';
import { runtimeConfig } from '../apps/commuter/services/env';
import { LoginPage } from './auth/LoginPage';
import { authService, DEMO_MODE } from './auth/authService';
import { liveConfigProblem } from './backend/runtime';
import type { AuthUser } from './auth/types';

export const ADMIN_URL = `${import.meta.env.BASE_URL}admin.html`;

type State = { status: 'loading' } | { status: 'ready'; user: AuthUser | null } | { status: 'error'; message: string };

/**
 * The single front door (/). Not signed in → login page.
 * After sign-in, the role decides the destination:
 * admins are sent to the admin website, customers stay here.
 * Demo mode: browser-only accounts. Live mode: Supabase Auth; the admin role comes from the server.
 *
 * CommuterDataGate validates and loads the Supabase transport
 * catalog before the commuter application is rendered.
 */
export function AppRoot() {
  const [state, setState] = useState<State>(() => DEMO_MODE ? { status: 'ready', user: authService.restoreSession() }
    : liveConfigProblem ? { status: 'error', message: liveConfigProblem } : { status: 'loading' });
  const [recovery, setRecovery] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (DEMO_MODE || liveConfigProblem) return;
    let active = true;
    authService.init()
      .then(user => { if (active) { setState({ status: 'ready', user }); setRecovery(authService.isPasswordRecovery()); } })
      .catch(() => { if (active) setState({ status: 'error', message: 'Unable to reach the SakayWise server. Check your connection and try again.' }); });
    const off = authService.onChange(user => { setState({ status: 'ready', user }); setRecovery(authService.isPasswordRecovery()); });
    return () => { active = false; off(); };
  }, [attempt]);

  const user = state.status === 'ready' ? state.user : null;
  useEffect(() => {
    if (user?.role === 'admin' && !recovery) location.replace(ADMIN_URL);
  }, [user, recovery]);

  if (state.status === 'loading') return <div className="auth-note" role="status">Checking your session…</div>;
  if (state.status === 'error') {
    return <div className="auth-note" role="alert"><div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}><p>{state.message}</p>
      {!liveConfigProblem && <button type="button" className="auth-btn" onClick={() => { setState({ status: 'loading' }); setAttempt(value => value + 1); }}>Try again</button>}</div></div>;
  }
  if (recovery) return <LoginPage initialMode="recovery" onSignedIn={signedIn => { setRecovery(false); setState({ status: 'ready', user: signedIn }); }} />;
  if (!user) return <LoginPage onSignedIn={signedIn => setState({ status: 'ready', user: signedIn })} />;

  if (user.role === 'admin') {
    return <div className="auth-note" role="status">Opening the admin console…</div>;
  }

  return (
    <CommuterDataGate config={runtimeConfig} account={user}>
      <CommuterApp
        account={user}
        onSignOut={() => {
          void authService.logout().finally(() => setState({ status: 'ready', user: null }));
        }}
      />
    </CommuterDataGate>
  );
}
