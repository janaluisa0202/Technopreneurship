// Automated support reply + "Sent / Seen" time labels, shared by the commuter app and the admin console.
// Live mode: the database composes and inserts the reply (supabase/migrations/20261120120000_*.sql);
// this module mirrors that format and rule for DEMO mode, and holds the demo configuration.

export type ContactKind = 'email' | 'phone' | 'sms' | 'messenger' | 'facebook' | 'website' | 'other';
export interface ContactChannel { id: string; kind: ContactKind; label: string; value: string; active: boolean; }
export interface AutoReplyConfig { enabled: boolean; message: string; supportHours: string; channels: ContactChannel[]; }

export const contactKinds: Record<ContactKind, string> = {
  email: 'Email', phone: 'Phone', sms: 'SMS', messenger: 'Messenger', facebook: 'Facebook', website: 'Website', other: 'Other',
};
export const DEFAULT_AUTO_REPLY = 'Thanks for contacting SakayWise Support. We received your message, and a support administrator will reply in this chat as soon as possible.';
export const AUTO_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Same text as public.support_auto_reply_text(). */
export function composeAutoReply(config: AutoReplyConfig): string {
  const channels = config.channels.filter(c => c.active);
  let text = config.message.trim();
  if (channels.length) text += `\n\nOther ways to reach us:${channels.map(c => `\n• ${c.label}: ${c.value}`).join('')}`;
  if (config.supportHours.trim()) text += `\n\nSupport hours: ${config.supportHours.trim()}`;
  return text.slice(0, 2000);
}

/** Same rule as the database trigger: reply unless staff or the auto-reply answered in the last 24 hours. */
export function shouldAutoReply(config: AutoReplyConfig, earlier: { senderType: string; createdAt: string }[], now = Date.now()): boolean {
  if (!config.enabled) return false;
  return !earlier.some(m => (m.senderType === 'admin' || m.senderType === 'system') && now - Date.parse(m.createdAt) < AUTO_REPLY_WINDOW_MS);
}

export function validateAutoReply(config: AutoReplyConfig): string | null {
  if (!config.message.trim()) return 'Write the automated reply message.';
  if (config.message.trim().length > 600) return 'Keep the automated reply under 600 characters.';
  if (config.supportHours.length > 200) return 'Keep the support hours under 200 characters.';
  for (const c of config.channels) {
    if (!c.label.trim() || c.label.trim().length > 60) return 'Each contact channel needs a label (up to 60 characters).';
    if (!c.value.trim() || c.value.trim().length > 200) return 'Each contact channel needs a value (up to 200 characters).';
  }
  return null;
}

/** A tappable link for the common channel kinds; plain text otherwise. */
export function contactHref(channel: Pick<ContactChannel, 'kind' | 'value'>): string | undefined {
  const v = channel.value.trim();
  if (channel.kind === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if ((channel.kind === 'phone' || channel.kind === 'sms') && /^\+?[\d\s()-]{6,}$/.test(v)) return `${channel.kind === 'sms' ? 'sms' : 'tel'}:${v.replace(/[\s()-]/g, '')}`;
  if (['messenger', 'facebook', 'website'].includes(channel.kind) && /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(v)) return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  return undefined;
}

/* ---------- demo configuration (this browser only) ---------- */
const KEY = 'sakaywise:support:auto-reply:v1';
// Obviously fake placeholders (reserved .example domain, invalid phone number) — same as supabase/seed.sql.
export const demoAutoReply = (): AutoReplyConfig => ({
  enabled: true, message: DEFAULT_AUTO_REPLY, supportHours: 'Monday to Saturday, 8:00 AM – 6:00 PM (demo)',
  channels: [
    { id: 'demo-email', kind: 'email', label: 'Email (demo)', value: 'support@sakaywise.example', active: true },
    { id: 'demo-phone', kind: 'phone', label: 'Hotline (demo placeholder)', value: '+63 2 0000 0000', active: true },
    { id: 'demo-messenger', kind: 'messenger', label: 'Facebook Messenger (demo)', value: 'm.me/sakaywise.example', active: true },
  ],
});
const listeners = new Set<() => void>();
let cached: AutoReplyConfig | undefined;
function isConfig(value: unknown): value is AutoReplyConfig {
  const v = value as AutoReplyConfig;
  return !!v && typeof v.enabled === 'boolean' && typeof v.message === 'string' && typeof v.supportHours === 'string' && Array.isArray(v.channels)
    && v.channels.every(c => c && typeof c.id === 'string' && typeof c.label === 'string' && typeof c.value === 'string' && typeof c.active === 'boolean' && c.kind in contactKinds);
}
export const demoAutoReplyStore = {
  get(): AutoReplyConfig {
    if (cached) return cached;
    try { const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || 'null'); cached = isConfig(parsed) ? parsed : demoAutoReply(); }
    catch { cached = demoAutoReply(); }
    return cached;
  },
  save(config: AutoReplyConfig) {
    const error = validateAutoReply(config); if (error) throw new Error(error);
    cached = { ...config, message: config.message.trim(), supportHours: config.supportHours.trim(), channels: config.channels.map(c => ({ ...c, label: c.label.trim(), value: c.value.trim() })) };
    try { localStorage.setItem(KEY, JSON.stringify(cached)); } catch { /* kept for this page */ }
    listeners.forEach(l => l());
  },
  reset() { cached = undefined; try { localStorage.removeItem(KEY); } catch { /* ignore */ } listeners.forEach(l => l()); },
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cached = undefined; listener(); } };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
  },
};

/* ---------- time labels ---------- */
/** "1:05 PM" today, otherwise "Nov 20, 1:05 PM". */
export function messageTime(iso: string, locale: string, now = new Date()): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(locale, sameDay ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}
