import { useMemo, useState } from 'react';
import { Chips, EmptyState, Modal, PageHeader, Pill, SearchBox, useDebounced, useNow } from '../components/ui';
import { useAdminState } from '../services/store';
import { go } from '../lib/router';
import { fullDate, initials, timeAgo } from '../lib/format';
import { supportCategoryLabels } from '../lib/labels';
import type { AppUser } from '../types';

const ACTIVE_WINDOW_MS = 14 * 86400000;

export function Users() {
  const { users, conversations } = useAdminState();
  const now = useNow(60000);
  const [query, setQuery] = useState('');
  const q = useDebounced(query).trim().toLowerCase();
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'support'>('all');
  const [open, setOpen] = useState<AppUser | null>(null);

  const convCount = (u: AppUser) => u.conversationCount ?? conversations.filter(c => c.userId === u.id).length;
  const rows = useMemo(() => users.map(u => ({ u, active: now - Date.parse(u.lastActiveAt) < ACTIVE_WINDOW_MS, convs: conversations.filter(c => c.userId === u.id), count: u.conversationCount ?? conversations.filter(c => c.userId === u.id).length }))
    .filter(x => (filter === 'all' || (filter === 'active' && x.active) || (filter === 'inactive' && !x.active) || (filter === 'support' && x.count > 0)) && (!q || `${x.u.nickname} ${x.u.email ?? ''}`.toLowerCase().includes(q)))
    .sort((a, b) => Date.parse(b.u.lastActiveAt) - Date.parse(a.u.lastActiveAt)), [users, conversations, now, filter, q]);
  const total = (fn: (x: { active: boolean; count: number }) => boolean) => users.filter(u => fn({ active: now - Date.parse(u.lastActiveAt) < ACTIVE_WINDOW_MS, count: convCount(u) })).length;

  return (
    <>
      <PageHeader title="Users" subtitle="Commuters who contacted support or signed in. Active means seen in the last 14 days." />
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search by name or email" label="Search users" />
        <Chips label="Filter users" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All', count: users.length }, { value: 'active', label: 'Active', count: total(x => x.active) }, { value: 'inactive', label: 'Inactive', count: total(x => !x.active) }, { value: 'support', label: 'Contacted support', count: total(x => x.count > 0) }]} />
      </div>
      {rows.length === 0 ? <div className="panel"><EmptyState icon="users" title="No users found" text="Try a different search or filter." /></div> : (
        <div className="panel table-panel"><div className="table-scroll">
          <table className="table">
            <thead><tr><th scope="col">Commuter</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Conversations</th><th scope="col">Last active</th><th scope="col"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{rows.map(({ u, active, count }) => (
              <tr key={u.id}>
                <td><div className="user-cell"><span className="avatar">{initials(u.nickname)}</span><div className="cell-main"><strong>{u.nickname}</strong><span>{u.email ?? 'No email'}</span></div></div></td>
                <td>{u.kind === 'account' ? 'Account' : 'Guest session'}</td>
                <td><Pill tone={active ? 'green' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Pill></td>
                <td>{count}</td>
                <td className="nowrap">{timeAgo(u.lastActiveAt, now)}</td>
                <td><button type="button" className="btn small ghost" onClick={() => setOpen(u)}>View</button></td>
              </tr>))}</tbody>
          </table>
        </div></div>
      )}
      {open && (
        <Modal title={open.nickname} onClose={() => setOpen(null)} footer={<button type="button" className="btn ghost" onClick={() => setOpen(null)}>Close</button>}>
          <dl className="detail-list">
            <div><dt>Email</dt><dd>{open.email ?? '—'}</dd></div>
            <div><dt>Type</dt><dd>{open.kind === 'account' ? 'Account' : 'Guest session'}</dd></div>
            <div><dt>Joined</dt><dd>{fullDate(open.joinedAt)}</dd></div>
            <div><dt>Last active</dt><dd>{fullDate(open.lastActiveAt)}</dd></div>
          </dl>
          <h3 className="sub-title">Message history</h3>
          {conversations.filter(c => c.userId === open.id).length === 0 ? <p className="muted">This commuter has not contacted support.</p> : (
            <ul className="history">{conversations.filter(c => c.userId === open.id).map(c => (
              <li key={c.id}><div className="history-top"><strong>{supportCategoryLabels[c.category]}</strong><Pill tone={c.status === 'open' ? 'blue' : c.status === 'pending' ? 'yellow' : 'green'}>{c.status}</Pill></div>
                <p className="clamp-3">{c.messages.at(-1)?.message}</p>
                <button type="button" className="link-btn" onClick={() => { setOpen(null); go('help', c.id); }}>Open conversation</button></li>))}</ul>
          )}
        </Modal>
      )}
    </>
  );
}
