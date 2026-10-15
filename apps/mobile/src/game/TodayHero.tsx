/**
 * Home's hero (F767; README Part 5.F, Part 6): the flame and the streak, today's
 * goal ring in measured minutes, and the level chip, under the greeting. Then
 * the one nudge line, only while a streak is running and today is still open.
 *
 * Every word and number is decided in `todayHeroView.ts` and `home/nudge.ts`,
 * from the game layer's hooks; this file is layout. It reads the game layer on
 * its own, so it sits above Home's own read and keeps its own states: sand
 * while the facts load, and nothing at all when they could not be read, so it
 * never shows a 0 it cannot vouch for.
 *
 * Each of the three is a press at the touch floor with one spoken label. The
 * flame and the ring open the Streak screen; the chip opens Progress. They sit
 * in a row that wraps when the reading size will not fit them side by side.
 *
 * Motion (`home/useHomeDraw.ts`, rules in `home/homeDraw.ts`): what is drawn is
 * held while Home is covered, behind the app, or under a sitting, an end card,
 * a sheet or a takeover, so a rise plays once, in front of the learner, after
 * the takeovers. A number that rose since Home last drew it counts up from
 * where the learner last saw it (`home/homeSeen.ts`). One that fell, and a
 * day's number on a new day, is drawn again where it stands, keyed on its
 * mount, so nothing ever counts down or replays. The flame lights only when
 * the run rose, and flickers a few times while the tab is in view and today
 * counts. Every primitive lands on its final frame under Reduce Motion,
 * watched live. No sound and no haptic of its own: the celebration that owns
 * the moment played them.
 *
 * Coming into focus asks the game layer to catch up quietly, which is the one
 * place a moment owed from another device is replayed (F766), and the day
 * turning while Home is on top asks again, so midnight brings the new day's
 * ring and quests in without leaving the tab.
 */

import { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';

import { Card, Press, Skeleton } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { CountUp } from '../motion/CountUp.tsx';
import { ProgressRing } from '../motion/ProgressRing.tsx';
import { RING_STEPS, heroCounts, risen } from '../home/homeDraw.ts';
import { DAY_CHECK_MS, dayTurned } from '../home/homeRefresh.ts';
import { homeNudge } from '../home/nudge.ts';
import { useHomeDraw, type HomeDrawn } from '../home/useHomeDraw.ts';
import { HIT, accent, paper, radius, space, type } from '../theme.ts';
import { Flame } from './art/Flame.tsx';
import { GAME_COPY } from './copy.ts';
import { useGame, useGoal, useLevel, useStreak, useXp } from './GameProvider.tsx';
import { todayHeroView, type TodayHeroView } from './todayHeroView.ts';
import { C2Flame } from '../onboarding/C2Visuals.tsx';
import { c, boldType } from '../onboarding/boldRhythm.ts';

/** The flame and the ring sit in the touch floor's square. */
const MARK = HIT;
const RING_STROKE = space(1);

type HeroModel = { hero: TodayHeroView; nudge: string | null };

export function TodayHero({ compact = false }: { compact?: boolean }) {
  const focused = useIsFocused();
  const { view, failed, refresh } = useGame();
  const run = useStreak();
  const goal = useGoal();
  const level = useLevel();
  const xp = useXp();
  const today = view?.today ?? null;

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  // While Home is on top, the day turning reads the game layer again.
  useEffect(() => {
    if (!focused || today === null) return;
    const timer = setInterval(() => {
      if (dayTurned(today, Date.now())) refresh();
    }, DAY_CHECK_MS);
    return () => clearInterval(timer);
  }, [focused, today, refresh]);

  const hero = todayHeroView({ streak: run, goal, level, xp });
  const nudge = homeNudge(run);
  const drawn = useHomeDraw<HeroModel>(today, hero === null ? null : { hero, nudge }, (model) => heroCounts(model.hero));

  if (hero === null) {
    // Unread: nothing, never a nought. Loading: one sand block where it will be.
    return failed ? null : <Skeleton blocks={[{ height: HIT + space(8), radius: radius.card }]} />;
  }
  if (drawn === null) return <Skeleton blocks={[{ height: HIT + space(8), radius: radius.card }]} />;
  return <DrawnHero drawn={drawn} focused={focused} compact={compact} />;
}

/** The hero as last drawn where the learner could see it. */
function DrawnHero({ drawn, focused, compact }: { drawn: HomeDrawn<HeroModel>; focused: boolean; compact: boolean }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { hero, nudge } = drawn.model;
  const { day, counters } = drawn.draw;
  const count = hero.flame.count;
  const run = counters.streak;
  const ring = counters.ring;
  const chip = counters.level;

  if (compact) return <Press haptic="light" accessibilityRole="button" accessibilityLabel={hero.flame.label}
    onPress={() => nav.navigate('Streak')} frame={st.compactFrame}
    style={{ minHeight: 112, backgroundColor: c.violet, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
    <View style={{ opacity: hero.flame.lit ? 1 : 0.65 }}><C2Flame size={58} active={focused && hero.flame.lit} /></View>
    <View style={{ flex: 1, gap: 4 }}>
      {count !== null && run !== undefined ? <CountUp key={`run-${run.mount}`} from={run.from} to={run.to}
        format={value => `${value}-day streak`} textStyle={[boldType.streakCount, { color: c.sun }]} />
        : <Text style={[boldType.heading, { color: c.sun }]}>Start your streak</Text>}
      <Text style={[boldType.small, { color: c.white }]}>{hero.flame.lit ? 'You showed up for your French today.' : nudge ?? 'A little French. A fresh beginning.'}</Text>
    </View>
  </Press>;

  return (
    <View style={st.block}>
      <Card style={st.card}>
        <View style={st.row}>
          <Press
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={hero.flame.label}
            onPress={() => nav.navigate('Streak')}
            frame={st.frame}
            style={st.part}
          >
            <Flame
              size={MARK}
              state={hero.flame.lit ? 'lit' : 'unlit'}
              ignite={hero.flame.lit && risen(run) ? `streak:${day}` : undefined}
              flicker={focused && hero.flame.lit}
            />
            <View style={st.words}>
              {count !== null && run !== undefined ? (
                <CountUp key={`run-${run.mount}`} from={run.from} to={run.to} textStyle={[type.heading, { color: paper.ink }]} />
              ) : null}
              <Text style={[type.small, { color: count === null ? paper.ink : paper.inkSoft }]}>{hero.flame.words}</Text>
            </View>
          </Press>

          <Press
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={hero.goal.label}
            onPress={() => nav.navigate('Streak')}
            frame={st.frame}
            style={st.part}
          >
            {hero.goal.fraction !== null && ring !== undefined ? (
              <ProgressRing
                key={`ring-${ring.mount}`}
                from={ring.from / RING_STEPS}
                to={ring.to / RING_STEPS}
                size={MARK}
                stroke={RING_STROKE}
                color={paper.ink}
                track={paper.line}
              />
            ) : (
              <Icon name="clock" variant="bulk" size={MARK - space(4)} color={accent.brand} />
            )}
            <View style={st.words}>
              <Text style={[type.label, { color: paper.ink }]}>{hero.goal.words}</Text>
            </View>
          </Press>

          <Press
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={hero.level.label}
            onPress={() => nav.navigate('MyFrench')}
            frame={st.frame}
            style={st.part}
          >
            <Icon name="star" variant="bulk" size={MARK - space(4)} color={accent.brand} />
            <View style={st.words}>
              {chip !== undefined ? (
                <CountUp key={`level-${chip.mount}`} from={chip.from} to={chip.to} format={GAME_COPY.level.title} textStyle={[type.label, { color: paper.ink }]} />
              ) : (
                <Text style={[type.label, { color: paper.ink }]}>{hero.level.words}</Text>
              )}
            </View>
          </Press>
        </View>
      </Card>
      {nudge !== null ? <Text style={[type.body, { color: paper.ink }]}>{nudge}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  compactFrame: { width: '100%', marginBottom: 18, minHeight: HIT },
  block: { marginTop: space(2), marginBottom: space(4), gap: space(3) },
  card: { paddingVertical: space(3) },
  // Side by side while they fit; at a large reading size each takes a line.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space(4), rowGap: space(2) },
  frame: { flexGrow: 1, maxWidth: '100%' },
  part: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(1) },
  words: { flexShrink: 1, minWidth: 0 },
});
