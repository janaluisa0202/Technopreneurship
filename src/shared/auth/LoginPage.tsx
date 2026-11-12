import { useState, type FormEvent } from 'react';
import { authService, DEMO_ADMIN_PASSWORD, DEMO_CUSTOMER_PASSWORD, DEMO_MODE } from './authService';
import type { AuthUser } from './types';
import './auth.css';

type Mode = 'signin' | 'register' | 'forgot' | 'sent';

/** One sign-in page for everyone. The caller decides where each role goes (see AppRoot). */
export function LoginPage({ onSignedIn }: { onSignedIn: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = (next: Mode) => { setMode(next); setError(''); setPassword(''); setShow(false); };

  async function run(action: () => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>) {
    if (busy) return;
    setBusy(true); setError('');
    const result = await action();
    setBusy(false);
    if (result.ok) onSignedIn(result.user); else { setError(result.error); setPassword(''); }
  }
  const signIn = (e: FormEvent) => { e.preventDefault(); void run(() => authService.login(email, password, keep)); };
  const register = (e: FormEvent) => { e.preventDefault(); void run(() => authService.register({ name, email, password })); };
  async function reset(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    const result = await authService.requestPasswordReset(email);
    setBusy(false);
    if (result.ok) setMode('sent'); else setError(result.error ?? 'Something went wrong.');
  }

  const passwordField = (id: string, autoComplete: string, hint?: string) => (
    <div className="auth-field">
      <label htmlFor={id}>Password</label>
      <div className="auth-password">
        <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={password} onChange={e => setPassword(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'auth-error' : undefined} />
        <button type="button" onClick={() => setShow(s => !s)} aria-pressed={show}>{show ? 'Hide' : 'Show'}<span className="auth-sr"> password</span></button>
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
  const errorBox = error && <p className="auth-error" id="auth-error" role="alert">{error}</p>;

  return (
    <main className="auth-page">
      <section className="auth-brand" aria-hidden="true">
        <div className="auth-wordmark big">Sakay<span>Wise</span></div>
        <p className="auth-tag">Your smarter way to commute.</p>
        <p className="auth-copy">Sign in to plan routes, check fares and queues, and chat with the SakayWise support team.</p>
      </section>
      <section className="auth-card">
        <div className="auth-wordmark small">Sakay<span>Wise</span></div>

        {mode === 'signin' && (
          <form onSubmit={signIn} noValidate>
            <h1>Sign in</h1>
            <p className="auth-sub">Use the email and password of your SakayWise account.</p>
            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
              <input id="auth-email" autoComplete="username" autoFocus value={email} onChange={e => setEmail(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'auth-error' : undefined} />
            </div>
            {passwordField('auth-password', 'current-password')}
            {errorBox}
            <div className="auth-row">
              <label className="auth-check"><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />Keep me signed in</label>
              <button type="button" className="auth-link" onClick={() => go('forgot')}>Forgot password?</button>
            </div>
            <button type="submit" className="auth-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <p className="auth-switch">New to SakayWise? <button type="button" className="auth-link" onClick={() => go('register')}>Create an account</button></p>
            {DEMO_MODE && (
              <div className="auth-demo">
                <strong>Demo mode</strong>
                <p>No server is connected yet. Customer: <code>mika@sakaywise.demo</code> / <code>{DEMO_CUSTOMER_PASSWORD}</code></p>
                <p>Admin: <code>admin@sakaywise.demo</code> / <code>{DEMO_ADMIN_PASSWORD}</code></p>
              </div>
            )}
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={register} noValidate>
            <h1>Create account</h1>
            <p className="auth-sub">Customer accounts can use the app and message support.</p>
            <div className="auth-field"><label htmlFor="reg-name">Full name</label><input id="reg-name" autoComplete="name" autoFocus maxLength={60} value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="auth-field"><label htmlFor="reg-email">Email</label><input id="reg-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></div>
            {passwordField('reg-password', 'new-password', 'At least 8 characters.')}
            {errorBox}
            <button type="submit" className="auth-btn" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
            <p className="auth-switch">Already have an account? <button type="button" className="auth-link" onClick={() => go('signin')}>Sign in</button></p>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={reset} noValidate>
            <h1>Reset password</h1>
            <p className="auth-sub">Enter your email and we will send reset instructions.</p>
            <div className="auth-field"><label htmlFor="reset-email">Email</label><input id="reset-email" type="email" autoComplete="email" autoFocus value={email} onChange={e => setEmail(e.target.value)} /></div>
            {errorBox}
            <button type="submit" className="auth-btn" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
            <p className="auth-switch"><button type="button" className="auth-link" onClick={() => go('signin')}>Back to sign in</button></p>
          </form>
        )}

        {mode === 'sent' && (
          <div>
            <h1>Check your email</h1>
            <p className="auth-sub">If <strong>{email.trim()}</strong> has an account, reset instructions are on their way.{DEMO_MODE ? ' (Demo mode: no email is actually sent.)' : ''}</p>
            <button type="button" className="auth-btn" onClick={() => go('signin')}>Back to sign in</button>
          </div>
        )}
      </section>
    </main>
  );
}
