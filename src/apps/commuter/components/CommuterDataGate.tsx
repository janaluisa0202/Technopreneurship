import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../../../shared/i18n';
import { setActiveCatalog } from '../services/catalog';
import { configProblemMessages, type RuntimeConfig } from '../services/runtimeConfig';
import { loadSupabaseClient } from '../services/supabase/client';
import { createRemoteSupportService, loadRemoteCatalog } from '../services/supabase/remoteServices';
import { configureSupportService } from '../lib/supportService';

type GateState = { status: 'ready' } | { status: 'loading' } | { status: 'error'; message: string };

/**
 * Demo mode: renders the app immediately with bundled data (no requests).
 * Live mode: loads and validates ONE network/fare snapshot, installs it and the remote support
 * adapter, then mounts the app. A failure shows an error with retry — never demo fixtures.
 */
export function CommuterDataGate({ config, children }: { config: RuntimeConfig; children: ReactNode }) {
  const { text } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GateState>(() => config.mode === 'demo' ? { status: 'ready' }
    : config.problem ? { status: 'error', message: configProblemMessages[config.problem] } : { status: 'loading' });
  useEffect(() => {
    if (config.mode === 'demo' || config.problem) return;
    const controller = new AbortController();
    setState({ status: 'loading' });
    loadSupabaseClient(config).then(async supabase => ({ supabase, catalog: await loadRemoteCatalog(supabase, controller.signal) })).then(({ supabase, catalog }) => {
      if (controller.signal.aborted) return;
      setActiveCatalog(catalog);
      let storage: Pick<Storage, 'getItem' | 'setItem'>;
      try { storage = localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw new Error('Storage unavailable'); } }; }
      configureSupportService(createRemoteSupportService(supabase, storage));
      setState({ status: 'ready' });
    }).catch(error => {
      if (controller.signal.aborted) return;
      const invalid = error instanceof Error && error.message.startsWith('invalid_catalog');
      setState({ status: 'error', message: invalid
        ? 'The SakayWise database returned transport data that failed validation. Routes are not shown rather than risk wrong guidance.'
        : 'Unable to load transport data from the SakayWise database. Check your connection and try again.' });
    });
    return () => controller.abort();
  }, [config, attempt]);

  if (state.status === 'ready') return <>{children}</>;
  return <main className="workspace"><div className="phone"><div className="app-content"><section className="data-gate" aria-live="polite">
    <div className="wordmark">Sakay<span>Wise</span></div>
    {state.status === 'loading'
      ? <p role="status">{text('Loading transport data…')}</p>
      : <>
          <p role="alert">{text(state.message)}</p>
          {config.problem
            ? <p className="demo-note">{text('Fix the environment configuration, or set VITE_SAKAYWISE_DATA_MODE=demo to use the bundled demo data.')}</p>
            : <button type="button" className="submit" onClick={() => setAttempt(value => value + 1)}>{text('Try again')}</button>}
        </>}
  </section></div></div></main>;
}
