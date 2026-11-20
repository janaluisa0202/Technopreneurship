import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ConfirmDialog, PageHeader, useToast } from '../components/ui';
import { run } from '../lib/actions';
import { adminStore } from '../services/store';
import { DEMO_MODE } from '../../../shared/auth/authService';
import type { Appearance } from '../theme';
import type { AdminAccount } from '../types';

export function Settings({ admin, appearance, onAppearance }: { admin: AdminAccount; appearance: Appearance; onAppearance: (a: Appearance) => void }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const options: { value: Appearance; label: string; icon: 'sun' | 'moon' | 'dashboard' }[] = [{ value: 'light', label: 'Light', icon: 'sun' }, { value: 'dark', label: 'Dark', icon: 'moon' }, { value: 'system', label: 'Match system', icon: 'dashboard' }];
  return (
    <>
      <PageHeader title="Settings" subtitle="Your account and how the admin site looks." />
      <div className="settings-grid">
        <section className="panel panel-pad"><h2 className="panel-title">Account</h2>
          <dl className="detail-list"><div><dt>Name</dt><dd>{admin.name}</dd></div><div><dt>Email</dt><dd>{admin.email}</dd></div><div><dt>Role</dt><dd>{admin.role === 'owner' ? 'Owner' : 'Moderator'}{admin.roles?.length ? ` (${admin.roles.map(r => r.replace(/_/g, ' ')).join(', ')})` : ''}</dd></div></dl>
          {admin.roles && <p className="muted">Roles are assigned on the server by a super admin. Each action is checked by the database, so some buttons may report that your role is not allowed.</p>}
        </section>
        <section className="panel panel-pad"><h2 className="panel-title">Appearance</h2>
          <div className="segmented" role="group" aria-label="Appearance">
            {options.map(o => <button key={o.value} type="button" aria-pressed={appearance === o.value} className={appearance === o.value ? 'on' : ''} onClick={() => onAppearance(o.value)}><Icon name={o.icon} size={18} />{o.label}</button>)}
          </div>
        </section>
        {DEMO_MODE && (
          <section className="panel panel-pad span-2"><h2 className="panel-title">Demo data</h2>
            <p className="muted">This prototype stores everything in your browser. Reset to restore the starter promos, conversations, incidents and reports.</p>
            {admin.role === 'owner'
              ? <button type="button" className="btn ghost danger-text" onClick={() => setConfirm(true)}>Reset demo data</button>
              : <p className="muted">Only owners can reset demo data.</p>}
          </section>
        )}
      </div>
      {confirm && <ConfirmDialog danger title="Reset demo data?" message="All changes you made to promos, conversations, incidents, reports, announcements and users will be replaced with the starter data." confirmLabel="Reset" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void run(toast, adminStore.resetDemoData(), 'Demo data reset.'); }} />}
    </>
  );
}
