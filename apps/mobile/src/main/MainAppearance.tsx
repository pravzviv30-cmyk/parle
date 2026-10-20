import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activeUserId, scopeGeneration, setItemInUserScope, userKey } from '../storage/scope.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { mainMode, type DisplayPreference } from './appearanceModel.ts';
import { appearanceSession, serialAppearanceWrites } from './appearanceSession.ts';
import { Appearance, appearanceFor } from './bTheme.tsx';
// The context, useB, useThemedStyles and PinLight live in the leaf bTheme.tsx so
// shared parts can read the theme without importing auth (UI-008, 2026-10-20).
export { useB, useThemedStyles, PinLight, ModeScope, type B } from './bTheme.tsx';
// One device write order also protects a same-account provider remount.
const persistChoice = serialAppearanceWrites((change: { owner: number; key: string; value: DisplayPreference }) =>
  setItemInUserScope(change.owner, change.key, change.value));
export function MainAppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); const { user } = useAuth();
  const currentUser = useRef(user?.id ?? null); currentUser.current = user?.id ?? null;
  const [state, setState] = useState({ owner: -1, userId: null as string | null, preference: 'system' as DisplayPreference, error: null as string | null });
  const session = useRef<ReturnType<typeof appearanceSession> | null>(null);
  useEffect(() => {
    const owner = scopeGeneration(); const userId = user?.id ?? null;
    setState({ owner, userId, preference: 'system', error: null });
    if (!userId || activeUserId() !== userId) return;
    const key = userKey('appearance');
    const request = appearanceSession({
      current: () => owner === scopeGeneration() && userId === activeUserId() && userId === currentUser.current,
      read: async () => { await persistChoice.settled(); return AsyncStorage.getItem(key); },
      write: value => persistChoice.write({ owner, key, value }),
      value: preference => setState(previous => ({ ...previous, owner, userId, preference })),
      error: error => setState(previous => ({ ...previous, owner, userId, error })),
    });
    session.current = request;
    void request.load();
    return () => { request.dispose(); if (session.current === request) session.current = null; };
  }, [user?.id]);
  const setPreference = useCallback((value: DisplayPreference) => { void session.current?.choose(value); }, []);
  const owned = state.owner === scopeGeneration() && state.userId === (user?.id ?? null);
  const preference = owned ? state.preference : 'system';
  const mode = mainMode(preference, system);
  const error = owned ? state.error : null;
  const value = useMemo(() => appearanceFor(mode, { preference, setPreference, error }), [mode, preference, setPreference, error]);
  return <Appearance.Provider value={value}>{children}</Appearance.Provider>;
}
export function useMainAppearance() { return useContext(Appearance); }
