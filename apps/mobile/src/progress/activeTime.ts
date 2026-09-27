/**
 * Active learning time: how long the learner was actually working, not how
 * long a screen happened to be open.
 *
 * The product decision (2026-09-23): practice time counts real work, typed or
 * spoken, and leaves out idle, background and paused stretches. It is its own
 * measurement. `durationMs` on the activity log stays what it always was, wall
 * clock from open to bank, and is never copied into `activeMs`. Metered live
 * minutes are a third thing again and nothing here reads or writes them.
 *
 * The clock is event driven and pure. A screen folds each meaningful learner
 * event (a keystroke, a submitted answer, a help tap, a review grade, a new
 * spoken turn) through `touched`, and calls `suspended` when it loses focus or
 * the app goes to the background. Nothing ticks, nothing is written to disk on
 * a timer, and every rule takes its instant as an argument so a test can walk
 * a two-minute gap without waiting two minutes.
 *
 * The rules:
 *
 *   - The first touch anchors and adds nothing. Opening a screen is not work.
 *   - Only the interval between two touches can count, and only when it is at
 *     or under the surface's cutoff. A longer gap is left out whole rather than
 *     clipped, because a clipped gap would pay a slice of every break.
 *   - An interval of zero or less (the same instant, or a clock that moved
 *     backwards) adds nothing and simply re-anchors.
 *   - Suspending keeps the total and forgets the anchor, so the first touch
 *     after coming back is a fresh anchor and the time away is never credited.
 *     A resumed sitting starts from its saved total the same way.
 */

import type { ActivityKind } from './activity.ts';

export interface ActiveClock {
  /** The instant of the last meaningful touch, or null when there is no live anchor. */
  readonly lastTouchAt: number | null;
  /** Credited active milliseconds so far. */
  readonly activeMs: number;
}

/**
 * The longest gap between two touches that still reads as one stretch of
 * attention, per surface. A conversation gets longer because the tutor is
 * speaking in between and the learner is listening, which is work too.
 */
export const ACTIVE_CUTOFF_MS: Readonly<Record<ActivityKind, number>> = Object.freeze({
  drill: 30_000,
  review: 30_000,
  lesson: 30_000,
  convo: 45_000,
});

/**
 * A stored or passed active total this app will hold: finite, at or above
 * zero, floored to whole milliseconds. Anything else is `undefined`, meaning
 * not measured, never zero.
 */
export function cleanActiveMs(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
}

/** A clock with no anchor, starting from a saved total when there is one. */
export function idleClock(activeMs = 0): ActiveClock {
  return { lastTouchAt: null, activeMs: cleanActiveMs(activeMs) ?? 0 };
}

/** Fold one meaningful learner event at `at` into the clock. Pure. */
export function touched(clock: ActiveClock, at: number, cutoffMs: number): ActiveClock {
  if (!Number.isFinite(at)) return clock;
  const last = clock.lastTouchAt;
  const gap = last === null ? 0 : at - last;
  const credit = gap > 0 && gap <= cutoffMs ? gap : 0;
  return { lastTouchAt: at, activeMs: clock.activeMs + credit };
}

/**
 * Whether the learner acted recently enough for a partner's event to count as
 * their attention.
 *
 * Some events are not the learner's own: in a conversation the tutor starts
 * and stops speaking, and in voice mode the agent re-arms a silence rescue
 * every few seconds whether anyone is there or not. Such an event may touch
 * the clock only while this holds, so a learner who walks away with the app
 * still foregrounded stops earning once the cutoff passes after their last
 * action. Listening between two of the learner's turns still counts. With no
 * learner action yet, or a clock that moved backwards, it never holds.
 */
export function learnerEngaged(lastLearnerAt: number | null, at: number, cutoffMs: number): boolean {
  if (lastLearnerAt === null || !Number.isFinite(at)) return false;
  const since = at - lastLearnerAt;
  return since >= 0 && since <= cutoffMs;
}

/** The screen lost focus or the app left the foreground: keep the total, drop the anchor. */
export function suspended(clock: ActiveClock): ActiveClock {
  return clock.lastTouchAt === null ? clock : { lastTouchAt: null, activeMs: clock.activeMs };
}

/**
 * A screen's handle on its clock. Mutable on purpose and held in a ref, so a
 * keystroke never causes a render.
 */
export interface ActiveClockController {
  /** A meaningful learner event, now (or at `at`). Ignored while not live or after close. */
  touch(at?: number): void;
  /** Credited active milliseconds so far. */
  read(): number;
  /** Continue from a saved total, with no anchor. A malformed total is none. */
  restore(activeMs: number): void;
  /** Start a new sitting from nothing. */
  reset(): void;
  /** Focused and foregrounded, or not. Going not-live suspends. */
  setLive(live: boolean): void;
  /** The screen is gone: suspend and ignore every later touch. */
  close(): void;
  /**
   * Undo `close` without an anchor. Only for the owning hook's effect setup,
   * because React's development double-mount runs cleanup then setup again on
   * the same instance.
   */
  open(): void;
}

export function createActiveClock(cutoffMs: number, now: () => number = Date.now, live = true): ActiveClockController {
  let clock = idleClock();
  let isLive = live;
  let closed = false;
  return {
    touch(at) {
      if (!isLive || closed) return;
      clock = touched(clock, at ?? now(), cutoffMs);
    },
    read: () => clock.activeMs,
    restore(activeMs) {
      clock = idleClock(activeMs);
    },
    reset() {
      clock = idleClock();
    },
    setLive(next) {
      isLive = next;
      if (!next) clock = suspended(clock);
    },
    close() {
      closed = true;
      clock = suspended(clock);
    },
    open() {
      closed = false;
    },
  };
}
