import type { QueueReport } from '../types';
import type { QueueObservation, TransportSegment } from '../types/route';

export const QUEUE_REPORT_TTL_MS = 30 * 60 * 1000;
export function reportIsFresh(report: QueueReport, now: number): boolean {
  const timestamp = Date.parse(report.reportedAt || '');
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp < QUEUE_REPORT_TTL_MS;
}
export function latestQueueReport(reports: QueueReport[], terminal: string, segmentId?: string) {
  // Local device reports and server aggregates count; illustrative baseline cards never do.
  return reports.filter(report => (report.isLocal || report.source === 'community-aggregate' || report.source === 'terminal-staff') && report.place === terminal && (!report.segmentId || report.segmentId === segmentId))
    .sort((first, second) => (Date.parse(second.reportedAt || '') || 0) - (Date.parse(first.reportedAt || '') || 0))[0];
}
export function queueForSegment(segment: TransportSegment, reports: QueueReport[], now: number): QueueObservation {
  if (!segment.queue) return { minutes: 0, level: 'low', source: 'sample', label: 'No queue on this walking connection' };
  const report = latestQueueReport(reports, segment.queue.terminal, segment.id);
  const fresh = !!report && reportIsFresh(report, now);
  const level = fresh ? report.level : segment.queue.defaultLevel;
  return {
    minutes: segment.queue.minutes[level], level,
    source: fresh ? 'community' : report ? 'stale' : 'sample',
    label: fresh ? (report.source === 'terminal-staff' ? 'Terminal staff report · Demo wait times' : report.source === 'community-aggregate' ? 'Community reports · Not verified · Demo wait times' : 'Community report · Demo estimate') : report ? 'Stale report · Demo baseline used' : 'Demo estimate · No current community report',
    reportedAt: report?.reportedAt,
  };
}
export function formatReportTime(timestamp?: string,locale='en-PH'): string {
  const date = Date.parse(timestamp || '');
  return Number.isFinite(date) ? new Date(date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : 'Time unavailable';
}
