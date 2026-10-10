/** Shared onboarding frame. Progress stays mounted when its owner switches pages. */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Animated, AppState, Easing, KeyboardAvoidingView, Platform, ScrollView, View, useWindowDimensions, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useReduceMotion } from '../motion.ts';
import { colour, decorative, paper, space } from '../theme.ts';
import { screenInsets } from '../responsiveLayout.ts';
import { onboardingProgress, type OnboardingProgressValue } from './onboardingProgress.ts';

export type OnboardingFramePresentation = { hideProgress?: boolean; ground?: string };
type FrameReporter = (progress: OnboardingProgressValue, presentation?: OnboardingFramePresentation) => void;
const FrameContext = createContext<FrameReporter | null>(null);

/** A dedicated surface can report its route while presenting its own chrome. */
export function useOnboardingFramePresentation(value: OnboardingProgressValue, presentation: OnboardingFramePresentation, active = true) {
  const report = useContext(FrameContext);
  // Apply the dedicated surface chrome before its first visible frame.
  useLayoutEffect(() => {
    if (active) report?.(value, presentation);
  }, [report, active, value.fraction, value.step, value.total, value.complete, presentation.hideProgress, presentation.ground]);
}

export function OnboardingProgress({ value }: { value: OnboardingProgressValue }) {
  const reduced = useReduceMotion();
  const fill = useRef(new Animated.Value(value.fraction)).current;
  useEffect(() => {
    fill.stopAnimation();
    const motion = Animated.timing(fill, {
      toValue: value.fraction, duration: reduced ? 0 : 320,
      easing: Easing.inOut(Easing.cubic), useNativeDriver: false,
    });
    motion.start();
    return () => motion.stop();
  }, [fill, reduced, value.fraction]);
  return <View accessibilityRole="progressbar" accessibilityLabel="Onboarding"
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value.fraction * 100)} aria-valuetext={value.complete ? 'Onboarding complete' : `Onboarding, step ${value.step} of ${value.total}`}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(value.fraction * 100), text: value.complete ? 'Onboarding complete' : `Onboarding, step ${value.step} of ${value.total}` }}
    style={{ height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: paper.skeleton }}>
    <Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: colour.blue, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
  </View>;
}

function ProgressHeader({ value }: { value: OnboardingProgressValue }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return <View style={{ paddingTop: insets.top + space(2), paddingBottom: space(4), ...screenInsets(width, insets.left, insets.right, true) }}>
    <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}><OnboardingProgress value={value} /></View>
  </View>;
}

/** Put this above AuthFlow's page switch so signup shares the same live fill. */
export function OnboardingFrame({ initialProgress, children }: { initialProgress: OnboardingProgressValue; children: ReactNode }) {
  const [frame, setFrame] = useState<{ value: OnboardingProgressValue; hideProgress: boolean; ground: string }>(() => ({
    value: initialProgress, hideProgress: false, ground: paper.ground,
  }));
  const report = useCallback<FrameReporter>((value, presentation) => {
    setFrame({ value, hideProgress: presentation?.hideProgress ?? false, ground: presentation?.ground ?? paper.ground });
  }, []);
  return <FrameContext.Provider value={report}>
    <View style={{ flex: 1, minHeight: 0, backgroundColor: frame.ground }}>
      <StatusBar style="dark" />
      <View {...(frame.hideProgress ? decorative : {})} pointerEvents={frame.hideProgress ? 'none' : 'auto'}
        style={{ height: frame.hideProgress ? 0 : undefined, opacity: frame.hideProgress ? 0 : 1, overflow: 'hidden' }}>
        <ProgressHeader value={frame.value} />
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
    </View>
  </FrameContext.Provider>;
}

type Props = {
  page: string;
  progress?: OnboardingProgressValue;
  children: ReactNode;
  footer?: ReactNode;
  avoidKeyboard?: boolean;
  /** Account actions scroll with the form; they never pin above the keyboard. */
  actionInScroll?: boolean;
  embedded?: boolean;
  active?: boolean;
  center?: boolean;
  scrollRef?: Ref<ScrollView>;
  onScroll?: ScrollViewProps['onScroll'];
  scrollEventThrottle?: number;
  /** Native form insets can be used without a second avoiding view. */
  automaticallyAdjustKeyboardInsets?: boolean;
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
  onViewportLayout?: ScrollViewProps['onLayout'];
};

export function OnboardingLayout({ page, progress, children, footer, avoidKeyboard = false, actionInScroll = false, embedded = false, active = true, center = true, scrollRef, onScroll, scrollEventThrottle = 100, automaticallyAdjustKeyboardInsets, keyboardDismissMode, onViewportLayout }: Props) {
  const report = useContext(FrameContext);
  const value = progress ?? onboardingProgress({ page });
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const horizontal = screenInsets(width, insets.left, insets.right, true);
  useEffect(() => {
    if (!embedded && active) report?.(value);
  }, [report, embedded, active, value.fraction, value.step, value.total, value.complete]);
  if (embedded) return <View style={{ gap: space(4) }}>{children}{footer}</View>;
  const column = { width: '100%', maxWidth: 560, alignSelf: 'center' } as const;
  const content = <>
    <ScrollView ref={scrollRef} style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{ flexGrow: 1, ...horizontal, paddingBottom: space(4), ...(center ? { justifyContent: 'center' as const } : null) }}
      onScroll={onScroll} scrollEventThrottle={scrollEventThrottle} onLayout={onViewportLayout}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      keyboardShouldPersistTaps="handled" keyboardDismissMode={keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag')} showsVerticalScrollIndicator={false}>
      <View style={column}>{children}</View>
      {actionInScroll && footer != null && <View style={[column, { marginTop: space(5), paddingBottom: insets.bottom + space(4) }]}>{footer}</View>}
    </ScrollView>
    {!actionInScroll && footer != null && <View style={{ ...horizontal, paddingTop: space(3), paddingBottom: insets.bottom + space(4), backgroundColor: paper.ground }}>
      <ScrollView style={[column, { flexGrow: 0, maxHeight: height * 0.4 }]} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
        {footer}
      </ScrollView>
    </View>}
  </>;
  return <View style={{ flex: 1, minHeight: 0, backgroundColor: paper.ground }}>
    {!report && <><StatusBar style="dark" /><ProgressHeader value={value} /></>}
    {avoidKeyboard ? <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, minHeight: 0 }}>{content}</KeyboardAvoidingView> : content}
  </View>;
}

/** One interruptible two-phase transition, with a synchronous advancement lock. */
export function useOnboardingTransition() {
  const reduced = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const shift = useRef(new Animated.Value(0)).current;
  const locked = useRef(false);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!reduced) return;
    animation.current?.stop();
    const commit = pending.current;
    pending.current = null;
    commit?.();
    opacity.setValue(1); shift.setValue(0); locked.current = false;
  }, [reduced, opacity, shift]);
  useEffect(() => {
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') return;
      animation.current?.stop();
      const commit = pending.current;
      pending.current = null;
      commit?.();
      opacity.setValue(1); shift.setValue(0); locked.current = false;
    });
    return () => { app.remove(); pending.current = null; animation.current?.stop(); };
  }, [opacity, shift]);
  const transition = (commit: () => void, backward = false): boolean => {
    if (locked.current) return false;
    locked.current = true;
    if (reduced || AppState.currentState !== 'active') { commit(); locked.current = false; return true; }
    pending.current = commit;
    animation.current = Animated.timing(opacity, { toValue: 0.45, duration: 110, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.current.start(({ finished }) => {
      if (!finished) return;
      const next = pending.current;
      pending.current = null;
      next?.();
      shift.setValue(backward ? -6 : 6);
      animation.current = Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 210, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(shift, { toValue: 0, duration: 210, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      ]);
      animation.current.start(() => { locked.current = false; });
    });
    return true;
  };
  return { transition, locked, style: { opacity, transform: [{ translateY: shift }] } };
}
