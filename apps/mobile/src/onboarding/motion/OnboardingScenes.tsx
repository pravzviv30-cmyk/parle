/** Approved C2 vectors, with the shared native motion engine and bounded UI flourishes. */
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, AppState, Easing, StyleSheet, View } from 'react-native';
import { colour, decorative, paper, radius } from '../../theme.ts';
import { NATIVE_DRIVER, useReduceMotion } from '../../motion.ts';
import { C2Scene } from './C2Scene.tsx';

export type OnboardingSceneKind = 'welcome' | 'level' | 'plan' | 'account';
export type SceneKind = OnboardingSceneKind;

export function OnboardingScene({ kind, size = 176, active = true, eventKey }: {
  kind: OnboardingSceneKind;
  size?: number;
  active?: boolean;
  eventKey?: string | number;
}) {
  return <C2Scene kind={kind === 'level' ? 'confidence' : kind}
    width={size} active={active} eventKey={eventKey} />;
}

/** An invitation, not an endless beacon: two slow glow cycles, then rest. */
export function GlowAction({ children, active = true, tone = 'sun' }: {
  children: ReactNode;
  active?: boolean;
  tone?: 'sun' | 'white' | 'blue' | 'mint';
}) {
  const reduced = useReduceMotion();
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    glow.stopAnimation();
    glow.setValue(0);
    if (reduced || !active || AppState.currentState !== 'active') return;
    const motion = Animated.sequence(Array.from({ length: 2 }, () => Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      Animated.timing(glow, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
    ])));
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { motion.stop(); glow.setValue(0); }
    });
    motion.start();
    return () => { motion.stop(); subscription.remove(); glow.setValue(0); };
  }, [active, glow, reduced]);
  return (
    <View style={styles.action}>
      <Animated.View {...decorative} style={[styles.glow, {
        borderColor: tone === 'white' ? paper.onInk : colour[tone],
        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }),
        transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }],
      }]} />
      {children}
    </View>
  );
}

/** Short, staggered row reveals; assistive technology sees the full row immediately. */
export function RevealItem({ children, index = 0, active = true }: {
  children: ReactNode;
  index?: number;
  active?: boolean;
}) {
  const reduced = useReduceMotion(true);
  const value = useRef(new Animated.Value(active ? 0 : 1)).current;
  useEffect(() => {
    if (reduced === null && active) return;
    value.stopAnimation();
    value.setValue(1);
    if (reduced || !active) return;
    value.setValue(0);
    const entrance = Animated.timing(value, {
      toValue: 1,
      duration: 280,
      delay: Math.min(Math.max(index, 0), 6) * 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });
    entrance.start();
    return () => { entrance.stop(); value.setValue(1); };
  }, [active, index, reduced, value]);
  return <Animated.View style={{ opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  action: { position: 'relative', alignSelf: 'stretch' },
  glow: { position: 'absolute', top: -5, bottom: -5, left: -5, right: -5, borderWidth: 3, borderRadius: radius.control + 5, pointerEvents: 'none' },
});
