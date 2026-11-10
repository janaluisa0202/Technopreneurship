import { useEffect, useRef, useState } from 'react';
import { ApplicationPanel } from '../components/ApplicationPanel';
import { Icon } from '../components/Icon';
import { useSupportCenter } from '../hooks/useSupportCenter';
import { supportCategories } from '../lib/supportService';
import { useI18n } from '../../../shared/i18n';
import type { SupportCategory } from '../types/support';
const faqs=[
  ['How do I search for a route?','Open Routes, choose your origin and destination, and confirm their address details. Mapped journeys are calculated automatically.'],
  ['How are recommended routes selected?','SakayWise compares explicit demo connections by total time, fare, waiting, or transfers. Queue reports and applicable advisories can change the recommendations.'],
  ['How do I check the fare?','Choose a passenger category, then open Fare Matrix or Check quoted fare. FareGuard compares your quote with the available sample benchmark, not an official tariff.'],
  ['How do I report a queue?','Open Queues, tap Report a queue, choose the matching terminal and queue condition, then submit the local demo report.'],
  ['How do I check road advisories?','Open Para Alerts and RoadWatch. Search or filter the simulated notices, then open a notice for its source, effective period, and mapped alternatives.'],
  ['How do I save a trip?','Tap Save trip on a route card or in route details. Open the saved icon in the header to view your locally stored guides.'],
  ['Can I use SakayWise without an account?','Yes. The commuter prototype works without login. Preferences, addresses, saved guides, reports, and demo support history remain in this browser.'],
] as const;
export function SupportCenter({onBack,returnFocus}:{onBack:()=>void;returnFocus?:string}){
  const {text,locale}=useI18n();const [section,setSection]=useState<'faq'|'message'>('faq');const support=useSupportCenter();const scrollRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight});},[support.messages]);
  const update=(key:keyof typeof support.draft,value:string)=>support.setDraft(previous=>({...previous,[key]:value}));
  return <ApplicationPanel title="Help & Support" onBack={onBack} returnFocus={returnFocus}>
    <div className="support-top"><p>{text('Need assistance with SakayWise?')}</p><div className="segment" role="group" aria-label={text('Support sections')}><button type="button" className={section==='faq'?'on':''} aria-pressed={section==='faq'} onClick={()=>setSection('faq')}>{text('Frequently Asked Questions')}</button><button type="button" className={section==='message'?'on':''} aria-pressed={section==='message'} onClick={()=>setSection('message')}>{text('Message Support')}</button></div></div>
    {section==='faq'?<div className="application-panel-scroll faq-list">{faqs.map(([question,answer])=><details className="card faq-item" key={question}><summary>{text(question)}<Icon name="chevron" size={18}/></summary><p>{text(answer)}</p></details>)}</div>:<>
      <div className="support-chat-scroll" ref={scrollRef}>
        <p className="support-demo-notice">{text('Demo chat — messages are saved on this device and are not sent to an administrator.')}</p>
        {support.conversations.length>0 && <label className="support-history-label">{text('Local conversation')}<select aria-label={text('Local conversation')} value={support.conversationId} onChange={event=>support.setConversationId(event.target.value)}>{support.conversations.map(conversation=><option key={conversation.id} value={conversation.id}>{text(conversation.subject)} · {new Date(conversation.createdAt).toLocaleDateString(locale)}</option>)}</select></label>}
        <details className="support-metadata card"><summary>{text('Issue category and optional details')}<Icon name="chevron" size={17}/></summary><div>
          <label htmlFor="support-category">{text('Issue category')}<select id="support-category" value={support.draft.category} onChange={event=>update('category',event.target.value as SupportCategory)}>{Object.entries(supportCategories).map(([value,label])=><option key={value} value={value}>{text(label)}</option>)}</select></label>
          <label htmlFor="support-name">{text('Name or nickname (optional)')}<input id="support-name" autoComplete="nickname" maxLength={80} value={support.draft.nickname} onChange={event=>update('nickname',event.target.value)} placeholder={text('How would you like to be addressed?')}/></label>
          <label htmlFor="support-email">{text('Email for follow-up (optional)')}<input id="support-email" type="email" autoComplete="email" maxLength={254} value={support.draft.email} onChange={event=>update('email',event.target.value)} placeholder={text('Optional email address')}/></label>
          <label htmlFor="support-trip">{text('Related route or trip (optional)')}<input id="support-trip" autoComplete="off" maxLength={200} value={support.draft.relatedTrip} onChange={event=>update('relatedTrip',event.target.value)} placeholder={text('Describe the route without sharing your exact location')}/></label><p className="input-hint">{text('You can ask for help without a name, email, or precise location. Details are stored only on this device in the demo.')}</p>
        </div></details>
        {!support.messages.length && <div className="support-empty"><Icon name="message" size={28}/><h3>{text('No demo messages yet')}</h3><p>{text('Write a concern below to test the local conversation. No administrator receives these messages.')}</p></div>}
        <div className="support-conversation" role="log" aria-label={text('Demo conversation')} aria-live="polite">{support.messages.map(message=><article className="support-message" key={message.id}><strong>{text(message.senderType==='admin'?'Support team':message.senderType==='system'?'System message':'You')}</strong><p>{message.message}</p><footer><time dateTime={message.createdAt}>{new Intl.DateTimeFormat(locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(message.createdAt))}</time><span>{text('Saved on this device')}</span></footer></article>)}</div>
      </div>
      <form className="support-composer" onSubmit={event=>{event.preventDefault();support.send();}}><label className="sr-only" htmlFor="support-message">{text('Message details')}</label><textarea id="support-message" rows={2} maxLength={2000} value={support.draft.message} onChange={event=>update('message',event.target.value)} placeholder={text('Describe your concern...')} disabled={!support.ready} aria-describedby={support.error?'support-error':'support-limit'}/><div className="support-composer-actions"><span id="support-limit">{support.draft.message.length}/2000</span><button type="submit" className="submit" disabled={support.busy || !support.ready}><Icon name="arrow" size={17}/>{text(support.busy?'Saving...':'Save demo message')}</button></div>{support.error && <p id="support-error" role="alert">{text(support.error)}</p>}</form>
    </>}
  </ApplicationPanel>;
}
