import { actionMessage } from '../services/store';

type Toast = (text: string, tone?: 'ok' | 'error') => void;
/** Awaits an admin action; shows the success toast only after the store (or server) accepted it. */
export function run(toast: Toast, action: Promise<unknown>, success: string, failure = 'Could not save the change.'): Promise<boolean> {
  return action.then(
    () => { if (success) toast(success); return true; },
    error => { toast(actionMessage(error, failure), 'error'); return false; },
  );
}
