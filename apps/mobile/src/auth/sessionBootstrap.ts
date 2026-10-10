import type { AuthAdapter, AuthUser } from './types.ts';

/** Live sign-out/account switches outrank an older encrypted-session read. */
export function observeSession(
  adapter: Pick<AuthAdapter, 'getSession' | 'onAuthStateChange' | 'onPasswordRecovery'>,
  onUser: (user: AuthUser | null) => void,
  onRecovery: () => void,
): () => void {
  let disposed = false;
  let receivedEvent = false;
  const offAuth = adapter.onAuthStateChange(user => {
    if (disposed) return;
    receivedEvent = true;
    onUser(user);
  });
  const offRecovery = adapter.onPasswordRecovery?.(() => {
    if (!disposed) onRecovery();
  });
  void Promise.resolve().then(() => adapter.getSession()).then(
    user => { if (!disposed && !receivedEvent) onUser(user); },
    () => { if (!disposed && !receivedEvent) onUser(null); },
  );
  return () => { disposed = true; offAuth(); offRecovery?.(); };
}
