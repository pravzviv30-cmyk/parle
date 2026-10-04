import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { Animated, AppState, Easing } from 'react-native';
import { NATIVE_DRIVER, useReduceMotion } from '../motion.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { FEEDBACK_MS, FeedbackLedger, type FeedbackKind } from './feedbackPolicy.ts';

const ledger = new FeedbackLedger();
/** Reading is always available. Motion adds a small, cancellable settle to a real event. */
export function Feedback({ children, kind, active, eventKey, appear = false }: {
  children: ReactNode; kind: FeedbackKind; active: boolean; eventKey?: string; appear?: boolean;
}) {
  const reduced = useReduceMotion(true);
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  const value = useRef(new Animated.Value(1)).current;
  const before = useRef(appear ? false : active);
  const priorKey = useRef(eventKey);
  useEffect(() => {
    setFocused(navigation?.isFocused() ?? true);
    if (!navigation) return;
    const onFocus = navigation.addListener('focus', () => setFocused(true));
    const onBlur = navigation.addListener('blur', () => setFocused(false));
    return () => { onFocus(); onBlur(); };
  }, [navigation]);
  useEffect(() => {
    if (reduced === null) { value.setValue(1); return; }
    const edge = active && (!before.current || priorKey.current !== eventKey);
    before.current = active; priorKey.current = eventKey;
    if (!edge || !focused || reduced || (AppState.currentState === 'background' || AppState.currentState === 'inactive')) { value.setValue(1); return; }
    if (eventKey !== undefined && !ledger.claim(`${scopeGeneration()}:${kind}:${eventKey}`)) return;
    value.setValue(0.85);
    const animation = Animated.timing(value, { toValue: 1, duration: FEEDBACK_MS[kind], easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER });
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') { animation.stop(); value.setValue(1); } });
    animation.start();
    return () => { animation.stop(); subscription.remove(); value.setValue(1); };
  }, [active, eventKey, kind, reduced, focused, value]);
  return <Animated.View style={{ opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0.85, 1], outputRange: [4, 0], extrapolate: 'clamp' }) }] }}>{children}</Animated.View>;
}
