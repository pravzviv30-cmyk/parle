/**
 * Today's stats as the sky draws them (UI-015): the container that reads the
 * game layer and hands the presentational `TodayStatTiles` what to draw. Every
 * behaviour is the retired stats-row hero's, moved here so the tiles can be previewed:
 *
 * - coming into focus asks the game layer to catch up quietly (F766), and the
 *   day turning while Today is on top asks again;
 * - the words come from `todayHeroView` and `statTileView`, the nudge from
 *   `homeNudge`, the numbers from Home's draw (`useHomeDraw`, `heroCounts`), so
 *   a rise plays once in front of the learner and nothing counts down;
 * - loading draws three sky-chip blocks, and facts that could not be read draw
 *   nothing at all, never a nought;
 * - the streak and the goal open Streak, the level opens Journey.
 *
 * The flame pops once when the streak rose in this draw and today has counted.
 * It renders through `children`, so the screen places the tiles and the nudge
 * in the sky where it likes.
 */

import { useCallback, useEffect, type ReactNode } from 'react';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';

import { flamePops, heroCounts } from '../home/homeDraw.ts';
import { DAY_CHECK_MS, dayTurned } from '../home/homeRefresh.ts';
import { homeNudge } from '../home/nudge.ts';
import type { SkyView } from '../home/skyView.ts';
import { useHomeDraw } from '../home/useHomeDraw.ts';
import { useGame, useGoal, useLevel, useStreak, useXp } from './GameProvider.tsx';
import { TodayStatTiles, TodayStatTilesSkeleton } from './TodayStatTiles.tsx';
import { statTileView, todayHeroView, type TodayHeroView } from './todayHeroView.ts';

type HeroModel = { hero: TodayHeroView; nudge: string | null };

/** What the sky draws: the tiles (or their skeleton, or nothing) and the nudge line. */
export interface TodayStatsParts {
  tiles: ReactNode;
  nudge: string | null;
}

export function TodayStats({ sky, children }: { sky: SkyView; children: (parts: TodayStatsParts) => ReactNode }) {
  const focused = useIsFocused();
  const nav = useNavigation<{ navigate: (screen: string, params?: object) => void }>();
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
  // While Today is on top, the day turning reads the game layer again.
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
    // Unread: nothing, never a nought. Loading: the tiles' blocks where they will be.
    return children({ tiles: failed ? null : <TodayStatTilesSkeleton sky={sky} />, nudge: null });
  }
  if (drawn === null) return children({ tiles: <TodayStatTilesSkeleton sky={sky} />, nudge: null });

  const shown = drawn.model.hero;
  const { counters } = drawn.draw;
  const tiles = (
    <TodayStatTiles
      tiles={statTileView(shown)}
      labels={{ streak: shown.flame.label, goal: shown.goal.label, level: shown.level.label }}
      sky={sky}
      // With no run the tile says "Start", so the streak is not counted.
      counters={{ streak: shown.flame.count === null ? undefined : counters.streak, ring: counters.ring, level: counters.level }}
      flamePop={flamePops(counters.streak, shown.flame.lit)}
      onStreak={() => nav.navigate('Streak')}
      onGoal={() => nav.navigate('Streak')}
      onLevel={() => nav.navigate('MyFrench')}
    />
  );
  return children({ tiles, nudge: drawn.model.nudge });
}
