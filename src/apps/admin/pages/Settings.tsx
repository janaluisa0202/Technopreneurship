import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { ConfirmDialog, PageHeader, useToast } from '../components/ui';
import { run } from '../lib/actions';
import { adminStore } from '../services/store';
import { DEMO_MODE } from '../../../shared/auth/authService';
import type { Appearance } from '../theme';
import type { AdminAccount } from '../types';
import { composeAutoReply, contactKinds, validateAutoReply, type AutoReplyConfig, type ContactKind } from '../../../shared/messaging/autoReply';

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
        <AutoReplySettings />
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

/** Support → automated reply: the acknowledgement commuters get, with alternative ways to reach the team. */
function AutoReplySettings() {
  const toast = useToast();
  const [saved, setSaved] = useState<AutoReplyConfig | null>(null);
  const [draft, setDraft] = useState<AutoReplyConfig | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const load = () => { setLoadError(''); adminStore.loadAutoReply().then(c => { setSaved(c); setDraft(c); }, () => setLoadError('Could not load the auto-reply settings.')); };
  useEffect(load, []);
  if (!draft || !saved) return <section className="panel panel-pad span-2"><h2 className="panel-title">Support auto-reply</h2><p className="muted">{loadError || 'Loading…'}</p>{loadError && <button type="button" className="btn ghost" onClick={load}>Try again</button>}</section>;

  const set = (patch: Partial<AutoReplyConfig>) => setDraft({ ...draft, ...patch });
  const setChannel = (i: number, patch: Partial<AutoReplyConfig['channels'][number]>) => set({ channels: draft.channels.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const problem = validateAutoReply(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const save = () => {
    if (problem || saving) return;
    setSaving(true);
    void run(toast, adminStore.saveAutoReply(draft, saved), 'Auto-reply saved.').then(ok => { setSaving(false); if (ok) load(); });
  };
  return (
    <section className="panel panel-pad span-2 auto-reply"><h2 className="panel-title">Support auto-reply</h2>
      <p className="muted">When a commuter writes to Help &amp; Support and nobody has answered in that chat for 24 hours, they immediately get this message with the contact channels below. Guests also see the channels on the support screen. Use real, official contact details only.{DEMO_MODE ? ' Demo mode: saved in this browser only.' : ' Only support staff can save changes.'}</p>
      <label className="check"><input type="checkbox" checked={draft.enabled} onChange={e => set({ enabled: e.target.checked })} />Send the automated reply</label>
      <div className="field"><label htmlFor="ar-message">Message</label>
        <textarea id="ar-message" rows={3} maxLength={600} value={draft.message} onChange={e => set({ message: e.target.value })} />
        <span className="hint">{draft.message.trim().length}/600</span></div>
      <div className="field"><label htmlFor="ar-hours">Support hours (optional)</label>
        <input id="ar-hours" maxLength={200} value={draft.supportHours} placeholder="e.g. Monday to Saturday, 8:00 AM – 6:00 PM" onChange={e => set({ supportHours: e.target.value })} /></div>
      <h3 className="panel-subtitle">Other ways to reach us</h3>
      {draft.channels.length === 0 && <p className="muted">No contact channels yet. The reply will only contain the message above.</p>}
      <ul className="channel-list">
        {draft.channels.map((c, i) => (
          <li key={c.id} className="channel-row">
            <select aria-label="Channel type" value={c.kind} onChange={e => setChannel(i, { kind: e.target.value as ContactKind })}>
              {Object.entries(contactKinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input aria-label="Label" maxLength={60} placeholder="Label (e.g. Email)" value={c.label} onChange={e => setChannel(i, { label: e.target.value })} />
            <input aria-label="Contact" maxLength={200} placeholder="Address or number" value={c.value} onChange={e => setChannel(i, { value: e.target.value })} />
            <label className="check"><input type="checkbox" checked={c.active} onChange={e => setChannel(i, { active: e.target.checked })} />Shown</label>
            <button type="button" className="icon-btn danger" aria-label={`Remove ${c.label || 'channel'}`} onClick={() => set({ channels: draft.channels.filter((_, j) => j !== i) })}><Icon name="trash" size={18} /></button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn small ghost" disabled={draft.channels.length >= 10} onClick={() => set({ channels: [...draft.channels, { id: `new-${Date.now()}-${draft.channels.length}`, kind: 'email', label: '', value: '', active: true }] })}>Add contact channel</button>
      <h3 className="panel-subtitle">Preview</h3>
      <p className="auto-reply-preview">{draft.enabled ? composeAutoReply(draft) : 'The automated reply is off.'}</p>
      {problem && dirty && <p className="form-error">{problem}</p>}
      <div className="card-actions">
        <button type="button" className="btn ghost" disabled={!dirty || saving} onClick={() => setDraft(saved)}>Discard changes</button>
        <button type="button" className="btn primary" disabled={!dirty || !!problem || saving} onClick={save}>{saving ? 'Saving…' : 'Save auto-reply'}</button>
      </div>
    </section>
  );
}
