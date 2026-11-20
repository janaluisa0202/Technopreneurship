import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../components/Icon';
import { Chips, ConfirmDialog, EmptyState, PageHeader, Pill, SearchBox, useDebounced, useNow, useToast } from '../components/ui';
import { run } from '../lib/actions';
import { adminStore, useAdminState } from '../services/store';
import { go } from '../lib/router';
import { fullDate, initials, timeAgo } from '../lib/format';
import { supportCategoryLabels } from '../lib/labels';
import type { Conversation, ConversationStatus, SupportCategory } from '../types';

const statusTone = { open: 'blue', pending: 'yellow', resolved: 'green', closed: 'neutral' } as const;
const quickReplies = [
  'Thanks for reaching out! We are looking into this and will update you shortly.',
  'Thank you for the report. We have passed it to our team to verify.',
  'This has been fixed. Please refresh the app and let us know if you still see the problem.',
];

export function HelpCenter({ selectedId }: { selectedId?: string }) {
  const { conversations, sync } = useAdminState();
  const now = useNow();
  const [query, setQuery] = useState('');
  const q = useDebounced(query).trim().toLowerCase();
  const [status, setStatus] = useState<'all' | ConversationStatus | 'unread' | 'spam'>('all');
  const [category, setCategory] = useState<'all' | SupportCategory>('all');

  const list = useMemo(() => {
    return conversations
      .filter(c => (status === 'spam' ? c.flaggedSpam : !c.flaggedSpam && (status === 'all' || (status === 'unread' ? c.unread : c.status === status))))
      .filter(c => category === 'all' || c.category === category)
      .filter(c => !q || `${c.nickname ?? ''} ${c.email ?? ''} ${c.subject} ${c.relatedTrip ?? ''} ${c.messages.map(m => m.message).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  }, [conversations, status, category, q]);

  const selected = conversations.find(c => c.id === selectedId);
  const visible = conversations.filter(c => !c.flaggedSpam);
  const count = (fn: (c: Conversation) => boolean) => visible.filter(fn).length;

  useEffect(() => { if (selected?.unread) void adminStore.markConversationRead(selected.id).catch(() => {}); }, [selected?.id, selected?.unread]);

  return (
    <>
      <PageHeader title="Help Center" subtitle="Read and answer concerns sent from the commuter app." />
      <div className="notice"><Icon name="info" size={18} /><span>{sync.mode === 'live'
        ? 'Replies are delivered to the commuter’s Help & Support chat. Opening a conversation marks the commuter’s messages as seen. The newest 200 conversations are loaded.'
        : 'Demo mode: replies show up instantly in the customer’s Help & Support chat, but only in this browser. A backend will deliver them across devices.'}</span></div>
      <div className="inbox">
        <section className="inbox-list panel" aria-label="Conversations">
          <div className="inbox-filters">
            <SearchBox value={query} onChange={setQuery} placeholder="Search conversations" label="Search conversations" />
            <Chips label="Filter by status" value={status} onChange={setStatus} options={[
              { value: 'all', label: 'All', count: visible.length }, { value: 'unread', label: 'Unread', count: count(c => c.unread) },
              { value: 'open', label: 'Open', count: count(c => c.status === 'open') }, { value: 'pending', label: 'Pending', count: count(c => c.status === 'pending') },
              { value: 'resolved', label: 'Resolved', count: count(c => c.status === 'resolved') }, { value: 'spam', label: 'Spam', count: conversations.filter(c => c.flaggedSpam).length },
            ]} />
            <label className="select-inline"><span>Issue type</span>
              <select value={category} onChange={e => setCategory(e.target.value as 'all' | SupportCategory)}>
                <option value="all">All issue types</option>
                {Object.entries(supportCategoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </div>
          {list.length === 0 ? <EmptyState icon="help" title="No conversations found" text="Change the filters or wait for new messages." /> : (
            <ul className="convo-list">
              {list.map(c => {
                const last = c.messages.at(-1);
                return (
                  <li key={c.id}>
                    <button type="button" className={`convo${c.id === selectedId ? ' selected' : ''}${c.unread ? ' unread' : ''}`} onClick={() => go('help', c.id)} aria-current={c.id === selectedId ? 'true' : undefined}>
                      <span className="avatar">{initials(c.nickname || 'Guest')}</span>
                      <span className="convo-main">
                        <span className="convo-top"><strong>{c.nickname || 'Guest'}</strong><small>{timeAgo(c.lastMessageAt, now)}</small></span>
                        <span className="convo-sub">{supportCategoryLabels[c.category]}</span>
                        <span className="clamp">{last?.senderType === 'admin' ? 'You: ' : ''}{last?.message}</span>
                      </span>
                      <span className="convo-badges">{c.unread && <span className="dot on" aria-label="Unread" />}<Pill tone={statusTone[c.status]}>{c.status}</Pill></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="thread panel" aria-label="Conversation">
          {selected ? <Thread key={selected.id} conversation={selected} /> : <EmptyState icon="help" title="Select a conversation" text="Choose a concern on the left to read it and reply." />}
        </section>
      </div>
    </>
  );
}

function Thread({ conversation: c }: { conversation: Conversation }) {
  const { sync } = useAdminState();
  const toast = useToast();
  const [text, setText] = useState('');
  const [confirmSpam, setConfirmSpam] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [c.messages.length]);

  const [sending, setSending] = useState(false);
  function send() {
    if (sending) return;
    setSending(true);
    // Text is cleared only after the reply was stored, so a failed send keeps the draft.
    void run(toast, adminStore.reply(c.id, text), 'Reply sent.', 'Could not send the reply.').then(ok => { setSending(false); if (ok) setText(''); });
  }
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); send(); } };

  return (
    <>
      <header className="thread-head">
        <div className="thread-title">
          <span className="avatar large">{initials(c.nickname || 'Guest')}</span>
          <div>
            <h2>{c.nickname || 'Guest'}</h2>
            <p>{supportCategoryLabels[c.category]}{c.email ? ` · ${c.email}` : ''}{c.relatedTrip ? ` · Trip: ${c.relatedTrip}` : ''}</p>
          </div>
        </div>
        <div className="thread-actions">
          <label className="select-inline compact"><span className="sr-only">Concern status</span>
            <select value={c.status} onChange={e => { void run(toast, adminStore.setConversationStatus(c.id, e.target.value as ConversationStatus), `Marked ${e.target.value}.`); }}>
              <option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option>{(sync.mode === 'live' || c.status === 'closed') && <option value="closed">Closed (final)</option>}
            </select>
          </label>
          {c.status !== 'resolved' && <button type="button" className="btn small ghost" onClick={() => { void run(toast, adminStore.setConversationStatus(c.id, 'resolved'), 'Marked resolved.'); }}><Icon name="check" size={16} />Resolve</button>}
          <button type="button" className="btn small ghost" onClick={() => { void run(toast, adminStore.markConversationUnread(c.id), 'Marked unread.'); }}>Mark unread</button>
          <button type="button" className="btn small ghost" onClick={() => (c.flaggedSpam ? void run(toast, adminStore.setConversationSpam(c.id, false), 'Spam flag removed.') : setConfirmSpam(true))}><Icon name="flag" size={16} />{c.flaggedSpam ? 'Not spam' : 'Spam'}</button>
        </div>
      </header>
      <div className="messages" tabIndex={0} aria-label="Messages">
        <p className="thread-note">Started {fullDate(c.createdAt)}</p>
        {c.messages.map(m => (
          <div key={m.id} className={`bubble-row ${m.senderType === 'admin' ? 'mine' : ''}`}>
            <div className="bubble">
              <small>{m.senderType === 'admin' ? m.senderName : c.nickname || 'Guest'} · {fullDate(m.createdAt)}</small>
              <p>{m.message}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="composer">
        <label className="select-inline compact"><span className="sr-only">Quick reply</span>
          <select value="" onChange={e => { if (e.target.value) setText(e.target.value); }}>
            <option value="">Insert quick reply…</option>
            {quickReplies.map(r => <option key={r} value={r}>{r.slice(0, 60)}…</option>)}
          </select>
        </label>
        <label className="sr-only" htmlFor="reply-box">Reply to {c.nickname || 'commuter'}</label>
        <textarea id="reply-box" rows={3} value={text} maxLength={2000} placeholder="Write a reply…" onChange={e => setText(e.target.value)} onKeyDown={onKey} />
        <div className="composer-foot"><small>{text.length}/2000 · Ctrl + Enter to send. Replying moves open concerns to Pending.</small>
          <button type="button" className="btn primary" onClick={send} disabled={!text.trim() || sending}><Icon name="send" size={18} />Send reply</button></div>
      </div>
      {confirmSpam && <ConfirmDialog title="Flag as spam?" message="This conversation moves to the Spam filter and stops counting toward open or unread totals." confirmLabel="Flag as spam" danger
        onCancel={() => setConfirmSpam(false)} onConfirm={() => { setConfirmSpam(false); void run(toast, adminStore.setConversationSpam(c.id, true), 'Flagged as spam.'); }} />}
    </>
  );
}
