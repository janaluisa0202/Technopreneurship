import { useI18n } from '../../../shared/i18n';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { baselineQueues } from '../services/catalog';
import { queueName } from '../lib/commute';
import { formatReportTime, reportIsFresh } from '../lib/queues';
import type { QueueLevel, QueueReport } from '../types';

interface Props { reports: QueueReport[]; now: number; onReport: () => void; live?: { noReport: string[]; status: 'idle'|'loading'|'ready'|'error'; onRetry: () => void }; }

export function QueuesPage({reports,now,onReport,live}:Props) {
  const {t,text,locale}=useI18n();

  const [filter,setFilter] = useState<'all'|QueueLevel>('all');
  const queues = [...reports,...baselineQueues].filter((report,index,list)=>list.findIndex(item=>item.place===report.place)===index);
  const filtered = filter==='all' ? queues : queues.filter(report=>report.level===filter);
  const counts = {low:queues.filter(q=>q.level==='low').length,mid:queues.filter(q=>q.level==='mid').length,high:queues.filter(q=>q.level==='high').length};
  return <div className="fade">
    <header className="section-head"><span className="back-overline">{t("QUEUESENSE · COMMUNITY SIGNALS")}</span><h1>{t("Before you line up.")}</h1><p>{live?text('See community queue reports for each terminal and share what you see. Reports are unverified and expire after 30 minutes.'):t("Look at example terminal queues and share a local report that changes route planning on this device.")}</p></header>
    {live?.status==='error' && <div className="queue-warning" role="alert"><span>{text('Queue reports could not be refreshed. Showing the last loaded estimates.')}</span> <button type="button" className="link-button" onClick={live.onRetry}>{text('Try again')}</button></div>}
    {live?.status==='loading' && !reports.length && <p className="demo-note" role="status">{text('Loading queue reports…')}</p>}
    <div className="queue-explainer"><Icon name="users" size={18}/><div><b>{t("Queue reports influence Smart Commute Picks")}</b><small>{t("Submit a heavy queue for UST España, then open Routes to see the time estimate update.")}</small></div></div>
    <div className="queue-overview"><div className="queue-mini"><b>{counts.low}</b><small>{t("Low queue")}</small></div><div className="queue-mini"><b>{counts.mid}</b><small>{t("Moderate")}</small></div><div className="queue-mini"><b>{counts.high}</b><small>{t("High queue")}</small></div></div>
    <div className="filter-bar" role="group" aria-label={t("Filter queue reports")}>
      {([['all','All stops'],['low','Low'],['mid','Moderate'],['high','High']] as const).map(([key,label])=><button type="button" key={key} className={filter===key?'active':''} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{text(label)}</button>)}
    </div>
    <div className="queue-list">
      {filtered.length===0 && !(live && filter==='all' && live.noReport.length) && <div className="empty-state card">{t("No reports match that filter.")}</div>}
      {filtered.map(report=><article className="card queue-item" key={report.id}>
        <div className="queue-item-top"><b>{report.place}</b><span className={`queue-status queue-${report.level}`}>{t("Queue:")}{' '}{text(queueName(report.level))}</span></div>
        <p className="queue-sub">{report.isLocal && report.where!=='Community-submitted local demo'?report.where:text(report.where)}</p>
        <div className="queue-track" aria-hidden="true"><div className={`queue-fill ${report.level==='low'?'':report.level}`} style={{width:`${report.progress}%`}}/></div>
        <div className="queue-footer"><strong>{text(report.estimate)}</strong><span>{text(report.updated)}</span></div>
        <div className="source-info">{report.source?text(!reportIsFresh(report,now)?'STALE COMMUNITY REPORTS · DEMO BASELINE USED':report.source==='terminal-staff'?'TERMINAL STAFF REPORT':`COMMUNITY REPORTS · ${(report.confidence||'low').toUpperCase()} CONFIDENCE · NOT VERIFIED`):report.isLocal?text(reportIsFresh(report,now)?'COMMUNITY REPORT · DEMO ESTIMATE · NOT VERIFIED':'STALE COMMUNITY REPORT · DEMO BASELINE USED'):t("DEMO ESTIMATE · NOT LIVE")}</div>
        {(report.isLocal || report.source) && <div className="queue-detail">{t("Last updated:")}{' '}{text(formatReportTime(report.reportedAt,locale))} {t("· Reports expire after 30 minutes")}</div>}
      </article>)}
      {live && filter==='all' && live.noReport.map(name=><article className="card queue-item" key={`none:${name}`}>
        <div className="queue-item-top"><b>{name}</b><span className="queue-status">{text('No current report')}</span></div>
        <div className="source-info">{text('NO COMMUNITY REPORT IN THE LAST 30 MINUTES')}</div>
      </article>)}
    </div>
    <button type="button" className="report-button" onClick={onReport}><Icon name="plus" size={17}/> {t("Report a queue")}</button>
    <p className="demo-note">{live?text('Reports are shared with SakayWise as unverified community information under a temporary guest session, not your name. Repeated reports from one device count once; moderators can remove abusive reports.'):t("Your reports are stored only in your browser. There is no cross-device sharing, contributor verification, or live queue service in this version.")}</p>
  </div>;
}
