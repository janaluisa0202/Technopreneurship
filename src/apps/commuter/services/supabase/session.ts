// SDK-free session/error helpers (type-only SDK import), so adapters stay unit-testable.
import type { SupabaseClient } from '@supabase/supabase-js';

let pendingSession: Promise<string> | undefined;

/**
 * Returns the current user id, creating a Supabase *anonymous* session only when a guest first
 * submits something (queue report, support message). Browsing never creates an account.
 * The session JWT — not a client-generated id — is what RLS uses to scope the guest's data.
 */
export async function ensureGuestSession(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  pendingSession ??= supabase.auth.signInAnonymously().then(({ data: signedIn, error }) => {
    if (error || !signedIn.user) throw new GuestSessionError(error?.message);
    return signedIn.user.id;
  }).finally(() => { pendingSession = undefined; });
  return pendingSession;
}

export async function currentUserId(supabase: SupabaseClient): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

export class GuestSessionError extends Error {
  constructor(detail?: string) { super(`guest_session_unavailable${detail ? `: ${detail}` : ''}`); }
}

/** Server error codes raised by the SakayWise RPCs (see supabase/migrations). */
export function serverErrorCode(error: unknown): string {
  const message = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  const known = ['rate_limited', 'duplicate_report', 'duplicate_message', 'unknown_terminal', 'segment_not_at_terminal', 'invalid_input',
    'invalid_email', 'empty_message', 'message_too_long', 'conversation_not_found', 'conversation_closed', 'conversation_limit',
    'authentication_required', 'forbidden', 'guest_session_unavailable'];
  return known.find(code => message.includes(code)) ?? 'unavailable';
}
