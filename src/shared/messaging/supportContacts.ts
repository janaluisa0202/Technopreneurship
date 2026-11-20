// Public "other ways to reach us" list for the support screen (guests included).
// Live: support_contact_channels + support_auto_reply_settings (public read, staff-managed). Demo: this browser's config.
import { useEffect, useState } from 'react';
import { DEMO_MODE } from '../auth/authService';
import { getLiveClient } from '../backend/runtime';
import { demoAutoReplyStore, type ContactChannel } from './autoReply';
export { contactHref } from './autoReply';

export interface SupportContacts { channels: ContactChannel[]; supportHours: string; }
const fromDemo = (): SupportContacts => {
  const c = demoAutoReplyStore.get();
  return { channels: c.channels.filter(x => x.active), supportHours: c.supportHours };
};

export function useSupportContacts(): SupportContacts | null {
  const [contacts, setContacts] = useState<SupportContacts | null>(() => (DEMO_MODE ? fromDemo() : null));
  useEffect(() => {
    if (DEMO_MODE) return demoAutoReplyStore.subscribe(() => setContacts(fromDemo()));
    let active = true;
    void getLiveClient().then(async supabase => {
      const [channels, settings] = await Promise.all([
        supabase.from('support_contact_channels').select('id,kind,label,value').eq('is_active', true).order('sort_order').order('label'),
        supabase.from('support_auto_reply_settings').select('support_hours').limit(1),
      ]);
      if (!active || channels.error) return;
      const rows = (channels.data ?? []) as { id: string; kind: ContactChannel['kind']; label: string; value: string }[];
      const hours = ((settings.data ?? [])[0] as { support_hours?: string } | undefined)?.support_hours ?? '';
      setContacts({ channels: rows.map(r => ({ ...r, active: true })), supportHours: hours });
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  return contacts;
}
