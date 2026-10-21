/**
 * Today's stats row (F767; README Part 5.F, Part 6; redrawn 2026-10-20, B5,
 * B-Today): the flame and the streak, today's goal ring in measured minutes,
 * and the level with its XP, three tiles in one white card under the greeting.
 * Then the one nudge line, only while a streak is running and today is still
 * open.
 *
 * Every word and number is decided in `todayHeroView.ts` and `home/nudge.ts`,
 * from the game layer's hooks; this file is layout. It reads the game layer on
 * its own, so it sits above Home's own read and keeps its own states: sand
 * while the facts load, and nothing at all when they could not be read, so it
 * never shows a 0 it cannot vouch for.
 *
 * Each tile is a press at the touch floor with one spoken label. The flame and
 * the ring open the Streak screen; the level opens Journey.
 *
 * Motion (`home/useHomeDraw.ts`, rules in `home/homeDraw.ts`): what is drawn is
 * held while Home is covered, behind the app, or under a sitting, an end card,
 * a sheet or a takeover, so a rise plays once, in front of the learner, after
 * the takeovers. A number that rose since Home last drew it counts up from
 * where the learner last saw it (`home/homeSeen.ts`). One that fell, and a
 * day's number on a new day, is drawn again where it stands, keyed on its
 * mount, so nothing ever counts down or replays. The flame is the canvas
 * drawing (2026-10-20 UI-008, artboard B-Today), still, and dimmed while
 * today has not counted yet; its ignite and flicker left with the old Flame
 * part. Every primitive lands on its final frame under Reduce Motion,
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

import { Press, Skeleton, StatRow, StatTile } from '../components.tsx';
import { BArt } from '../art/BArt.tsx';
import { CountUp } from '../motion/CountUp.tsx';
import { Icon } from '../icons/Icon.tsx';
import { ProgressRing } from '../motion/ProgressRing.tsx';
import { useB } from '../main/bTheme.tsx';
import { StarMark } from '../today/TodayParts.tsx';
import { RING_STEPS, heroCounts } from '../home/homeDraw.ts';
import { DAY_CHECK_MS, dayTurned } from '../home/homeRefresh.ts';
import { homeNudge } from '../home/nudge.ts';
import { useHomeDraw, type HomeDrawn } from '../home/useHomeDraw.ts';
import { HIT, radius, space, type } from '../theme.ts';
import { GAME_COPY } from './copy.ts';
import { useGame, useGoal, useLevel, useStreak, useXp } from './GameProvider.tsx';
import { statTiles, streakDays, todayHeroView, type TodayHeroView } from './todayHeroView.ts';

/** The flame and the ring sit in the touch floor's square. */
const MARK = HIT;
const RING_STROKE = space(1.5);

type HeroModel = { hero: TodayHeroView; nudge: string | null };

export function TodayHero() {
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
  return <DrawnHero drawn={drawn} xpTotal={xp?.total ?? 0} />;
}

/**
 * The hero as last drawn where the learner could see it: Today's stats row
 * (2026-10-20, B5, B-Today), one white card of three. The flame and the
 * streak, today's goal ring with "6 of 10" and "min today", and the level with
 * its XP. Each tile is a door at the touch floor with one spoken label, which
 * is also the ring's label: the disc marks themselves are decoration. With no
 * goal chosen there is no ring, only today's minutes beside a clock.
 */
function DrawnHero({ drawn, xpTotal }: { drawn: HomeDrawn<HeroModel>; xpTotal: number }) {
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
  const { hero, nudge } = drawn.model;
  const { counters } = drawn.draw;
  const run = counters.streak;
  const ring = counters.ring;
  const chip = counters.level;
  const count = hero.flame.count;
  const t = useB();
  const tiles = statTiles(hero, xpTotal);
  const number = [type.statSm, st.centred, { color: t.text }];

  return (
    <View style={st.block}>
      <StatRow>
        <Press haptic="light" accessibilityRole="button" accessibilityLabel={hero.flame.label} onPress={() => nav.navigate('Streak')} frame={st.frame} style={st.part}>
          <StatTile
            compact
            value={tiles.streak.value}
            valueNode={count !== null && run !== undefined ? <CountUp key={`run-${run.mount}`} from={run.from} to={run.to} format={streakDays} textStyle={number} /> : undefined}
            label={tiles.streak.label}
            mark={
              <View style={[st.disc, { backgroundColor: t.sun }]}>
                {/* 2026-10-20 UI-008, artboard B-Today: the canvas flame, 28 by 35, dimmed while today is still open. */}
                <BArt name="flame" width={28} height={35} style={hero.flame.lit ? undefined : st.unlit} />
              </View>
            }
          />
        </Press>
        <Press haptic="light" accessibilityRole="button" accessibilityLabel={hero.goal.label} onPress={() => nav.navigate('Streak')} frame={st.frame} style={st.part}>
          <StatTile
            compact
            value={tiles.goal.value}
            label={tiles.goal.label}
            mark={
              <View style={[st.disc, { backgroundColor: t.lavender }]}>
                {hero.goal.fraction !== null && ring !== undefined ? (
                  <ProgressRing key={`ring-${ring.mount}`} from={ring.from / RING_STEPS} to={ring.to / RING_STEPS} size={MARK - space(1.5)} stroke={RING_STROKE} color={t.brand} track={t.card} />
                ) : (
                  <Icon name="clock" variant="bulk" size={MARK - space(4)} color={t.brand} />
                )}
              </View>
            }
          />
        </Press>
        <Press haptic="light" accessibilityRole="button" accessibilityLabel={hero.level.label} onPress={() => nav.navigate('MyFrench')} frame={st.frame} style={st.part}>
          <StatTile
            compact
            value={tiles.level.value}
            valueNode={chip !== undefined ? <CountUp key={`level-${chip.mount}`} from={chip.from} to={chip.to} format={GAME_COPY.level.title} textStyle={number} /> : undefined}
            label={tiles.level.label}
            mark={
              <View style={[st.disc, { backgroundColor: t.mint }]}>
                <StarMark size={28} fill={t.onBrand} stroke={t.onMint} />
              </View>
            }
          />
        </Press>
      </StatRow>
      {nudge !== null ? <Text style={[type.body, { color: t.text }]}>{nudge}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  // 2026-10-20 UI-008, artboard B-Today: the page's 22 gap spaces the row.
  block: { gap: space(3) },
  unlit: { opacity: 0.45 },
  frame: { flexGrow: 1, maxWidth: '100%' },
  centred: { textAlign: 'center' },
  part: { minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  // The 52pt colour disc each stat sits under.
  disc: { width: MARK + space(2), height: MARK + space(2), borderRadius: (MARK + space(2)) / 2, alignItems: 'center', justifyContent: 'center' },
});
