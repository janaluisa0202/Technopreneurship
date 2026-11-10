import { useLayoutEffect, useRef, useState } from 'react';
import { useI18n } from '../../../../shared/i18n';
import { useSettings } from '../../../../shared/settings/SettingsProvider';
import { introductionSlides } from '../../lib/onboarding';
import { useModalFocus } from '../../hooks/useModalFocus';
import { Icon } from '../Icon';

/** Decorative diagram of transit modes, not a geographic map or route. */
function CommuteIllustration(){
  return <div className="intro-art" aria-hidden="true"><span className="intro-art-orbit"/><span className="intro-art-stop"><Icon name="map" size={27}/></span><span className="intro-art-bus"><Icon name="jeep" size={68}/></span><span className="intro-art-train"><Icon name="train" size={33}/></span><span className="intro-art-spark"><Icon name="spark" size={22}/></span></div>;
}
export function Introduction({onFinish,onClose,replaying}:{onFinish:()=>void;onClose:()=>void;replaying:boolean}){
  const {t,text}=useI18n();const {settings,update}=useSettings();
  const [slide,setSlide]=useState(-1);const panelRef=useRef<HTMLElement>(null);const scrollRef=useRef<HTMLDivElement>(null);const titleRef=useRef<HTMLHeadingElement>(null);
  useModalFocus(panelRef,true,'#intro-title','.settings-trigger');
  useLayoutEffect(()=>{scrollRef.current?.scrollTo(0,0);titleRef.current?.focus({preventScroll:true});},[slide]);
  const current=slide>=0?introductionSlides[slide]:null;
  return <section className="introduction-screen" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="intro-title" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();replaying?onClose():onFinish();}}}>
    <header className="introduction-header"><div className="introduction-wordmark" aria-label="SakayWise">Sakay<span>Wise</span></div><div className="introduction-tools"><label className="sr-only" htmlFor="introduction-language">{t('Language')}</label><select id="introduction-language" value={settings.language} onChange={event=>update({language:event.target.value as 'en'|'fil'})}><option value="en">English</option><option value="fil">Filipino</option></select>{replaying && <button type="button" className="location-back" aria-label={t('Close introduction')} onClick={onClose}><Icon name="x" size={18}/></button>}</div></header>
    <div className="introduction-scroll" ref={scrollRef}>
      <div className="introduction-slide" key={slide}>
        {!current?<><CommuteIllustration/><p className="introduction-eyebrow">{t('Welcome to SakayWise')}</p><h1 id="intro-title" ref={titleRef} tabIndex={-1}>{t('Smart Routes. Fair Fares. Less Waiting.')}</h1><p className="introduction-description">{t('Your everyday companion for smarter public transportation in the Philippines.')}</p><span className="introduction-guest"><Icon name="check" size={16}/>{t('No account needed. Start exploring.')}</span></>:<><div className={`onboarding-feature-art feature-${slide}`} aria-hidden="true"><span/><Icon name={current.icon} size={72}/></div><p className="introduction-eyebrow">{text(current.feature)}</p><h1 id="intro-title" ref={titleRef} tabIndex={-1}>{t(current.title)}</h1><p className="introduction-description">{t(current.description)}</p></>}
        <p className="introduction-demo"><Icon name="info" size={15}/>{t('Explore illustrative routes, fares, queues, and advisories. No live transport feed is connected.')}</p>
      </div>
    </div>
    <footer className="introduction-footer">
      {current && <><p className="introduction-progress" role="status">{t('Step {current} of {total}',{current:slide+1,total:introductionSlides.length})}</p><div className="onboarding-dots" role="group" aria-label={t('Introduction progress')}>{introductionSlides.map((item,index)=><button key={item.feature} type="button" aria-label={t('Go to introduction step {step}',{step:index+1})} aria-current={slide===index?'step':undefined} onClick={()=>setSlide(index)}><span/></button>)}</div></>}
      <div className="introduction-actions">{current && <button type="button" className="small-outline" onClick={()=>setSlide(slide-1)}><Icon name="back" size={18}/>{t('Back')}</button>}<button type="button" className="introduction-primary" onClick={()=>slide===introductionSlides.length-1?onFinish():setSlide(slide+1)}>{!current?t('Get Started'):slide===introductionSlides.length-1?t('Start Commuting'):t('Next')}<Icon name="arrow" size={18}/></button></div>
      <button type="button" className="introduction-skip" onClick={onFinish}>{!current?t('Skip Introduction'):t('Skip for now')}</button>
    </footer>
  </section>;
}
