// Live Para Alerts → Updates: published announcements, current promos, and staff broadcasts.
// RLS decides what a commuter may read (published / active-today / audience all|route).
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClientId } from '../../lib/clientId';
import type { CommuterUpdate } from '../../types/updates';

export interface AnnouncementRow { id: string; title: string; body: string; channel: string; published_at: string | null; updated_at: string; }
export interface PromoRow { id: string; title: string; description: string; promo_type: string; start_date: string; end_date: string; applies_to: string; updated_at: string; }
export interface BroadcastRow { id: string; audience: 'all' | 'route' | 'one'; route_origin_place_id: string | null; route_destination_place_id: string | null; recipient_label: string; purpose: string; subject: string; body: string; sent_at: string; }

const channelLabels: Record<string, string> = { 'para-alerts': 'Para Alerts', roadwatch: 'RoadWatch', promo: 'Promo notice', general: 'Announcement' };
const promoLabels: Record<string, string> = { student: 'Student fare promo', 'route-discount': 'Route discount', partner: 'Partner promo', seasonal: 'Seasonal promo' };
const purposeLabels: Record<string, string> = { general: 'Message from SakayWise', announcement: 'Announcement', advisory: 'Route advisory', promo: 'Promo' };

export function mapUpdates(announcements: AnnouncementRow[], promos: PromoRow[], broadcasts: BroadcastRow[]): CommuterUpdate[] {
  const items: CommuterUpdate[] = [
    ...announcements.map(a => ({ id: `ann:${a.id}`, kind: 'announcement' as const, title: a.title, body: a.body, at: new Date(a.published_at ?? a.updated_at).toISOString(), label: channelLabels[a.channel] ?? 'Announcement' })),
    ...promos.map(p => ({ id: `promo:${p.id}`, kind: 'promo' as const, title: p.title, body: p.description, at: new Date(p.updated_at).toISOString(), label: promoLabels[p.promo_type] ?? 'Promo',
      detail: `Until ${p.end_date}${p.applies_to ? ` · ${p.applies_to}` : ''}` })),
    ...broadcasts.filter(m => m.audience !== 'one').map(m => ({ id: `msg:${m.id}`, kind: 'message' as const, title: m.subject, body: m.body, at: new Date(m.sent_at).toISOString(),
      label: purposeLabels[m.purpose] ?? 'Message from SakayWise',
      ...(m.audience === 'route' && m.route_origin_place_id && m.route_destination_place_id
        ? { routeKey: `${m.route_origin_place_id}:${m.route_destination_place_id}`, routeLabel: m.recipient_label } : {}) })),
  ];
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Route messages are shown only to commuters whose journey/watched/saved routes match (decided on the device). */
export function visibleUpdates(items: CommuterUpdate[], routeKeys: Set<string>, showAllRoutes = false): CommuterUpdate[] {
  return items.filter(item => !item.routeKey || showAllRoutes || routeKeys.has(item.routeKey));
}

export async function loadLiveUpdates(supabase: SupabaseClient): Promise<CommuterUpdate[]> {
  const [announcements, promos, broadcasts] = await Promise.all([
    supabase.from('announcements').select('id,title,body,channel,published_at,updated_at').eq('status', 'published').order('published_at', { ascending: false }).limit(50),
    supabase.from('promos').select('id,title,description,promo_type,start_date,end_date,applies_to,updated_at').order('end_date', { ascending: true }).limit(50),
    supabase.from('admin_messages').select('id,audience,route_origin_place_id,route_destination_place_id,recipient_label,purpose,subject,body,sent_at').in('audience', ['all', 'route']).order('sent_at', { ascending: false }).limit(50),
  ]);
  for (const result of [announcements, promos, broadcasts]) if (result.error) throw result.error;
  return mapUpdates(announcements.data as AnnouncementRow[], promos.data as PromoRow[], broadcasts.data as BroadcastRow[]);
}

export function subscribeLiveUpdates(supabase: SupabaseClient, onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = () => { clearTimeout(timer); timer = setTimeout(onChange, 400); };
  const channel = supabase.channel(`commuter-updates-${createClientId()}`);
  for (const table of ['announcements', 'promos', 'admin_messages']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, debounced);
  channel.subscribe();
  return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
}

/** Unread support replies for the signed-in commuter (RLS limits rows to their own conversations). */
export async function countUnreadSupportReplies(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase.from('support_messages').select('id', { count: 'exact', head: true })
    .in('sender_type', ['admin', 'system']).is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}
export function subscribeSupportReplies(supabase: SupabaseClient, onChange: () => void): () => void {
  const channel = supabase.channel(`support-unread-${createClientId()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => onChange())
    .subscribe(status => { if (status === 'SUBSCRIBED') onChange(); });
  return () => { void supabase.removeChannel(channel); };
}
