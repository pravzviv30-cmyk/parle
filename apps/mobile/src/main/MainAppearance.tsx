import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mainApp } from '../palette.ts';
import { activeUserId, scopeGeneration, setItemInUserScope, userKey } from '../storage/scope.ts';
import { useAuth } from '../auth/useAuth.tsx';
import { mainMode, type DisplayPreference } from './appearanceModel.ts';
import { appearanceSession, serialAppearanceWrites } from './appearanceSession.ts';
const Appearance = createContext({ mode: 'light' as 'light' | 'dark', colors: mainApp.light as { [K in keyof typeof mainApp.light]: string }, preference: 'system' as DisplayPreference, setPreference: (_value: DisplayPreference) => {}, error: null as string | null });
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
  return <Appearance.Provider value={{ mode, colors: mainApp[mode], preference, setPreference, error: owned ? state.error : null }}>{children}</Appearance.Provider>;
}
export function useMainAppearance() { return useContext(Appearance); }
