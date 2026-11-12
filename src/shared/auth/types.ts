export type UserRole = 'admin' | 'customer';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Only set when role is 'admin'. */
  adminRole?: 'owner' | 'moderator';
  /** Live mode: the server-side role names (super_admin, admin, support_staff, transport_data_manager). */
  adminRoles?: string[];
}

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string; /** Live sign-up needs email confirmation first. */ confirmEmail?: boolean };

export interface RegisterInput { name: string; email: string; password: string; }

/** What the admin Users page needs to know about a customer account. */
export interface CustomerRecord { id: string; name: string; email: string; createdAt: string; lastLoginAt?: string; }

/**
 * The contract the login page and both apps rely on. `authService.ts` implements it with browser storage for the demo.
 * To connect the backend, implement the same functions with API calls (see src/shared/README.md).
 */
export interface AuthService {
  /** `identifier` is an email address (admins may also use the part before the @). */
  login(identifier: string, password: string, keepSignedIn: boolean): Promise<AuthResult>;
  /** Creates a customer account (never an admin) and signs it in. */
  register(input: RegisterInput): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<{ ok: boolean; error?: string }>;
  /** The signed-in user for this browser tab, or null. Must not throw. Live mode: valid after init(). */
  restoreSession(): AuthUser | null;
  /** Loads the session (live mode: from Supabase, role from the server). Demo: resolves restoreSession(). */
  init(): Promise<AuthUser | null>;
  logout(): Promise<void>;
  /** Sign-in/out from another tab, session expiry, or a password-recovery link. */
  onChange(listener: (user: AuthUser | null) => void): () => void;
  /** True after opening a password-reset link (live mode). */
  isPasswordRecovery(): boolean;
  updatePassword(password: string): Promise<{ ok: boolean; error?: string }>;
}
