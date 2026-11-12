import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './apps/admin/AdminApp';
import { authService } from './shared/auth/authService';
import type { AdminAccount } from './apps/admin/types';

const home = import.meta.env.BASE_URL;
const user = authService.restoreSession();

if (!user || user.role !== 'admin') {
  // Not signed in, or a customer account: back to the shared login page. (The backend must also refuse non-admins.)
  location.replace(home);
} else {
  const account: AdminAccount = { id: user.id, name: user.name, email: user.email, role: user.adminRole ?? 'moderator' };
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AdminApp account={account} onSignOut={() => { authService.logout(); location.replace(home); }} />
    </React.StrictMode>,
  );
}
