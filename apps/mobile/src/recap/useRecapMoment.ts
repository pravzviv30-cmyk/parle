/**
 * The recap's moment, as the result page plays it (`recap/moment.ts` decides;
 * this keeps the clock).
 *
 * Once per recap: the moment is claimed in place under the session's key, so a
 * page turned away from and back to, or a recap drawn again, shows the final
 * frame silently. It starts when the OS has said whether movement is reduced
 * and the room has let go of the audio (`sound/audioFocus.ts`), or once
 * RECAP_AUDIO_WAIT_MS has passed. The beats are `celebrate/timelines.ts`
 * `recap-result`, and their sound and haptic reach the device only through
 * `celebrate/effects.ts`, which asks the audio focus again as each one fires.
 * Under Reduce Motion the page is drawn at rest at once, and the one sound and
 * haptic still play once, when the room lets go.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

import { fireBeat, fireStill } from '../celebrate/effects.ts';
import { claimInPlace } from '../celebrate/queue.ts';
import { TIMELINES, beatAt, playsStill } from '../celebrate/timelines.ts';
import { useLatch, useTimeline } from '../celebrate/useTimeline.ts';
import { useReduceMotion } from '../motion.ts';
import { useAnswered } from '../motion/landing.ts';
import { anyHold, subscribe } from '../sound/audioFocus.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { RECAP_AUDIO_WAIT_MS, momentMayStart } from './moment.ts';

const TIMELINE = TIMELINES['recap-result'];
const noop = () => {};

/** True while nothing holds the learner's ears: no microphone, voice line or live room. */
function useAudioFree(): boolean {
  return !useSyncExternalStore(subscribe, anyHold, anyHold);
}

export interface RecapMomentClock {
  /** Movement is reduced: draw every part at rest. */
  reduced: boolean;
  /** Every part is at its final frame (reduced, already played, or nothing to play). */
  final: boolean;
  /** Whether a part's beat has come. Always true once final. */
  reached: (element: string) => boolean;
}

export function useRecapMoment({ key, plays }: { key: string | null; plays: boolean }): RecapMomentClock {
  const answered = useAnswered(useReduceMotion(true));
  const reduced = answered === true;
  const audioFree = useAudioFree();
  const [waitedOut, setWaitedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaitedOut(true), RECAP_AUDIO_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  const [first] = useState(() => plays && (key === null || claimInPlace(`${scopeGeneration()}:recap:${key}`)));
  const go = momentMayStart({ answered: answered !== null, audioFree, waitedOut });
  // Under reduced motion the clock goes final only once it may start, so its
  // one still sound waits for the room to give the audio back.
  const final = useLatch(!first || (reduced && go));

  const elapsed = useTimeline(TIMELINE, {
    ready: go,
    final,
    still: playsStill({ reduced, stopped: !first }),
    onCue: first ? fireBeat : noop,
    onStill: first ? () => fireStill(TIMELINE) : noop,
    onEnd: noop,
  });
  const atRest = final || reduced;
  return {
    reduced,
    final: atRest,
    reached: (element) => atRest || elapsed >= beatAt(TIMELINE, element),
  };
}
