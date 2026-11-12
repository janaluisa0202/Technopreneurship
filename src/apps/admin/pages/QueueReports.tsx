import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Chips, EmptyState, PageHeader, Pill, useNow, useToast } from '../components/ui';
import { adminStore, useAdminState } from '../services/store';
import { QUEUE_REPORT_TTL_MS } from '../../commuter/lib/queues';
import { fullDate, timeAgo } from '../lib/format';
import { queueLevelLabels } from '../lib/labels';
import type { QueueReportStatus } from '../types';

const levelTone = { low: 'green', mid: 'yellow', high: 'red' } as const;
const statusTone = { pending: 'yellow', approved: 'green', rejected: 'neutral', spam: 'red' } as const;

export function QueueReports() {
  const { queueReports } = useAdminState();
  const now = useNow();
  const toast = useToast();
  const [tab, setTab] = useState<QueueReportStatus>('pending');
  const count = (s: QueueReportStatus) => queueReports.filter(r => r.status === s).length;
  const rows = useMemo(() => queueReports.filter(r => r.status === tab).sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt)), [queueReports, tab]);

  const latest = useMemo(() => {
    const byTerminal = new Map<string, (typeof queueReports)[number]>();
    for (const r of [...queueReports].filter(r => r.status === 'approved').sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt))) if (!byTerminal.has(r.terminal)) byTerminal.set(r.terminal, r);
    return [...byTerminal.values()];
  }, [queueReports]);

  const act = (id: string, status: QueueReportStatus, msg: string) => { adminStore.reviewQueueReport(id, status); toast(msg); };

  return (
    <>
      <PageHeader title="Queue reports" subtitle="Review commuter-submitted queue reports so wrong or outdated ones never reach route recommendations." />
      <div className="split wide-left">
        <section className="panel">
          <div className="panel-pad"><Chips label="Report status" value={tab} onChange={setTab} options={[
            { value: 'pending', label: 'Pending', count: count('pending') }, { value: 'approved', label: 'Approved', count: count('approved') },
            { value: 'rejected', label: 'Rejected', count: count('rejected') }, { value: 'spam', label: 'Spam', count: count('spam') },
          ]} /></div>
          {rows.length === 0 ? <EmptyState icon="queue" title={`No ${tab} reports`} text={tab === 'pending' ? 'You are all caught up.' : 'Nothing here yet.'} /> : (
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th scope="col">Terminal</th><th scope="col">Queue</th><th scope="col">Details</th><th scope="col">Reported</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {rows.map(r => {
                    const age = now - Date.parse(r.reportedAt);
                    const stale = age >= QUEUE_REPORT_TTL_MS;
                    return (
                      <tr key={r.id}>
                        <td className="cell-main"><strong>{r.terminal}</strong><span>Reporter {r.reporterId}</span></td>
                        <td><Pill tone={levelTone[r.level]}>{queueLevelLabels[r.level]}</Pill></td>
                        <td className="cell-details">{r.details || <span className="muted">No details</span>}</td>
                        <td className="nowrap"><span title={fullDate(r.reportedAt)}>{timeAgo(r.reportedAt, now)}</span>{r.status === 'pending' && stale && <><br /><Pill tone="neutral">Outdated</Pill></>}</td>
                        <td>
                          <div className="row-actions">
                            {r.status === 'pending' ? <>
                              <button type="button" className="btn small success" onClick={() => act(r.id, 'approved', 'Report approved.')}><Icon name="check" size={16} />Approve</button>
                              <button type="button" className="btn small ghost" onClick={() => act(r.id, 'rejected', 'Report rejected.')}>Reject</button>
                              <button type="button" className="btn small ghost danger-text" onClick={() => act(r.id, 'spam', 'Marked as spam.')}><Icon name="flag" size={16} />Spam</button>
                            </> : <>
                              <Pill tone={statusTone[r.status]}>{r.status}</Pill>
                              <button type="button" className="btn small ghost" onClick={() => act(r.id, 'pending', 'Returned to pending.')}>Undo</button>
                            </>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="panel" aria-label="Latest approved queue status">
          <header className="panel-head"><h2>Latest approved status</h2></header>
          {latest.length === 0 ? <EmptyState icon="queue" title="No approved reports" text="Approved reports show the current status per terminal." /> : (
            <ul className="row-list">
              {latest.map(r => {
                const fresh = now - Date.parse(r.reportedAt) < QUEUE_REPORT_TTL_MS;
                return (
                  <li key={r.id} className="row-static">
                    <span className="row-main"><strong>{r.terminal}</strong><span>{queueLevelLabels[r.level]} · {timeAgo(r.reportedAt, now)}</span></span>
                    <Pill tone={fresh ? 'green' : 'neutral'}>{fresh ? 'Fresh' : 'Stale'}</Pill>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="panel-foot">Commuter route estimates use a report for 30 minutes. After that the app falls back to its baseline.</p>
        </aside>
      </div>
    </>
  );
}
