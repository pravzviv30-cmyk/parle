/**
 * A postcard, stamped, for a scene the learner finished on their own (come
 * alive, core loop 2.9; README Part 5.E "Recap").
 *
 * On the recap's can-do page, in place: the scene's postcard drops in (a
 * little tilted, settling on the snap spring), the ink stamp slams on its
 * corner, and confetti leaves it. Every independent finish this session gets
 * it: the first earn the bigger one (`postcard-first`: the `badge` sound and a
 * full `celebrate()`), an earn again the lighter one (`postcard-again`:
 * `correct` and one success). A finish whose history could not be read
 * (`neutral`) takes the first earn's weight. A finish with help gets no stamp
 * at all; the recap draws that postcard still (`recap/evidence.ts`
 * `postcardStamp`). The beats are `celebrate/timelines.ts`, and the sound and
 * haptic reach the device only through `effects.ts`, which says nothing while
 * a microphone or a live room holds the learner's ears.
 *
 * Once per recap: a page turned away from and back to shows the postcard
 * already stamped, silently. Reduce Motion shows the stamped postcard at once
 * with the still confetti drawing over it, and still plays its one sound and
 * haptic, watched live. Leaving the page or the app lands it on that frame.
 * Decorative and untouchable: the words under it say what was earned.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import type { IllustrationName } from '../art/flat/index.ts';
import { Illustration } from '../art/flat/Illustration.tsx';
import type { PostcardStampKind } from '../recap/evidence.ts';
import { useReduceMotion } from '../motion.ts';
import { cancel, spring, timing } from '../motion/drive.ts';
import { useAnswered, useLandOnLeave } from '../motion/landing.ts';
import { DUR, EASE, SPRING } from '../motion/tokens.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { decorative, paper, STROKE } from '../theme.ts';
import { Confetti } from './Confetti.tsx';
import { fireBeat, fireStill } from './effects.ts';
import { claimInPlace } from './queue.ts';
import { TIMELINES, beatAt, playsStill } from './timelines.ts';
import { useLatch, useTimeline } from './useTimeline.ts';

/** The postcard drops from this tilt and size to its resting tilt. Degrees and scale. */
const DROP = { tiltFrom: -8, tiltTo: -3, scaleFrom: 1.3 } as const;
/** The stamp slams in from this size. */
const SLAM_FROM = 1.6;
/** The stamp, a share of the postcard's width, on its top right corner. */
const STAMP_SHARE = 0.26;
const STAMP_BOX = 100;
const noop = () => {};

export function PostcardStamp({
  art,
  kind: given,
  momentKey,
  children,
}: {
  /** The scene's postcard. */
  art: IllustrationName;
  /** The first earn, an earn again, or an earn whose history could not be read (`recap/evidence.ts` `postcardStamp`). */
  kind: PostcardStampKind;
  /** The recap this stamp belongs to, so it plays once; null plays once per mount. */
  momentKey: string | null;
  /** The postcard as drawn instead of `art` (2026-10-21 UI-008, B-Celebrate's tile). */
  children?: ReactNode;
}) {
  // A finish whose history could not be read may be the first, so it stamps
  // with the first earn's weight; the line under it claims no earlier finish
  // and no first time (F777).
  const kind = given === 'neutral' ? 'first' : given;
  const timeline = TIMELINES[kind === 'first' ? 'postcard-first' : 'postcard-again'];
  const answered = useAnswered(useReduceMotion(true));
  const reduced = answered === true;
  const [first] = useState(() => momentKey === null || claimInPlace(`${scopeGeneration()}:stamp:${momentKey}`));
  // Once stamped, always stamped: turning Reduce Motion off never replays it.
  const final = useLatch(reduced || !first);

  const elapsed = useTimeline(timeline, {
    ready: answered !== null,
    final,
    still: playsStill({ reduced, stopped: !first }),
    onCue: first ? fireBeat : noop,
    onStill: first ? () => fireStill(timeline) : noop,
    onEnd: noop,
  });
  const reached = (element: string): boolean => final || elapsed >= beatAt(timeline, element);

  const drop = useSharedValue(final ? 1 : 0);
  const slam = useSharedValue(final ? 1 : 0);
  const land = useCallback(() => {
    cancel(drop);
    cancel(slam);
    drop.value = 1;
    slam.value = 1;
  }, [drop, slam]);
  useLandOnLeave(land);

  const dropping = reached('card');
  const slamming = reached('stamp');
  useEffect(() => {
    if (final) {
      land();
      return;
    }
    if (dropping) drop.value = spring(1, SPRING.snap, reduced);
  }, [final, dropping, reduced, drop, land]);
  useEffect(() => {
    if (!final && slamming) slam.value = timing(1, DUR.fast, EASE.out, reduced);
  }, [final, slamming, reduced, slam]);

  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, drop.value * 4),
    transform: [
      { rotate: `${DROP.tiltFrom + (DROP.tiltTo - DROP.tiltFrom) * drop.value}deg` },
      { scale: DROP.scaleFrom + (1 - DROP.scaleFrom) * drop.value },
    ],
  }));
  const stamp = useAnimatedStyle(() => ({
    opacity: slam.value,
    transform: [{ scale: SLAM_FROM + (1 - SLAM_FROM) * slam.value }],
  }));

  const [box, setBox] = useState({ width: 0, height: 0 });
  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ width: Math.round(width), height: Math.round(height) });
  };
  const stampSize = Math.max(44, box.width * STAMP_SHARE);

  return (
    <View {...decorative} style={st.stage} onLayout={measure}>
      <Reanimated.View style={card}>
        {children ?? <Illustration name={art} />}
        <Reanimated.View style={[st.stamp, { width: stampSize, height: stampSize, top: -stampSize / 4, right: -stampSize / 6 }, stamp]}>
          <Svg width={stampSize} height={stampSize} viewBox={`0 0 ${STAMP_BOX} ${STAMP_BOX}`} {...decorative}>
            <Circle cx={STAMP_BOX / 2} cy={STAMP_BOX / 2} r={46} fill="none" stroke={paper.ink} strokeWidth={STROKE * 2} />
            <Circle cx={STAMP_BOX / 2} cy={STAMP_BOX / 2} r={36} fill="none" stroke={paper.ink} strokeWidth={STROKE} strokeDasharray="6 5" />
          </Svg>
        </Reanimated.View>
      </Reanimated.View>
      {box.width > 0 ? (
        <View style={st.confetti}>
          <Confetti
            seed={`stamp:${momentKey ?? art}`}
            started={reached('burst')}
            final={final}
            reduced={reduced}
            width={box.width}
            height={box.height}
            count={kind === 'first' ? 32 : 16}
            palette={['blue', 'sun', 'coral', 'paper']}
            ground="mint"
          />
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  stage: { alignSelf: 'flex-start', maxWidth: '100%', pointerEvents: 'none' },
  stamp: { position: 'absolute', pointerEvents: 'none' },
  confetti: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
});
