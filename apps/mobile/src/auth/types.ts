/**
 * The auth seam.
 *
 * One interface, two implementations: Supabase when the env carries a project,
 * a local on-device store when it does not — the same screens drive both, so
 * the app keeps its run-with-no-keys promise. Everything user-visible speaks
 * in plain sentences; adapters translate provider errors before they escape.
 */

export interface AuthUser {
  /** Stable identity — the Supabase uid, or a per-account local id in mock mode. */
  id: string;
  email: string | null;
  provider: 'password' | 'google' | 'mock';
}

/** Inline-error contract: `message` is a plain sentence, never a provider code. */
export type AuthResult = { ok: true; message?: string } | { ok: false; message: string };

export interface AuthAdapter {
  kind: 'supabase' | 'mock';
  /** The session on disk, if one survives from a previous launch. */
  getSession(): Promise<AuthUser | null>;
  /** Subscribe to sign-in/sign-out. Returns unsubscribe. */
  onAuthStateChange(cb: (user: AuthUser | null) => void): () => void;
  /**
   * Password recovery landed (web: the learner arrived from a reset email).
   * Optional — the mock adapter has no email to arrive from.
   */
  onPasswordRecovery?(cb: () => void): () => void;
  signUpWithPassword(email: string, password: string): Promise<AuthResult>;
  signInWithPassword(email: string, password: string): Promise<AuthResult>;
  signInWithGoogle(): Promise<AuthResult>;
  sendPasswordReset(email: string): Promise<AuthResult>;
  /** Finish a recovery: set the new password on the recovery session. */
  completePasswordReset?(newPassword: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  /** Bearer token for the token server, or null when there is none (mock). */
  getAccessToken(): Promise<string | null>;
}
