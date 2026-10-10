import { useEffect, useRef } from 'react';
import { Animated, AppState, Text, View } from 'react-native';
import { PillButton } from '../components.tsx';
import { Screen, readingColumn } from '../layout.tsx';
import { colour, paper, type } from '../theme.ts';
import { NATIVE_DRIVER, useReduceMotion } from '../motion.ts';
import { OnboardingScene } from './motion/OnboardingScenes.tsx';
import { useScreenReader } from '../celebrate/useScreenReader.ts';

/** Shown only after account creation and durable progress handoff, never on a pending email. */
export function AccountWelcome({ onDone }: { onDone: () => void }) {
  const reduced = useReduceMotion();
  const reader = useScreenReader();
  const opacity = useRef(new Animated.Value(1)).current;
  const completed = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    done.current();
  };
  useEffect(() => {
    opacity.setValue(1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let animation: Animated.CompositeAnimation | undefined;
    const schedule = () => {
      timer = setTimeout(() => {
        animation = Animated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 300, useNativeDriver: NATIVE_DRIVER });
        animation.start(({ finished }) => { if (finished) finish(); });
      }, reduced ? 1800 : 2600);
    };
    if (reader === false && AppState.currentState === 'active') schedule();
    const subscription = AppState.addEventListener('change', state => {
      if (timer) clearTimeout(timer);
      animation?.stop();
      opacity.setValue(1);
      if (reader === false && state === 'active' && !completed.current) schedule();
    });
    return () => { if (timer) clearTimeout(timer); animation?.stop(); subscription.remove(); };
  }, [reduced, reader, opacity]);
  return <Screen ground={colour.sun} footer={<PillButton label="Go to Home" onPress={finish} />}>
    <Animated.View style={[readingColumn, { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20, opacity }]}>
      <View style={{ alignItems: 'center' }}><OnboardingScene kind="account" size={220} /></View>
      <Text accessibilityRole="header" style={[type.display, { color: paper.ink, textAlign: 'center' }]}>You’re in!</Text>
      <Text style={[type.body, { color: paper.ink, textAlign: 'center' }]}>Your account is ready. Your French journey is yours to keep.</Text>
    </Animated.View>
  </Screen>;
}
