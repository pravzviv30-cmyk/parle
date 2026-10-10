import { useContext, useEffect, useState } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { AppState, StyleSheet } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { decorative, radius } from '../theme.ts';
import { useReduceMotion } from '../motion.ts';
import { welcomeGlow, welcomeGlowEnabled } from './welcomeGlow.ts';

/** Decorative overlay stays within PillButton's existing pressed geometry. */
export function WelcomeSignInGlow({ active }: { active: boolean }) {
  const reduced = useReduceMotion();
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  const [appState, setAppState] = useState(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    setFocused(navigation?.isFocused() ?? true);
    if (!navigation) return;
    const onFocus = navigation.addListener('focus', () => setFocused(true));
    const onBlur = navigation.addListener('blur', () => setFocused(false));
    return () => { onFocus(); onBlur(); };
  }, [navigation]);
  const enabled = welcomeGlowEnabled(active, reduced, focused, appState);
  return <Reanimated.View
    {...decorative}
    pointerEvents="none"
    style={[StyleSheet.absoluteFill, {
      borderRadius: radius.control,
      boxShadow: welcomeGlow.rest,
      animationName: enabled ? welcomeGlow.keyframes : 'none',
      animationDuration: welcomeGlow.duration,
      animationTimingFunction: 'linear',
      animationIterationCount: 'infinite',
    }]}
  />;
}
