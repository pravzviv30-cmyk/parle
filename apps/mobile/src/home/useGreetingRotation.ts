/**
 * The timers behind Home's greeting.
 *
 * `greeting.ts` decides what the words are and when each one is due;
 * everything here is the machinery that makes that happen on a real device.
 * The split is deliberate. This file cannot be tested (apps/mobile has no
 * renderer), so it is kept thin enough to read in one sitting and holds no
 * decision worth arguing about: one value, one chain of timers, one loop.
 *
 * Hold, fade out, sit blank, SWAP THE WORD, fade back in. The swap happens in
 * the blank rather than at the start of the fade in, and that ordering is the
 * whole trick: if the JS thread is busy the blank simply lasts a little
 * longer, which nobody can see, instead of the word changing halfway through a
 * fade, which everybody can.
 *
 * Two ways it stops. A learner who has asked for less movement gets the final
 * frame and never the empty header, per the app's one motion rule. And a tab
 * that is no longer on top stops entirely, because a tab stays mounted after
 * its first visit and a loop left running here would animate a header nobody
 * is looking at for as long as the app is open.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

import { useReduceMotion } from '../motion.ts';
import {
  GREETINGS,
  GREETING_BLANK_MS,
  GREETING_CYCLE_MS,
  GREETING_HOLD_MS,
  GREETING_IN_MS,
  GREETING_OUT_MS,
  greetingIndex,
  greetingLine,
  greetingRest,
} from './greeting.ts';

export interface GreetingRotation {
  /** The greeting to draw, name included when there is one. */
  line: string;
  /** Hand to `TabHeader`'s `titleOpacity`. Nothing else moves. */
  opacity: Animated.Value;
}

export function useGreetingRotation(args: {
  firstName: string | null;
  /** False when the tab is not on top. */
  focused: boolean;
}): GreetingRotation {
  const { firstName, focused } = args;

  const opacity = useRef(new Animated.Value(1)).current;
  const [index, setIndex] = useState(0);

  // Watched, not sampled: a learner turns this on while something is bothering
  // them, and this is a header that moves every few seconds.
  const reduced = useReduceMotion();

  useEffect(() => {
    if (reduced || !focused) {
      // The final frame, always. Withholding the movement must never withhold
      // the greeting, and a paused header keeps the word it was showing.
      opacity.setValue(1);
      return;
    }

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
     * freezes frames for a hidden tab, and the fade-out had already put opacity
     * at 0, so the header sat holding a word nobody could see with no timer
     * pending to bring it back. F416, and it was found by looking at the running
     * app rather than at the file.
     *
     * So the timers own the sequence and the animation rides alongside it.
     * Timers throttle in the background; they do not die. A frame that never
     * lands now costs a fade, and the next step still arrives and still sets the
     * word back to full. The three delays are the same three numbers, added up
     * rather than waited for one at a time.
     */
    const cycle = () => {
      const fade = (toValue: number, duration: number) => {
        running?.stop();
        const run = Animated.timing(opacity, { toValue, duration, useNativeDriver: true });
        running = run;
        run.start();
      };

      after(GREETING_HOLD_MS, () => {
        fade(0, GREETING_OUT_MS);
        after(GREETING_OUT_MS + GREETING_BLANK_MS, () => {
          // Through the rule rather than past it. `greetingIndex` is the
          // exported answer to "which word after this much time", and a second
          // copy of the modulo here is a second answer that would drift the
          // first time either changed.
          setIndex((current) => greetingIndex((current + 1) * GREETING_CYCLE_MS, GREETINGS.length));
          fade(1, GREETING_IN_MS);
          after(GREETING_IN_MS, cycle);
        });
      });
    };

    opacity.setValue(1);
    cycle();

    return () => {
      live = false;
      if (timer !== null) clearTimeout(timer);
      running?.stop();
      // Whatever the fade was part way through, the word goes back to being
      // readable. Stopping an animation leaves the value where it stood, and
      // where it stood may be nothing at all.
      opacity.setValue(1);
    };
  }, [reduced, focused, opacity]);

  const word = GREETINGS[index % GREETINGS.length] ?? GREETINGS[0] ?? '';
  return {
    line: reduced ? greetingRest(firstName) : greetingLine(word, firstName),
    opacity,
  };
}
