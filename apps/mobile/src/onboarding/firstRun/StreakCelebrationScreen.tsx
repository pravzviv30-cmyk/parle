/** A single, event-owned entrance. The same hero moves only while fully faded. */
import { useCallback, useEffect, useState, type Ref, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Reanimated, { interpolate, Extrapolation, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { DayKey } from '@luvani/core';
import { IconButton, PillButton, Press } from '../../components.tsx';
import { Icon } from '../../icons/Icon.tsx';
import { ScrollScreen, readingColumn, useCompactPhone, useFontScale } from '../../layout.tsx';
import { useReduceMotion } from '../../motion.ts';
import { cancel, timing } from '../../motion/drive.ts';
import { useAnswered, useLandOnLeave } from '../../motion/landing.ts';
import { arrived } from '../../motion/haptics.ts';
import { play as playSfx, pauseAllSfx } from '../../sound/sfx.ts';
import { StreakFlame } from '../../streak/StreakFlame.tsx';
import { decorative, paper, radius, space, streakCelebration as palette, type } from '../../theme.ts';
import type { GuestStreak } from '../guestProgress.ts';
import { useOnboardingFramePresentation } from '../OnboardingLayout.tsx';
import { onboardingProgress, type OnboardingProgressValue } from '../onboardingProgress.ts';
import { streakCelebrationView, type StreakCelebrationView } from './streakCelebrationView.ts';
import { createEntranceReceipts, createEntranceSession, type StreakEntrancePhase, STREAK_ENTRANCE_MS, STREAK_ENTRANCE_TIMELINE, streakEntranceDuration } from './streakEntrance.ts';

const END = STREAK_ENTRANCE_MS;
const STREAK_PROGRESS = onboardingProgress({ page: 'remind' });
const STREAK_FRAME = { hideProgress: true, ground: palette.ground };
// A moment exists only after a durable, fresh qualifying finish. Keeping the
// receipt across mounts also protects React's effect replay and back navigation.
const receipts = createEntranceReceipts();


export function StreakCelebrationScreen({ streak, today, moment, onBack, onContinue, onReminder, active = true, notice, headingRef, progress = STREAK_PROGRESS }: {
  streak: GuestStreak | null;
  today: DayKey;
  moment: string | null;
  onBack?: () => void;
  onContinue: () => void;
  onReminder?: () => void;
  active?: boolean;
  notice?: string;
  headingRef?: Ref<Text>;
  progress?: OnboardingProgressValue;
}) {
  useOnboardingFramePresentation(progress, STREAK_FRAME, active);
  const model = streakCelebrationView(streak, today);
  const eventKey = model?.eventKey;
  const reduced = useAnswered(useReduceMotion(true));
  // RN Web's screen-reader API is a constant-true stub, not a browser signal.
  // Web follows prefers-reduced-motion; native also observes VoiceOver/TalkBack.
  const [reader, setReader] = useState<boolean | null>(Platform.OS === 'web' ? false : null);
  const screenReader = useAnswered(reader);
  // Native AppState can be unknown during the first bridge turn. Only an
  // actual inactive/background state should consume a fresh entrance.
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const fontScale = useFontScale();
  const compact = useCompactPhone();
  const [viewportHeight, setViewportHeight] = useState(0);
  const [flameReady, setFlameReady] = useState<boolean | null>(null);
  const onFlameReady = useCallback((canAnimate: boolean) => setFlameReady(canAnimate), []);
  const [session] = useState(() => createEntranceSession(receipts, eventKey ?? null, moment));
  const [entrance, setEntrance] = useState<StreakEntrancePhase>(session.phase);
  const clock = useSharedValue(session.phase === 'settled' ? END : 0);
  const intro = entrance !== 'settled';
  const small = compact || fontScale > 1.2;
  const flameSize = small ? 176 : 220;
  const heroHeight = flameSize + type.title.lineHeight * 2 * fontScale;
  const centralOffset = Math.max(0, (viewportHeight - heroHeight) / 2);
  const settle = useCallback(() => {
    session.settle();
    cancel(clock);
    clock.value = END;
    setEntrance('settled');
  }, [clock, session]);
  useLandOnLeave(() => { settle(); pauseAllSfx(); });

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (live) setReader(value); }).catch(() => { if (live) setReader(true); });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => { live = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (session.phase === 'waiting' && (viewportHeight === 0 || flameReady === null) && active && foreground && reduced !== true && screenReader !== true) return;
    const decision = session.update({ reduced: flameReady === false ? true : reduced, reader: screenReader, active, foreground });
    setEntrance(decision.phase);
    if (decision.celebrate) { arrived(); playSfx('streak'); }
    if (decision.phase === 'settled') { cancel(clock); clock.value = END; }
    else if (decision.animate) {
      // One linear elapsed-time value coordinates ignition, hold, invisible
      // relocation and the restrained reveal. The UI thread owns its clock.
      clock.value = timing(END, streakEntranceDuration(model!.variant), [0, 0, 1, 1], false, finished => {
        if (finished) settle();
      });
    }
  }, [active, clock, flameReady, foreground, model?.variant, screenReader, reduced, session, settle, viewportHeight]);

  const flameLook = useAnimatedStyle(() => ({
    opacity: interpolate(clock.value, STREAK_ENTRANCE_TIMELINE.flame.inputRange, STREAK_ENTRANCE_TIMELINE.flame.outputRange, Extrapolation.CLAMP),
    transform: [{ scale: interpolate(clock.value, [0, 190, 350, END], [0.88, 1.025, 1, 1], Extrapolation.CLAMP) }],
  }));
  const headlineLook = useAnimatedStyle(() => ({ opacity: interpolate(clock.value, STREAK_ENTRANCE_TIMELINE.message.inputRange, STREAK_ENTRANCE_TIMELINE.message.outputRange, Extrapolation.CLAMP) }));
  const heroLook = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - interpolate(clock.value, STREAK_ENTRANCE_TIMELINE.position.inputRange, STREAK_ENTRANCE_TIMELINE.position.outputRange, Extrapolation.CLAMP)) * centralOffset }] }));
  const secondaryHidden = intro ? decorative : {};
  const footer = <View style={readingColumn}>
    <FadeGroup clock={clock} start={1850} end={END} {...secondaryHidden} style={st.footer}>
    <PillButton label={model === null ? 'Start learning French' : 'Continue learning'} onPress={onContinue} disabled={intro} />
    {onReminder && <Press onPress={onReminder} disabled={intro} accessibilityRole="button" accessibilityLabel="Set a reminder for tomorrow. Choose and confirm a time" style={st.reminder}>
      <Icon name="bell" size={16} color={paper.ink} />
      <Text style={[type.small, st.ink]}>Remind me tomorrow</Text>
    </Press>}
    </FadeGroup>
    {intro && <Pressable accessibilityRole="button" accessibilityLabel="Skip celebration" onPress={settle} style={StyleSheet.absoluteFill} />}
  </View>;

  return <View style={st.root}>
    <ScrollScreen onViewportLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)} scrollEnabled={!intro} ground={palette.ground} topGap={16} header={onBack ? <View style={[readingColumn, st.header]}><IconButton icon="back" tone="disc" label="Back" onPress={() => { settle(); pauseAllSfx(); onBack(); }} /></View> : undefined} footer={footer}>
      <View style={st.body}>
        <View style={[readingColumn, st.column]}>
          <Reanimated.View style={[st.hero, heroLook]}>
            <Reanimated.View {...decorative} style={flameLook}>
              <StreakFlame size={flameSize} active={active && foreground} playing={entrance !== 'waiting'} onReady={onFlameReady} reducedMotion={reduced === true || screenReader === true} celebrating={entrance !== 'settled' && model !== null} />
            </Reanimated.View>
            {entrance === 'introducing' && <Confetti clock={clock} size={flameSize} richer={model?.variant === 'milestone'} />}
            <Reanimated.Text ref={headingRef} accessibilityRole="header" nativeID="streak-celebration-heading" style={[type.title, st.headline, headlineLook]}>
              {model?.headline.replace('Your streak ', 'Your streak\n') ?? 'Your next chapter starts here.'}
            </Reanimated.Text>
          </Reanimated.View>
          <FadeGroup clock={clock} start={1560} end={1790} {...secondaryHidden}>
            <Text style={[type.body, st.encouragement]}>{model?.encouragement ?? 'Finish your first practice to start a streak.'}</Text>
          </FadeGroup>
          {model && <>
            <FadeGroup clock={clock} start={1670} end={1930} {...secondaryHidden} style={st.summary}>
              <Text style={[type.small, st.summaryTitle]}>{model.summary}</Text>
              <Text style={[type.heading, st.count]}>{model.countLabel}</Text>
              <AchievementWeek model={model} clock={clock} />
            </FadeGroup>
            <FadeGroup clock={clock} start={1810} end={2050} {...secondaryHidden} style={st.milestone}>
              <Text style={[type.small, st.milestoneTitle]}>{model.nextMilestone.title}</Text>
              <Text style={[type.small, st.ink]}>{model.nextMilestone.line}</Text>
            </FadeGroup>
          </>}
          {notice ? <Text accessibilityLiveRegion="polite" style={[type.small, st.notice]}>{notice}</Text> : null}
        </View>
        {intro && <Pressable accessibilityRole="button" accessibilityLabel="Skip celebration" onPress={settle} style={StyleSheet.absoluteFill} />}
      </View>
    </ScrollScreen>
  </View>;
}

function FadeGroup({ clock, start, end, children, style, ...props }: {
  clock: SharedValue<number>; start: number; end: number; children: ReactNode;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
  pointerEvents?: 'none' | 'auto'; accessibilityElementsHidden?: boolean;
  'aria-hidden'?: boolean;
  importantForAccessibility?: 'no-hide-descendants' | 'auto';
}) {
  const look = useAnimatedStyle(() => ({ opacity: interpolate(clock.value, [0, start, end, END], [0, 0, 1, 1], Extrapolation.CLAMP) }));
  return <Reanimated.View {...props} style={[style, look]}>{children}</Reanimated.View>;
}

function AchievementWeek({ model, clock }: { model: StreakCelebrationView; clock: SharedValue<number> }) {
  const today = model.week.find(cell => cell.isToday);
  const fill = useAnimatedStyle(() => ({ opacity: interpolate(clock.value, [0, 1710, 1900, END], [0, 0, 1, 1], Extrapolation.CLAMP) }));
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(clock.value, [0, 1710, 1870, 1970, END], [0.88, 0.88, 1.07, 1, 1], Extrapolation.CLAMP) }] }));
  return <View>
    <View style={st.week}>
    {model.week.map(cell => <View key={cell.day} accessible accessibilityLabel={cell.accessibilityLabel} style={st.day}>
      <Reanimated.View style={[st.disc, cell.isToday && st.today, cell.completed && pulse]}>
        {cell.completed && <Reanimated.View {...decorative} style={[StyleSheet.absoluteFill, st.filled, fill]} />}
        {cell.completed && <Reanimated.View {...decorative} style={fill}><Icon name="check" size={18} color={paper.ink} /></Reanimated.View>}
      </Reanimated.View>
      <Text style={[type.small, st.weekday, cell.completed && st.weekdayComplete]}>{cell.label}</Text>
    </View>)}
    </View>
    {today && <Text {...decorative} style={[type.small, st.todayLabel]}>{today.completed ? 'Today' : `Today: ${today.label}`}</Text>}
  </View>;
}

/** One deterministic burst, gone before the hero's invisible relocation. */
function Confetti({ clock, size, richer }: { clock: SharedValue<number>; size: number; richer?: boolean }) {
  return <View {...decorative} style={[st.confetti, { width: size, height: size }]}>
    {Array.from({ length: richer ? 28 : 20 }, (_, i) => <Particle key={i} clock={clock} size={size} index={i} />)}
  </View>;
}

function Particle({ clock, size, index: i }: { clock: SharedValue<number>; size: number; index: number }) {
  const colors = [palette.gold, palette.orange, palette.cream, paper.ink, palette.gold, palette.cream];
  const direction = i % 2 ? 1 : -1;
  const dx = direction * (42 + (i * 29 % 96));
  const rise = 38 + (i * 19 % 88);
  const start = 40 + (i * 13 % 110);
  const end = 1050 + i % 5 * 35;
  const particleWidth = 4 + i % 3 * 2;
  const particleHeight = 5 + i % 4 * 2;
  const look = useAnimatedStyle(() => ({
    opacity: interpolate(clock.value, [0, start, start + 70, end - 190, end, END], [0, 0, 1, 1, 0, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(clock.value, [0, start, end, END], [0, 0, dx, dx], Extrapolation.CLAMP) },
      { translateY: interpolate(clock.value, [0, start, start + 380, end, END], [0, 0, -rise, 75 + i * 7 % 100, 75 + i * 7 % 100], Extrapolation.CLAMP) },
      { rotate: `${interpolate(clock.value, [0, end, END], [i * 27, i * 27 + direction * 240, i * 27 + direction * 240], Extrapolation.CLAMP)}deg` },
    ],
  }));
  return <Reanimated.View style={[{ position: 'absolute', top: size * 0.43, left: size / 2, width: particleWidth, height: particleHeight, borderRadius: i % 3 === 0 ? 5 : 1.5, backgroundColor: colors[i % colors.length] }, look]} />;
}

const st = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: palette.ground },
  header: { marginBottom: 8, alignItems: 'flex-start' },
  body: { flexGrow: 1, paddingBottom: 16 },
  column: { gap: 16, alignItems: 'stretch', maxWidth: space(105) },
  hero: { alignItems: 'center' },
  headline: { color: paper.ink, textAlign: 'center', maxWidth: space(80) },
  encouragement: { color: paper.ink, textAlign: 'center', maxWidth: space(75), alignSelf: 'center' },
  summary: { backgroundColor: palette.cream, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 16, gap: 4 },
  summaryTitle: { color: paper.inkSoft, textAlign: 'center' },
  count: { color: paper.ink, textAlign: 'center', marginBottom: 10 },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: { flex: 1, minWidth: space(0), alignItems: 'center', gap: 3 },
  disc: { width: '100%', maxWidth: space(9), aspectRatio: 1, borderRadius: 18, borderWidth: 1, borderColor: paper.line, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  today: { borderColor: paper.ink, borderWidth: 1.5 },
  filled: { backgroundColor: palette.gold, borderRadius: 18 },
  weekday: { color: paper.inkSoft },
  weekdayComplete: { color: paper.ink },
  todayLabel: { color: paper.ink, marginTop: 3 },
  milestone: { alignItems: 'center', gap: 0, paddingTop: 4 },
  milestoneTitle: { ...type.small, color: paper.ink },
  footer: { gap: 4 },
  reminder: { minHeight: 40, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 7 },
  ink: { color: paper.ink },
  notice: { color: paper.ink, textAlign: 'center' },
  confetti: { position: 'absolute', top: 0, alignSelf: 'center' },
});
