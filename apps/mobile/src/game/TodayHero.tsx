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
 * Motion: a number that rose since Home last drew it counts up once from where
 * the learner last saw it (`home/homeSeen.ts`), and never counts down or
 * replays. The flame lights only when the streak rose today, and flickers a
 * few times while the tab is in view and today counts. Every primitive lands
 * on its final frame under Reduce Motion, watched live. No sound and no
 * haptic of its own: the celebration that owns the moment played them.
 *
 * Coming into focus asks the game layer to catch up quietly, which is the one
 * place a moment owed from another device is replayed (F766).
 */

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';

import { Card, Press, Skeleton } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { CountUp } from '../motion/CountUp.tsx';
import { ProgressRing } from '../motion/ProgressRing.tsx';
import { homeNudge } from '../home/nudge.ts';
import { useShownFrom } from '../home/useShownFrom.ts';
import { HIT, accent, paper, radius, space, type } from '../theme.ts';
import { Flame } from './art/Flame.tsx';
import { GAME_COPY } from './copy.ts';
import { useGame, useGoal, useLevel, useStreak, useXp } from './GameProvider.tsx';
import { todayHeroView } from './todayHeroView.ts';

/** The flame and the ring sit in the touch floor's square. */
const MARK = HIT;
const RING_STROKE = space(1);

export function TodayHero() {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const focused = useIsFocused();
  const { view, failed, refresh } = useGame();
  const run = useStreak();
  const goal = useGoal();
  const level = useLevel();
  const xp = useXp();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const hero = todayHeroView({ streak: run, goal, level, xp });
  const from = useShownFrom(
    view?.today ?? null,
    hero === null ? null : { streak: hero.flame.count ?? 0, minutes: hero.goal.minutes, level: hero.level.level },
  );
  const nudge = homeNudge(run);

  if (hero === null) {
    // Unread: nothing, never a nought. Loading: one sand block where it will be.
    return failed ? null : <Skeleton blocks={[{ height: HIT + space(8), radius: radius.card }]} />;
  }
  if (from === null) return <Skeleton blocks={[{ height: HIT + space(8), radius: radius.card }]} />;

  const count = hero.flame.count;
  const rose = count !== null && from.streak !== undefined && count > from.streak;
  const startMinutes = from.minutes ?? hero.goal.minutes;

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
              ignite={rose && hero.flame.lit && view !== null ? `streak:${view.today}` : undefined}
              flicker={focused && hero.flame.lit}
            />
            <View style={st.words}>
              {count !== null ? (
                <CountUp from={from.streak ?? count} to={count} textStyle={[type.heading, { color: paper.ink }]} />
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
            {hero.goal.fraction !== null && hero.goal.target !== null ? (
              <ProgressRing
                from={Math.min(1, startMinutes / hero.goal.target)}
                to={hero.goal.fraction}
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
              <CountUp
                from={from.level ?? hero.level.level}
                to={hero.level.level}
                format={GAME_COPY.level.title}
                textStyle={[type.label, { color: paper.ink }]}
              />
            </View>
          </Press>
        </View>
      </Card>
      {nudge !== null ? <Text style={[type.body, { color: paper.ink }]}>{nudge}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  block: { marginTop: space(2), marginBottom: space(4), gap: space(3) },
  card: { paddingVertical: space(3) },
  // Side by side while they fit; at a large reading size each takes a line.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space(4), rowGap: space(2) },
  frame: { flexGrow: 1, maxWidth: '100%' },
  part: { minHeight: HIT, flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(1) },
  words: { flexShrink: 1, minWidth: 0 },
});
