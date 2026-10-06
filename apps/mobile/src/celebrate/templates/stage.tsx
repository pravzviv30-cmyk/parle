/**
 * What every takeover template shares: the props the frame hands it and the
 * stage the art stands on.
 *
 * A template draws the stage only: the art, its bloom and its confetti. The
 * frame (`celebrate/Takeover.tsx`) draws the number, the words, the rows and
 * Continue, so every card reads the same way to a screen reader. The stage is
 * decorative and untouchable: the words below it say what happened.
 *
 * Two modes, chosen by `final`. Playing, each part arrives on its beat from
 * `timelines.ts`. Final (reduced motion, a skip, a hold), every part is drawn
 * where it ends, with nothing left to move; the frame remounts the stage when
 * it turns final, so no primitive is left halfway.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DiscBloom } from '../../motion/DiscBloom.tsx';
import { decorative } from '../../theme.ts';
import type { CardView } from '../cardView.ts';
import type { TakeoverCard } from '../queue.ts';

export interface StageProps {
  readonly card: TakeoverCard;
  readonly view: CardView;
  /** Draw where everything ends, and move nothing. */
  readonly final: boolean;
  /** Movement is reduced (the final frame was never a skip). */
  readonly reduced: boolean;
  /** Whether the beat for this element has arrived. Always true once final. */
  readonly reached: (element: string) => boolean;
  /** The stage's size, in points. */
  readonly width: number;
  readonly height: number;
}

/** The art's size on a stage of this height. */
export function artSize(height: number): number {
  return Math.round(height * 0.72);
}

export function StageBox({ height, children }: { height: number; children: ReactNode }) {
  return (
    <View {...decorative} style={[st.box, { height }]}>
      {children}
    </View>
  );
}

/**
 * The glow behind the art. While playing it opens on its beat; under reduced
 * motion it rests, still; after a skip it is simply not drawn, because opening
 * it then would be movement the learner just asked to end.
 */
export function StageBloom({ colour, radius, started, final, reduced, hold = false }: { colour: string; radius: number; started: boolean; final: boolean; reduced: boolean; hold?: boolean }) {
  if (final ? !reduced : !started) return null;
  const size = radius * 2.2;
  return <DiscBloom color={colour} radius={radius} hold={hold || final} style={[st.bloom, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }]} />;
}

const st = StyleSheet.create({
  box: { width: '100%', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  bloom: { position: 'absolute', left: '50%', top: '50%' },
});
