/**
 * The hold a finished sitting takes on the celebration queue before it
 * settles, handed to its end card (F766; README Part 6: never a takeover
 * inside a sitting or under an end card).
 *
 * `game/settle.ts` publishes a sitting's moments the instant it has read them
 * back, which is before the page can mount the end card that holds the queue.
 * Without a hold taken first, a streak or a level could start under the card
 * in that gap. So the page takes this hold before it calls the settle, and the
 * end card lets it go when the card itself goes (`celebrate/EndCard.tsx`,
 * `release`). When no card will come (the settle never started, settled
 * nothing, or the page gave up waiting for it), the page lets it go itself.
 *
 * One hold at a time per page: taking it again while it is held changes
 * nothing, and every way of letting it go is safe to call twice. Once the page
 * has gone (`close`) no hold is taken any more, so a settle that answers after
 * the learner left can never hold the queue with nobody left to let it go.
 * Pure apart from the queue's own hold, so `settleHold.test.ts` runs it
 * against the real queue under Node.
 */

import { holdCelebrations } from '../celebrate/queue.ts';

export interface SettleHold {
  /** Hold the queue now, before the settle. Holding twice holds once; a closed page holds nothing. */
  take(): void;
  /** The settle is under way and its end card will take the hold over. */
  claim(): void;
  /** Let the hold go unless an end card is to take it over: the settle never started, or settled nothing. */
  drop(): void;
  /** Let the hold go: its end card went, or its page stopped waiting for it. */
  release(): void;
  /** The page is up: holds may be taken again. */
  open(): void;
  /** The page went: let the hold go, and take none until it is open again. */
  close(): void;
  /** True while the hold is taken. */
  readonly held: boolean;
}

export function createSettleHold(hold: () => () => void = holdCelebrations): SettleHold {
  let current: (() => void) | null = null;
  let claimed = false;
  let closed = false;
  const release = (): void => {
    const letGo = current;
    current = null;
    claimed = false;
    letGo?.();
  };
  return {
    take() {
      if (current !== null || closed) return;
      claimed = false;
      current = hold();
    },
    claim() {
      if (current !== null) claimed = true;
    },
    drop() {
      if (!claimed) release();
    },
    release,
    open() {
      closed = false;
    },
    close() {
      closed = true;
      release();
    },
    get held() {
      return current !== null;
    },
  };
}
