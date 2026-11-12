import { Icon, type IconName } from '../components/Icon';
import { Pill, PageHeader, EmptyState, useNow } from '../components/ui';
import { useAdminState } from '../services/store';
import { href, type RouteKey } from '../lib/router';
import { timeAgo, todayISO } from '../lib/format';
import { channelLabels, incidentCategoryLabels, severityLabels, supportCategoryLabels } from '../lib/labels';
import type { AdminAccount } from '../types';

export function Dashboard({ admin }: { admin: AdminAccount }) {
  const s = useAdminState();
  const now = useNow();
  const today = todayISO();
  const activePromos = s.promos.filter(p => p.status === 'active' && p.endDate >= today && p.startDate <= today).length;
  const openSupport = s.conversations.filter(c => c.status === 'open' && !c.flaggedSpam).length;
  const activeIncidents = s.incidents.filter(i => i.status === 'active').length;
  const unread = s.conversations.filter(c => c.unread && !c.flaggedSpam).length;
  const pendingQueue = s.queueReports.filter(r => r.status === 'pending').length;

  const cards: { label: string; value: number; icon: IconName; to: RouteKey; tone: string; note: string }[] = [
    { label: 'Active promos', value: activePromos, icon: 'promo', to: 'promos', tone: 'yellow', note: 'Live today' },
    { label: 'Open support messages', value: openSupport, icon: 'help', to: 'help', tone: 'blue', note: 'Waiting for a reply' },
    { label: 'Active incidents', value: activeIncidents, icon: 'incident', to: 'incidents', tone: 'red', note: 'Shown in RoadWatch' },
    { label: 'Unread messages', value: unread, icon: 'mail', to: 'help', tone: 'blue', note: 'Not opened yet' },
    { label: 'Pending queue reports', value: pendingQueue, icon: 'queue', to: 'queue', tone: 'yellow', note: 'Need review' },
  ];
  const recentSupport = [...s.conversations].filter(c => !c.flaggedSpam).sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)).slice(0, 5);
  const latestIncidents = [...s.incidents].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 4);
  const latestAnnouncements = [...s.announcements].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 4);
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader title={`${greeting}, ${admin.name.split(' ')[0]}`} subtitle="Here is what needs attention across SakayWise right now." />
      <section className="summary-grid" aria-label="Summary">
        {cards.map(card => (
          <a key={card.label} className={`summary-card ${card.tone}`} href={href(card.to)}>
            <span className="summary-icon"><Icon name={card.icon} size={22} /></span>
            <strong className="summary-value">{card.value}</strong>
            <span className="summary-label">{card.label}</span>
            <small>{card.note}</small>
          </a>
        ))}
      </section>

      <div className="dash-grid">
        <section className="panel wide">
          <header className="panel-head"><h2>Recent support messages</h2><a href={href('help')}>Open Help Center <Icon name="arrow" size={16} /></a></header>
          {recentSupport.length === 0 ? <EmptyState icon="help" title="No support messages yet" text="New concerns from commuters will appear here." /> : (
            <ul className="row-list">
              {recentSupport.map(c => {
                const last = c.messages.at(-1);
                return (
                  <li key={c.id}>
                    <a className="row-link" href={href('help', c.id)}>
                      <span className={`dot${c.unread ? ' on' : ''}`} aria-label={c.unread ? 'Unread' : 'Read'} />
                      <span className="row-main">
                        <strong>{c.nickname || 'Guest'} <small>· {supportCategoryLabels[c.category]}</small></strong>
                        <span className="clamp">{last?.message ?? 'No messages'}</span>
                      </span>
                      <span className="row-meta"><Pill tone={c.status === 'open' ? 'blue' : c.status === 'pending' ? 'yellow' : 'green'}>{c.status}</Pill><small>{timeAgo(c.lastMessageAt, now)}</small></span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel">
          <header className="panel-head"><h2>Latest incident reports</h2><a href={href('incidents')}>Manage <Icon name="arrow" size={16} /></a></header>
          {latestIncidents.length === 0 ? <EmptyState icon="incident" title="No incidents posted" /> : (
            <ul className="row-list">
              {latestIncidents.map(i => (
                <li key={i.id}>
                  <a className="row-link" href={href('incidents')}>
                    <span className="row-main"><strong>{i.title}</strong><span className="clamp">{incidentCategoryLabels[i.category]} · {i.areaName}</span></span>
                    <span className="row-meta"><Pill tone={i.severity === 'critical' ? 'red' : i.severity === 'high' ? 'orange' : i.severity === 'moderate' ? 'yellow' : 'blue'}>{severityLabels[i.severity]}</Pill><small>{i.status === 'resolved' ? 'Resolved' : timeAgo(i.updatedAt, now)}</small></span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <header className="panel-head"><h2>Latest announcements</h2><a href={href('announcements')}>Manage <Icon name="arrow" size={16} /></a></header>
          {latestAnnouncements.length === 0 ? <EmptyState icon="announce" title="No announcements yet" /> : (
            <ul className="row-list">
              {latestAnnouncements.map(a => (
                <li key={a.id}>
                  <a className="row-link" href={href('announcements')}>
                    <span className="row-main"><strong>{a.title}</strong><span className="clamp">{channelLabels[a.channel]}</span></span>
                    <span className="row-meta"><Pill tone={a.status === 'published' ? 'green' : a.status === 'draft' ? 'yellow' : 'neutral'}>{a.status}</Pill><small>{timeAgo(a.updatedAt, now)}</small></span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
