/**
 * The timers behind Home's greeting.
 *
 * `greeting.ts` decides what the words are, which of them the hour allows and
 * when each one is due; everything here is the machinery that makes that
 * happen on a real device, plus the one thing a rule may not do: read the
 * clock. This file cannot be tested (apps/mobile has no renderer), so it is
 * kept thin enough to read in one sitting and holds no decision worth arguing
 * about: one value, two timers, one loop.
 *
 * Hold the word, then lift it out of the slot while the next one rises in
 * behind it, then commit the new word at rest. The commit happens in the same
 * tick the value goes back to zero, and that ordering is the whole trick: the
 * word the learner is now reading is the word that just arrived, at the
 * position the strip started from, so nothing jumps.
 *
 * The clock is read once when the effect starts, which is once per visit to
 * Home. A learner who opens the tab at ten to six and leaves it open is
 * greeted with the afternoon's words until they come back to it, which is the
 * right trade: the alternative is a header that re-picks its pool on a timer
 * and changes language under somebody mid-read.
 *
 * Two ways it stops. A learner who has asked for less movement gets no swap at
 * all and the header draws the still line, per the app's one motion rule. And a
 * tab that is no longer on top stops entirely, because a tab stays mounted
 * after its first visit and a loop left running here would animate a header
 * nobody is looking at for as long as the app is open.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

import type { TitleSwap } from '../layout.tsx';
import { useReduceMotion } from '../motion.ts';
import { firstNameOf } from '../tutor/dashboard.ts';
import {
  GREETING_CYCLE_MS,
  GREETING_HOLD_MS,
  GREETING_SWIPE_MS,
  greetingIndex,
  greetingLead,
  greetingPool,
  greetingRest,
  greetingSubline,
} from './greeting.ts';

export interface GreetingRotation {
  /**
   * The whole greeting as one still line, the hour's French word included.
   * Hand to `TabHeader`'s `title`: it is what a screen reader hears and what
   * the header draws when nothing may move.
   */
  rest: string;
  /** Hand to `TabHeader`'s `titleSwap`. Null when nothing may move. */
  swap: TitleSwap | null;
  /**
   * The hour's question, for `TabHeader`'s `purpose`. Still: it is the one
   * line on Home that says what the screen is for, and a line that changed
   * every few seconds would be unreadable.
   */
  subline: string;
}

export function useGreetingRotation(args: {
  firstName: string | null;
  /** False when the tab is not on top. */
  focused: boolean;
}): GreetingRotation {
  const { firstName, focused } = args;

  // One value for the whole rotation: 0 is a word at rest, 1 is that word one
  // line up and gone. The header interpolates it and starts nothing.
  const progress = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  // The hour Home was opened at. State rather than a ref, because the pool and
  // the resting word are drawn from it and a render has to follow it.
  const [clock, setClock] = useState(() => Date.now());

  // Watched, not sampled: a learner turns this on while something is bothering
  // them, and this is a header that moves every few seconds.
  const reduced = useReduceMotion();

  useEffect(() => {
    // Once, here, on focus. Coming back to Home after six in the evening picks
    // up the evening's words; sitting on it does not change them underneath a
    // learner who is reading.
    const openedAt = Date.now();
    setClock(openedAt);

    if (reduced || !focused) {
      // Withholding the movement must never withhold the greeting. A paused
      // header keeps the word it was showing, whole, at rest.
      progress.setValue(0);
      return;
    }

    const pool = greetingPool(openedAt);

    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let running: Animated.CompositeAnimation | null = null;

    // One pending timer at a time, so nothing accumulates over an hour on
    // Home and there is exactly one handle to clear on the way out.
    const after = (ms: number, run: () => void) => {
      timer = setTimeout(() => {
        timer = null;
        if (live) run();
      }, ms);
    };

    /**
     * One pass of the cycle, driven by timers rather than by the animation.
     *
     * This used to chain each step off the previous `Animated.timing`'s
     * completion callback, which read well and had a failure mode that cost the
     * whole feature: the cycle only advanced if frames arrived. A browser
     * freezes frames for a hidden tab, and the fade had already taken the word
     * away, so the header sat holding a word nobody could see with no timer
     * pending to bring it back. F416, and it was found by looking at the running
     * app rather than at the file.
     *
     * So the timers own the sequence and the animation rides alongside it.
     * Timers throttle in the background; they do not die. A frame that never
     * lands now costs the swipe its movement, and the next step still arrives,
     * still commits the new word, and still puts the strip back at rest.
     */
    const cycle = () => {
      after(GREETING_HOLD_MS, () => {
        running?.stop();
        const run = Animated.timing(progress, {
          toValue: 1,
          duration: GREETING_SWIPE_MS,
          useNativeDriver: true,
        });
        running = run;
        run.start();

        after(GREETING_SWIPE_MS, () => {
          // Through the rule rather than past it. `greetingIndex` is the
          // exported answer to "which word after this much time", and a second
          // copy of the modulo here is a second answer that would drift the
          // first time either changed. Counted over the hour's pool, so the
          // word that arrives is the word that was rising.
          setIndex((current) => greetingIndex((current + 1) * GREETING_CYCLE_MS, pool.length));
          progress.setValue(0);
          cycle();
        });
      });
    };

    progress.setValue(0);
    cycle();

    return () => {
      live = false;
      if (timer !== null) clearTimeout(timer);
      running?.stop();
      // Whatever the swipe was part way through, the slot goes back to a whole
      // word. Stopping an animation leaves the value where it stood, and where
      // it stood may be half a line up.
      progress.setValue(0);
    };
  }, [reduced, focused, progress]);

  const pool = greetingPool(clock);
  // In range by construction: `greetingIndex` answers inside the length it is
  // given, and the pool is never empty.
  const wordAt = (step: number): string => pool[greetingIndex(step * GREETING_CYCLE_MS, pool.length)]!.word;

  return {
    rest: greetingRest(firstName, clock),
    subline: greetingSubline(clock),
    swap: reduced
      ? null
      : {
          word: greetingLead(wordAt(index)),
          next: greetingLead(wordAt(index + 1)),
          rest: firstNameOf(firstName),
          progress,
        },
  };
}
