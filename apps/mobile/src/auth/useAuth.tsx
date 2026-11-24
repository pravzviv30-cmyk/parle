/**
 * Auth state for the whole tree.
 *
 * The provider owns exactly three facts: whether the disk has answered yet,
 * who is signed in, and whether a password-recovery link just landed. Screens
 * read them through `useAuth()`; the adapter does everything else.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Text } from 'react-native';
import { PillButton, Sheet } from '../components.tsx';
import { paper, type } from '../theme.ts';
import { EMAIL_LINK_FAILED } from './emailCallback.ts';
import { differentAccountLine } from './friendly.ts';
import type { AuthAdapter, AuthUser } from './types.ts';
import { trackedEmailSignup } from './signupCompletion.ts';
import { observeSession } from './sessionBootstrap.ts';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  adapter: AuthAdapter;
  /** A reset-email link landed; the learner must set a new password. */
  recovering: boolean;
  clearRecovery: () => void;
  /** Kept in memory so only this new email signup can adopt its own guest plan. */
  creatingAccount: boolean;
  newAccountUserId: string | null;
  clearNewAccount: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ adapter, children }: { adapter: AuthAdapter; children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [emailLinkFailed, setEmailLinkFailed] = useState(false);
  const [accountChanged, setAccountChanged] = useState<'deletion' | 'export' | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newAccountUserId, setNewAccountUserId] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const screenAdapter = useMemo<AuthAdapter>(() => ({
    ...adapter,
    async signUpWithPassword(email, password) {
      return trackedEmailSignup(adapter, email, password, {
        begin: () => { setCreatingAccount(true); setNewAccountUserId(null); },
        created: (id) => { if (mounted.current) setNewAccountUserId(id); },
        finish: () => { if (mounted.current) setCreatingAccount(false); },
      });
    },
  }), [adapter]);

  useEffect(() => adapter.onEmailLinkFailure?.(() => setEmailLinkFailed(true)), [adapter]);
  useEffect(() => adapter.onAccountChanged?.(setAccountChanged), [adapter]);
  // The live region below is Android-only; VoiceOver hears the line from here.
  useEffect(() => {
    if (accountChanged && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(differentAccountLine(accountChanged));
  }, [accountChanged]);

  useEffect(() => {
    return observeSession(adapter, (next) => {
      setUser(next);
      setStatus(next ? 'signedIn' : 'signedOut');
      if (next === null) { setRecovering(false); setNewAccountUserId(null); }
    }, () => setRecovering(true));
  }, [adapter]);

  return (
    <AuthContext.Provider value={{ status, user, adapter: screenAdapter, recovering, clearRecovery: () => setRecovering(false), creatingAccount, newAccountUserId, clearNewAccount: () => setNewAccountUserId(null) }}>
      {children}
      <Sheet visible={emailLinkFailed} title="Email link" onClose={() => setEmailLinkFailed(false)}
        footer={<PillButton label="Continue" onPress={() => setEmailLinkFailed(false)} />}>
        <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>{EMAIL_LINK_FAILED}</Text>
      </Sheet>
      <Sheet visible={accountChanged !== null} title="Different account" onClose={() => setAccountChanged(null)}
        footer={<PillButton label="Continue" onPress={() => setAccountChanged(null)} />}>
        {accountChanged && <Text accessibilityLiveRegion="polite" style={[type.body, { color: paper.ink }]}>{differentAccountLine(accountChanged)}</Text>}
      </Sheet>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('useAuth outside AuthProvider');
  return value;
}
