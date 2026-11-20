/**
 * Where people land.
 *  - "/"             customer app, open to everyone (guests can plan routes, compare fares, see queues and advisories).
 *  - "/?signin=1"    the sign-in page (used by the admin site and by "Sign in" links).
 *  - "/admin.html"   admin console, signed-in admins only.
 */
export const SIGNIN_PARAM = 'signin';

/** True when the address asks for the sign-in page, e.g. "?signin=1". */
export function wantsSignIn(search: string): boolean {
  try { return new URLSearchParams(search).has(SIGNIN_PARAM); } catch { return false; }
}

export const adminUrl = (base: string) => `${base}admin.html`;
export const signInUrl = (base: string) => `${base}?${SIGNIN_PARAM}=1`;

/** Removes ?signin from the address bar without reloading (keeps any other parameters). */
export function clearSignInParam(): void {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has(SIGNIN_PARAM)) return;
    url.searchParams.delete(SIGNIN_PARAM);
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch { /* address bar is cosmetic; ignore */ }
}
