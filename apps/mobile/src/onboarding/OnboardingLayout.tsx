/** Shared onboarding frame. Progress stays mounted when its owner switches pages. */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Animated, AppState, Easing, Keyboard, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, View, useWindowDimensions, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useReduceMotion } from '../motion.ts';
import { colour, decorative, paper, space } from '../theme.ts';
import { c } from './boldRhythm.ts';
import { sheetRunsUnder } from '../components.tsx';
import { footerHeightLatch, footerInScroll } from '../responsiveLayout.ts';
import { onboardingProgress, type OnboardingProgressValue } from './onboardingProgress.ts';

/** `statusBar` lets a page whose band sits under the clock pick light or dark (2026-10-21 UI-008, B-OB bands). */
export type OnboardingFramePresentation = { hideProgress?: boolean; ground?: string; statusBar?: 'light' | 'dark' };
type FrameReporter = (progress: OnboardingProgressValue, presentation?: OnboardingFramePresentation) => void;
const FrameContext = createContext<FrameReporter | null>(null);
/**
 * The top safe-area inset a page's own band pads for when it bleeds under the
 * clock (`bleedTop`, 2026-10-21 UI-008). The frame owns the inset; a band reads
 * it here rather than measuring the safe area itself (surfaceContract F307).
 */
const TopInset = createContext(0);
export function useOnboardingTopInset(): number { return useContext(TopInset); }

/** A dedicated surface can report its route while presenting its own chrome. */
export function useOnboardingFramePresentation(value: OnboardingProgressValue, presentation: OnboardingFramePresentation, active = true) {
  const report = useContext(FrameContext);
  // Apply the dedicated surface chrome before its first visible frame.
  useLayoutEffect(() => {
    if (active) report?.(value, presentation);
  }, [report, active, value.fraction, value.stageFraction, value.step, value.total, value.complete, presentation.hideProgress, presentation.ground, presentation.statusBar]);
}

export function OnboardingProgress({ value, violet = false }: { value: OnboardingProgressValue; violet?: boolean }) {
  const reduced = useReduceMotion();
  const displayed = value.stageFraction ?? value.fraction;
  const fill = useRef(new Animated.Value(displayed)).current;
  useEffect(() => {
    fill.stopAnimation();
    const motion = Animated.timing(fill, {
      toValue: displayed, duration: reduced ? 0 : 300,
      easing: Easing.inOut(Easing.cubic), useNativeDriver: false,
    });
    motion.start();
    return () => motion.stop();
  }, [fill, reduced, displayed]);
  return <View accessibilityRole="progressbar" accessibilityLabel="Onboarding"
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(displayed * 100)} aria-valuetext={value.complete ? 'Onboarding complete' : `Onboarding, step ${value.step} of ${value.total}`}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(displayed * 100), text: value.complete ? 'Onboarding complete' : `Onboarding, step ${value.step} of ${value.total}` }}
    style={{ height: 4, flexDirection: 'row', gap: 6 }}>
    {[0, 1, 2, 3].map(stage => <View key={stage} style={{ flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: violet ? c.lavender : c.line, opacity: 1 }}>
      <Animated.View style={{ height: 4, borderRadius: 2, backgroundColor: violet ? c.sun : c.violet, width: fill.interpolate({ inputRange: [stage / 4, (stage + 1) / 4], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }} />
    </View>)}
  </View>;
}

function ProgressHeader({ value, violet = false }: { value: OnboardingProgressValue; violet?: boolean }) {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top + 8, paddingBottom: 20, paddingLeft: Math.max(24, insets.left), paddingRight: Math.max(24, insets.right) }}>
    <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}><OnboardingProgress value={value} violet={violet} /></View>
  </View>;
}

/** Put this above AuthFlow's page switch so signup shares the same live fill. */
export function OnboardingFrame({ initialProgress, children }: { initialProgress: OnboardingProgressValue; children: ReactNode }) {
  const [frame, setFrame] = useState<{ value: OnboardingProgressValue; hideProgress: boolean; ground: string; statusBar?: 'light' | 'dark' }>(() => ({
    value: initialProgress, hideProgress: false, ground: paper.ground,
  }));
  const report = useCallback<FrameReporter>((value, presentation) => {
    setFrame({ value, hideProgress: presentation?.hideProgress ?? false, ground: presentation?.ground ?? paper.ground, statusBar: presentation?.statusBar });
  }, []);
  return <FrameContext.Provider value={report}>
    <View style={{ flex: 1, minHeight: 0, backgroundColor: frame.ground }}>
      <StatusBar style={frame.statusBar ?? (frame.ground === c.violet ? "light" : "dark")} />
      <View {...(frame.hideProgress ? decorative : {})} pointerEvents={frame.hideProgress ? 'none' : 'auto'}
        style={{ height: frame.hideProgress ? 0 : undefined, opacity: frame.hideProgress ? 0 : 1, overflow: 'hidden' }}>
        <ProgressHeader value={frame.value} violet={frame.ground === c.violet} />
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
    </View>
  </FrameContext.Provider>;
}

/** Is a text field focused? Only then can a web soft keyboard be shrinking the window. Native windows never shrink for it. */
function editableFocused(): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const active = document.activeElement as HTMLElement | null;
  return active != null && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
}

type Props = {
  page: string;
  ground?: string;
  progress?: OnboardingProgressValue;
  children: ReactNode;
  /** Decorative question banner bleeds beyond the reading column's gutters. */
  hero?: ReactNode;
  footer?: ReactNode;
  avoidKeyboard?: boolean;
  /** Account actions scroll with the form; they never pin above the keyboard. */
  actionInScroll?: boolean;
  embedded?: boolean;
  active?: boolean;
  hideProgress?: boolean;
  dismissKeyboardOnBackground?: boolean;
  showScrollCue?: boolean;
  center?: boolean;
  scrollRef?: Ref<ScrollView>;
  onScroll?: ScrollViewProps['onScroll'];
  scrollEventThrottle?: number;
  /** Native form insets can be used without a second avoiding view. */
  automaticallyAdjustKeyboardInsets?: boolean;
  keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
  onViewportLayout?: ScrollViewProps['onLayout'];
  /**
   * The page draws its own band under the clock (B-OB artboards, 2026-10-21):
   * no progress header and no top spacer; the band pads for the safe area.
   */
  bleedTop?: boolean;
  /** The status bar over that band: light on blue, dark on sun and mint. */
  statusBar?: 'light' | 'dark';
};

export function OnboardingLayout({ page, progress, children, hero, footer, avoidKeyboard = false, actionInScroll: askedInScroll = false, embedded = false, active = true, hideProgress = false, dismissKeyboardOnBackground = false, showScrollCue = false, center = false, ground = c.paper, scrollRef, onScroll, scrollEventThrottle = 100, automaticallyAdjustKeyboardInsets, keyboardDismissMode, onViewportLayout, bleedTop = false, statusBar }: Props) {
  const report = useContext(FrameContext);
  const value = progress ?? onboardingProgress({ page });
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // F921: on a short screen (under 700pt usable) a pinned footer squeezes the form
  // and covers the welcome; it scrolls after the content instead.
  // The soft keyboard shrinks the web window while typing; the latch keeps the
  // tallest height at this width so the footer never jumps mid-form.
  const footerHeight = useRef<{ width: number; height: number } | null>(null);
  footerHeight.current = footerHeightLatch(footerHeight.current, width, height, editableFocused());
  const actionInScroll = askedInScroll || footerInScroll(footerHeight.current.height - insets.top - insets.bottom);
  const gutter = 24;
  const horizontal = { paddingLeft: Math.max(gutter, insets.left), paddingRight: Math.max(gutter, insets.right) };
  const ownedScroll = useRef<ScrollView | null>(null);
  const measurements = useRef({ content: 0, viewport: 0, offset: 0 });
  const flashed = useRef(false);
  const [cue, setCue] = useState(false);
  const captureScroll = useCallback((node: ScrollView | null) => {
    ownedScroll.current = node;
    if (typeof scrollRef === 'function') scrollRef(node);
    else if (scrollRef) scrollRef.current = node;
  }, [scrollRef]);
  const updateCue = () => {
    const more = showScrollCue && sheetRunsUnder(measurements.current.content, measurements.current.viewport, measurements.current.offset);
    setCue(more);
    if (more && !flashed.current) { flashed.current = true; requestAnimationFrame(() => ownedScroll.current?.flashScrollIndicators()); }
  };
  useLayoutEffect(() => { flashed.current = false; setCue(false); measurements.current = { content: 0, viewport: measurements.current.viewport, offset: 0 }; }, [page]);
  useLayoutEffect(() => {
    if (!embedded && active) report?.(value, { ground, hideProgress: hideProgress || bleedTop, statusBar });
  }, [report, ground, hideProgress, bleedTop, statusBar, embedded, active, value.fraction, value.stageFraction, value.step, value.total, value.complete]);
  if (embedded) return <View style={{ gap: space(4) }}>{hero}{children}{footer}</View>;
  const column = { width: '100%', maxWidth: 560, alignSelf: 'center' } as const;
  // RN web treats every scroll as a drag. Form focus anchors must keep editing.
  const resolvedKeyboardDismissMode = Platform.OS === 'web' ? 'none' : keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag');
  const webDragDismisses = Platform.OS === 'web' && (keyboardDismissMode ?? 'on-drag') === 'on-drag';
  const content = <>
    <ScrollView ref={captureScroll} style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{ flexGrow: 1, ...horizontal, paddingTop: hero != null || bleedTop ? 0 : 20, paddingBottom: space(4), ...(center ? { justifyContent: 'center' as const } : null) }}
      onScroll={event => { measurements.current.offset = event.nativeEvent.contentOffset.y; updateCue(); onScroll?.(event); }} scrollEventThrottle={scrollEventThrottle}
      onLayout={event => { measurements.current.viewport = event.nativeEvent.layout.height; updateCue(); onViewportLayout?.(event); }}
      onContentSizeChange={(_width, contentHeight) => { measurements.current.content = contentHeight; updateCue(); }}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      {...(webDragDismisses ? { onWheel: Keyboard.dismiss } : {})}
      onTouchMove={webDragDismisses ? Keyboard.dismiss : undefined}
      keyboardShouldPersistTaps="handled" keyboardDismissMode={resolvedKeyboardDismissMode} showsVerticalScrollIndicator={showScrollCue}>
      <View style={column}>
        {hero != null && <View style={{ marginLeft: -horizontal.paddingLeft, marginRight: -horizontal.paddingRight }}>{hero}</View>}
        {children}
      </View>
      {actionInScroll && footer != null && <View style={[column, { marginTop: space(5), paddingBottom: insets.bottom + space(4) }]}>{footer}</View>}
    </ScrollView>
    {!actionInScroll && footer != null && <View style={{ ...horizontal, paddingTop: space(3), paddingBottom: insets.bottom + space(4), backgroundColor: ground, borderTopWidth: 1, borderTopColor: cue ? c.line : 'transparent' }}>
      <ScrollView style={[column, { flexGrow: 0, maxHeight: height * 0.4 }]} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
        {footer}
      </ScrollView>
    </View>}
  </>;
  const frame = <View style={{ flex: 1, minHeight: 0, backgroundColor: ground }}>
    {report && hideProgress && !bleedTop && <View style={{ height: insets.top + 32 }} />}
    {!report && <><StatusBar style={statusBar ?? (ground === c.violet ? "light" : "dark")} />{bleedTop ? null : hideProgress ? <View style={{ height: insets.top + 32 }} /> : <ProgressHeader value={value} violet={ground === c.violet} />}</>}
    {avoidKeyboard ? <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, minHeight: 0 }}>{content}</KeyboardAvoidingView> : content}
  </View>;
  const framed = <TopInset.Provider value={bleedTop ? insets.top : 0}>{frame}</TopInset.Provider>;
  return dismissKeyboardOnBackground && Platform.OS !== 'web' ? <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>{framed}</TouchableWithoutFeedback> : framed;
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
    animation.current = Animated.timing(opacity, { toValue: 0, duration: 100, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.current.start(({ finished }) => {
      if (!finished) return;
      const next = pending.current;
      pending.current = null;
      next?.();
      shift.setValue(backward ? -12 : 12);
      animation.current = Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(shift, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      ]);
      animation.current.start(() => { locked.current = false; });
    });
    return true;
  };
  return { transition, locked, style: { opacity, transform: [{ translateY: shift }] } };
}
