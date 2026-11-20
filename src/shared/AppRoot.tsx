
import { useI18n } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { CommuterApp } from '../apps/commuter/CommuterApp';
import { CommuterDataGate } from '../apps/commuter/components/CommuterDataGate';
import { runtimeConfig } from '../apps/commuter/services/env';
import { LoginPage } from './auth/LoginPage';
import { authService, DEMO_MODE } from './auth/authService';
import { liveConfigProblem } from './backend/runtime';
import { adminUrl, clearSignInParam, wantsSignIn } from './auth/routes';
import { createLogoutAction, clearAccountDrafts } from './auth/logout';
import { clearAccountSupportCache } from '../apps/commuter/lib/accountSupportService';
import { configureSupportService } from '../apps/commuter/lib/supportService';
import type { AuthUser } from './auth/types';

export const ADMIN_URL = adminUrl(import.meta.env.BASE_URL);

type State = { status: 'loading' } | { status: 'ready'; user: AuthUser | null } | { status: 'error'; message: string };

/**
 * The single front door (/). Everyone lands on the customer app. No account is needed to plan routes,
 * compare fares or read queues and advisories. Chatting with support needs an account, so the app asks
 * for sign-in / registration only at that moment (or from Settings), and returns the person to where they were.
 * The sign-in page is also reachable directly at /?signin=1 (the admin site sends signed-out staff there).
 * After sign-in, the role decides the destination: admins are sent to the admin website, customers stay here.
 * Demo mode: browser-only accounts. Live mode: Supabase Auth; the admin role comes from the server.
 *
 * CommuterDataGate validates and loads the Supabase transport
 * catalog before the commuter application is rendered.
 */
type LoginRequest = { mode: 'signin' | 'register' } | null;
export function AppRoot() {
  const {text}=useI18n();
  const [state, setState] = useState<State>(() => DEMO_MODE ? { status: 'ready', user: authService.restoreSession() }
    : liveConfigProblem ? { status: 'error', message: liveConfigProblem } : { status: 'loading' });
  const [recovery, setRecovery] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Sign-in page is shown only when asked for: /?signin=1, or a Sign in / Create account button in the app.
  const [login, setLogin] = useState<LoginRequest>(() => wantsSignIn(location.search) ? { mode: 'signin' } : null);
  const [resume, setResume] = useState<'support' | null>(null);
  const accountRef=useRef<AuthUser|null>(state.status==='ready'?state.user:null);
  const cleanupFailed=useRef(false);
  const [logoutNotice,setLogoutNotice]=useState('');
  function acceptUser(next:AuthUser|null){
    const previous=accountRef.current;
    if(previous && previous.id!==next?.id){
      const stores:Storage[]=[];
      for(const name of ['localStorage','sessionStorage'] as const){try{stores.push(window[name]);}catch{cleanupFailed.current=true;}}
      if(!clearAccountDrafts(previous.id,stores))cleanupFailed.current=true;
      clearAccountSupportCache(previous.id);configureSupportService(undefined);
    }
    accountRef.current=next;
    if(!next && previous){setResume(null);setLogin(null);clearSignInParam();}
    setState({status:'ready',user:next});
  }
  const [logout]=useState(()=>createLogoutAction(()=>authService.logout(),()=>{
    acceptUser(null);setResume(null);setLogin(null);clearSignInParam();setRecovery(false);
    setLogoutNotice(cleanupFailed.current?'You have successfully logged out. Some account drafts could not be removed from this device.':'You have successfully logged out.');
  }));


  useEffect(() => {
    if (!DEMO_MODE && liveConfigProblem) return;
    let active = true;
    if(!DEMO_MODE)authService.init()
      .then(user => { if (active) { acceptUser(user); setRecovery(authService.isPasswordRecovery()); } })
      .catch(() => { if (active) setState({ status: 'error', message: 'Unable to reach the SakayWise server. Check your connection and try again.' }); });
    const off = authService.onChange(user => { if(!active)return;acceptUser(user); setRecovery(authService.isPasswordRecovery()); });
    return () => { active = false; off(); };
  }, [attempt]);

  const user = state.status === 'ready' ? state.user : null;
  useEffect(() => {
    if (user?.role === 'admin' && !recovery) location.replace(ADMIN_URL);
  }, [user, recovery]);

  if (state.status === 'loading') return <div className="auth-note" role="status">{text('Checking your session…')}</div>;
  if (state.status === 'error') {
    return <div className="auth-note" role="alert"><div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}><p>{text(state.message)}</p>
      {!liveConfigProblem && <button type="button" className="auth-btn" onClick={() => { setState({ status: 'loading' }); setAttempt(value => value + 1); }}>{text('Try again')}</button>}</div></div>;
  }
  if (recovery) return <LoginPage initialMode="recovery" onSignedIn={signedIn => { setRecovery(false); acceptUser(signedIn); }} />;

  if (!user && login) {
    return <LoginPage initialMode={login.mode}
      onBack={() => { clearSignInParam(); setResume(null); setLogin(null); }}
      onSignedIn={signedIn => { clearSignInParam(); setLogin(null); acceptUser(signedIn); }} />;
  }

  if (user?.role === 'admin') {
    return <div className="auth-note" role="status">{text('Opening the admin console…')}</div>;
  }

  // Guests and customers both get the mobile app. The key reloads account-specific data when the person signs in or out.
  return (
    <CommuterDataGate key={user?.id ?? 'guest'} config={runtimeConfig} account={user ?? undefined}>
      <CommuterApp
        account={user}
        startPanel={user ? resume : null}
        sessionNotice={logoutNotice}
        onSignIn={(mode, forSupport) => { setLogoutNotice('');cleanupFailed.current=false; setResume(forSupport ? 'support' : null); setLogin({ mode }); }}
        onSignOut={logout}
      />
    </CommuterDataGate>
  );
}
