import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { AppState } from 'react-native';
import { useLive } from '../app/LiveContext.tsx';
import { useProfile } from '../app/ProfileContext.tsx';
import { onUserScopeReset, scopeGeneration } from '../storage/scope.ts';
import { prefersTyping } from '../profile/typing.ts';
import { ConversationStartRequest } from './conversationStartRequest.ts';
/** Preserve the existing server probe and prevent starts after blur/account change. */
export function useConversationStart() {
  const { recheck } = useLive(); const { profile } = useProfile();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const focused = useIsFocused(); const focus = useRef(focused); focus.current = focused;
  const request = useRef(new ConversationStartRequest()).current;
  const mounted = useRef(true);
  const [checking, setChecking] = useState(false); const [failed, setFailed] = useState(false);
  useEffect(() => {
    mounted.current = true;
    const reset = () => { request.invalidate(); setChecking(false); setFailed(false); };
    const unsubscribe = onUserScopeReset(reset);
    const foreground = AppState.addEventListener('change', state => { if (state !== 'active') reset(); });
    return () => { mounted.current = false; request.invalidate(); unsubscribe(); foreground.remove(); };
  }, [request]);
  // The navigation blur event invalidates immediately, even if a quick return
  // is batched into the same React render as the departure.
  useFocusEffect(useCallback(() => () => {
    request.invalidate();
    if (mounted.current) { setChecking(false); setFailed(false); }
  }, [request]));
  // A typer's default stays typed; otherwise no intent is stated, so the mic opens closed (F903).
  const start = (params: object = {}, textMode: boolean | undefined = prefersTyping(profile) ? true : undefined) => {
    void request.start({
      scope: scopeGeneration,
      visible: () => mounted.current && focus.current && AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
      probe: recheck,
      checking: setChecking,
      failed: setFailed,
      open: (screen, gateParams) => nav.navigate(screen, { ...params, ...gateParams }),
    }, textMode);
  };
  return { start, checking, failed };
}
