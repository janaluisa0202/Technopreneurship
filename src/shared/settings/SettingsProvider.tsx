import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { defaultSettings, readSettings, resolveTheme, watchSystemTheme, SETTINGS_KEY, type AppSettings } from './settings';
interface SettingsContextValue {settings:AppSettings;theme:'light'|'dark';update:(patch:Partial<AppSettings>)=>void;reset:()=>void;}
const SettingsContext=createContext<SettingsContextValue|null>(null);
export function SettingsProvider({children}:{children:ReactNode}){
  const [settings,setSettings]=useState<AppSettings>(()=>{try{return readSettings(localStorage);}catch{return {...defaultSettings};}});
  const [systemDark,setSystemDark]=useState(()=>window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme=resolveTheme(settings.appearance,systemDark);
  useEffect(()=>watchSystemTheme(window.matchMedia('(prefers-color-scheme: dark)'),setSystemDark),[]);
  useLayoutEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.lang=settings.language;document.documentElement.style.fontSize=`${settings.textSize}%`;document.documentElement.style.colorScheme=theme;},[theme,settings.language,settings.textSize]);
  useEffect(()=>{try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{/* Settings stay usable when browser storage is unavailable. */}},[settings]);
  const value=useMemo<SettingsContextValue>(()=>({settings,theme,update:patch=>setSettings(previous=>({...previous,...patch})),reset:()=>setSettings({...defaultSettings})}),[settings,theme]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
export function useSettings(){const value=useContext(SettingsContext);if(!value)throw new Error('SettingsProvider is required');return value;}
