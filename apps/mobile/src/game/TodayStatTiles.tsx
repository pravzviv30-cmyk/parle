/**
 * Today's three chunky stat tiles (UI-015, founder 2026-10-31): streak days,
 * minutes against the goal, and the level, each a solid card with a 4pt lip in
 * the sky's own colour, a coloured coin, a big number and one word.
 *
 * Props in, taps out: every word comes from `statTileView`, every spoken label
 * from `todayHeroView`, and the counters from Home's draw, so a dev preview can
 * draw every state. Each tile is the shared `LipTile` chrome
 * (components.tsx). `TodayStats` (game/TodayStats.tsx) is the container that
 * reads the game layer.
 *
 * The tiles choose their layout from their own measured width and the reading
 * size (`statTileLayout`): coin beside the words, coin above them, or three
 * full-width rows at accessibility sizes. The numbers count up from where the
 * learner last saw them, keyed on their mount as the old hero did, and the
 * flame pops once when today's streak ticks. Reduced motion lands every one at
 * rest.
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BArt } from '../art/BArt.tsx';
import { LIP_SIZES, LipTile } from '../components.tsx';
import { Icon } from '../icons/Icon.tsx';
import { useB, useThemedStyles, type B } from '../main/bTheme.tsx';
import { CountUp } from '../motion/CountUp.tsx';
import { PopOnce } from '../motion/PopOnce.tsx';
import { ProgressRing } from '../motion/ProgressRing.tsx';
import { HIT, bType, decorative, radius, space } from '../theme.ts';
import { StarMark } from '../today/TodayParts.tsx';
import { RING_STEPS, type Counter } from '../home/homeDraw.ts';
import type { SkyView } from '../home/skyView.ts';
import { STAT_COIN, STAT_GAP, STAT_PADDING, statCoins, statRowTileWidth, statTileLayout, type StatTileLayout, type StatTileView } from './todayHeroView.ts';

/** The tile's height beside its coin (board: 66). */
const TILE_HEIGHT = 66;
/** The game-button lip under each tile, from the shared chrome. */
const LIP = LIP_SIZES.tile.lip;
/** The goal ring inside its coin (board: 30, stroke 4). */
const RING = 30;
const RING_STROKE = 4;
/** The flame (board: 22 by 26) and the star (26). */
const FLAME = { width: 22, height: 26 } as const;
const STAR = 26;
/** The page margins the row sits in, for the first frame before it measures itself. */
const ROW_MARGINS = space(8);

export interface StatTileCounters {
  /** Absent while no run is going, so "Start" is drawn and never counted. */
  streak?: Counter;
  ring?: Counter;
  level?: Counter;
}

export function TodayStatTiles({ tiles, labels, sky, counters = {}, flamePop, onStreak, onGoal, onLevel }: {
  tiles: StatTileView;
  /** One spoken label per tile, from `todayHeroView`. */
  labels: { streak: string; goal: string; level: string };
  sky: SkyView;
  counters?: StatTileCounters;
  flamePop: boolean;
  onStreak: () => void;
  onGoal: () => void;
  onLevel: () => void;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const layout = statTileLayout(statRowTileWidth(rowWidth ?? windowWidth - ROW_MARGINS), fontScale);
  const coins = statCoins(t);
  const number = [bType.stat24, { color: t.text }];
  const { streak: run, ring, level: chip } = counters;

  return (
    <View style={layout === 'rows' ? s.column : s.row} onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
      <Tile layout={layout} lip={sky.lip} label={labels.streak} onPress={onStreak}
        coin={
          <View style={[s.coin, { backgroundColor: coins.streak }]}>
            <PopOnce play={flamePop}>
              <BArt name="flame" width={FLAME.width} height={FLAME.height} style={tiles.streak.lit ? undefined : s.unlit} />
            </PopOnce>
          </View>
        }
        number={run !== undefined
          ? <CountUp key={`run-${run.mount}`} from={run.from} to={run.to} textStyle={number} />
          : <Text style={number}>{tiles.streak.number}</Text>}
        word={tiles.streak.label}
      />
      <Tile layout={layout} lip={sky.lip} label={labels.goal} onPress={onGoal}
        coin={
          <View style={[s.coin, { backgroundColor: coins.goal }]}>
            {tiles.goal.ring && ring !== undefined
              ? <ProgressRing key={`ring-${ring.mount}`} from={ring.from / RING_STEPS} to={ring.to / RING_STEPS} size={RING} stroke={RING_STROKE} color={t.mint} track={t.ring} />
              : <Icon name="clock" variant="bulk" size={RING - space(2)} color={t.text} />}
          </View>
        }
        number={
          <Text style={number}>
            {tiles.goal.number}
            {tiles.goal.of !== null ? <Text style={[bType.bold14, { color: t.muted }]}>{tiles.goal.of}</Text> : null}
          </Text>
        }
        word={tiles.goal.label}
      />
      <Tile layout={layout} lip={sky.lip} label={labels.level} onPress={onLevel}
        coin={
          <View style={[s.coin, { backgroundColor: coins.level }]}>
            <StarMark size={STAR} fill={t.sun} stroke={t.sunDeep} />
          </View>
        }
        number={chip !== undefined
          ? <CountUp key={`level-${chip.mount}`} from={chip.from} to={chip.to} textStyle={number} />
          : <Text style={number}>{tiles.level.number}</Text>}
        word={tiles.level.label}
      />
    </View>
  );
}

/** One tile: the lip behind it, the press on top, the coin and the words set by the layout. */
function Tile({ layout, lip, label, onPress, coin, number, word }: {
  layout: StatTileLayout;
  lip: string;
  label: string;
  onPress: () => void;
  coin: ReactNode;
  number: ReactNode;
  word: string;
}) {
  const t = useB();
  const s = useThemedStyles(makeStyles);
  const stacked = layout === 'stacked';
  return (
    <View style={layout === 'rows' ? undefined : s.share}>
      <LipTile lip={lip} onPress={onPress} accessibilityLabel={label} style={[s.tile, stacked ? s.tileStacked : s.tileSide]}>
        <View {...decorative}>{coin}</View>
        <View style={[s.words, stacked && s.wordsStacked]}>
          {number}
          <Text style={[bType.bold11, { color: t.muted }]}>{word}</Text>
        </View>
      </LipTile>
    </View>
  );
}

/** Loading: three blocks the tiles' size in the sky's chip colour, never a nought. */
export function TodayStatTilesSkeleton({ sky }: { sky: SkyView }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.row} accessible accessibilityLabel="Loading">
      {[0, 1, 2].map((index) => <View key={index} style={[s.block, { backgroundColor: sky.chip }]} />)}
    </View>
  );
}

const makeStyles = (_t: B) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: STAT_GAP },
    column: { gap: STAT_GAP + LIP },
    share: { flex: 1, minWidth: 0 },
    tile: { minHeight: HIT, gap: STAT_GAP, paddingHorizontal: STAT_PADDING - space(1) },
    tileSide: { minHeight: TILE_HEIGHT, flexDirection: 'row', alignItems: 'center' },
    tileStacked: { minHeight: TILE_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingVertical: STAT_PADDING - space(1) },
    words: { flexShrink: 1, minWidth: 0 },
    wordsStacked: { alignItems: 'center' },
    coin: { width: STAT_COIN, height: STAT_COIN, borderRadius: STAT_COIN / 2, alignItems: 'center', justifyContent: 'center' },
    unlit: { opacity: 0.45 },
    block: { flex: 1, minWidth: 0, height: TILE_HEIGHT + LIP, borderRadius: radius.stat },
  });
