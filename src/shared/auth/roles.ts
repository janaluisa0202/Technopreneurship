import type { Session } from '@supabase/supabase-js';
import type { AuthUser } from './types';

/**
 * Builds the app user from a Supabase session and the roles returned by my_admin_roles() (server).
 * Admin UI labels: super_admin → Owner, any other active role → Moderator. This is presentation only;
 * Row-Level Security decides what each role can actually do.
 */
export function userFrom(session: Pick<Session, 'user'>, roles: string[], profile: { display_name?: string | null } | null): AuthUser {
  const meta = session.user.user_metadata as { display_name?: string } | undefined;
  const email = session.user.email ?? '';
  const name = profile?.display_name || meta?.display_name || email.split('@')[0] || 'SakayWise user';
  if (!roles.length) return { id: session.user.id, name, email, role: 'customer' };
  return { id: session.user.id, name, email, role: 'admin', adminRole: roles.includes('super_admin') ? 'owner' : 'moderator', adminRoles: roles };
}

