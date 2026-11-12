import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './apps/admin/AdminApp';
import { authService, DEMO_MODE } from './shared/auth/authService';
import { liveConfigProblem } from './shared/backend/runtime';
import type { AdminAccount } from './apps/admin/types';

const home = import.meta.env.BASE_URL;
const root = createRoot(document.getElementById('root')!);
const note = (text: string, retry = false) => root.render(
  <div role={retry ? 'alert' : 'status'} style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
    <div><p>{text}</p>{retry && <button type="button" onClick={() => location.reload()}>Try again</button>}</div>
  </div>,
);

/**
 * The admin site only opens for a signed-in admin. In live mode the role comes from the server
 * (my_admin_roles); this redirect is a convenience — Row-Level Security enforces every admin action.
 */
async function start() {
  if (!DEMO_MODE && liveConfigProblem) { note(liveConfigProblem); return; }
  if (!DEMO_MODE) note('Checking your admin access…');
  let user;
  try { user = await authService.init(); } catch { note('Unable to reach the SakayWise server. Check your connection and try again.', true); return; }
  if (!user || user.role !== 'admin') {
    // Not signed in, or a customer account: back to the shared login page.
    location.replace(home);
    return;
  }
  const account: AdminAccount = { id: user.id, name: user.name, email: user.email, role: user.adminRole ?? 'moderator', roles: user.adminRoles };
  // Signed out in another tab, session expired, or the role was revoked.
  authService.onChange(next => { if (!next || next.role !== 'admin') location.replace(home); });
  root.render(
    <React.StrictMode>
      <AdminApp account={account} onSignOut={() => { void authService.logout().finally(() => location.replace(home)); }} />
    </React.StrictMode>,
  );
}
void start();
