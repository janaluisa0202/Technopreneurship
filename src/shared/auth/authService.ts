import type { AuthResult, AuthService, AuthUser, CustomerRecord, RegisterInput } from './types';

/**
 * DEMO AUTH — browser storage only.
 * Anything checked in the browser can be bypassed, so this must be replaced by the backend before real use:
 * the server has to verify credentials, issue the session, and decide whether someone is an admin or a customer.
 */
export const DEMO_MODE = true;
export const DEMO_ADMIN_PASSWORD = 'SakayWise-Admin1';
export const DEMO_CUSTOMER_PASSWORD = 'SakayWise-User1';

const admins: AuthUser[] = [
  { id: 'adm-1', name: 'Admin Demo', email: 'admin@sakaywise.demo', role: 'admin', adminRole: 'owner' },
  { id: 'adm-2', name: 'Ops Moderator', email: 'ops@sakaywise.demo', role: 'admin', adminRole: 'moderator' },
];
/** Ready-made customers. Their ids match the sample conversations in the support store. */
const seedCustomers: CustomerRecord[] = [
  { id: 'user-1', name: 'Mika Santos', email: 'mika@sakaywise.demo', createdAt: '2026-08-01T08:00:00.000Z' },
  { id: 'user-2', name: 'Carlo Reyes', email: 'carlo@sakaywise.demo', createdAt: '2026-08-12T08:00:00.000Z' },
  { id: 'user-3', name: 'Bea Cruz', email: 'bea@sakaywise.demo', createdAt: '2026-08-20T08:00:00.000Z' },
  { id: 'user-4', name: 'Jun Dela Cruz', email: 'jun@sakaywise.demo', createdAt: '2026-07-10T08:00:00.000Z' },
  { id: 'user-5', name: 'Lia Ramos', email: 'lia@sakaywise.demo', createdAt: '2026-11-10T08:00:00.000Z' },
  { id: 'user-6', name: 'Rina Lopez', email: 'rina@sakaywise.demo', createdAt: '2026-06-02T08:00:00.000Z' },
];

const ACCOUNTS_KEY = 'sakaywise:auth:accounts:v1';
const LOGINS_KEY = 'sakaywise:auth:logins:v1';
export const SESSION_KEY = 'sakaywise:session:v1';
const KEEP_DAYS = 7;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface StoredAccount { id: string; name: string; email: string; salt: string; hash: string; createdAt: string; }

function readJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: demo keeps working in memory only */ }
}
const storedAccounts = (): StoredAccount[] => {
  const list = readJson<unknown>(ACCOUNTS_KEY, []);
  return Array.isArray(list) ? (list as StoredAccount[]).filter(a => a && typeof a.id === 'string' && typeof a.email === 'string' && typeof a.hash === 'string') : [];
};
const logins = () => readJson<Record<string, string>>(LOGINS_KEY, {});

async function sha256(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('secure-context');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
const randomHex = (bytes: number) => Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, '0')).join('');

const toUser = (c: CustomerRecord): AuthUser => ({ id: c.id, name: c.name, email: c.email, role: 'customer' });

/* ---------- customer directory (used by the admin Users page) ---------- */
let customersCache: CustomerRecord[] = [];
const customerListeners = new Set<() => void>();
function refreshCustomers() {
  const last = logins();
  const registered: CustomerRecord[] = storedAccounts().map(a => ({ id: a.id, name: a.name, email: a.email, createdAt: a.createdAt }));
  customersCache = [...seedCustomers, ...registered].map(c => ({ ...c, lastLoginAt: last[c.id] }));
  customerListeners.forEach(l => l());
}
refreshCustomers();
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === ACCOUNTS_KEY || e.key === LOGINS_KEY) refreshCustomers(); });
export const customerDirectory = {
  getSnapshot: () => customersCache,
  subscribe(listener: () => void) { customerListeners.add(listener); return () => { customerListeners.delete(listener); }; },
};

/* ---------- sessions ---------- */
let failures = 0;
let lockedUntil = 0;

function findByIdentifier(raw: string): { user: AuthUser; check: (password: string) => Promise<boolean> } | null {
  const id = raw.trim().toLowerCase();
  const demo = (password: string) => async (p: string) => p === password;
  const admin = admins.find(a => a.email === id || a.email.split('@')[0] === id);
  if (admin) return { user: admin, check: demo(DEMO_ADMIN_PASSWORD) };
  const seed = seedCustomers.find(c => c.email === id || c.email.split('@')[0] === id);
  if (seed) return { user: toUser(seed), check: demo(DEMO_CUSTOMER_PASSWORD) };
  const stored = storedAccounts().find(a => a.email.toLowerCase() === id);
  if (stored) return { user: toUser(stored as unknown as CustomerRecord), check: async p => (await sha256(`${stored.salt}:${p}`)) === stored.hash };
  return null;
}
function startSession(user: AuthUser, keep: boolean) {
  const session = JSON.stringify({ userId: user.id, expiresAt: Date.now() + (keep ? KEEP_DAYS * 86400000 : 12 * 3600000) });
  try {
    localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
    (keep ? localStorage : sessionStorage).setItem(SESSION_KEY, session);
  } catch { /* the session still works for this page load */ }
  if (user.role === 'customer') { writeJson(LOGINS_KEY, { ...logins(), [user.id]: new Date().toISOString() }); refreshCustomers(); }
}

export const authService: AuthService = {
  async login(identifier, password, keep): Promise<AuthResult> {
    const now = Date.now();
    if (now < lockedUntil) return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((lockedUntil - now) / 1000)} seconds.` };
    if (!identifier.trim() || !password) return { ok: false, error: 'Enter your email and your password.' };
    await new Promise(resolve => setTimeout(resolve, 450));
    const found = findByIdentifier(identifier);
    let valid = false;
    try { valid = !!found && (await found.check(password)); } catch { valid = false; }
    if (!found || !valid) {
      failures += 1;
      if (failures >= MAX_ATTEMPTS) { lockedUntil = Date.now() + LOCK_MS; failures = 0; }
      return { ok: false, error: 'Incorrect email or password.' };
    }
    failures = 0;
    startSession(found.user, keep);
    return { ok: true, user: found.user };
  },

  async register(input: RegisterInput): Promise<AuthResult> {
    const name = input.name.trim().replace(/\s+/g, ' ');
    const email = input.email.trim().toLowerCase();
    if (name.length < 2 || name.length > 60) return { ok: false, error: 'Enter your name (2–60 characters).' };
    if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: 'Enter a valid email address.' };
    if (input.password.length < 8) return { ok: false, error: 'Use a password with at least 8 characters.' };
    if (findByIdentifier(email) || admins.some(a => a.email === email)) return { ok: false, error: 'An account with this email already exists. Try signing in.' };
    let salt: string; let hash: string;
    try { salt = randomHex(16); hash = await sha256(`${salt}:${input.password}`); }
    catch { return { ok: false, error: 'Creating an account needs localhost or https. Open the site from http://localhost.' }; }
    const account: StoredAccount = { id: `cust-${randomHex(6)}`, name, email, salt, hash, createdAt: new Date().toISOString() };
    writeJson(ACCOUNTS_KEY, [...storedAccounts(), account]);
    refreshCustomers();
    const user = toUser({ id: account.id, name, email, createdAt: account.createdAt });
    startSession(user, false);
    return { ok: true, user };
  },

  async requestPasswordReset(email) {
    if (!EMAIL.test(email.trim())) return { ok: false, error: 'Enter a valid email address.' };
    await new Promise(resolve => setTimeout(resolve, 400));
    return { ok: true }; // Always succeeds so the form never reveals which emails have accounts.
  },

  restoreSession(): AuthUser | null {
    for (const store of [sessionStorage, localStorage]) {
      try {
        const raw = store.getItem(SESSION_KEY);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { userId?: string; expiresAt?: number };
        if (typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now() && typeof parsed.userId === 'string') {
          const admin = admins.find(a => a.id === parsed.userId);
          if (admin) return admin;
          const customer = customersCache.find(c => c.id === parsed.userId);
          if (customer) return toUser(customer);
        }
        store.removeItem(SESSION_KEY);
      } catch { /* ignore a malformed session */ }
    }
    return null;
  },

  logout() {
    try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch { /* nothing to clear */ }
  },
};
