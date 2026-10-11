import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Text, View } from 'react-native';
import { BoldButton as PillButton } from './BoldButton.tsx';
import { paper } from '../theme.ts';
import { boldType as type } from './boldRhythm.ts';
import { NATIVE_DRIVER, useReduceMotion } from '../motion.ts';
import { BoldScene } from './motion/BoldScene.tsx';
import { useScreenReader } from '../celebrate/useScreenReader.ts';
import { OnboardingLayout } from './OnboardingLayout.tsx';
import { onboardingProgress, type OnboardingProgressValue } from './onboardingProgress.ts';

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
      }, reduced ? 1000 : 1700);
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
    footer={<PillButton label="Go to home" onPress={finish} />}>
    <Animated.View style={{ justifyContent: 'center', alignItems: 'center', gap: 20, opacity }}>
      <View style={{ alignItems: 'center' }}><BoldScene kind="fresh" width={240} /></View>
      <Text accessibilityRole="header" style={[type.title, { color: paper.ink, textAlign: 'center' }]}>Welcome to Luvani.</Text>
      <Text style={[type.body, { color: paper.ink, textAlign: 'center' }]}>This is where your French begins.</Text>
      {!!error && <Text accessibilityRole="alert" style={type.small}>{error}</Text>}
    </Animated.View>
  </OnboardingLayout>;
}
