import { useEffect, useLayoutEffect, useState } from 'react';

export type Appearance = 'light' | 'dark' | 'system';
const KEY = 'sakaywise:admin:settings:v1';

export function useAppearance(): [Appearance, (a: Appearance) => void] {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try { const v = JSON.parse(localStorage.getItem(KEY) || 'null') as { appearance?: string } | null; if (v && ['light', 'dark', 'system'].includes(String(v.appearance))) return v.appearance as Appearance; } catch { /* default */ }
    return 'system';
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  const theme = appearance === 'system' ? (systemDark ? 'dark' : 'light') : appearance;
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; }, [theme]);
  const update = (next: Appearance) => { setAppearance(next); try { localStorage.setItem(KEY, JSON.stringify({ appearance: next })); } catch { /* keep in memory */ } };
  return [appearance, update];
}
