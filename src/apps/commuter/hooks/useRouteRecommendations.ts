import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeRouteRecommendations } from '../lib/routeEngine';
import { QUEUE_REPORT_TTL_MS } from '../lib/queues';
import type { Passenger, Priority, QueueReport } from '../types';
import type { RouteItinerary } from '../types/route';
import type { RoadAdvisory } from '../types/roadwatch';

export function useRouteRecommendations(originId: string | undefined, destinationId: string | undefined, passenger: Passenger, priority: Priority, reports: QueueReport[], advisories: RoadAdvisory[], advisoryNow: number) {
  const [clock, setClock] = useState(Date.now);
  const now = useMemo(()=>Math.max(Date.now(),advisoryNow,clock),[reports,clock,advisoryNow]);
  const key = JSON.stringify([originId, destinationId, passenger, priority, reports, advisories, now]);
  const [result, setResult] = useState<{ key: string; routes: RouteItinerary[]; allRoutes: RouteItinerary[]; baselineRoutes: RouteItinerary[]; change: string; error: boolean }>();
  const previous = useRef<{ pair: string; best: string; priority: Priority; passenger: Passenger } | null>(null);
  useEffect(() => {
    const nextExpiry = reports.map(report => Date.parse(report.reportedAt || '') + QUEUE_REPORT_TTL_MS).filter(expiry => expiry > Date.now()).sort((a,b) => a-b)[0];
    if (!nextExpiry) return;
    const timer = window.setTimeout(() => setClock(Date.now()), Math.min(nextExpiry - Date.now() + 1, 2147483647));
    return () => window.clearTimeout(timer);
  }, [reports, now]);
  useEffect(() => {
    let active = true;
    if (!originId || !destinationId) return;
    // Pending state belongs to this computation, with no minimum spinner time
    // or fabricated network delay. Obsolete computations cannot replace it.
    Promise.resolve().then(() => analyzeRouteRecommendations({ originId, destinationId, passenger, priority }, reports, now, undefined, advisories)).then(analysis => {
      const {routes}=analysis;
      if (!active) return;
      const pair = `${originId}:${destinationId}`;
      const best = routes[0]?.id || '';
      const changed = previous.current?.pair === pair && previous.current.priority === priority && previous.current.passenger === passenger && previous.current.best && previous.current.best !== best;
      previous.current = { pair, best, priority, passenger };
      setResult({ key, ...analysis, change: changed && best ? 'Queue or advisory impacts changed. A different route now best matches your preference.' : '', error: false });
    }).catch(() => { if (active) setResult({ key, routes: [], allRoutes:[], baselineRoutes:[], change: '', error: true }); });
    return () => { active = false; };
  }, [originId, destinationId, passenger, priority, reports, advisories, now, key]);
  const ready = result?.key === key;
  const previousRoutes = result && result.routes[0]?.originId===originId && result.routes[0]?.destinationId===destinationId ? result.allRoutes.filter(route=>!route.unavailable) : [];
  return { retry:()=>setClock(value=>Math.max(Date.now(),value+1)), key, now, allRoutes:ready?result.allRoutes:[], baselineRoutes:ready?result.baselineRoutes:[], routes: ready ? result.routes : [], previousRoutes, change: ready ? result.change : '', status: !originId || !destinationId ? 'idle' : !ready ? 'loading' : result.error ? 'error' : 'ready' } as const;
}
