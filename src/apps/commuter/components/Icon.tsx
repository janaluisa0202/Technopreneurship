import type { SVGProps } from 'react';

const paths = {
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
  mapFold:'<path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3zM9 2v17m6-14v17"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>', 
  settings:'<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z"/><circle cx="12" cy="12" r="3"/>',
  language:'<path d="M3 5h12M9 3v2m-3 0c0 7 6 10 6 10M13 5c0 5-5 9-9 10m10 6 4-11 4 11m-7-4h6"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  moon:'<path d="M20 14a9 9 0 0 1-10-11 9 9 0 1 0 10 11z"/>',
  screen:'<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M12 17v4m-4 0h8"/>',
  textSize:'<path d="M3 5h12M9 5v15m8-9h5m-2-1v10"/>',
  message:'<path d="M21 11a9 9 0 0 1-9 9H4l-2 2v-9a9 9 0 1 1 19-2z"/><path d="M7 10h10M7 14h7"/>',
  road:'<path d="m7 2-4 20m14-20 4 20M12 3v3m0 4v4m0 4v3"/>',
  closure:'<path d="M3 8h18v8H3zM6 8l6 8m1-8 6 8M5 16v5m14-5v5"/>',
  weather:'<path d="M5 15a4 4 0 1 1 1-8 6 6 0 0 1 12 1 3.5 3.5 0 0 1 1 7M7 18l-1 3m7-3-1 3m7-3-1 3"/>',
  tools:'<path d="m4 21 8-8M15 3a5 5 0 0 0-3 8l-8 8 2 2 8-8a5 5 0 0 0 7-6l-4 3-3-3 3-4z"/>',
  walk:'<circle cx="13" cy="4" r="2"/><path d="m7 21 3-7 3 3v5m-3-8 2-7 4 4h4M5 13l3-4 4-2"/>',
  bus:'<rect x="4" y="3" width="16" height="17" rx="3"/><path d="M4 12h16M8 20v2m8-2v2M8 16h.01M16 16h.01M8 7h8"/>',
  train:'<rect x="5" y="2" width="14" height="17" rx="4"/><path d="M5 10h14M8 14h.01M16 14h.01M8 19l-3 3m11-3 3 3M12 2v8"/>',
  van:'<path d="M3 17V7h12l6 6v4H3ZM15 7v6h6"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M6 10h5"/>',
  tricycle:'<circle cx="5" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="m5 18 5-9h6l2 9M9 9 7 5H4m6 4-1 9h9M13 5h7v7"/>',
  search:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  map:'<path d="M12 22s8-7.2 8-13a8 8 0 0 0-16 0c0 5.8 8 13 8 13z"/><circle cx="12" cy="9" r="2.5"/>',
  flag:'<path d="M5 22V3m0 2c6-4 8 4 15 0v11c-7 4-9-4-15 0"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  compass:'<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="m15.5 8.5-2.3 4.7-4.7 2.3 2.3-4.7z" stroke="white" fill="white"/>',
  calc:'<rect x="5" y="2" width="14" height="20" rx="3"/><rect x="8" y="5" width="8" height="4" rx=".5"/><path d="M8 13h1m5 0h1m-7 4h1m5 0h1"/>',
  users:'<circle cx="10" cy="7" r="3"/><path d="M3 20v-2a7 7 0 0 1 14 0v2z"/><path d="M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  jeep:'<path d="M3 15V8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v7M3 15h18v4H3zm3 4v2m12-2v2M6 9h11"/>',
  route:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  warning:'<path d="m12 3 10 18H2z"/><path d="M12 9v4m0 4h.01"/>',
  switch:'<path d="M7 7h14l-4-4m4 4-4 4M17 17H3l4-4m-4 4 4 4"/>',
  shield:'<path d="M12 22s8-4 8-10V5L12 2 4 5v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  bookmark:'<path d="M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18l-7-5-7 5z"/>',
  spark:'<path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2z"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
} as const;

export type IconName = keyof typeof paths;
interface Props extends SVGProps<SVGSVGElement> { name: IconName; size?: number; }
export function Icon({name, size = 18, ...rest}: Props) {
  // Path markup is from our static internal constant, never from commuter input or API data.
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML={{__html: paths[name]}} {...rest} />;
}
