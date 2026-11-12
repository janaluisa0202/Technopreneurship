import { useMemo, useState } from 'react';
import { EmptyState, PageHeader, Pill, SearchBox, useDebounced, useNow } from '../components/ui';
import { useAdminState } from '../services/store';
import { fullDate, timeAgo } from '../lib/format';
import type { ActivityArea } from '../types';

const areaLabels: Record<ActivityArea, string> = { auth: 'Sign-in', promo: 'Promos', support: 'Help Center', incident: 'Incidents', message: 'Messages', queue: 'Queue reports', announcement: 'Announcements', system: 'System' };

export function ActivityLog() {
  const { activity, sync } = useAdminState();
  const now = useNow();
  const [query, setQuery] = useState('');
  const q = useDebounced(query).trim().toLowerCase();
  const [area, setArea] = useState<'all' | ActivityArea>('all');
  const [who, setWho] = useState('all');
  const admins = useMemo(() => Array.from(new Set(activity.map(a => a.adminName))), [activity]);
  const rows = activity.filter(a => (area === 'all' || a.area === area) && (who === 'all' || a.adminName === who) && (!q || `${a.action} ${a.target} ${a.adminName}`.toLowerCase().includes(q)));
  return (
    <>
      <PageHeader title="Activity log" subtitle={sync.mode === 'live' ? 'Who changed what, newest first, from the server audit trail (latest 300 entries).' : 'Who changed what, newest first. The last 300 actions are kept.'} />
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search activity" label="Search activity" />
        <label className="select-inline compact"><span className="sr-only">Module</span><select value={area} onChange={e => setArea(e.target.value as 'all' | ActivityArea)}><option value="all">All modules</option>{Object.entries(areaLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="select-inline compact"><span className="sr-only">Admin</span><select value={who} onChange={e => setWho(e.target.value)}><option value="all">All admins</option>{admins.map(a => <option key={a} value={a}>{a}</option>)}</select></label>
      </div>
      {sync.activityRestricted ? <div className="panel"><EmptyState icon="log" title="Activity log is limited to admins" text="Your role can manage its own modules but cannot read the audit trail. Ask a super admin if you need access." /></div> : rows.length === 0 ? <div className="panel"><EmptyState icon="log" title="No activity found" /></div> : (
        <div className="panel table-panel"><div className="table-scroll"><table className="table">
          <thead><tr><th scope="col">When</th><th scope="col">Admin</th><th scope="col">Module</th><th scope="col">Action</th><th scope="col">Item</th></tr></thead>
          <tbody>{rows.map(a => (
            <tr key={a.id}><td className="nowrap"><span title={fullDate(a.at)}>{timeAgo(a.at, now)}</span></td><td>{a.adminName}</td><td><Pill tone="neutral">{areaLabels[a.area]}</Pill></td><td>{a.action}</td><td className="cell-details">{a.target}</td></tr>))}</tbody>
        </table></div></div>
      )}
    </>
  );
}
