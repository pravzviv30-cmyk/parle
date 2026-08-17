/**
 * Auth state for the whole tree.
 *
 * The provider owns exactly three facts: whether the disk has answered yet,
 * who is signed in, and whether a password-recovery link just landed. Screens
 * read them through `useAuth()`; the adapter does everything else.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import type { AuthAdapter, AuthUser } from './types.ts';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  adapter: AuthAdapter;
  /** A reset-email link landed; the learner must set a new password. */
  recovering: boolean;
  clearRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ adapter, children }: { adapter: AuthAdapter; children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void adapter.getSession().then((existing) => {
      if (cancelled) return;
      setUser(existing);
      setStatus(existing ? 'signedIn' : 'signedOut');
    });
    const offAuth = adapter.onAuthStateChange((next) => {
      if (cancelled) return;
      setUser(next);
      setStatus(next ? 'signedIn' : 'signedOut');
      if (next === null) setRecovering(false);
    });
    const offRecovery = adapter.onPasswordRecovery?.(() => {
      if (!cancelled) setRecovering(true);
    });
    return () => {
      cancelled = true;
      offAuth();
      offRecovery?.();
    };
  }, [adapter]);

  return (
    <AuthContext.Provider value={{ status, user, adapter, recovering, clearRecovery: () => setRecovering(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('useAuth outside AuthProvider');
  return value;
}
