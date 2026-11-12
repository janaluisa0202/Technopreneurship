import { useEffect, useState } from 'react';

export type RouteKey = 'dashboard' | 'promos' | 'help' | 'incidents' | 'messages' | 'queue' | 'announcements' | 'users' | 'activity' | 'settings';
export const routeKeys: RouteKey[] = ['dashboard', 'promos', 'help', 'incidents', 'messages', 'queue', 'announcements', 'users', 'activity', 'settings'];

export interface ParsedRoute { key: RouteKey; param?: string; }
export function parseHash(hash: string): ParsedRoute {
  const [first, second] = hash.replace(/^#\/?/, '').split('/');
  const key = (routeKeys as string[]).includes(first) ? (first as RouteKey) : 'dashboard';
  return { key, param: second ? decodeURIComponent(second) : undefined };
}
export function useHashRoute(): ParsedRoute {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
export const go = (key: RouteKey, param?: string) => { location.hash = `#/${key}${param ? `/${encodeURIComponent(param)}` : ''}`; };
export const href = (key: RouteKey, param?: string) => `#/${key}${param ? `/${encodeURIComponent(param)}` : ''}`;
