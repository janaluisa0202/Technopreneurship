import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { demoAdminStore } from '../../admin/services/store';
import { useCustomerUnread } from '../../../shared/messaging/supportStore';
import { getLiveClient, LIVE_MODE } from '../../../shared/backend/runtime';
import { countUnreadSupportReplies, loadLiveUpdates, subscribeLiveUpdates, subscribeSupportReplies, visibleUpdates } from '../services/supabase/updatesService';
import type { CommuterUpdate, CommuterUpdatesState } from '../types/updates';

const POLL_MS = 60000;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Demo: what the admin console saved in this browser (published announcements, active promos, broadcasts). */
function demoItems(): CommuterUpdate[] {
  const s = demoAdminStore.getState(), day = today();
  return [
    ...s.announcements.filter(a => a.status === 'published').map(a => ({ id: `ann:${a.id}`, kind: 'announcement' as const, title: a.title, body: a.body, at: a.publishedAt ?? a.updatedAt, label: a.channel === 'roadwatch' ? 'RoadWatch' : a.channel === 'promo' ? 'Promo notice' : a.channel === 'para-alerts' ? 'Para Alerts' : 'Announcement' })),
    ...s.promos.filter(p => p.status === 'active' && p.startDate <= day && p.endDate >= day).map(p => ({ id: `promo:${p.id}`, kind: 'promo' as const, title: p.title, body: p.description, at: p.updatedAt, label: 'Promo', detail: `Until ${p.endDate}${p.appliesTo ? ` · ${p.appliesTo}` : ''}` })),
    // Demo route messages use free-text route names, so they are shown to everyone with their route label.
    ...s.messages.filter(m => m.audience !== 'one').map(m => ({ id: `msg:${m.id}`, kind: 'message' as const, title: m.subject, body: m.body, at: m.sentAt, label: 'Message from SakayWise', ...(m.audience === 'route' ? { routeLabel: m.recipientLabel } : {}) })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function useCommuterUpdates(routeKeys: Set<string>): CommuterUpdatesState {
  const demoState = useSyncExternalStore(demoAdminStore.subscribe, demoAdminStore.getState, demoAdminStore.getState);
  const [live, setLive] = useState<{ status: 'loading' | 'ready' | 'error'; items: CommuterUpdate[] }>({ status: LIVE_MODE ? 'loading' : 'ready', items: [] });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!LIVE_MODE) return;
    let active = true;
    const load = () => getLiveClient().then(loadLiveUpdates)
      .then(items => { if (active) setLive({ status: 'ready', items }); })
      .catch(() => { if (active) setLive(previous => ({ ...previous, status: 'error' })); });
    void load();
    let unsubscribe = () => {};
    void getLiveClient().then(supabase => { if (active) unsubscribe = subscribeLiveUpdates(supabase, () => void load()); });
    const poll = window.setInterval(() => void load(), POLL_MS);
    return () => { active = false; unsubscribe(); window.clearInterval(poll); };
  }, [attempt]);
  const items = useMemo(() => LIVE_MODE ? visibleUpdates(live.items, routeKeys) : demoItems(), [live.items, routeKeys, demoState]);
  return { mode: LIVE_MODE ? 'live' : 'demo', status: LIVE_MODE ? live.status : 'ready', items, retry: () => setAttempt(value => value + 1) };
}

/** Unread support replies: demo store in demo mode; Supabase read receipts (Realtime + polling) in live mode. */
export function useSupportUnread(accountId: string): number {
  const demoCount = useCustomerUnread(accountId);
  const [liveCount, setLiveCount] = useState(0);
  useEffect(() => {
    if (!LIVE_MODE) return;
    let active = true;
    const load = () => getLiveClient().then(countUnreadSupportReplies).then(n => { if (active) setLiveCount(n); }).catch(() => {});
    void load();
    let unsubscribe = () => {};
    void getLiveClient().then(supabase => { if (active) unsubscribe = subscribeSupportReplies(supabase, () => void load()); });
    const poll = window.setInterval(() => void load(), 30000);
    const onRead = () => void load();
    window.addEventListener('sakaywise:support-read', onRead);
    return () => { active = false; unsubscribe(); window.clearInterval(poll); window.removeEventListener('sakaywise:support-read', onRead); };
  }, [accountId]);
  return LIVE_MODE ? liveCount : demoCount;
}
