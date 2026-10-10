/**
 * Day one, drawn (come alive, README Part 5.C row 9; the rules are
 * `guestProgress.ts` `guestStreak`).
 *
 * `DayOne` leads the remind page: the one flame from `game/art`, lit once by
 * the key of the finish that has just reached the phone (`moment`), and the run
 * under it, counted up from the run before that finish. Without a moment (a
 * return to the page, a resume, a second practice the same day) the flame is
 * simply lit and the number is final. `StreakCard` is the guest home's quiet
 * version: a small flame, the run and this week.
 *
 * Every number is the guest's own finish days through core's streak rule; the
 * page passes nothing it did not read from the guest record. The flame is lit
 * only when today counts, and grey (never sad) while the run's newest day is
 * yesterday. Reduced motion: the flame lit and still, the number final (each
 * primitive watches the setting live). No sound and no haptic here: the page
 * plays the moment's once.
 */

import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import type { DayKey } from '@luvani/core';
import { Flame } from '../../game/art/index.ts';
import { GAME_COPY } from '../../game/copy.ts';
import { CountUp } from '../../motion/CountUp.tsx';
import { decorative, paper, radius, space, type } from '../../theme.ts';
import type { GuestStreak } from '../guestProgress.ts';
import { WeekStrip } from './WeekStrip.tsx';
import { OnboardingScene, CelebrationBurst } from '../motion/OnboardingScenes.tsx';
import { useReduceMotion } from '../../motion.ts';

/** The day-one flame, in points. */
const HERO_FLAME = 120;
/** The home card's flame. */
const CARD_FLAME = 40;

/** "1 day streak": what a screen reader hears for the run. */
const runLabel = (current: number): string => `${current} ${GAME_COPY.streak.label}`;

export function DayOne({ streak, moment }: { streak: GuestStreak; moment: string | null }) {
  const reduced = useReduceMotion();
  const settle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    settle.setValue(reduced ? 1 : 0);
    if (reduced) return;
    const animation = Animated.sequence([Animated.delay(900), Animated.timing(settle, { toValue: 1, duration: 450, useNativeDriver: Platform.OS !== 'web' })]);
    animation.start();
    return () => animation.stop();
  }, [reduced, settle]);
  return (
    <View style={st.hero}>
      <Animated.View style={{ transform: [{ translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: settle.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1] }) }] }}>
        <OnboardingScene kind="streak" size={150} active={streak.todayPractised} />
        {moment !== null && <View {...decorative} style={{ position: 'absolute', inset: 0 }}><CelebrationBurst size={150} /></View>}
      </Animated.View>
      <Animated.Text accessibilityRole="header" style={[type.title, st.ink, { textAlign: 'center', opacity: settle.interpolate({ inputRange: [0, 1], outputRange: [1, 0.65] }) }]}>
        {streak.current > 1 ? streak.title : 'Your Streak has started'}
      </Animated.Text>
      <Text style={[type.small, st.ink]}>{runLabel(streak.current)}</Text>
    </View>
  );
}

export function StreakCard({ streak, today }: { streak: GuestStreak; today: DayKey }) {
  return (
    <View style={st.card}>
      <View style={st.row}>
        <Flame size={CARD_FLAME} state={streak.todayPractised ? 'lit' : 'unlit'} />
        <Text style={[type.heading, st.ink, st.words]}>{runLabel(streak.current)}</Text>
      </View>
      <WeekStrip week={streak.week} today={today} moment={null} />
    </View>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: 'center', gap: space(2) },
  count: { alignItems: 'center' },
  ink: { color: paper.ink },
  card: { backgroundColor: paper.card, borderRadius: radius.card, padding: space(5), gap: space(4) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  words: { flex: 1 },
});
