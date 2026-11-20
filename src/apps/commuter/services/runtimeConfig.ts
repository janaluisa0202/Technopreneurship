// Explicit, environment-driven data mode. Pure (takes the env object) so it is unit-testable.
//   VITE_SAKAYWISE_DATA_MODE=demo  (default) bundled illustrative data, no network requests
//   VITE_SAKAYWISE_DATA_MODE=live  Supabase; requires URL + public key, otherwise a visible error
// Live mode never silently substitutes demo data.
export type DataMode = 'demo' | 'live';
export type ConfigProblem = 'invalid-mode' | 'missing-url' | 'invalid-url' | 'missing-key' | 'secret-key';
export interface RuntimeConfig {
  mode: DataMode;
  supabaseUrl?: string;
  supabaseKey?: string;
  problem?: ConfigProblem;
}

type Env = Record<string, string | boolean | undefined>;
const value = (env: Env, key: string) => { const raw = env[key]; return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined; };

/** Detects keys that must never reach a browser: new-style secret keys and legacy service_role JWTs. */
export function isPrivilegedKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(globalThis.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return json?.role === 'service_role' || json?.role === 'supabase_admin';
  } catch {
    return false;
  }
}

export function readRuntimeConfig(env: Env): RuntimeConfig {
  const requested = (value(env, 'VITE_SAKAYWISE_DATA_MODE') || 'demo').toLowerCase();
  if (requested !== 'demo' && requested !== 'live') return { mode: 'live', problem: 'invalid-mode' };
  if (requested === 'demo') return { mode: 'demo' };
  const supabaseUrl = value(env, 'VITE_SUPABASE_URL');
  const supabaseKey = value(env, 'VITE_SUPABASE_PUBLISHABLE_KEY') || value(env, 'VITE_SUPABASE_ANON_KEY');
  if (!supabaseUrl) return { mode: 'live', problem: 'missing-url' };
  try {
    const url = new URL(supabaseUrl);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return { mode: 'live', problem: 'invalid-url' };
  } catch {
    return { mode: 'live', problem: 'invalid-url' };
  }
  if (!supabaseKey) return { mode: 'live', supabaseUrl, problem: 'missing-key' };
  if (isPrivilegedKey(supabaseKey)) return { mode: 'live', supabaseUrl, problem: 'secret-key' };
  return { mode: 'live', supabaseUrl, supabaseKey };
}

export const configProblemMessages: Record<ConfigProblem, string> = {
  'invalid-mode': 'VITE_SAKAYWISE_DATA_MODE must be "demo" or "live".',
  'missing-url': 'Live mode needs VITE_SUPABASE_URL.',
  'invalid-url': 'VITE_SUPABASE_URL must be an https:// project URL (http:// is allowed only for localhost).',
  'missing-key': 'Live mode needs VITE_SUPABASE_PUBLISHABLE_KEY (or the legacy VITE_SUPABASE_ANON_KEY).',
  'secret-key': 'Refusing to start: the configured key is a secret/service-role key. Only the publishable (anon) key may be used in the browser.',
};
