import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Text, View } from 'react-native';
import { PillButton } from '../components.tsx';
import { paper, type } from '../theme.ts';
import { NATIVE_DRIVER, useReduceMotion } from '../motion.ts';
import { OnboardingScene } from './motion/OnboardingScenes.tsx';
import { useScreenReader } from '../celebrate/useScreenReader.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';
import { onboardingProgress, type OnboardingProgressValue } from './onboardingProgress.ts';
import { C2 } from './c2Presentation.ts';
import { C2Action } from './C2Action.tsx';

/** Shown only after account creation and durable progress handoff, never on a pending email. */
export function AccountWelcome({ onDone, progress = onboardingProgress({ page: 'account-welcome' }) }: { onDone: () => void | Promise<void>; progress?: OnboardingProgressValue }) {
  const reduced = useReduceMotion();
  const reader = useScreenReader();
  const opacity = useRef(new Animated.Value(1)).current;
  const [error, setError] = useState('');
  const completed = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    void Promise.resolve().then(() => done.current()).catch(() => { completed.current = false; opacity.setValue(1); setError('Your welcome could not be saved. Tap Go to home to retry.'); });
  };
  useEffect(() => {
    opacity.setValue(1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let animation: Animated.CompositeAnimation | undefined;
    const schedule = () => {
      timer = setTimeout(() => {
        animation = Animated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 300, useNativeDriver: NATIVE_DRIVER });
        animation.start(({ finished }) => { if (finished) finish(); });
      }, reduced ? 1000 : 2200);
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
  return <OnboardingLayout page="account-welcome" progress={{ ...progress, fraction: 1, complete: true }}
    ground={C2.violet} footer={<C2Action label="Go to home" gold onPress={finish} />}>
    <Animated.View style={{ justifyContent: 'center', alignItems: 'center', gap: 20, opacity }}>
      <Text accessibilityRole="header" style={[type.title, { color: C2.white, textAlign: 'center' }]}>Welcome to Luvani.</Text>
      <View style={{ alignItems: 'center' }}><OnboardingScene kind="account" size={270} /></View>
      <Text style={[type.body, { color: C2.white, textAlign: 'center' }]}>This is where your French begins.</Text>
      {!!error && <Text accessibilityRole="alert" style={[type.small, { color: C2.white }]}>{error}</Text>}
    </Animated.View>
  </OnboardingLayout>;
}
