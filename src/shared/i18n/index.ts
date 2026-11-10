import { useCallback } from 'react';
import type { TranslationKey } from './en';
import { translate } from './translate';
import { useSettings } from '../settings/SettingsProvider';
export { translate } from './translate';
export function useI18n(){
  const {settings}=useSettings();
  const t=useCallback((key:TranslationKey,values?:Record<string,string|number>)=>translate(settings.language,key,values),[settings.language]);
  const text=useCallback((key:string|undefined,values?:Record<string,string|number>)=>translate(settings.language,key,values),[settings.language]);
  return {t,text,locale:settings.language==='fil'?'fil-PH':'en-PH',language:settings.language};
}
