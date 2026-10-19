import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/useAuth.tsx';
import { onUserScopeReset, scopeGeneration } from '../storage/scope.ts';
import type { RootStackParamList } from '../nav/types.ts';
import { fetchBillingStatus } from './client.ts';
import type { BillingStatus } from './billingStatus.ts';
import { exploreAccessLabel, openExploreContent, type ExploreAccessRef } from './exploreAccess.ts';

/** Presentation gate for the new authored collection; server admission still meters every session. */
export function useExploreAccess() {
  const { user } = useAuth();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const focused = useIsFocused();
  const owner = scopeGeneration();
  const live = useRef({ owner, id: user?.id, focused });
  live.current = { owner, id: user?.id, focused };
  const ticket = useRef(0);
  const [state, setState] = useState<{ owner: number; status: BillingStatus | null }>({ owner: -1, status: null });
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const invalidate = () => { ticket.current++; setChecking(false); setError(null); };
    const unsubscribe = onUserScopeReset(invalidate);
    const foreground = AppState.addEventListener('change', state => { if (state !== 'active') invalidate(); });
    return () => { ticket.current++; unsubscribe(); foreground.remove(); };
  }, []);
  useFocusEffect(useCallback(() => {
    let alive = true;
    setChecking(false);
    setError(null);
    if (user) void fetchBillingStatus(user.id).then(status => {
      if (alive && owner === scopeGeneration()) setState({ owner, status });
    });
    return () => { alive = false; ticket.current++; };
  }, [user?.id, owner]));
  const status = state.owner === owner ? state.status : null;
  const open = (ref: ExploreAccessRef, action: () => void) => {
    const request = ++ticket.current;
    const current = () => request === ticket.current && owner === scopeGeneration()
      && live.current.owner === owner && live.current.id === user?.id && live.current.focused
      && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    setChecking(true);
    setError(null);
    void openExploreContent({
      ref,
      current,
      read: async () => {
        const next = user ? await fetchBillingStatus(user.id) : null;
        if (current()) setState({ owner, status: next });
        return next;
      },
      open: action,
      plans: () => nav.navigate('Wall', { entry: 'settings', returnToCollection: true }),
      unavailable: () => setError('Your plan could not be checked. Try again when you’re connected. Free samples and your saved French are still available.'),
    }).finally(() => { if (current()) setChecking(false); });
  };
  return { open, checking, error, label: (ref: ExploreAccessRef) => exploreAccessLabel(ref, status) };
}
