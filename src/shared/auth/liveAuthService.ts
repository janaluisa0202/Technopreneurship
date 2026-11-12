// Live-mode implementation of the shared AuthService using Supabase Auth.
// The browser never decides who is an admin: the role comes from my_admin_roles() (RLS-backed
// table admin_role_assignments), and every admin query is re-checked by Row-Level Security.
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { setSessionPersistence } from '../../apps/commuter/services/supabase/client';
import { getLiveClient } from '../backend/runtime';
import type { AuthResult, AuthService, AuthUser, RegisterInput } from './types';
import { userFrom } from './roles';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let current: AuthUser | null = null;
let recovery = false;
let initialised: Promise<AuthUser | null> | undefined;
const listeners = new Set<(user: AuthUser | null) => void>();
const notify = () => listeners.forEach(listener => listener(current));

/** Maps a Supabase session to the app's user. Anonymous sessions are not a sign-in. */
export async function resolveUser(supabase: SupabaseClient, session: Session | null): Promise<AuthUser | null> {
  if (!session?.user || session.user.is_anonymous) return null;
  const [roles, profile] = await Promise.all([supabase.rpc('my_admin_roles'), supabase.rpc('touch_profile')]);
  if (roles.error) throw roles.error;
  return userFrom(session, (roles.data ?? []) as string[], (Array.isArray(profile.data) ? profile.data[0] : profile.data) as { display_name?: string | null } | null);
}

const failure = (error: string, extra: Partial<Extract<AuthResult, { ok: false }>> = {}): AuthResult => ({ ok: false, error, ...extra });
function signInMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email address first. Open the link we sent you, then sign in.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  return 'Unable to sign in right now. Check your connection and try again.';
}
const appUrl = () => `${location.origin}${import.meta.env.BASE_URL}`;

export const liveAuthService: AuthService = {
  init() {
    initialised ??= (async () => {
      const supabase = await getLiveClient();
      supabase.auth.onAuthStateChange((event, session) => {
        // Supabase warns against awaiting other client calls inside this callback.
        setTimeout(() => {
          if (event === 'PASSWORD_RECOVERY') { recovery = true; notify(); return; }
          if (event === 'SIGNED_OUT') { current = null; recovery = false; notify(); return; }
          if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user.id !== current?.id) {
            resolveUser(supabase, session).then(user => { current = user; notify(); }).catch(() => {});
          }
        }, 0);
      });
      const { data } = await supabase.auth.getSession();
      try { current = await resolveUser(supabase, data.session); } catch { current = null; }
      return current;
    })();
    return initialised;
  },

  async login(identifier, password, keep) {
    const email = identifier.trim().toLowerCase();
    if (!email || !password) return failure('Enter your email and your password.');
    if (!EMAIL.test(email)) return failure('Enter the full email address of your account.');
    const supabase = await getLiveClient();
    setSessionPersistence(keep);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) return failure(signInMessage(error?.message ?? ''));
    try {
      current = await resolveUser(supabase, data.session);
    } catch {
      await supabase.auth.signOut();
      return failure('Signed in, but your account details could not be loaded. Please try again.');
    }
    if (!current) return failure('This sign-in cannot be used here.');
    if (current.role === 'admin') await supabase.rpc('admin_log_event', { p_detail: 'Signed in' });
    notify();
    return { ok: true, user: current };
  },

  async register(input: RegisterInput) {
    const name = input.name.trim().replace(/\s+/g, ' ');
    const email = input.email.trim().toLowerCase();
    if (name.length < 2 || name.length > 60) return failure('Enter your name (2–60 characters).');
    if (!EMAIL.test(email) || email.length > 254) return failure('Enter a valid email address.');
    if (input.password.length < 8) return failure('Use a password with at least 8 characters.');
    const supabase = await getLiveClient();
    setSessionPersistence(false);
    const { data, error } = await supabase.auth.signUp({ email, password: input.password, options: { data: { display_name: name }, emailRedirectTo: appUrl() } });
    if (error) {
      if (/already registered|already exists/i.test(error.message)) return failure('An account with this email already exists. Try signing in.');
      if (/password/i.test(error.message)) return failure('Choose a stronger password (at least 8 characters, not easy to guess).');
      return failure('Unable to create the account right now. Please try again.');
    }
    if (!data.session) return failure('Check your email to confirm your account, then sign in.', { confirmEmail: true });
    current = await resolveUser(supabase, data.session);
    if (!current) return failure('Unable to create the account right now. Please try again.');
    notify();
    return { ok: true, user: current };
  },

  async requestPasswordReset(email) {
    if (!EMAIL.test(email.trim())) return { ok: false, error: 'Enter a valid email address.' };
    const supabase = await getLiveClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: appUrl() });
    // Same answer whether or not the email exists; only transport/rate-limit errors surface.
    if (error && /rate limit|too many/i.test(error.message)) return { ok: false, error: 'Too many reset requests. Wait a few minutes and try again.' };
    if (error && !/not found|user/i.test(error.message)) return { ok: false, error: 'Unable to send the reset email right now. Please try again.' };
    return { ok: true };
  },

  async updatePassword(password) {
    if (password.length < 8) return { ok: false, error: 'Use a password with at least 8 characters.' };
    const supabase = await getLiveClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: /password/i.test(error.message) ? 'Choose a stronger password.' : 'Unable to update the password. Request a new reset link.' };
    recovery = false;
    const { data } = await supabase.auth.getSession();
    current = await resolveUser(supabase, data.session).catch(() => null);
    notify();
    return { ok: true };
  },

  isPasswordRecovery: () => recovery,
  restoreSession: () => current,

  async logout() {
    const supabase = await getLiveClient();
    if (current?.role === 'admin') await supabase.rpc('admin_log_event', { p_detail: 'Signed out' }).then(() => {}, () => {});
    current = null;
    recovery = false;
    await supabase.auth.signOut().catch(() => supabase.auth.signOut({ scope: 'local' }));
    notify();
  },

  onChange(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
