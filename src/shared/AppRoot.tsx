
import { useEffect, useState } from 'react';
import { CommuterApp } from '../apps/commuter/CommuterApp';
import { CommuterDataGate } from '../apps/commuter/components/CommuterDataGate';
import { runtimeConfig } from '../apps/commuter/services/env';
import { LoginPage } from './auth/LoginPage';
import { authService } from './auth/authService';
import type { AuthUser } from './auth/types';

export const ADMIN_URL = `${import.meta.env.BASE_URL}admin.html`;

/**
 * The single front door (/). Not signed in → login page.
 * After sign-in, the role decides the destination:
 * admins are sent to the admin website, customers stay here.
 *
 * CommuterDataGate validates and loads the Supabase transport
 * catalog before the commuter application is rendered.
 */
export function AppRoot() {
  const [user, setUser] = useState<AuthUser | null>(() => authService.restoreSession());

  useEffect(() => {
    if (user?.role === 'admin') location.replace(ADMIN_URL);
  }, [user]);

  if (!user) return <LoginPage onSignedIn={setUser} />;

  if (user.role === 'admin') {
    return <div className="auth-note" role="status">Opening the admin console…</div>;
  }

  return (
    <CommuterDataGate config={runtimeConfig}>
      <CommuterApp
        account={user}
        onSignOut={() => {
          authService.logout();
          setUser(null);
        }}
      />
    </CommuterDataGate>
  );
}
