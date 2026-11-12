import type { SupabaseClient } from '@supabase/supabase-js';
import type { RuntimeConfig } from '../runtimeConfig';

let client: SupabaseClient | undefined;
let pending: Promise<SupabaseClient> | undefined;

const PERSIST_KEY = 'sakaywise:auth:persist';
const safe = <T>(fn: () => T): T | null => { try { return fn(); } catch { return null; } };
/** "Keep me signed in": true keeps the session in localStorage; false keeps it for this tab only. */
export function setSessionPersistence(keep: boolean): void {
  safe(() => localStorage.setItem(PERSIST_KEY, keep ? '1' : '0'));
}
// Session storage adapter shared by the commuter app (/) and the admin site (/admin.html) — same origin, same session.
const sessionStore = {
  getItem: (key: string) => safe(() => sessionStorage.getItem(key)) ?? safe(() => localStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    const keep = safe(() => localStorage.getItem(PERSIST_KEY)) !== '0';
    if (keep) { safe(() => localStorage.setItem(key, value)); safe(() => sessionStorage.removeItem(key)); }
    else { safe(() => sessionStorage.setItem(key, value)); safe(() => localStorage.removeItem(key)); }
  },
  removeItem: (key: string) => { safe(() => localStorage.removeItem(key)); safe(() => sessionStorage.removeItem(key)); },
};

/**
 * Creates the browser client in live mode only. The SDK is loaded with a dynamic import, so demo
 * mode neither downloads it nor makes any network request. Uses ONLY the public URL + publishable
 * (anon) key; Row-Level Security on the server does the authorization.
 */
export async function loadSupabaseClient(config: RuntimeConfig): Promise<SupabaseClient> {
  if (config.mode !== 'live' || config.problem || !config.supabaseUrl || !config.supabaseKey) {
    throw new Error('Supabase is not configured for live mode.');
  }
  if (client) return client;
  const { supabaseUrl, supabaseKey } = config;
  pending ??= import('@supabase/supabase-js').then(({ createClient }) => {
    // detectSessionInUrl: completes email-confirmation and password-reset links (PASSWORD_RECOVERY event).
    client ??= createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'sakaywise:auth:v1', storage: sessionStore },
    });
    return client;
  });
  return pending;
}

/** The client created during start-up (auth init / CommuterDataGate) — live mode only. */
export function requireSupabaseClient(): SupabaseClient {
  if (!client) throw new Error('Supabase client requested before live data was loaded.');
  return client;
}

export { ensureGuestSession, currentUserId, serverErrorCode, GuestSessionError } from './session';
