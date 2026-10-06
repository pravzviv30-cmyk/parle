/**
 * The end of a finished sitting, in place on the page that ran it (README
 * Part 6; motion-sound 5.2 as an end card, never a takeover).
 *
 * A mint card under the kicker "Practice complete.": the line for this kind of
 * practice, then up to three tiles counting up to their numbers (XP, time, and
 * the screen's own count), the goal ring drawing from where today stood to
 * where it stands now, the quests this sitting finished and the cap line when
 * the daily XP limit held some back. Every number is the GameDelta's, read back
 * from disk by `game/settle.ts`, or the count the screen hands over; a tile
 * appears only when its number exists (`endCardModel.ts`). On the sitting that
 * finished the day's third quest, the quiet line "All three quests done today."
 * lands with the `quest` sound (`end-card-quests`, founder decision D22).
 *
 * While it is on screen it holds the celebration queue, so a streak or a level
 * waits until the learner leaves the card. It sounds `complete` and gives one
 * `celebrate()` once per sitting, never inside a live room or while a
 * microphone is open; the XP tile ticks as it counts. Under reduced motion it
 * is drawn finished at once, and its sound and haptic still play once. A card
 * that mounts again for the same sitting is drawn finished and stays silent.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { GameDelta } from '../game/delta.ts';
import { useReduceMotion } from '../motion.ts';
import { CountUp } from '../motion/CountUp.tsx';
import { useAnswered } from '../motion/landing.ts';
import { Enter } from '../motion/layout.tsx';
import { ProgressRing } from '../motion/ProgressRing.tsx';
import { StaggerIn } from '../motion/StaggerIn.tsx';
import { DUR, STAGGER } from '../motion/tokens.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { colour, onColour, paper, radius, space, textOn, type } from '../theme.ts';
import { Confetti } from './Confetti.tsx';
import { countTick, fireBeat, fireStill } from './effects.ts';
import { endCardView, timeText, xpText, type EndTile } from './endCardModel.ts';
import { claimInPlace, holdCelebrations } from './queue.ts';
import { TIMELINES, beatAt, playsStill } from './timelines.ts';
import { useLatch, useTimeline } from './useTimeline.ts';

const INK = textOn.mint;
const SOFT = onColour.mint;
/** The height of the band the confetti flies in, across the top of the card. */
const CONFETTI_BAND = 160;
const RING = 56;
const noop = () => {};

function tileText(tile: EndTile, value: number): string {
  if (tile.id === 'xp') return xpText(value);
  if (tile.id === 'time') return timeText(value);
  return String(value);
}

export function EndCard({
  delta,
  count = null,
  tutorName = null,
}: {
  /** What the sitting changed, from `game/settle.ts`. */
  delta: GameDelta;
  /** The screen's own count for this sitting (lines said, answers right), or null for none. */
  count?: number | null;
  /** The chosen tutor's name, for a quest title that names them. */
  tutorName?: string | null;
}) {
  const view = useMemo(() => endCardView(delta, { count, tutorName }), [delta, count, tutorName]);
  const timeline = TIMELINES[view.timeline];
  const answered = useAnswered(useReduceMotion(true));
  const reduced = answered === true;
  // Once per sitting: a card that mounts again for the same sitting is drawn finished, silently.
  const [first] = useState(() => claimInPlace(`${scopeGeneration()}:${delta.key}`));
  // Once final, always final: turning Reduce Motion off mid-card never replays it.
  const final = useLatch(reduced || !first);

  // The queue waits while the learner is reading this.
  useEffect(() => holdCelebrations(), []);

  const elapsed = useTimeline(timeline, {
    ready: answered !== null,
    final,
    // A card mounted again for the same sitting is drawn finished, and was heard the first time.
    still: playsStill({ reduced, stopped: !first }),
    onCue: first ? fireBeat : noop,
    onStill: first ? () => fireStill(timeline) : noop,
    onEnd: noop,
  });
  const reached = (element: string): boolean => final || elapsed >= beatAt(timeline, element);

  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));
  const counting = reached('tiles');

  const tiles = view.tiles.map((tile) => (
    <View key={tile.id} style={st.tile} accessible accessibilityLabel={`${tileText(tile, tile.value)}, ${tile.label}`}>
      <CountUp
        from={final ? tile.value : 0}
        to={counting ? tile.value : final ? tile.value : 0}
        format={(value) => tileText(tile, value)}
        tick={tile.id === 'xp' && first ? 'both' : 'none'}
        onSoundTick={countTick}
        label={tileText(tile, tile.value)}
        textStyle={[type.stat, { color: paper.ink }]}
      />
      <Text style={[type.small, { color: paper.inkSoft }]}>{tile.label}</Text>
    </View>
  ));

  const goal =
    view.goal === null ? null : (
      <View style={st.goal}>
        <ProgressRing
          from={final ? view.goal.to : view.goal.from}
          to={view.goal.to}
          size={RING}
          stroke={6}
          color={paper.ink}
          track={paper.card}
          duration={DUR.reveal}
          delay={final ? 0 : beatAt(timeline, 'goal')}
        />
        <Text style={[type.bodyStrong, st.grow, { color: INK }]}>{view.goal.line}</Text>
      </View>
    );

  const rows = [
    ...view.quests.map((quest) => (
      <Text key={`quest:${quest}`} style={[type.body, { color: INK }]}>
        {quest}
      </Text>
    )),
    ...(view.questProgress !== null
      ? [
          <Text key="quests" style={[type.small, { color: SOFT }]}>
            {view.questProgress}
          </Text>,
        ]
      : []),
    ...(view.capLine !== null
      ? [
          <Text key="cap" style={[type.small, { color: SOFT }]}>
            {view.capLine}
          </Text>,
        ]
      : []),
  ];

  return (
    <View style={st.card} onLayout={onLayout}>
      <View style={st.band}>
        <Confetti
          seed={delta.key}
          started={reached('burst')}
          final={final}
          reduced={reduced}
          width={width}
          height={CONFETTI_BAND}
          count={36}
          palette={['blue', 'sun', 'coral', 'paper']}
          ground="mint"
        />
      </View>
      <Text style={[type.label, { color: INK }]}>{view.kicker}</Text>
      {final ? (
        <Text style={[type.title, { color: INK }]}>{view.line}</Text>
      ) : (
        <Enter delay={beatAt(timeline, 'line')}>
          <Text style={[type.title, { color: INK }]}>{view.line}</Text>
        </Enter>
      )}
      {tiles.length > 0 &&
        (final ? (
          <View style={st.tiles}>
            {tiles.map((tile) => (
              <View key={tile.key} style={st.tileSlot}>
                {tile}
              </View>
            ))}
          </View>
        ) : (
          <View style={st.tiles}>
            <StaggerIn step={STAGGER.tiles} delay={beatAt(timeline, 'tiles')} itemStyle={st.tileSlot}>
              {tiles}
            </StaggerIn>
          </View>
        ))}
      {goal}
      {rows.length > 0 &&
        (final ? (
          <View style={st.rows}>{rows}</View>
        ) : (
          <View style={st.rows}>
            <StaggerIn delay={beatAt(timeline, 'rows')}>{rows}</StaggerIn>
          </View>
        ))}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colour.mint, borderRadius: radius.card, padding: space(5), gap: space(3) },
  band: { position: 'absolute', left: 0, right: 0, top: 0, height: CONFETTI_BAND, pointerEvents: 'none' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  tileSlot: { flexGrow: 1, flexBasis: 0, minWidth: space(24) },
  tile: { backgroundColor: paper.card, borderRadius: radius.tile, paddingVertical: space(3), paddingHorizontal: space(4), gap: space(1) },
  goal: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  grow: { flex: 1, minWidth: 0 },
  rows: { gap: space(1.5) },
});
