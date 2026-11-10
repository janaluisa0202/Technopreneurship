import type { SupabaseClient } from '@supabase/supabase-js';
import type { RuntimeConfig } from '../runtimeConfig';

let client: SupabaseClient | undefined;

/**
 * Creates the browser client in live mode only. The SDK is loaded with a dynamic import, so demo
 * mode neither downloads it nor makes any network request. Uses ONLY the public URL + publishable
 * (anon) key; Row-Level Security on the server does the authorization.
 */
export async function loadSupabaseClient(config: RuntimeConfig): Promise<SupabaseClient> {
  if (config.mode !== 'live' || config.problem || !config.supabaseUrl || !config.supabaseKey) {
    throw new Error('Supabase is not configured for live mode.');
  }
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client ??= createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'sakaywise:auth:v1' },
    });
  }
  return client;
}

/** The client created by CommuterDataGate before the app mounted (live mode only). */
export function requireSupabaseClient(): SupabaseClient {
  if (!client) throw new Error('Supabase client requested before live data was loaded.');
  return client;
}

export { ensureGuestSession, currentUserId, serverErrorCode, GuestSessionError } from './session';
