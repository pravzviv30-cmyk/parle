/**
 * The daily quests' chest (come alive D6 and D10): shut on the Home quests
 * card, opened on the chest takeover once all three quests are really done.
 *
 *   open    the resting truth: true once the chest is really opened (the
 *           chest's claim is written). Turning true after mount opens it: the
 *           chest bumps twice and, on the second bump, the lid swings open
 *           about its hinge on the pop spring. Mounting already open shows it
 *           open, never a replay. Turning false settles the lid shut.
 *   ground  what it sits on, so it never vanishes into it: on coral the chest
 *           is white, on sun its bands are.
 *
 * Open, the lid rises a little above the drawing's box, so leave room above
 * the chest when it can open.
 *
 * Only transform moves, on the whole chest and on the lid's own still Svg; no
 * SVG attribute is animated. Every timing goes through motion/drive.ts with
 * the live reduced-motion answer from motion.ts, and the numbers come from
 * motion/tokens.ts and artMotion.ts. Under Reduce Motion it is the final
 * frame, watched live. Leaving the foreground or unmounting lands it there.
 *
 * Decorative: hidden from assistive technology and untouchable. It plays no
 * sound and no haptic; the celebration that owns the moment does that, once.
 */

import { useCallback, useEffect, useRef, type ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { useReduceMotion } from '../../motion.ts';
import { cancel, delay, sequence, spring, timing } from '../../motion/drive.ts';
import { useAnswered, useLandOnLeave } from '../../motion/landing.ts';
import { EASE, SPRING } from '../../motion/tokens.ts';
import { decorative } from '../../theme.ts';
import { CHEST_MOTION as M } from './artMotion.ts';
import { artPaths } from './paths.tsx';
import { ART_VIEWBOX, CHEST_FOOT, CHEST_HINGE, CHEST_OPEN, drawn, layer, originOf, type ArtGround, type DrawnPart } from './shapes.ts';

export type ChestProps = {
  /** Points, square. */
  size: number;
  /** True once the chest is really opened. Turning true after mount opens it. */
  open?: boolean;
  /** The ground it sits on. */
  ground?: ArtGround;
};

const FOOT = originOf(CHEST_FOOT);
const HINGE = originOf(CHEST_HINGE);

export function Chest({ size, open = false, ground = 'paper' }: ChestProps): ReactElement {
  const answered = useAnswered(useReduceMotion(true));
  const lid = useSharedValue(open ? 1 : 0);
  const bump = useSharedValue(1);
  const was = useRef(open);

  /** The final frame: the lid where the truth says, the chest at rest. */
  const land = useCallback(() => {
    cancel(lid);
    cancel(bump);
    lid.value = was.current ? 1 : 0;
    bump.value = 1;
  }, [lid, bump]);
  useLandOnLeave(land);

  useEffect(() => {
    // Until the OS answers, a change waits; the answer replays it here.
    if (answered === null) return;
    const before = was.current;
    was.current = open;
    if (open === before || answered) {
      land();
      return;
    }
    const reduced = answered;
    if (!open) {
      cancel(bump);
      bump.value = 1;
      lid.value = spring(0, SPRING.settle, reduced);
      return;
    }
    bump.value = sequence(
      reduced,
      timing(M.bump, M.beat, EASE.out, reduced),
      timing(1, M.beat, EASE.in, reduced),
      timing(M.bump, M.beat, EASE.out, reduced),
      spring(1, SPRING.pop, reduced),
    );
    lid.value = delay(M.lidAt, spring(1, SPRING.pop, reduced), reduced);
  }, [open, answered, land, lid, bump]);

  const whole = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const swing = useAnimatedStyle(() => ({
    transform: [{ translateY: (lid.value * CHEST_OPEN.lift * size) / 100 }, { rotate: `${lid.value * CHEST_OPEN.angle}deg` }],
  }));

  const parts = drawn('chest', open ? 'open' : 'closed', ground);
  return (
    <Reanimated.View {...decorative} style={[{ width: size, height: size }, st.still, { transformOrigin: FOOT }, whole]}>
      <View style={st.layer}>
        <Layer parts={layer(parts, 'body')} size={size} />
      </View>
      <Reanimated.View style={[st.layer, { transformOrigin: HINGE }, swing]}>
        <Layer parts={layer(parts, 'lid')} size={size} />
      </Reanimated.View>
    </Reanimated.View>
  );
}

/** One still layer of the chest: the one decorative Svg this file draws. */
function Layer({ parts, size }: { parts: readonly DrawnPart[]; size: number }): ReactElement {
  return (
    <Svg width={size} height={size} viewBox={ART_VIEWBOX} {...decorative}>
      {artPaths(parts)}
    </Svg>
  );
}

const st = StyleSheet.create({
  still: { pointerEvents: 'none' },
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
