// One place for both entry points (commuter `/` and admin `/admin.html`) to know the data mode and
// reach the single shared Supabase client. Demo mode never loads the SDK.
import { runtimeConfig } from '../../apps/commuter/services/env';
import { configProblemMessages } from '../../apps/commuter/services/runtimeConfig';
import { loadSupabaseClient } from '../../apps/commuter/services/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export const LIVE_MODE = runtimeConfig.mode === 'live';
export const liveConfigProblem: string | undefined = runtimeConfig.problem ? configProblemMessages[runtimeConfig.problem] : undefined;

export function getLiveClient(): Promise<SupabaseClient> {
  return loadSupabaseClient(runtimeConfig);
}
