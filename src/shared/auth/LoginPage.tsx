import { useI18n } from '../i18n';
import { useState, type FormEvent } from 'react';
import { authService, DEMO_ADMIN_PASSWORD, DEMO_CUSTOMER_PASSWORD, DEMO_MODE } from './authService';
import type { AuthResult, AuthUser } from './types';
import logo from '../assets/logo.png';
import './auth.css';

type Mode = 'signin' | 'register' | 'forgot' | 'sent' | 'confirm' | 'recovery';

/** One sign-in page for everyone. The caller decides where each role goes (see AppRoot). */
export function LoginPage({ onSignedIn, onBack, initialMode = 'signin' }: { onSignedIn: (user: AuthUser) => void; onBack?: () => void; initialMode?: Mode }) {
  const {text}=useI18n();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = (next: Mode) => { setMode(next); setError(''); setPassword(''); setShow(false); };

  async function run(action: () => Promise<AuthResult>) {
    if (busy) return;
    setBusy(true); setError('');
    try {
    const result = await action();
    if (result.ok) onSignedIn(result.user);
    else if (result.confirmEmail) { setPassword(''); setMode('confirm'); }
    else { setError(result.error); setPassword(''); }
    } catch {setError('Unable to continue. Check your connection and try again.');} finally {setBusy(false);}
  }
  async function setNewPassword(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
    const result = await authService.updatePassword(password);
    if (!result.ok) { setError(result.error ?? 'Something went wrong.'); return; }
    const user = authService.restoreSession();
    if (user) onSignedIn(user); else go('signin');
    } catch {setError('Unable to continue. Check your connection and try again.');} finally {setBusy(false);}
  }
  const signIn = (e: FormEvent) => { e.preventDefault(); void run(() => authService.login(email, password, keep)); };
  const register = (e: FormEvent) => { e.preventDefault(); void run(() => authService.register({ name, email, password })); };
  async function reset(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
    const result = await authService.requestPasswordReset(email);
    if (result.ok) setMode('sent'); else setError(result.error ?? 'Something went wrong.');
    } catch {setError('Unable to continue. Check your connection and try again.');} finally {setBusy(false);}
  }

  const passwordField = (id: string, autoComplete: string, hint?: string) => (
    <div className="auth-field">
      <label htmlFor={id}>{text("Password")}</label>
      <div className="auth-password">
        <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={password} onChange={e => setPassword(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'auth-error' : undefined} />
        <button type="button" onClick={() => setShow(s => !s)} aria-pressed={show} aria-label={text(show?'Hide password':'Show password')}>{show ? text("Hide") : text("Show")}<span className="auth-sr">{text("password")}</span></button>
      </div>
      {hint && <small>{text(hint)}</small>}
    </div>
  );
  const errorBox = error && <p className="auth-error" id="auth-error" role="alert">{text(error)}</p>;

  return (
    <main className="workspace"><div className="phone auth-phone"><div className="auth-page">
      <section className="auth-brand">
        <img className="auth-logo" src={logo} alt="SakayWise: Plan, Ride, Fare, Go" width={461} height={383} decoding="async" />
        <p className="auth-tag">{text("Your smarter way to commute.")}</p>
        <p className="auth-copy">{text('Sign in to contact support. Route search stays open to everyone.')}</p>
      </section>
      <section className="auth-card">
        {onBack && <button type="button" className="auth-back" onClick={onBack}>{text("← Back to SakayWise")}</button>}

        {mode === 'signin' && (
          <form onSubmit={signIn} noValidate>
            <h1>{text("Sign in")}</h1>
            <p className="auth-sub">{text("Use the email and password of your SakayWise account.")}</p>
            <div className="auth-field">
              <label htmlFor="auth-email">{text("Email")}</label>
              <input id="auth-email" type="email" inputMode="email" autoComplete="username" autoFocus value={email} onChange={e => setEmail(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'auth-error' : undefined} />
            </div>
            {passwordField('auth-password', 'current-password')}
            {errorBox}
            <div className="auth-row">
              <label className="auth-check"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />{text("Keep me signed in")}</label>
              <button type="button" className="auth-link" onClick={() => go('forgot')}>{text("Forgot password?")}</button>
            </div>
            <button type="submit" className="auth-btn" disabled={busy}>{busy ? text("Signing in…") : text("Sign in")}</button>
            <p className="auth-switch">{text("New to SakayWise?")}<button type="button" className="auth-link" onClick={() => go('register')}>{text("Create an account")}</button></p>
            {DEMO_MODE && (
              <details className="auth-demo"><summary>{text("Demo mode")}</summary>

                <p>{text("No server is connected yet. Customer:")}<code>{text("mika@sakaywise.demo")}</code>{text("/")}<code>{DEMO_CUSTOMER_PASSWORD}</code></p>
                <p>{text("Admin:")}<code>{text("admin@sakaywise.demo")}</code>{text("/")}<code>{DEMO_ADMIN_PASSWORD}</code></p>
              </details>
            )}
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={register} noValidate>
            <h1>{text("Create account")}</h1>
            <p className="auth-sub">{text("Customer accounts can use the app and message support.")}</p>
            <div className="auth-field"><label htmlFor="reg-name">{text("Full name")}</label><input id="reg-name" aria-describedby={error?'auth-error':undefined} autoComplete="name" autoFocus maxLength={60} value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="auth-field"><label htmlFor="reg-email">{text("Email")}</label><input id="reg-email" aria-describedby={error?'auth-error':undefined} type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></div>
            {passwordField('reg-password', 'new-password', text('At least 8 characters.'))}
            {errorBox}
            <button type="submit" className="auth-btn" disabled={busy}>{busy ? text("Creating account…") : text("Create account")}</button>
            <p className="auth-switch">{text("Already have an account?")}<button type="button" className="auth-link" onClick={() => go('signin')}>{text("Sign in")}</button></p>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={reset} noValidate>
            <h1>{text("Reset password")}</h1>
            <p className="auth-sub">{text("Enter your email and we will send reset instructions.")}</p>
            <div className="auth-field"><label htmlFor="reset-email">{text("Email")}</label><input id="reset-email" type="email" autoComplete="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} /></div>
            {errorBox}
            <button type="submit" className="auth-btn" disabled={busy}>{busy ? text("Sending…") : text("Send reset link")}</button>
            <p className="auth-switch"><button type="button" className="auth-link" onClick={() => go('signin')}>{text("Back to sign in")}</button></p>
          </form>
        )}

        {mode === 'confirm' && (
          <div>
            <h1>{text("Confirm your email")}</h1>
            <p className="auth-sub">{text('We sent a confirmation link to {email}. Open it, then sign in.',{email:email.trim()})}</p>
            <button type="button" className="auth-btn" onClick={() => go('signin')}>{text("Back to sign in")}</button>
          </div>
        )}

        {mode === 'recovery' && (
          <form onSubmit={setNewPassword} noValidate>
            <h1>{text("Set a new password")}</h1>
            <p className="auth-sub">{text("Choose a new password for your SakayWise account.")}</p>
            {passwordField('new-password', 'new-password', 'At least 8 characters.')}
            {errorBox}
            <button type="submit" className="auth-btn" disabled={busy}>{busy ? text("Saving…") : text("Save new password")}</button>
          </form>
        )}

        {mode === 'sent' && (
          <div>
            <h1>{text("Check your email")}</h1>
            <p className="auth-sub">{text('If {email} has an account, reset instructions are on their way.',{email:email.trim()})}{DEMO_MODE ? text(" (Demo mode: no email is actually sent.)") : text("")}</p>
            <button type="button" className="auth-btn" onClick={() => go('signin')}>{text("Back to sign in")}</button>
          </div>
        )}
      </section>
    </div></div></main>
  );
}
