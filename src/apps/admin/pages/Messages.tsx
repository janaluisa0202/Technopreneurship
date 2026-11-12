import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { ConfirmDialog, EmptyState, Field, PageHeader, Pill, useNow, useToast } from '../components/ui';
import { adminStore, useAdminState, ValidationError } from '../services/store';
import { sampleTrips } from '../../commuter/data/demo';
import { fullDate, timeAgo } from '../lib/format';
import type { Audience, DirectMessage, MessagePurpose } from '../types';

const purposeLabels: Record<MessagePurpose, string> = { general: 'General message', announcement: 'Announcement', advisory: 'Route / road advisory', promo: 'Promo notification' };
const audienceLabels: Record<Audience, string> = { one: 'One commuter', all: 'All users', route: 'Users on a route' };
const routes = Array.from(new Set(sampleTrips.map(t => `${t.from} → ${t.to}`)));

export function Messages() {
  const { users, messages, promos } = useAdminState();
  const now = useNow();
  const toast = useToast();
  const [audience, setAudience] = useState<Audience>('one');
  const [recipientId, setRecipientId] = useState('');
  const [route, setRoute] = useState(routes[0] ?? '');
  const [purpose, setPurpose] = useState<MessagePurpose>('general');
  const [promoId, setPromoId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const activePromos = useMemo(() => promos.filter(p => p.status === 'active'), [promos]);

  function pickPromo(id: string) {
    setPromoId(id);
    const p = promos.find(x => x.id === id);
    if (p) { setSubject(s => s || `New promo: ${p.title}`); setBody(b => b || `${p.title} — ${p.description}${p.appliesTo ? ` Applies to: ${p.appliesTo}.` : ''}`); }
  }
  function validate(): string {
    if (audience === 'one' && !recipientId) return 'Choose which commuter should receive this message.';
    if (audience === 'route' && !route) return 'Choose a route.';
    if (purpose === 'promo' && !promoId) return 'Choose the promo this message is about.';
    if (!subject.trim()) return 'Add a subject.';
    if (!body.trim()) return 'Write the message.';
    return '';
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validate(); setError(problem);
    if (problem) return;
    if (audience === 'all') setConfirm(true); else send();
  }
  function send() {
    const user = users.find(u => u.id === recipientId);
    try {
      adminStore.sendDirectMessage({ audience, recipientId: audience === 'one' ? recipientId : undefined, recipientLabel: audience === 'all' ? 'All users' : audience === 'route' ? route : user?.nickname ?? 'Commuter', purpose, subject, body, promoId: purpose === 'promo' ? promoId : undefined });
      toast('Message saved.'); setSubject(''); setBody(''); setPromoId(''); setConfirm(false);
    } catch (e) { setError(e instanceof ValidationError ? e.message : 'Could not send the message.'); setConfirm(false); }
  }

  return (
    <>
      <PageHeader title="Direct messages" subtitle="Reply to one commuter, send an announcement to everyone, or warn commuters on a route." />
      <div className="notice"><Icon name="info" size={18} /><span>Demo mode: a message to one commuter appears in that customer’s Help & Support chat. Messages to all users or a route are only recorded here until the backend can deliver them.</span></div>
      <div className="split">
        <form className="panel form-panel" onSubmit={submit} noValidate>
          <h2 className="panel-title">New message</h2>
          <fieldset className="radio-group"><legend>Send to</legend>
            {(Object.keys(audienceLabels) as Audience[]).map(a => (
              <label key={a} className={`radio${audience === a ? ' on' : ''}`}><input type="radio" name="audience" value={a} checked={audience === a} onChange={() => setAudience(a)} />{audienceLabels[a]}</label>
            ))}
          </fieldset>
          {audience === 'one' && <Field label="Commuter" htmlFor="dm-user"><select id="dm-user" value={recipientId} onChange={e => setRecipientId(e.target.value)}><option value="">Choose a commuter…</option>{users.map(u => <option key={u.id} value={u.id}>{u.nickname}{u.email ? ` · ${u.email}` : ''}</option>)}</select></Field>}
          {audience === 'route' && <Field label="Route" htmlFor="dm-route"><select id="dm-route" value={route} onChange={e => setRoute(e.target.value)}>{routes.map(r => <option key={r} value={r}>{r}</option>)}</select></Field>}
          <Field label="Type of message" htmlFor="dm-purpose"><select id="dm-purpose" value={purpose} onChange={e => setPurpose(e.target.value as MessagePurpose)}>{Object.entries(purposeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          {purpose === 'promo' && <Field label="Promo" htmlFor="dm-promo"><select id="dm-promo" value={promoId} onChange={e => pickPromo(e.target.value)}><option value="">Choose an active promo…</option>{activePromos.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>}
          <Field label="Subject" htmlFor="dm-subject"><input id="dm-subject" value={subject} maxLength={100} onChange={e => setSubject(e.target.value)} /></Field>
          <Field label="Message" htmlFor="dm-body" hint={`${body.length}/1000`}><textarea id="dm-body" rows={6} maxLength={1000} value={body} onChange={e => setBody(e.target.value)} /></Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn primary full" type="submit"><Icon name="send" size={18} />Send message</button>
        </form>

        <section className="panel" aria-label="Sent messages">
          <header className="panel-head"><h2>Sent messages</h2><small>{messages.length} total</small></header>
          {messages.length === 0 ? <EmptyState icon="send" title="Nothing sent yet" text="Messages you send appear here." /> : (
            <ul className="history">
              {messages.map((m: DirectMessage) => (
                <li key={m.id}>
                  <div className="history-top"><strong>{m.subject}</strong><small title={fullDate(m.sentAt)}>{timeAgo(m.sentAt, now)}</small></div>
                  <p className="clamp-3">{m.body}</p>
                  <div className="history-meta"><Pill tone="blue">{audienceLabels[m.audience]}</Pill><Pill tone="neutral">{purposeLabels[m.purpose]}</Pill><small>To {m.recipientLabel} · by {m.sentBy}{m.delivery === 'sent' ? ' · delivered to their chat' : ' · recorded only'}</small></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {confirm && <ConfirmDialog title="Send to all users?" message={<>“{subject.trim()}” will be addressed to every commuter. Double-check the wording before you continue.</>} confirmLabel="Send to everyone" onCancel={() => setConfirm(false)} onConfirm={send} />}
    </>
  );
}
