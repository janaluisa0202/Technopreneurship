import { en, type TranslationKey } from './en';
import { fil } from './fil';
import type { Language } from '../settings/settings';
const caseKeys=new Map(Object.keys(en).map(key=>[key.toLowerCase(),key]));
export function translate(language:Language,key:string|undefined,values:Record<string,string|number>={}):string {
  key=key || '';
  const english=(en as Record<string,string>)[key] ?? key;
  let message=english;
  if(language==='fil'){
    const direct=(fil as Record<string,string>)[key];
    if(direct!==undefined)message=direct;
    else {
      const tr=(value:string)=>translate(language,value);
      const lower=key.toLowerCase();
      const caseKey=caseKeys.get(lower);
      const patterns:[RegExp,(match:RegExpMatchArray)=>string][]=[
        [/^Recommended because this route has the (.+)\.$/,m=>`Iminumungkahi ang rutang ito dahil mayroon itong ${tr(m[1])}.`],
        [/^Board the sample (.+) service; confirm the actual stop and signboard with the operator\.$/,m=>`Sumakay sa halimbawang ${tr(m[1])}; tiyakin sa operator ang aktuwal na hintuan at karatula.`],
        [/^(\d+(?:\.\d+)?) min of explicitly supplied additional travel delay\.$/,m=>`${m[1]} min na dagdag sa biyahe ayon sa ibinigay na tantiya.`],
        [/^Saved trip guides, (\d+) saved$/,m=>`Mga na-save na gabay, ${m[1]} naka-save`],
        [/^(Para Alerts|My Alerts), (\d+) matching advisories$/,m=>`${tr(m[1])}, ${m[2]} katugmang abiso`],
        [/^(.+) content$/,m=>`Nilalaman ng ${tr(m[1])}`],
        [/^Current (origin|destination)$/,m=>`Kasalukuyang ${tr(m[1])}`],
        [/^(\d+) places?$/,m=>`${m[1]} lugar`],
        [/^Select (.+), (\d+) minutes$/,m=>`Piliin ang ${tr(m[1])}, ${m[2]} minuto`],
        [/^View Route Details: (.+)$/,m=>`Tingnan ang Detalye ng Ruta: ${tr(m[1])}`],
        [/^Save trip: (.+)$/,m=>`I-save ang biyahe: ${tr(m[1])}`],
        [/^View Details: (.+)$/,m=>`Tingnan ang Detalye: ${tr(m[1])}`],
        [/^Latest available update: (.+)$/,m=>`Pinakahuling available na update: ${tr(m[1])}`],
        [/^This advisory is (.+); no current operational effect is applied\.$/,m=>`${tr(m[1])} ang abisong ito; walang kasalukuyang epekto sa operasyon na inilalapat.`],
        [/^Difference: (.+)\. This is not proof of overcharging; verify the current official route-specific tariff\.$/,m=>`Agwat: ${m[1]}. Hindi ito patunay ng sobrang singil; tiyakin ang kasalukuyang opisyal na taripa ng ruta.`],
        [/^ \+ transfer (\d+) min$/,m=>` + ${m[1]} min sa paglipat`],
      ];
      if(caseKey)message=(fil as Record<string,string>)[caseKey] ?? english;
      else {
        let matched=false;
        for(const [pattern,format] of patterns){const match=key.match(pattern);if(match){message=format(match);matched=true;break;}}
        if(!matched && key.includes(' + '))message=key.split(' + ').map(tr).join(' + ');
        else if(!matched && key.includes(' → '))message=key.split(' → ').map(tr).join(' → ');
      }
    }
  }
  return message.replace(/\{(\w+)\}/g,(match,name)=>values[name]===undefined?match:String(values[name]));
}
export type {TranslationKey};
