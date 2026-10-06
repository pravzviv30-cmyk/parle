/**
 * A sitting page's end, and the holds that keep a takeover off it (F760, F766).
 *
 * Three things, for the page that ran the sitting:
 *
 * - **The sitting hold.** While the page is mounted the celebration queue is
 *   held, so nothing a foreground catch-up brings back, and nothing this
 *   sitting earns, takes over the screen in the middle of practice. The
 *   takeovers play once the learner has left (README Part 6).
 * - **The settle hold.** `holdForSettle` (or `expect`, which takes it too) is
 *   called before the page settles, because the settle publishes its moments
 *   before the end card can mount. The end card is handed `release` and lets
 *   the hold go when it goes; when no card will come, `dropSettleHold` or the
 *   wait running out lets it go here (`practice/settleHold.ts`).
 * - **The delta.** `expect` names the sitting by its source and the instant
 *   it handed the settle; the end moves from `waiting` to `settled` when that
 *   sitting's delta is published, or to `unsettled` after `SETTLE_WAIT_MS`
 *   (`practice/sittingDelta.ts` says why and decides). The subscription is
 *   taken when the page mounts, before any sitting can finish, so a delta that
 *   lands before `expect` is still found.
 *
 * Leaving the page lets every hold go.
 */

import { useCallback, useEffect, useReducer, useState } from 'react';

import { holdCelebrations } from '../celebrate/queue.ts';
import { onSettled } from '../game/settle.ts';
import { createSettleHold } from './settleHold.ts';
import { SETTLE_WAIT_MS, createDeltaWatch, sittingEnd, type SittingEnd, type SittingMatch } from './sittingDelta.ts';

/** Hold the celebration queue for as long as the calling page is mounted: the sitting hold (F766). */
export function useSittingHold(): void {
  useEffect(() => holdCelebrations(), []);
}

export interface SittingEndValue {
  end: SittingEnd;
  /** Hold the queue now, before this sitting settles. */
  holdForSettle: () => void;
  /** Wait for this sitting's delta. Holds the queue first if it is not held yet. */
  expect: (match: SittingMatch) => void;
  /** The sitting will not settle after all: let the settle hold go, unless `expect` already named it. */
  dropSettleHold: () => void;
  /** The settle hold's release, for the end card to call when it unmounts. */
  release: () => void;
}

export function useSittingEnd(): SittingEndValue {
  useSittingHold();
  const [hold] = useState(createSettleHold);
  const [watch] = useState(createDeltaWatch);
  const [, heard] = useReducer((n: number) => n + 1, 0);
  const [match, setMatch] = useState<SittingMatch | null>(null);
  const [waitedOut, setWaitedOut] = useState(false);

  useEffect(
    () =>
      onSettled((delta) => {
        watch.push(delta);
        heard();
      }),
    [watch],
  );
  // Leaving lets the settle hold go, whether or not its card ever came, and a
  // settle that answers after the learner left takes no hold of its own.
  useEffect(() => {
    hold.open();
    return () => hold.close();
  }, [hold]);

  const delta = match === null ? null : watch.find(match);
  useEffect(() => {
    if (match === null || delta !== null) return;
    const timer = setTimeout(() => setWaitedOut(true), SETTLE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [match, delta]);

  const end = sittingEnd(match, delta, waitedOut);
  // No card will come for a sitting whose delta never arrived.
  useEffect(() => {
    if (end.state === 'unsettled') hold.release();
  }, [end.state, hold]);

  const holdForSettle = useCallback(() => hold.take(), [hold]);
  const expect = useCallback(
    (next: SittingMatch) => {
      hold.take();
      hold.claim();
      setWaitedOut(false);
      setMatch(next);
    },
    [hold],
  );
  const dropSettleHold = useCallback(() => hold.drop(), [hold]);
  const release = useCallback(() => hold.release(), [hold]);

  return { end, holdForSettle, expect, dropSettleHold, release };
}
