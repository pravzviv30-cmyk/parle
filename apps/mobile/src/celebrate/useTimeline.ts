/**
 * A celebration's clock: it walks a timeline from `timelines.ts`, says how far
 * it has got, and fires each beat's sound and haptic once.
 *
 *   ready   false until the OS has said whether movement is reduced; nothing
 *           starts before, for at most ANSWER_WAIT_MS (motion/landing.ts).
 *   final   the card shows its final frame. Every beat counts as reached and
 *           no beat fires after this.
 *   still   the card is final because movement is reduced, and nothing (a
 *           hold, a skip) stopped it (`playsStill`). A card that is final
 *           before it ever started plays its one still sound and haptic once
 *           only then, because sound and touch are not motion; one that a hold
 *           or a skip landed first stays silent for good.
 *
 * `onEnd` is said once, when the last beat is reached or the card goes final,
 * which is when the queue remembers the moment as seen. A clock restarted by a
 * remount in development picks up where it was and never fires a beat twice.
 */

import { useEffect, useRef, useState } from 'react';

import { beatTimes, type Beat, type Timeline } from './timelines.ts';

/**
 * True from the first render `on` is true, and for good. A card that has
 * landed on its final frame stays there: Reduce Motion turned off, or a hold
 * let go, never replays it (motion-sound 4.3, "no replay").
 */
export function useLatch(on: boolean): boolean {
  const [held, setHeld] = useState(on);
  useEffect(() => {
    if (on && !held) setHeld(true);
  }, [on, held]);
  return held || on;
}

export function useTimeline(
  timeline: Timeline,
  {
    ready,
    final,
    still,
    onCue,
    onStill,
    onEnd,
  }: {
    ready: boolean;
    final: boolean;
    still: boolean;
    onCue: (beat: Beat) => void;
    onStill: () => void;
    onEnd: () => void;
  },
): number {
  const [elapsed, setElapsed] = useState(-1);
  const latest = useRef({ still, onCue, onStill, onEnd });
  useEffect(() => {
    latest.current = { still, onCue, onStill, onEnd };
  });
  const startedAt = useRef<number | null>(null);
  const fired = useRef(new Set<number>());
  const ended = useRef(false);
  const stilled = useRef(false);

  useEffect(() => {
    if (!ready || final) return;
    if (startedAt.current === null) startedAt.current = Date.now();
    const since = Date.now() - startedAt.current;
    const handles: ReturnType<typeof setTimeout>[] = [];
    for (const t of beatTimes(timeline)) {
      const run = () => {
        setElapsed((now) => Math.max(now, t));
        timeline.beats.forEach((beat, i) => {
          if (beat.t !== t || fired.current.has(i)) return;
          fired.current.add(i);
          latest.current.onCue(beat);
        });
        if (t >= timeline.end && !ended.current) {
          ended.current = true;
          latest.current.onEnd();
        }
      };
      if (t <= since) run();
      else handles.push(setTimeout(run, t - since));
    }
    return () => handles.forEach(clearTimeout);
  }, [ready, final, timeline]);

  useEffect(() => {
    if (!final) return;
    setElapsed(timeline.end);
    // Decided once, the first time the card is final: a card a hold landed never sounds later.
    if (startedAt.current === null && !stilled.current) {
      stilled.current = true;
      if (latest.current.still) latest.current.onStill();
    }
    if (!ended.current) {
      ended.current = true;
      latest.current.onEnd();
    }
  }, [final, timeline]);

  return final ? timeline.end : elapsed;
}
