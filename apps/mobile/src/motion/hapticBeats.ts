/**
 * The timing behind the celebration haptics, kept apart from the device.
 *
 * `haptics.native.ts` imports expo-haptics, which a Node suite cannot load, so
 * the part worth testing lives here with nothing imported: when each beat of a
 * pattern fires, that every beat asks the haptic switch again at the moment it
 * fires, that a pattern can be cancelled, and how far apart two ticks must be.
 * The clock is injected so a test can step it.
 */

/** One physical answer in a pattern. */
export type Beat = 'success' | 'medium' | 'light';

/**
 * A celebration: a success, then a medium impact at 140 ms, then a light one at
 * 280 ms. The one pattern in the app; every other haptic is a single answer.
 */
export const CELEBRATE_BEATS: readonly { readonly at: number; readonly beat: Beat }[] = [
  { at: 0, beat: 'success' },
  { at: 140, beat: 'medium' },
  { at: 280, beat: 'light' },
];

/** The least gap between two ticks, so a count-up is felt as steps rather than a buzz. */
export const TICK_GAP_MS = 60;

/** What the beats need from time. The default is the real one. */
export interface BeatClock {
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  /** Milliseconds that only go forward, so a wall-clock correction never opens or shuts a throttle. */
  now(): number;
}

export const realClock: BeatClock = {
  setTimeout: (run, ms) => setTimeout(run, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  // clock.ts's monotonicNow, written out because this file imports nothing.
  now: () => {
    const clock = globalThis.performance;
    return typeof clock?.now === 'function' ? clock.now() : Date.now();
  },
};

export interface Beats {
  /** Play a pattern. Starting one cancels whatever is still pending from the last. */
  play(pattern: readonly { readonly at: number; readonly beat: Beat }[], fire: (beat: Beat) => void): void;
  /** Drop every beat that has not fired yet. */
  cancel(): void;
  /** How many beats are still waiting. */
  pending(): number;
}

/**
 * A player for haptic patterns.
 *
 * `enabled` is asked again as each beat fires, not once when the pattern
 * starts: a microphone that opens, or the switch turned off, 100 ms into a
 * celebration silences the beats still to come.
 */
export function createBeats(enabled: () => boolean, clock: BeatClock = realClock): Beats {
  let waiting: unknown[] = [];
  const cancel = (): void => {
    for (const handle of waiting) clock.clearTimeout(handle);
    waiting = [];
  };
  return {
    play(pattern, fire) {
      cancel();
      for (const { at, beat } of pattern) {
        if (at <= 0) {
          if (enabled()) fire(beat);
          continue;
        }
        const handle: unknown = clock.setTimeout(() => {
          waiting = waiting.filter((h) => h !== handle);
          if (enabled()) fire(beat);
        }, at);
        waiting.push(handle);
      }
    },
    cancel,
    pending: () => waiting.length,
  };
}

/**
 * A gate that opens at most once every `gapMs`. Returns true when this call
 * may fire, and counts it.
 */
export function createThrottle(gapMs: number, clock: Pick<BeatClock, 'now'> = realClock): () => boolean {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const now = clock.now();
    if (now - last < gapMs) return false;
    last = now;
    return true;
  };
}
