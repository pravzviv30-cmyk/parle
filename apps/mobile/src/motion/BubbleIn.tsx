/**
 * A transcript bubble arriving (come alive, core loop section 3.5).
 *
 * The learner's bubble rises 16 points from the orb's side and grows from 0.96;
 * the tutor's rises 8 and only fades in. Both take `DUR.base` on the out curve.
 * Only a bubble added after the transcript mounted arrives: the caller passes
 * `play={false}` for the lines that were already there, so opening a
 * conversation never replays its history.
 *
 * Reduced motion: the bubble is in place at once, watched live, through the
 * `Enter` it is built on. This file asks too, so a bubble under reduced motion
 * is never even asked to travel.
 */

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from '../motion.ts';
import { Enter } from './layout.tsx';
import { BUBBLE, DUR } from './tokens.ts';

export function BubbleIn({
  who,
  play = true,
  style,
  children,
}: {
  /** Whose line it is. The learner's arrives with a little more movement. */
  who: 'learner' | 'tutor';
  /** False for a line that was there before the transcript mounted. */
  play?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const reduced = useReduceMotion();
  const shape = BUBBLE[who];
  return (
    <Enter
      from="down"
      distance={reduced ? 0 : shape.rise}
      scaleFrom={reduced ? 1 : shape.from}
      duration={DUR.base}
      play={play}
      style={style}
    >
      {children}
    </Enter>
  );
}
