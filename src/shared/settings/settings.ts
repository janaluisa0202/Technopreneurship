export type Language='en'|'fil';
export type Appearance='light'|'dark'|'system';
export type TextSize=90|100|110|120|130;
export interface AppSettings {language:Language;appearance:Appearance;textSize:TextSize;}
export const SETTINGS_KEY='sakaywise:settings:v1';
export const defaultSettings:AppSettings={language:'en',appearance:'system',textSize:100};
export function isAppSettings(value:unknown):value is AppSettings {
  if(typeof value!=='object' || value===null)return false;
  const settings=value as Record<string,unknown>;
  return ['en','fil'].includes(String(settings.language)) && ['light','dark','system'].includes(String(settings.appearance)) && [90,100,110,120,130].includes(Number(settings.textSize)) && typeof settings.textSize==='number';
}
export function readSettings(storage:Pick<Storage,'getItem'>):AppSettings {
  try {const value:unknown=JSON.parse(storage.getItem(SETTINGS_KEY) || 'null');return isAppSettings(value)?value:{...defaultSettings};}catch{return {...defaultSettings};}
}
export const resolveTheme=(appearance:Appearance,systemDark:boolean):'light'|'dark'=>appearance==='system'?(systemDark?'dark':'light'):appearance;
export function watchSystemTheme(media:Pick<MediaQueryList,'matches'|'addEventListener'|'removeEventListener'>,onChange:(dark:boolean)=>void){
  const change=()=>onChange(media.matches);change();media.addEventListener('change',change);return()=>media.removeEventListener('change',change);
}
