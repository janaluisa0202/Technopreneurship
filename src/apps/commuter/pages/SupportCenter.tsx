import { useEffect, useRef, useState } from 'react';
import { ApplicationPanel } from '../components/ApplicationPanel';
import { Icon } from '../components/Icon';
import { useSupportCenter } from '../hooks/useSupportCenter';
import { supportCategories } from '../lib/supportService';
import { useI18n } from '../../../shared/i18n';
import type { SupportCategory, SupportMessage } from '../types/support';
import { messageTime } from '../../../shared/messaging/autoReply';
import { contactHref, useSupportContacts } from '../../../shared/messaging/supportContacts';

const faqs = [
  ['How do I search for a route?', 'Open Routes, choose your origin and destination, and confirm their address details. Mapped journeys are calculated automatically.'],
  ['How are recommended routes selected?', 'SakayWise compares explicit demo connections by total time, fare, waiting, or transfers. Queue reports and applicable advisories can change the recommendations.'],
  ['How do I check the fare?', 'Choose a passenger category, then open Fare Matrix or Check quoted fare. FareGuard compares your quote with the available sample benchmark, not an official tariff.'],
  ['How do I report a queue?', 'Open Queues, tap Report a queue, choose the matching terminal and queue condition, then submit the local demo report.'],
  ['How do I check road advisories?', 'Open Para Alerts and RoadWatch. Search or filter the simulated notices, then open a notice for its source, effective period, and mapped alternatives.'],
  ['How do I save a trip?', 'Tap Save trip on a route card or in route details. Open the saved icon in the header to view your locally stored guides.'],
  ['Do I need an account to use SakayWise?', 'No. You can plan routes, compare fares, check queues and read road advisories without an account. You only need to sign in or create an account to message the support team, so they can reply to you. Preferences, addresses, saved guides, and reports stay in this browser.'],
] as const;

function FaqList() {
  const { text } = useI18n();
  return (
    <div className="application-panel-scroll faq-list">
      {faqs.map(([question, answer]) => (
        <details className="card faq-item" key={question}>
          <summary>{text(question)}<Icon name="chevron" size={18} /></summary>
          <p>{text(answer)}</p>
        </details>
      ))}
    </div>
  );
}

const statusLabels = { open: 'Waiting for support', pending: 'Support replied', resolved: 'Resolved', closed: 'Closed' } as const;
const authorLabel = (message: SupportMessage) => (message.senderType === 'admin' ? 'Support team' : message.senderType === 'system' ? 'SakayWise (automated)' : 'You');

/** "Sent 1:05 PM · Seen 1:07 PM" for the commuter's own messages; the times come from the server. */
function MessageFooter({ message }: { message: SupportMessage }) {
  const { text, locale } = useI18n();
  const at = (iso: string) => <time dateTime={iso} title={new Date(iso).toLocaleString(locale)}>{messageTime(iso, locale)}</time>;
  if (message.senderType !== 'commuter') return <footer>{at(message.createdAt)}<span>{text(message.senderType === 'admin' ? 'SakayWise support' : 'Automated reply')}</span></footer>;
  if (message.deliveryStatus === 'saved-local') return <footer>{at(message.createdAt)}<span>{text('Saved on this device')}</span></footer>;
  if (message.deliveryStatus === 'failed') return <footer>{at(message.createdAt)}<span>{text('Not sent')}</span></footer>;
  if (message.deliveryStatus === 'pending') return <footer>{at(message.createdAt)}<span>{text('Sending...')}</span></footer>;
  return (
    <footer className="support-receipt">
      <span>{text('Sent')} {at(message.createdAt)}</span>
      <span>{message.readAt ? <>{text('Seen')} {at(message.readAt)}</> : text('Not seen yet')}</span>
    </footer>
  );
}

/** Alternative contact channels configured by the support team (never hard-coded here). */
function ContactChannels() {
  const { text } = useI18n();
  const contacts = useSupportContacts();
  if (!contacts || (!contacts.channels.length && !contacts.supportHours)) return null;
  return (
    <section className="card support-contacts" aria-label={text('Other ways to reach us')}>
      <h3>{text('Other ways to reach us')}</h3>
      {contacts.channels.length > 0 && (
        <ul>
          {contacts.channels.map(channel => {
            const href = contactHref(channel);
            return <li key={channel.id}><span>{channel.label}</span>{href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{channel.value}</a> : <strong>{channel.value}</strong>}</li>;
          })}
        </ul>
      )}
      {contacts.supportHours && <p>{text('Support hours')}: {contacts.supportHours}</p>}
    </section>
  );
}

function usePageVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

function SupportCenterSignedIn({ onBack, returnFocus }: { onBack: () => void; returnFocus?: string }) {
  const { text, locale } = useI18n();
  const [section, setSection] = useState<'faq' | 'message'>('faq');
  const support = useSupportCenter();
  const remote = support.mode === 'remote';
  const scrollRef = useRef<HTMLDivElement>(null);
  // Replies from support and the automated reply both count; marking them read is what shows support "Seen".
  const hasUnreadReply = support.messages.some(message => message.senderType !== 'commuter' && !message.readAt);
  const pageVisible = usePageVisible();

  useEffect(() => {
    if (section === 'message' && pageVisible && support.conversationId && hasUnreadReply) {
      void support.markRead(support.conversationId);
    }
  }, [section, pageVisible, support.conversationId, hasUnreadReply, support.markRead]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [support.messages]);

  const update = (key: keyof typeof support.draft, value: string) =>
    support.setDraft(previous => ({ ...previous, [key]: value }));

  return (
    <ApplicationPanel title="Help & Support" onBack={onBack} returnFocus={returnFocus}>
      <div className="support-top">
        <p>{text('Need assistance with SakayWise?')}</p>
        <div className="segment" role="group" aria-label={text('Support sections')}>
          <button type="button" className={section === 'faq' ? 'on' : ''} aria-pressed={section === 'faq'} onClick={() => setSection('faq')}>{text('Frequently Asked Questions')}</button>
          <button type="button" className={section === 'message' ? 'on' : ''} aria-pressed={section === 'message'} onClick={() => setSection('message')}>{text('Message Support')}</button>
        </div>
      </div>

      {section === 'faq' ? (
        <FaqList />
      ) : (
        <>
          <div className="support-chat-scroll" ref={scrollRef}>
            <p className="support-demo-notice">
              {text(remote
                ? 'Messages are sent to the SakayWise support team. Replies appear here when an administrator responds. Do not share sensitive personal information.'
                : 'Demo chat — your messages go to the SakayWise admin console running in this browser. Replies appear here.')}
            </p>
            {support.conversations.length > 0 && (
              <label className="support-history-label">
                {text('Your conversations')}
                <select aria-label={text('Your conversations')} value={support.conversationId} onChange={event => support.setConversationId(event.target.value)}>
                  {support.conversations.map(conversation => (
                    <option key={conversation.id} value={conversation.id}>
                      {text(conversation.subject)} · {new Date(conversation.createdAt).toLocaleDateString(locale)} · {text(statusLabels[conversation.status])}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <details className="support-metadata card">
              <summary>{text('Issue category and optional details')}<Icon name="chevron" size={17} /></summary>
              <div>
                <label htmlFor="support-category">{text('Issue category')}
                  <select id="support-category" value={support.draft.category} onChange={event => update('category', event.target.value as SupportCategory)}>
                    {Object.entries(supportCategories).map(([value, label]) => <option key={value} value={value}>{text(label)}</option>)}
                  </select>
                </label>
                <label htmlFor="support-name">{text('Name or nickname (optional)')}
                  <input id="support-name" autoComplete="nickname" maxLength={80} value={support.draft.nickname} onChange={event => update('nickname', event.target.value)} placeholder={text('How would you like to be addressed?')} />
                </label>
                <label htmlFor="support-email">{text('Email for follow-up (optional)')}
                  <input id="support-email" type="email" autoComplete="email" maxLength={254} value={support.draft.email} onChange={event => update('email', event.target.value)} placeholder={text('Optional email address')} />
                </label>
                <label htmlFor="support-trip">{text('Related route or trip (optional)')}
                  <input id="support-trip" autoComplete="off" maxLength={200} value={support.draft.relatedTrip} onChange={event => update('relatedTrip', event.target.value)} placeholder={text('Describe the route without sharing your exact location')} />
                </label>
                <p className="input-hint">{text(remote
                  ? 'You can ask for help without a name, email, or precise location. Optional details are shared only with the SakayWise support team.'
                  : 'Your name and email are shared only with the support team.')}</p>
              </div>
            </details>
            {!support.messages.length && (
              <div className="support-empty">
                <Icon name="message" size={28} />
                <h3>{text('No messages yet')}</h3>
                <p>{text(remote
                  ? 'Write your concern below. A SakayWise support administrator will reply in this conversation.'
                  : 'Write your concern below and the support team will reply here.')}</p>
              </div>
            )}
            <div className="support-conversation" role="log" aria-label={text(remote ? 'Support conversation' : 'Conversation with support')} aria-live="polite">
              {support.messages.map(message => (
                <article className={`support-message from-${message.senderType}`} key={message.id}>
                  <strong>{text(authorLabel(message))}</strong>
                  <p>{message.message}</p>
                  <MessageFooter message={message} />
                </article>
              ))}
            </div>
          </div>
          <form className="support-composer" onSubmit={event => { event.preventDefault(); void support.send(); }}>
            <label className="sr-only" htmlFor="support-message">{text('Message details')}</label>
            <textarea id="support-message" rows={2} maxLength={2000} value={support.draft.message} onChange={event => update('message', event.target.value)} placeholder={text('Describe your concern...')} disabled={!support.ready} aria-describedby={support.error ? 'support-error' : 'support-limit'} />
            <div className="support-composer-actions">
              <span id="support-limit">{support.draft.message.length}/2000</span>
              <button type="submit" className="submit" disabled={support.busy || !support.ready}>
                <Icon name="arrow" size={17} />
                {text(remote ? (support.busy ? 'Sending...' : 'Send message') : (support.busy ? 'Saving...' : 'Send message'))}
              </button>
            </div>
            {support.error && <p id="support-error" role="alert">{text(support.error)}</p>}
          </form>
        </>
      )}
    </ApplicationPanel>
  );
}

/** Guests can read the FAQ; messaging support needs an account so the team can reply. */
function SupportCenterGuest({ onBack, returnFocus, onSignIn }: { onBack: () => void; returnFocus?: string; onSignIn: (mode: 'signin' | 'register') => void }) {
  const { text } = useI18n();
  const [section, setSection] = useState<'faq' | 'message'>('faq');
  return (
    <ApplicationPanel title="Help & Support" onBack={onBack} returnFocus={returnFocus}>
      <div className="support-top">
        <p>{text('Need assistance with SakayWise?')}</p>
        <div className="segment" role="group" aria-label={text('Support sections')}>
          <button type="button" className={section === 'faq' ? 'on' : ''} aria-pressed={section === 'faq'} onClick={() => setSection('faq')}>{text('Frequently Asked Questions')}</button>
          <button type="button" className={section === 'message' ? 'on' : ''} aria-pressed={section === 'message'} onClick={() => setSection('message')}>{text('Message Support')}</button>
        </div>
      </div>
      {section === 'faq' ? <FaqList /> : (
        <div className="application-panel-scroll">
          <div className="support-empty" role="status">
            <Icon name="message" size={28} />
            <h3>{text('Sign in to chat with support')}</h3>
            <p>{text('Messaging the support team needs an account so we can send our replies to you. Browsing routes, fares, queues and advisories stays free without one.')}</p>
            <button type="button" className="submit" onClick={() => onSignIn('signin')}>{text('Sign in')}</button>
            <button type="button" className="small-outline" onClick={() => onSignIn('register')}>{text('Create an account')}</button>
          </div>
          <ContactChannels />
        </div>
      )}
    </ApplicationPanel>
  );
}

export function SupportCenter({ signedIn, onSignIn, onBack, returnFocus }: { signedIn: boolean; onSignIn: (mode: 'signin' | 'register') => void; onBack: () => void; returnFocus?: string }) {
  return signedIn ? <SupportCenterSignedIn onBack={onBack} returnFocus={returnFocus} /> : <SupportCenterGuest onBack={onBack} returnFocus={returnFocus} onSignIn={onSignIn} />;
}
