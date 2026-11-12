import { useEffect, useState } from 'react';
import type { QueueReport } from '../types';
import type { RemoteQueueService } from '../services/supabase/remoteServices';

interface State { reports: QueueReport[]; noReport: string[]; nextChangeAt?: number; status: 'idle' | 'loading' | 'ready' | 'error'; }

/** Server queue estimates with Realtime refresh, expiry refresh, abort-on-unmount and retry. Idle in demo mode. */
export function useLiveQueues(service: RemoteQueueService | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ reports: [], noReport: [], status: service ? 'loading' : 'idle' });
  useEffect(() => {
    if (!service) return;
    const controller = new AbortController();
    service.load(controller.signal)
      .then(result => { if (!controller.signal.aborted) setState({ ...result, status: 'ready' }); })
      // Keep the last good values on screen but surface the failure; never substitute samples.
      .catch(() => { if (!controller.signal.aborted) setState(previous => ({ ...previous, status: 'error' })); });
    return () => controller.abort();
  }, [service, attempt]);
  useEffect(() => {
    if (!service) return;
    let timer: number | undefined;
    const unsubscribe = service.subscribe(() => { window.clearTimeout(timer); timer = window.setTimeout(() => setAttempt(value => value + 1), 500); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [service]);
  useEffect(() => {
    if (!state.nextChangeAt) return;
    const timer = window.setTimeout(() => setAttempt(value => value + 1), Math.min(Math.max(state.nextChangeAt - Date.now() + 500, 1000), 2147483647));
    return () => window.clearTimeout(timer);
  }, [state.nextChangeAt]);
  return { ...state, retry: () => setAttempt(value => value + 1) };
}
