/**
 * The celebration queue: which full-screen moment plays, in what order, when,
 * and whether it may ever play again (come alive, motion-sound section 4, with
 * README Part 6 and the Phase 1 contract in `celebrate/events.ts`).
 *
 * Pure: no React, no engine, no storage. The host (`CelebrationHost.tsx`) hands
 * it the clock, the scope generation and the store calls, so every decision
 * here runs under Node in `queue.test.ts`. It imports only modules that import
 * nothing a Node suite cannot load: the contract, the audio focus holds and the
 * sound-effect gate.
 *
 * What it decides:
 * - **The burst.** Moments that arrive within `BURST_WINDOW_MS` of each other,
 *   or while a run of cards is still going, are one burst. A burst plays at
 *   most `MAX_TAKEOVERS` cards in `TAKEOVER_ORDER`; whatever is left over
 *   becomes a row under "Also today" on the last card, never a fourth
 *   takeover. A moment that arrives while that last card is on screen becomes
 *   a row on it too. One that arrives after the last card has gone, before the
 *   run has ended, is left for the game pipeline's catch-up: it is not
 *   remembered as played and its crash-replay copy stays.
 * - **Merging.** A milestone replaces the same day's plain streak moment; the
 *   newest day's streak and the highest level each make one card; badges
 *   share a card three at a time.
 * - **Once only.** An account moment is checked against the synced `game.seen`
 *   list before it waits, and marked there when its card reaches its final
 *   frame or is skipped. Every moment that has played is also remembered in
 *   memory (`MEMORY_LEDGER_LIMIT`), keyed by the scope generation, so one
 *   published again before its `seen` mark has landed never plays twice. A
 *   guest moment and a toast are remembered in memory only.
 * - **A crash.** An account moment waiting to play is also written to this
 *   phone's pending queue (`gameLocal`), and dropped from it once it has played,
 *   been skipped, timed out or been cleared by a safety stop.
 * - **Holds.** Nothing starts while a microphone or a live room holds the audio
 *   focus, a sheet or an end card is up, or the app is not active. A hold pauses
 *   the queue; it never drops a moment. A card already on screen lands on its
 *   final frame and stays until the learner moves on.
 * - **A safety stop (F137).** `suppressCelebrations` clears the queue, the card
 *   on screen and anything published before the host attached, silences sound
 *   effects, and refuses every new moment until it is released.
 * - **Sign-out.** A new scope generation clears the queue without a write: the
 *   account that left keeps its own pending moments for its next sign-in.
 * - **Time to live.** A moment that waits longer than `CELEBRATION_TTL_MS` is
 *   dropped.
 */

import { badgeFor, isDayKey } from '@luvani/core';

import type { PersistAck } from '../storage/ack.ts';
import { liveRoom, micLive, subscribe as onFocusChange } from '../sound/audioFocus.ts';
import { suppressSfx } from '../sound/sfxGate.ts';
import {
  CELEBRATION_TTL_MS,
  MAX_TAKEOVERS,
  discardBufferedCelebrations,
  isRememberedInSeen,
  isTakeover,
  takeoverRank,
  type CelebrationEvent,
  type TakeoverType,
} from './events.ts';

/** Moments that arrive this close together are one burst, in ms. */
export const BURST_WINDOW_MS = 250;
/** The pause between one card and the next, and after the app comes back, in ms. */
export const RESUME_AFTER_MS = 300;
/** How many guest moments and toasts are remembered in memory. */
export const MEMORY_LEDGER_LIMIT = 256;
/** The most badges one card shows. */
export const BADGES_PER_CARD = 3;

type EventOf<T extends CelebrationEvent['type']> = Extract<CelebrationEvent, { type: T }>;
export type PhraseSavedEvent = EventOf<'phrase-saved'>;

// ──────────────────────────────────────────────────────────────── memory ledger

/** A bounded set of keys, oldest forgotten first. In memory only: never persisted, never sent. */
export interface MemoryLedger {
  has(key: string): boolean;
  add(key: string): void;
  readonly size: number;
}

export function createMemoryLedger(limit: number = MEMORY_LEDGER_LIMIT): MemoryLedger {
  const seen = new Set<string>();
  return {
    has: (key) => seen.has(key),
    add(key) {
      if (seen.has(key)) return;
      seen.add(key);
      while (seen.size > limit) seen.delete(seen.values().next().value!);
    },
    get size() {
      return seen.size;
    },
  };
}

const inPlace = createMemoryLedger();

/**
 * True the first time an in-place moment (an end card) asks with this key,
 * false every time after, so a card that remounts never sounds twice. The
 * caller puts the scope generation in the key. In memory only.
 */
export function claimInPlace(key: string): boolean {
  if (inPlace.has(key)) return false;
  inPlace.add(key);
  return true;
}

// ──────────────────────────────────────────────────────────────────────── holds

type HoldChange = 'hold' | 'suppress';
let holdCount = 0;
let suppressCount = 0;
const holdListeners = new Set<(change: HoldChange) => void>();

function emitHold(change: HoldChange): void {
  for (const listener of [...holdListeners]) {
    try {
      listener(change);
    } catch {
      /* A listener's failure is its own. */
    }
  }
}

/**
 * Hold the queue while something sits over the host: a sheet while it is
 * presented, an end card while it is mounted. Returns the release, which is
 * safe to call twice. Holds are counted, so two never release each other.
 */
export function holdCelebrations(): () => void {
  holdCount += 1;
  emitHold('hold');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holdCount = Math.max(0, holdCount - 1);
    emitHold('hold');
  };
}

/**
 * A safety stop is on screen (F137): clear everything waiting, stop the moment
 * playing, drop anything published before the host attached, silence sound
 * effects, and refuse every new moment until the release runs. Called from
 * `tutor/SafetyStopView.tsx` on mount; the release runs on unmount.
 */
export function suppressCelebrations(): () => void {
  suppressCount += 1;
  const releaseSfx = suppressSfx();
  discardBufferedCelebrations();
  emitHold('suppress');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suppressCount = Math.max(0, suppressCount - 1);
    releaseSfx();
    emitHold('hold');
  };
}

/** True while a sheet or an end card holds the queue. */
export const celebrationsHeld = (): boolean => holdCount > 0;
/** True while a safety stop is on screen. */
export const celebrationsSuppressed = (): boolean => suppressCount > 0;

// ──────────────────────────────────────────────────────────────── what can show

const whole = (value: unknown, least: number): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value >= least;
const text = (value: unknown): boolean => typeof value === 'string' && value.length > 0;

/**
 * Whether a moment carries everything its card shows. A moment that does not
 * is dropped rather than drawn with a gap or a made-up number.
 */
export function isShowable(event: CelebrationEvent): boolean {
  if (!text(event.key)) return false;
  switch (event.type) {
    case 'purchase-confirmed':
      return text(event.data.transactionId);
    case 'streak-extended':
      return isDayKey(event.data.day) && whole(event.data.current, 1) && whole(event.data.lifetimeDays, 1);
    case 'streak-milestone':
      return (
        isDayKey(event.data.day) &&
        isDayKey(event.data.runStart) &&
        whole(event.data.current, 1) &&
        whole(event.data.lifetimeDays, 1) &&
        whole(event.data.milestone, 1)
      );
    case 'level-up':
      return whole(event.data.before, 1) && whole(event.data.level, 2) && event.data.before < event.data.level;
    case 'badge-earned':
      return text(event.data.id) && badgeFor(event.data.id) !== null;
    case 'phrase-saved':
      return text(event.data.phraseKey);
    default:
      return false;
  }
}

// ──────────────────────────────────────────────────────────────────── planning

/** One full-screen card. */
export interface TakeoverCard {
  /** Unique for the life of the queue. */
  readonly id: string;
  readonly type: TakeoverType;
  /** What the card shows: one moment, or up to three badges. */
  readonly shows: readonly CelebrationEvent[];
  /** Moments past the budget, a row each under "Also today". Only ever on a burst's last card. */
  readonly also: readonly CelebrationEvent[];
  /** Every moment this card stands for (shown, merged into it, or a row), each remembered once it has played. */
  readonly covers: readonly CelebrationEvent[];
}

export type PlannedCard = Omit<TakeoverCard, 'id'>;

function planned(type: TakeoverType, shows: readonly CelebrationEvent[], covers: readonly CelebrationEvent[]): PlannedCard {
  return { type, shows, also: [], covers };
}

function newest<E extends { readonly data: { readonly day: string } }>(events: readonly E[]): E {
  return events.reduce((best, event) => (event.data.day >= best.data.day ? event : best));
}

/**
 * The cards one burst plays, in order, at most `budget` of them.
 *
 * Merges first (a milestone replaces the same day's streak moment; one card for
 * the newest streak day and the highest level; badges three to a card), then orders by `TAKEOVER_ORDER`, then folds every card past the
 * budget into rows on the last card it plays. A card's `covers` holds every
 * moment it stands for, so a moment folded away is remembered with it.
 */
export function planBurst(events: readonly CelebrationEvent[], budget: number): PlannedCard[] {
  const byKey = new Map<string, CelebrationEvent>();
  for (const event of events) if (isTakeover(event.type) && !byKey.has(event.key)) byKey.set(event.key, event);
  const unique = [...byKey.values()];
  const of = <T extends TakeoverType>(type: T): EventOf<T>[] => unique.filter((event): event is EventOf<T> => event.type === type);
  const cards: PlannedCard[] = [];

  const purchases = of('purchase-confirmed');
  if (purchases.length > 0) cards.push(planned('purchase-confirmed', [purchases[purchases.length - 1]!], purchases));

  const streaks: (EventOf<'streak-milestone'> | EventOf<'streak-extended'>)[] = [...of('streak-milestone'), ...of('streak-extended')];
  if (streaks.length > 0) {
    const day = newest(streaks).data.day;
    const sameDay = streaks.filter((event) => event.data.day === day);
    const milestones = sameDay.filter((event): event is EventOf<'streak-milestone'> => event.type === 'streak-milestone');
    const shown = milestones.length > 0 ? milestones.reduce((best, event) => (event.data.milestone > best.data.milestone ? event : best)) : sameDay[sameDay.length - 1]!;
    cards.push(planned(shown.type, [shown], streaks));
  }

  const levels = of('level-up');
  if (levels.length > 0) {
    const top = levels.reduce((best, event) => (event.data.level > best.data.level ? event : best));
    const before = Math.min(...levels.map((event) => event.data.before));
    cards.push(planned('level-up', [{ ...top, data: { before, level: top.data.level } }], levels));
  }

  const badges = of('badge-earned');
  for (let at = 0; at < badges.length; at += BADGES_PER_CARD) {
    const group = badges.slice(at, at + BADGES_PER_CARD);
    cards.push(planned('badge-earned', group, group));
  }

  // Array sort is stable, so badge cards keep the order their badges arrived in.
  cards.sort((a, b) => takeoverRank(a.type) - takeoverRank(b.type));
  const room = Math.max(1, Math.floor(budget));
  const playing = cards.slice(0, room);
  const rest = cards.slice(room);
  if (rest.length > 0 && playing.length > 0) {
    const last = playing[playing.length - 1]!;
    playing[playing.length - 1] = {
      ...last,
      also: [...last.also, ...rest.flatMap((card) => card.shows)],
      covers: [...last.covers, ...rest.flatMap((card) => card.covers)],
    };
  }
  return playing;
}

// ──────────────────────────────────────────────────────────────────── the queue

/** What the queue needs from the world. The host binds these; a test fakes them. */
export interface QueueDeps {
  now(): number;
  setTimer(run: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** The account scope's generation (`storage/scope.ts`); a change is a sign-out or a switch. */
  generation(): number;
  /** Whether the synced `game.seen` list holds a key. Rejects when the disk cannot be read. */
  hasSeen(key: string): Promise<boolean>;
  markSeen(marks: readonly { key: string; at: number }[]): Promise<PersistAck>;
  /** This phone's crash-replay queue (`gameLocal`). */
  enqueuePending(items: readonly { key: string; at: number }[]): Promise<PersistAck>;
  dropPending(keys: readonly string[]): Promise<PersistAck>;
  /** Stop whatever the card on screen is playing: haptic beats waiting, sounds sounding. */
  stopEffects(): void;
}

export interface ToastItem {
  readonly id: string;
  readonly event: PhraseSavedEvent;
}

export interface QueueSnapshot {
  /** The card on screen, and whether it has reached its final frame. */
  readonly current: { readonly card: TakeoverCard; readonly final: boolean } | null;
  /** True while something holds the queue: the card on screen lands on its final frame and nothing new starts. */
  readonly paused: boolean;
  readonly toast: ToastItem | null;
}

export interface CelebrationQueue {
  /** Moments from `attachCelebrationListener`. */
  receive(events: readonly CelebrationEvent[]): void;
  snapshot(): QueueSnapshot;
  subscribe(listener: () => void): () => void;
  /** Listen to the holds and the audio focus. Returns the stop. */
  start(): () => void;
  /** The card reached its final frame, or was skipped there: remember what it covers. */
  reachedFinal(id: string): void;
  /** The learner pressed Continue. */
  dismiss(id: string): void;
  toastDone(id: string): void;
  setActive(active: boolean): void;
  /** The account scope changed: clear everything, write nothing. */
  reset(): void;
  /** The keys waiting to play, for tests and diagnostics. */
  waitingKeys(): string[];
}

type Entry = { readonly event: CelebrationEvent; readonly receivedAt: number; readonly generation: number };
type Showing = { card: TakeoverCard; readonly generation: number; final: boolean };

export function createCelebrationQueue(deps: QueueDeps): CelebrationQueue {
  let waiting: Entry[] = [];
  let checking = 0;
  const inFlight = new Set<string>();
  let showing: Showing | null = null;
  // Cards put on screen since the run began. The run ends only when nothing is showing, waiting, being checked or about to resume.
  let presentedInBurst = 0;
  let burstGeneration: number | null = null;
  let toast: ToastItem | null = null;
  let active = true;
  let windowTimer: unknown = null;
  let ttlTimer: unknown = null;
  let resumeTimer: unknown = null;
  let serial = 0;
  // Moves on every clear, so a seen check that answers late cannot bring back what was cleared.
  let epoch = 0;
  const ledger = createMemoryLedger(MEMORY_LEDGER_LIMIT);
  const listeners = new Set<() => void>();
  let snap: QueueSnapshot = { current: null, paused: false, toast: null };

  const held = (): boolean => celebrationsHeld() || celebrationsSuppressed() || micLive() || liveRoom() || !active;
  const memoryKey = (generation: number, event: CelebrationEvent): string => `${generation}:${event.type}:${event.key}`;

  /** A store call that may throw before it returns (no account to bind a key to) or reject: either is swallowed. */
  const safely = (work: () => Promise<unknown>): void => {
    try {
      void work().catch(() => {});
    } catch {
      /* No account scope to write in. */
    }
  };

  function publish(): void {
    const current = showing === null ? null : { card: showing.card, final: showing.final };
    const next: QueueSnapshot = { current, paused: showing !== null && held(), toast };
    // The card itself, not its id: a row added to the card on screen is news to the frame.
    const same =
      snap.current?.card === next.current?.card &&
      snap.current?.final === next.current?.final &&
      snap.paused === next.paused &&
      snap.toast?.id === next.toast?.id;
    if (same) return;
    snap = next;
    for (const listener of [...listeners]) listener();
  }

  const isQueued = (key: string): boolean =>
    waiting.some((entry) => entry.event.key === key) || (showing?.card.covers.some((event) => event.key === key) ?? false);

  function admit(event: CelebrationEvent, generation: number): void {
    const now = deps.now();
    waiting.push({ event, receivedAt: now, generation });
    if (isRememberedInSeen(event) && generation === deps.generation()) {
      const at = Number.isSafeInteger(event.at) && event.at > 0 ? event.at : now;
      safely(() => deps.enqueuePending([{ key: event.key, at }]));
    }
  }

  function openWindow(): void {
    if (windowTimer !== null) deps.clearTimer(windowTimer);
    windowTimer = deps.setTimer(() => {
      windowTimer = null;
      pump();
    }, BURST_WINDOW_MS);
  }

  function startResume(): void {
    if (resumeTimer !== null) deps.clearTimer(resumeTimer);
    resumeTimer = deps.setTimer(() => {
      resumeTimer = null;
      pump();
    }, RESUME_AFTER_MS);
  }

  /** Drop what timed out and what belongs to an account that has gone. */
  function expire(): void {
    const now = deps.now();
    const generation = deps.generation();
    const kept: Entry[] = [];
    const timedOut: string[] = [];
    for (const entry of waiting) {
      if (entry.generation !== generation) continue;
      if (now - entry.receivedAt >= CELEBRATION_TTL_MS) {
        if (isRememberedInSeen(entry.event)) timedOut.push(entry.event.key);
        continue;
      }
      kept.push(entry);
    }
    waiting = kept;
    if (timedOut.length > 0) safely(() => deps.dropPending(timedOut));
  }

  function scheduleTtl(): void {
    if (ttlTimer !== null) {
      deps.clearTimer(ttlTimer);
      ttlTimer = null;
    }
    if (waiting.length === 0) return;
    const due = Math.min(...waiting.map((entry) => entry.receivedAt + CELEBRATION_TTL_MS));
    ttlTimer = deps.setTimer(() => {
      ttlTimer = null;
      pump();
    }, Math.max(0, due - deps.now()));
  }

  /** The run has put on screen every card its budget allows. */
  const spent = (): boolean => presentedInBurst >= MAX_TAKEOVERS;

  function present(): void {
    const [first] = planBurst(
      waiting.map((entry) => entry.event),
      MAX_TAKEOVERS - presentedInBurst,
    );
    if (first === undefined) {
      waiting = [];
      return;
    }
    const covered = new Set(first.covers.map((event) => event.key));
    waiting = waiting.filter((entry) => !covered.has(entry.event.key));
    serial += 1;
    presentedInBurst += 1;
    showing = { card: { ...first, id: `card-${serial}` }, generation: deps.generation(), final: false };
  }

  /**
   * The budget is spent and its last card is on screen: whatever arrives now
   * becomes a row on that card, never a fourth takeover. A card that has
   * already landed remembers its new rows at once, because they are drawn on
   * its final frame.
   */
  function foldIntoLast(card: Showing): void {
    const joining = planBurst(
      waiting.map((entry) => entry.event),
      Number.MAX_SAFE_INTEGER,
    );
    waiting = [];
    if (joining.length === 0) return;
    const also = joining.flatMap((planned) => planned.shows);
    const covers = joining.flatMap((planned) => planned.covers);
    card.card = { ...card.card, also: [...card.card.also, ...also], covers: [...card.card.covers, ...covers] };
    if (card.final) remember(covers, card.generation);
  }

  function pump(): void {
    expire();
    const generation = deps.generation();
    // A run belongs to one account: the next one starts with the whole budget.
    if (generation !== burstGeneration) {
      burstGeneration = generation;
      presentedInBurst = 0;
    }
    if (showing !== null && showing.generation !== generation) {
      showing = null;
      deps.stopEffects();
    }
    if (spent() && waiting.length > 0) {
      if (showing !== null) foldIntoLast(showing);
      // The last card has gone and the run is still ending: a fourth card now
      // would break the budget, and there is no card left to carry a row. The
      // moment is not remembered and its crash-replay copy stays, for the game
      // pipeline's catch-up to bring back on its own.
      else waiting = [];
    }
    const settled = windowTimer === null && resumeTimer === null && checking === 0;
    if (showing === null && waiting.length === 0 && settled) presentedInBurst = 0;
    else if (showing === null && waiting.length > 0 && settled && !held()) present();
    scheduleTtl();
    publish();
  }

  /** Moments that have played (reached their final frame, been skipped, or been drawn as a row there). */
  function remember(events: readonly CelebrationEvent[], generation: number): void {
    // In memory as well, so one published again before its `seen` mark has landed never plays twice.
    for (const event of events) ledger.add(memoryKey(generation, event));
    const durable = events.filter(isRememberedInSeen).map((event) => event.key);
    if (durable.length === 0 || generation !== deps.generation()) return;
    const at = deps.now();
    safely(() => deps.markSeen(durable.map((key) => ({ key, at }))));
    safely(() => deps.dropPending(durable));
  }

  function clear(): void {
    epoch += 1;
    checking = 0;
    inFlight.clear();
    for (const timer of [windowTimer, ttlTimer, resumeTimer]) if (timer !== null) deps.clearTimer(timer);
    windowTimer = null;
    ttlTimer = null;
    resumeTimer = null;
    waiting = [];
    presentedInBurst = 0;
    toast = null;
    if (showing !== null) {
      showing = null;
      deps.stopEffects();
    }
  }

  /** F137: everything waiting goes, the crash-replay copies too, so nothing returns after the stop. */
  function suppress(): void {
    const generation = deps.generation();
    const unplayed = [
      ...waiting.filter((entry) => entry.generation === generation).map((entry) => entry.event),
      ...(showing !== null && !showing.final && showing.generation === generation ? showing.card.covers : []),
    ];
    const keys = unplayed.filter(isRememberedInSeen).map((event) => event.key);
    clear();
    if (keys.length > 0) safely(() => deps.dropPending(keys));
    publish();
  }

  function showToast(event: PhraseSavedEvent, generation: number): void {
    const key = memoryKey(generation, event);
    if (ledger.has(key)) return;
    ledger.add(key);
    // Still and silent in a live room or behind the app: the page already says it was saved.
    if (micLive() || liveRoom() || !active) return;
    serial += 1;
    toast = { id: `toast-${serial}`, event };
    publish();
  }

  function check(event: CelebrationEvent, generation: number): void {
    inFlight.add(event.key);
    checking += 1;
    const asked = epoch;
    let answer: Promise<boolean>;
    try {
      answer = deps.hasSeen(event.key);
    } catch {
      answer = Promise.reject(new Error('no account scope'));
    }
    void answer
      .then(
        (seen): 'seen' | 'new' => (seen ? 'seen' : 'new'),
        (): 'unknown' => 'unknown',
      )
      .then((verdict) => {
        if (asked !== epoch) return;
        checking -= 1;
        inFlight.delete(event.key);
        const current = generation === deps.generation();
        // Already played somewhere: tidy a crash-replay copy that outlived it.
        if (verdict === 'seen' && current) safely(() => deps.dropPending([event.key]));
        // Unreadable: never risk a second showing of a moment that may have played.
        if (verdict === 'new' && current && !celebrationsSuppressed() && !isQueued(event.key)) admit(event, generation);
        pump();
      });
  }

  function receive(events: readonly CelebrationEvent[]): void {
    if (celebrationsSuppressed()) return;
    const generation = deps.generation();
    let arrived = false;
    for (const event of events) {
      if (event === null || typeof event !== 'object' || !isShowable(event)) continue;
      if (event.type === 'phrase-saved') {
        showToast(event, generation);
        continue;
      }
      if (!isTakeover(event.type) || isQueued(event.key) || inFlight.has(event.key)) continue;
      // Played in this session: its `seen` mark may still be on its way to the disk.
      if (ledger.has(memoryKey(generation, event))) continue;
      if (isRememberedInSeen(event)) {
        arrived = true;
        check(event, generation);
        continue;
      }
      arrived = true;
      admit(event, generation);
    }
    if (arrived) openWindow();
    pump();
  }

  return {
    receive,
    snapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      const onHold = (change: HoldChange): void => {
        if (change === 'suppress') suppress();
        else pump();
      };
      holdListeners.add(onHold);
      const stopFocus = onFocusChange(() => {
        if (showing !== null && (micLive() || liveRoom())) deps.stopEffects();
        pump();
      });
      if (celebrationsSuppressed()) suppress();
      else pump();
      return () => {
        holdListeners.delete(onHold);
        stopFocus();
      };
    },
    reachedFinal(id) {
      if (showing === null || showing.card.id !== id || showing.final) return;
      showing.final = true;
      remember(showing.card.covers, showing.generation);
      publish();
    },
    dismiss(id) {
      if (showing === null || showing.card.id !== id) return;
      if (!showing.final) {
        showing.final = true;
        remember(showing.card.covers, showing.generation);
      }
      showing = null;
      startResume();
      pump();
    },
    toastDone(id) {
      if (toast?.id !== id) return;
      toast = null;
      publish();
    },
    setActive(next) {
      if (next === active) return;
      active = next;
      if (!next) deps.stopEffects();
      else startResume();
      pump();
    },
    reset() {
      clear();
      discardBufferedCelebrations();
      publish();
    },
    waitingKeys: () => waiting.map((entry) => entry.event.key),
  };
}
