/**
 * The drawing on the recap's result page, with the moment around it (come
 * alive, core loop 2.9): a sun glow opens behind it on the moment's first beat
 * and passes, and when the scene was finished on the learner's own, confetti
 * leaves it. The drawing itself never moves and is there from the start.
 *
 * Composed from the shared primitives (`DiscBloom`, the celebration's
 * `Confetti`), on the recap moment's clock (`useRecapMoment`). Under reduced
 * motion there is no glow, and an earned scene's confetti is the still
 * `celebrate-confetti` drawing laid over it. Decorative and untouchable.
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Confetti } from '../celebrate/Confetti.tsx';
import { DiscBloom } from '../motion/DiscBloom.tsx';
import { colour } from '../theme.ts';
import type { RecapMomentClock } from './useRecapMoment.ts';

/** The confetti on a scene earned on the learner's own. */
const BURST = 32;

export function ResultArt({
  moment,
  burst,
  seed,
  children,
}: {
  moment: RecapMomentClock;
  /** Confetti too: the scene was finished on the learner's own. */
  burst: boolean;
  /** The moment's key, so one recap always throws the same confetti. */
  seed: string;
  children: ReactNode;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ width: Math.round(width), height: Math.round(height) });
  };
  const sized = box.width > 0;
  return (
    <View style={st.art} onLayout={measure}>
      {sized && !moment.final && moment.reached('bloom') ? (
        <View style={st.layer}>
          <DiscBloom color={colour.sun} radius={Math.max(box.width, box.height) * 0.45} />
        </View>
      ) : null}
      {children}
      {sized && burst ? (
        <View style={st.layer}>
          <Confetti
            seed={seed}
            started={moment.reached('burst')}
            final={moment.final}
            reduced={moment.reduced}
            width={box.width}
            height={box.height}
            count={BURST}
            palette={['blue', 'sun', 'mint', 'paper']}
            ground="coral"
          />
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  art: { alignSelf: 'flex-start', maxWidth: '100%' },
  layer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
});
