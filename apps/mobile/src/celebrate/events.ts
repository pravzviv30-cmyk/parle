/**
 * The one contract between something that really happened and a moment the
 * learner sees celebrated.
 *
 * Phase 1 of docs/come-alive (README Part 6) builds three things against this
 * file at once: the celebration host (which subscribes), the game pipeline
 * (which publishes after a sitting settles) and the art (which the templates
 * draw). Nothing here imports React, an animation engine or storage, so any
 * module and any Node test may import it.
 *
 * What plays where:
 * - A finished sitting shows its numbers on an END CARD rendered in place by the
 *   screen, from the GameDelta it got back. That card is not an event here; while
 *   it is on screen the host holds the queue.
 * - After the learner leaves the card, at most MAX_TAKEOVERS full-screen moments
 *   play, in TAKEOVER_ORDER. Anything beyond the budget becomes a quiet row on the
 *   last card, never a fourth takeover.
 * - A TOAST is a small in-place confirmation the host draws over any screen.
 * - Nothing plays inside a live room or a sitting, and nothing at all after a
 *   safety stop (F137): the pipeline never settles one, and the host clears its
 *   queue when the safety view mounts.
 *
 * Every key is deterministic from persisted facts, so the synced `game.seen`
 * list (the only persisted celebration ledger) can tell a moment that already
 * played on another device from a new one.
 */
import type { DayKey } from '@luvani/core';
import { isDaySeenKey, isSeenKey } from '../game/model.ts';

/** Who the moment belongs to. A guest has no account scope, so guest moments are deduplicated in memory only. */
export type CelebrationOrigin = 'account' | 'guest';

/** Full-screen moments, in the only order they may play. */
export const TAKEOVER_ORDER = [
  'purchase-confirmed',
  'streak-milestone',
  'streak-extended',
  'level-up',
  'badge-earned',
] as const;

export type TakeoverType = (typeof TAKEOVER_ORDER)[number];

/** Small confirmations drawn by the host over whatever screen is showing. */
export type ToastType = 'phrase-saved';

export type CelebrationType = TakeoverType | ToastType;

/** At most this many takeovers play after one sitting (README Part 6). */
export const MAX_TAKEOVERS = 3;

/** How long a queued moment may wait behind a hold before it is dropped, in ms. */
export const CELEBRATION_TTL_MS = 10 * 60 * 1000;

/** How long a day-scoped `seen` key is kept, in days (the game store's rule). Durable keys are kept for good. */
export const SEEN_DAY_KEPT_DAYS = 60;

export interface PurchaseConfirmedData {
  readonly transactionId: string;
}

export interface StreakData {
  readonly day: DayKey;
  /** The run after this practice, counted as practice days (covers bridge, add 0). */
  readonly current: number;
  /** Practice days in all. Always shown beside the run, and never falls (D2). */
  readonly lifetimeDays: number;
}

export interface StreakMilestoneData extends StreakData {
  readonly milestone: number;
  readonly runStart: DayKey;
}

export interface LevelUpData {
  readonly before: number;
  readonly level: number;
}

export interface BadgeEarnedData {
  readonly id: string;
}

export interface PhraseSavedData {
  /** The stored phrase's own key, never the learner's text. */
  readonly phraseKey: string;
}

interface Base<T extends CelebrationType, D> {
  readonly type: T;
  readonly key: string;
  readonly origin: CelebrationOrigin;
  /** Epoch ms of the fact the moment celebrates. */
  readonly at: number;
  readonly data: D;
}

export type CelebrationEvent =
  | Base<'purchase-confirmed', PurchaseConfirmedData>
  | Base<'streak-milestone', StreakMilestoneData>
  | Base<'streak-extended', StreakData>
  | Base<'level-up', LevelUpData>
  | Base<'badge-earned', BadgeEarnedData>
  | Base<'phrase-saved', PhraseSavedData>;

/** The one key table. A key names the fact, so the same fact always has the same key. */
export const celebrationKey = {
  purchase: (transactionId: string): string => `purchase:${transactionId}`,
  streak: (day: DayKey): string => `streak:${day}`,
  milestone: (milestone: number, runStart: DayKey): string => `milestone:${milestone}:${runStart}`,
  level: (level: number): string => `level:${level}`,
  badge: (id: string): string => `badge:${id}`,
  saved: (phraseKey: string): string => `saved:${phraseKey}`,
} as const;

/**
 * Whether a `seen` key names a day-scoped moment (pruned after SEEN_DAY_KEPT_DAYS)
 * rather than a durable one (kept for good: a milestone, level, badge or purchase
 * must never replay). One rule, owned by the game store (game/model.ts), decided
 * by the key's kind and never by whether it happens to contain a date.
 */
export { isDaySeenKey };

/**
 * Whether a moment is remembered in the synced `game.seen` list. Every takeover
 * is (account origin); a toast never is: a saved phrase is confirmed in memory
 * only, so no phrase key ever leaves the device.
 */
export function isRememberedInSeen(event: CelebrationEvent): boolean {
  return event.origin === 'account' && isTakeover(event.type) && isSeenKey(event.key);
}

export function isTakeover(type: CelebrationType): type is TakeoverType {
  return (TAKEOVER_ORDER as readonly string[]).includes(type);
}

/** Sort rank of a takeover; lower plays first. */
export function takeoverRank(type: TakeoverType): number {
  return TAKEOVER_ORDER.indexOf(type);
}

type Listener = (events: readonly CelebrationEvent[]) => void;

/** Moments published before the host attached, oldest first. Bounded: a host that never mounts loses the oldest. */
const BUFFER_LIMIT = 32;
let listener: Listener | null = null;
let buffered: CelebrationEvent[] = [];

/**
 * Hand moments to the celebration host. Call it only with facts that are already
 * on disk. Safe to call before the host mounts: they wait, bounded, until it attaches.
 */
export function publishCelebrations(events: readonly CelebrationEvent[]): void {
  if (events.length === 0) return;
  if (listener) {
    listener(events);
    return;
  }
  buffered = [...buffered, ...events].slice(-BUFFER_LIMIT);
}

/**
 * The host's subscription. Only one host listens at a time; attaching delivers
 * anything buffered, and the returned function detaches (only if still current).
 */
export function attachCelebrationListener(next: Listener): () => void {
  listener = next;
  if (buffered.length > 0) {
    const waiting = buffered;
    buffered = [];
    next(waiting);
  }
  return () => {
    if (listener === next) listener = null;
  };
}

/** Drop anything waiting for a host, for sign-out and a safety stop. */
export function discardBufferedCelebrations(): void {
  buffered = [];
}
