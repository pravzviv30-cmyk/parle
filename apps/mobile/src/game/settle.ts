/**
 * The one write pipeline for a finished sitting (Come alive, Phase 1, F744;
 * README Part 6: one module, one type).
 *
 * Every place a practice finishes calls this, and nothing else writes the
 * game layer's facts for a sitting:
 *
 *     const delta = await settleSitting({ source, at, xpEarned, activeMs, write });
 *
 * or, where the sitting's own write has an owner of its own (the practice
 * completion plan, the daily phrase, the guest hand-off), `beginSettle()`
 * before that write and `finishSettle(token, …)` once it has landed.
 *
 * `finishSettle` runs alone on one chain and, in order:
 *
 * 1. records the day: a sitting that earned XP carries its day on its activity
 *    entry; one that earned none has its day recorded by its own write
 *    (`recordActivity` with `finished: true`, or `recordActiveDay`), checked
 *    here, and a row in `game.sittings` (D3, F731). No new activity kind, ever.
 * 2. writes the fixed +5 for a win nothing grades (today's phrase, a review
 *    with nothing recalled, the guest's first practice), once per key.
 * 3. reconciles: covers (travel, then freezes, then a repair, each only for a
 *    confirmed paid plan), the goal day, today's three quests (dealt once and
 *    frozen), quest claims, the monthly XP rollups and new badges.
 * 4. reads everything back and builds the GameDelta from what is on disk.
 * 5. turns the delta into celebration moments (`game/events.ts`), drops any
 *    already in the synced `seen` list, queues them on this phone in case of a
 *    crash, and hands them to the host. The host marks a moment seen once it
 *    has played; this file never does, or the host would refuse to play it.
 *
 * A sitting counts for the local day it finished (game.md 2.1), so one that
 * ends at 23:59 and settles a few seconds after midnight still belongs to the
 * day before. Anything settled later than that (a retried plan, a guest
 * practice kept the next day) settles against today and never re-deals or
 * claims a past day's quests.
 *
 * It answers null and writes nothing more the moment the account changes, so
 * a sitting settled after a sign-out lands nowhere, and `settleSitting` never
 * starts a sitting's own write for an account that changed while its snapshot
 * was read. A safety stop never calls it (F137): the screens settle only
 * inside their `!stopped` guards.
 *
 * Until the existing-learner seed has run on this phone (F745), a settle
 * writes the sitting's facts but awards no badge and plays nothing: on a phone
 * that has not been introduced, a badge or a milestone may be months old, and
 * it must never burst onto the screen as news.
 *
 * The reminder planner (`reminders/ReminderPlanner.tsx`, Phase 4) hears every
 * settled sitting through `onSettled` and plans the next days again, so a
 * practice skips today's reminder. This file knows nothing about reminders.
 */

import {
  FREEZE_CAP,
  FREE_FREEZE_CAP,
  QUEST_XP,
  addDays,
  freezesToApply,
  localDayKey,
  milestoneCrossed,
  newBadges,
  questsForDay,
  questsToClaim,
  repairOffer,
  streakFrom,
  totalXp,
  travelCover,
  utcOffsetMinutesAt,
  xpCreditedFor,
  type CoverKind,
  type DayKey,
  type QuestEligibility,
  type QuestId,
  type StreakCover,
} from '@luvani/core';

import { publishCelebrations, type CelebrationEvent } from '../celebrate/events.ts';
import { cleanActiveMs } from '../progress/activeTime.ts';
import { loadActiveDays, loadActivity, recordActiveDay, type ActivityEntry, type ActivityKind } from '../progress/activity.ts';
import type { PersistAck } from '../storage/ack.ts';
import { activeUserId, onUserScopeReset, scopeGeneration } from '../storage/scope.ts';
import type { GameDelta, SittingSource } from './delta.ts';
import { eventsFromDelta } from './events.ts';
import { enqueueCelebrations, loadGameLocal, setLastPracticeOffset, setPaidSince, setProtectedSince, type GameLocal } from './gameLocal.ts';
import { MAX_SITTING_ACTIVE_MS, isSittingSource, seenIn, type QuestClaimRow, type StoredGame } from './model.ts';
import { readOutsideFacts } from './sources.ts';
import {
  addBonus,
  addClaims,
  addCovers,
  appendSitting,
  awardBadges,
  loadGame,
  markGoalDay,
  raiseXpMonths,
  setQuestDay,
} from './store.ts';
import {
  PRACTISE_BONUS_XP,
  activityMonths,
  badgeFactsFrom,
  finishedOfKind,
  finishedSittings,
  gameViewFrom,
  protectionOf,
  questsDoneOf,
  type BillingFacts,
  type GameFacts,
  type GameView,
  type OutsideFacts,
} from './view.ts';

const DAY_MS = 86_400_000;

// ─────────────────────────────────────────────────────────── the environment

/**
 * What the pipeline reads from outside the stores. The app's `GameProvider`
 * fills in the billing answer it last fetched and the microphone permission;
 * until it does, billing is unknown (no cover, no live-minute quest) and the
 * app cannot record (no recording quest), which is the safe direction for both.
 */
export interface GameEnvironment {
  now(): number;
  /** The server's last billing answer, or null when it is unknown. Never a network call. */
  billing(): Promise<BillingFacts | null>;
  /** True only when the app can record the learner's voice. False when it cannot tell. */
  canRecord(): Promise<boolean>;
  outside(today: DayKey, now: number): Promise<OutsideFacts>;
}

const DEFAULT_ENVIRONMENT: GameEnvironment = {
  now: () => Date.now(),
  billing: () => Promise.resolve(null),
  canRecord: () => Promise.resolve(false),
  outside: (today, now) => readOutsideFacts(today, now),
};

let environment: GameEnvironment = DEFAULT_ENVIRONMENT;

/** Replace parts of the environment; the answer puts the previous one back. */
export function configureGameEnvironment(overrides: Partial<GameEnvironment>): () => void {
  const previous = environment;
  const next = { ...environment, ...overrides };
  environment = next;
  return () => {
    if (environment === next) environment = previous;
  };
}

export function gameEnvironment(): GameEnvironment {
  return environment;
}

// ──────────────────────────────────────────────────────────────── the chain

let chain: Promise<unknown> = Promise.resolve();

/** Run work alone: settles, the existing-learner seed and the quiet catch-up never interleave. */
export function onSettleChain<T>(work: () => Promise<T>): Promise<T> {
  const next = chain.then(work, work);
  chain = next.catch(() => {});
  return next;
}

/** How long an unfinished settle holds the quiet catch-up back. Long enough for any write; short enough to forget an abandoned one. */
export const SETTLE_HOLD_MS = 120_000;

const openSettles = new Set<{ openedAt: number }>();
/** Keys this launch handed to the host. The catch-up leaves them to the host, and a second settle never hands them over twice. */
const publishedThisLaunch = new Set<string>();

/**
 * Raised, synchronously, every time a sitting begins to settle. A quiet pass
 * that read it before a sitting began can tell that one did, and stops before
 * it claims, awards or marks seen anything that sitting may have written: those
 * moments are the sitting's to celebrate, not the catch-up's to swallow.
 */
let settleEpoch = 0;

export function settleEpochNow(): number {
  return settleEpoch;
}

/** True while a sitting between `beginSettle` and `finishSettle` could still write. */
export function settleInFlight(now: number): boolean {
  for (const marker of openSettles) {
    if (now - marker.openedAt < SETTLE_HOLD_MS) return true;
    openSettles.delete(marker);
  }
  return false;
}

export function publishedInThisLaunch(key: string): boolean {
  return publishedThisLaunch.has(key);
}

onUserScopeReset(() => {
  openSettles.clear();
  publishedThisLaunch.clear();
});

// ───────────────────────────────────────────────────────────────── the facts

interface Snapshot {
  activity: readonly ActivityEntry[];
  practiceDays: readonly DayKey[];
  game: StoredGame;
}

/** The streak's, the XP's and the game's facts, read strictly. Rejects on anything unreadable. */
async function snapshot(): Promise<Snapshot> {
  const [activity, practiceDays, game] = await Promise.all([loadActivity({ strict: true }), loadActiveDays(), loadGame()]);
  return { activity, practiceDays, game };
}

export async function readGameFacts(outside: OutsideFacts, billing: BillingFacts | null): Promise<GameFacts> {
  return { ...(await snapshot()), outside, billing };
}

async function safely<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

// ──────────────────────────────────────────────────────────── the reconcile

export interface Reconciled {
  covers: StreakCover[];
  claims: QuestClaimRow[];
  badges: string[];
  facts: GameFacts;
  view: GameView;
}

interface ReconcileInput {
  uid: string;
  /** The local day the game's facts are worked out for: today, or the day a sitting just before midnight finished. */
  today: DayKey;
  now: number;
  /** A practice can earn a travel cover and complete a repair; a quiet pass only spends freezes. */
  mode: 'practice' | 'quiet';
  /** UTC offset at this practice, minutes east. */
  offsetNow?: number;
  /** Badges are awarded only once the existing-learner seed has run on this phone, so none is dated by accident. */
  awardBadges: boolean;
  /**
   * Whether this pass may deal the day's quests. The guest hand-off may not:
   * it runs before the app knows the plan or the microphone, and a deal is
   * frozen for the day, so it leaves the deal to the first catch-up.
   */
  dealQuests: boolean;
  /** True while the account this work was bound to is still the active one. */
  live: () => boolean;
}

function eligibilityOf(facts: GameFacts, today: DayKey, canRecord: boolean): QuestEligibility {
  const billing = facts.billing;
  return {
    practiceDaysBefore: facts.practiceDays.filter((day) => day < today).length,
    phraseCards: facts.outside.phraseCards,
    conversations: finishedOfKind(facts, 'convo').length,
    // Unknown is ineligible, and so is a plan that cannot start a room now
    // (review finding 19): a quest the room might refuse is a broken promise.
    liveSecondsRemaining: billing === null ? null : billing.canStart ? billing.secondsRemaining : 0,
    canRecord,
  };
}

function coversToApply(i: {
  facts: GameFacts;
  today: DayKey;
  now: number;
  mode: 'practice' | 'quiet';
  paidSince: DayKey | null;
  protectedSince: DayKey | null;
  offsetNow?: number;
  offsetBefore: number | null;
}): StreakCover[] {
  const protection = protectionOf(i.facts.billing);
  if (protection === null) return [];
  const input = { practiceDays: i.facts.practiceDays, covers: i.facts.game.covers, today: i.today };
  const paid = protection.cap >= FREEZE_CAP;
  // Travel first, so a trip never spends a freeze. Paid-only, as it was (D4).
  if (i.mode === 'practice' && paid && i.offsetNow !== undefined) {
    const day = travelCover({ ...input, entitled: true, offsetNow: i.offsetNow, offsetBefore: i.offsetBefore });
    if (day !== null) return [{ day, kind: 'travel', at: i.now }];
  }
  if (protection.freezes) {
    // A paid plan's two freezes never reach before the plan (paidSince); the
    // one every learner holds reaches back only to protectedSince (D23). So a
    // plan bought after a gap cannot spend its second freeze on that gap.
    const both = paid ? freezesToApply(protection.cap, { ...input, protectedSince: i.paidSince }) : [];
    const days = both.length > 0 ? both : freezesToApply(Math.min(protection.cap, FREE_FREEZE_CAP), { ...input, protectedSince: i.protectedSince });
    if (days.length > 0) return days.map((day) => ({ day, kind: 'freeze' as const, at: i.now }));
  }
  // A repair is earned by practice (two finished sittings in the window) and
  // limited to once every REPAIR_EVERY_DAYS (D19), both inside `repairOffer`.
  if (i.mode === 'practice' && protection.repair) {
    const offer = repairOffer({ ...input, entitled: true, sittings: finishedSittings(i.facts) });
    if (offer !== null && offer.ready) return offer.days.map((day) => ({ day, kind: 'repair' as const, at: i.now }));
  }
  return [];
}

/**
 * Bring the game's facts up to date with the practice on disk: covers, the
 * goal day, today's quests and their claims, the XP rollups and badges. Every
 * write is a union or a max, so running it twice is running it once. Null when
 * the account changed part way.
 */
export async function reconcileGame(input: ReconcileInput): Promise<Reconciled | null> {
  const env = environment;
  const billing = await safely(() => env.billing(), null);
  const canRecord = await safely(() => env.canRecord(), false);
  const outside = await env.outside(input.today, input.now);
  let facts = await readGameFacts(outside, billing);
  const local: GameLocal | null = await safely(() => loadGameLocal(), null);

  // The first day this phone saw a paid plan, and the first day it saw any
  // plan holding a freeze (the free plan's one, D23), each on its own calendar
  // day whatever day the facts are for, and forgetting each when it goes. So no
  // freeze is ever applied to a day before it was held. Unknown billing
  // changes nothing.
  const protection = protectionOf(billing);
  const observed = localDayKey(input.now);
  let paidSince = local?.paidSince ?? null;
  let protectedSince = local?.protectedSince ?? null;
  if (protection !== null && local !== null && input.live()) {
    const paid = protection.cap >= FREEZE_CAP;
    if (paid && paidSince === null) {
      if ((await setPaidSince(observed)) === 'durable') paidSince = observed;
    } else if (!paid && paidSince !== null) {
      if ((await setPaidSince(null)) === 'durable') paidSince = null;
    }
    if (protection.freezes && protectedSince === null && input.live()) {
      if ((await setProtectedSince(observed)) === 'durable') protectedSince = observed;
    } else if (!protection.freezes && protectedSince !== null && input.live()) {
      if ((await setProtectedSince(null)) === 'durable') protectedSince = null;
    }
  }

  const covers = coversToApply({
    facts,
    today: input.today,
    now: input.now,
    mode: input.mode,
    paidSince,
    protectedSince,
    ...(input.offsetNow === undefined ? {} : { offsetNow: input.offsetNow }),
    offsetBefore: local?.lastPracticeOffsetMin ?? null,
  });
  if (!input.live()) return null;
  const coversWritten = covers.length > 0 && (await addCovers(covers)) === 'durable' ? covers : [];
  if (input.mode === 'practice' && input.offsetNow !== undefined && local !== null && input.live()) {
    await setLastPracticeOffset(input.offsetNow);
  }

  facts = await readGameFacts(outside, billing);
  let view = gameViewFrom(facts, input.today);
  if (!input.live()) return null;
  if (view.goal.met && !facts.game.goalDays.includes(input.today)) await markGoalDay(input.today);

  // Dealt once, the first time a day is computed, and frozen in the store: a
  // change in eligibility later that day never reshuffles what was shown.
  if (view.quests.ids === null && input.dealQuests) {
    const ids = questsForDay({ day: input.today, seed: input.uid, eligibility: eligibilityOf(facts, input.today, canRecord), goalTarget: outside.goalTarget });
    if (!input.live()) return null;
    await setQuestDay({ day: input.today, ids, at: input.now });
  }

  facts = await readGameFacts(outside, billing);
  view = gameViewFrom(facts, input.today);
  let claims: QuestClaimRow[] = [];
  if (view.quests.ids !== null) {
    const due = questsToClaim({ day: input.today, ids: view.quests.ids, facts: view.quests.facts, goalTarget: outside.goalTarget, claims: facts.game.claims });
    const rows = due.map((questId) => ({ day: input.today, questId, xp: QUEST_XP, at: input.now }));
    if (!input.live()) return null;
    if (rows.length > 0 && (await addClaims(rows)) === 'durable') claims = rows;
  }

  // The rollup only ever raises a month, so the total shown never falls once
  // old entries age out. Quest and fixed-XP months are folded by the store on
  // every write (model.ts `rolledUp`).
  const months = activityMonths(facts.activity);
  if (!input.live()) return null;
  if (months.length > 0) await raiseXpMonths(months);

  facts = await readGameFacts(outside, billing);
  view = gameViewFrom(facts, input.today);
  let badges: string[] = [];
  if (input.awardBadges) {
    const earned = newBadges(badgeFactsFrom(facts, view), facts.game.badges.map((badge) => badge.id));
    if (!input.live()) return null;
    if (earned.length > 0 && (await awardBadges(earned.map((id) => ({ id, at: input.now })))) === 'durable') badges = earned;
  }

  if (badges.length > 0 || claims.length > 0) {
    facts = await readGameFacts(outside, billing);
    view = gameViewFrom(facts, input.today);
  }
  return { covers: coversWritten, claims, badges, facts, view };
}

// ─────────────────────────────────────────────────────────────── the settle

export interface SettleToken {
  readonly scope: number;
  readonly uid: string | null;
  readonly before: Snapshot | null;
  readonly marker: { openedAt: number };
}

export interface SittingFacts {
  readonly source: SittingSource;
  /** Epoch ms the sitting finished. */
  readonly at: number;
  /** XP the sitting earned before any cap; 0 for a win nothing grades. */
  readonly xpEarned: number;
  /** Measured active time; absent when the screen measured none. */
  readonly activeMs?: number;
}

/**
 * Take the snapshot a sitting's delta is measured against. Call it before the
 * sitting's write. Never rejects: a snapshot that cannot be read makes the
 * settle answer null, and the write itself is never held back.
 */
export async function beginSettle(): Promise<SettleToken> {
  settleEpoch += 1;
  const marker = { openedAt: environment.now() };
  openSettles.add(marker);
  const scope = scopeGeneration();
  const uid = activeUserId();
  let before: Snapshot | null = null;
  if (uid !== null) before = await safely(() => snapshot(), null);
  return { scope, uid, before, marker };
}

type Listener = (delta: GameDelta) => void;
const settledListeners = new Set<Listener>();

/**
 * Hear every sitting once it has settled. The reminder planner re-plans from
 * it (a practice skips today's reminder), and the provider refreshes the hooks.
 */
export function onSettled(listener: Listener): () => void {
  settledListeners.add(listener);
  return () => {
    settledListeners.delete(listener);
  };
}

/** The bonus key for a win nothing grades, or null. One key, one +5, however many devices see it. */
export function bonusKeyFor(source: SittingSource, at: number, xpEarned: number, day: DayKey): string | null {
  if (source === 'phrase') return `phrase:${day}`;
  if (source === 'guest') return `guest:${day}`;
  if (source === 'review' && xpEarned <= 0) return `review:${Math.floor(at)}`;
  return null;
}

/** A measured active time the game store will hold, or undefined. */
function sittingActiveMs(value: number | undefined): number | undefined {
  const clean = cleanActiveMs(value);
  return clean === undefined || clean > MAX_SITTING_ACTIVE_MS ? undefined : clean;
}

/** The activity kind a source writes, or null for a source that never writes an entry. */
function activityKindOf(source: SittingSource): ActivityKind | null {
  return source === 'convo' || source === 'lesson' || source === 'drill' || source === 'review' ? source : null;
}

/** Entries on disk now that were not in the snapshot, by the log's own identity `(at, kind, xp)`. */
function entriesAdded(before: readonly ActivityEntry[], after: readonly ActivityEntry[]): ActivityEntry[] {
  const held = new Map<string, number>();
  for (const entry of before) {
    const id = `${entry.at}|${entry.kind}|${entry.xp}`;
    held.set(id, (held.get(id) ?? 0) + 1);
  }
  const added: ActivityEntry[] = [];
  for (const entry of after) {
    const id = `${entry.at}|${entry.kind}|${entry.xp}`;
    const left = held.get(id) ?? 0;
    if (left > 0) held.set(id, left - 1);
    else added.push(entry);
  }
  return added;
}

/**
 * What this sitting's entry added to the shown total, under the one shown cap.
 *
 * `xpCreditedFor` against the log as it stood before, and never more than the
 * capped total of the entry's own local day actually rose, so a sitting that
 * shared its day with another write can claim only what the day gained. Only
 * that day is compared: the write that adds an entry also drops entries older
 * than 400 days, so the whole log's total can fall while this sitting's day
 * rises, and comparing it would call an uncapped sitting capped. Zero when no
 * entry of this sitting landed: a replay credits nothing twice.
 */
function creditedXp(source: SittingSource, earned: number, before: readonly ActivityEntry[], after: readonly ActivityEntry[]): { counted: number; landed: boolean } {
  const kind = activityKindOf(source);
  if (earned <= 0 || kind === null) return { counted: 0, landed: false };
  const entry = entriesAdded(before, after).find((added) => added.kind === kind && added.xp === earned);
  if (entry === undefined) return { counted: 0, landed: false };
  const day = localDayKey(entry.at);
  const onDay = (log: readonly ActivityEntry[]) => log.filter((held) => localDayKey(held.at) === day);
  const gained = Math.max(0, totalXp(onDay(after)) - totalXp(onDay(before)));
  return { counted: Math.min(earned, xpCreditedFor(before, entry), gained), landed: true };
}

function restoredByOf(covers: readonly StreakCover[], view: GameView): CoverKind | null {
  if (covers.some((cover) => cover.kind === 'repair')) return 'repair';
  const bridged = covers.find((cover) => view.streak.coveredInRun.some((held) => held.day === cover.day));
  return bridged?.kind ?? null;
}

/**
 * The day a sitting's facts are worked out for. Today, unless the sitting
 * finished yesterday within the last `SETTLE_HOLD_MS`: one that ended at 23:59
 * and is settled a moment after midnight. Anything from yesterday settled any
 * later (a plan retried in the morning, a guest practice kept the next day)
 * settles against today, so it never deals or claims quests for a day the
 * learner has already left, or one their account did not exist on.
 */
function factsDayFor(at: number, now: number): DayKey {
  const today = localDayKey(now);
  const finished = localDayKey(at);
  if (finished === today) return today;
  return finished === addDays(today, -1) && now - at <= SETTLE_HOLD_MS ? finished : today;
}

async function settleNow(token: SettleToken, sitting: SittingFacts): Promise<GameDelta | null> {
  const env = environment;
  const uid = token.uid;
  const before = token.before;
  const live = () => uid !== null && token.scope === scopeGeneration() && activeUserId() === uid;
  if (!live() || uid === null || before === null) return null;
  if (!isSittingSource(sitting.source) || !Number.isFinite(sitting.at) || sitting.at <= 0 || !Number.isFinite(sitting.xpEarned)) return null;

  const now = env.now();
  const at = Math.floor(sitting.at);
  // A sitting from a clock far ahead is not one this phone can vouch for, and the store would refuse its rows.
  if (at > now + DAY_MS) return null;
  const sittingDay = localDayKey(at);
  const day = factsDayFor(at, now);
  const earned = Math.max(0, Math.floor(sitting.xpEarned));
  const activeMs = sittingActiveMs(sitting.activeMs);
  const local = await safely(() => loadGameLocal(), null);
  const introduced = local !== null && local.introducedAt !== null;

  // 1. The day. A sitting with XP carries it on its activity entry already;
  //    one without has it from its own write, checked here, and a game row.
  if (earned === 0) {
    const days = await loadActiveDays();
    if (!live()) return null;
    if (!days.includes(sittingDay) && (await recordActiveDay(at)) !== 'durable') return null;
    if (!live()) return null;
    await appendSitting(activeMs === undefined ? { at, source: sitting.source } : { at, source: sitting.source, activeMs });
  }

  // 2. The fixed +5 for a win nothing grades, once per key.
  let bonusXp = 0;
  const bonusKey = bonusKeyFor(sitting.source, at, earned, sittingDay);
  if (bonusKey !== null) {
    const held = await loadGame();
    if (!live()) return null;
    if (!held.bonus.some((row) => row.key === bonusKey) && (await addBonus([{ key: bonusKey, xp: PRACTISE_BONUS_XP, at: now }])) === 'durable') {
      bonusXp = PRACTISE_BONUS_XP;
    }
  }

  // 3. Covers, goal, quests, rollups, badges.
  const done = await reconcileGame({
    uid,
    today: day,
    now,
    mode: 'practice',
    ...(sitting.source === 'guest' ? {} : { offsetNow: utcOffsetMinutesAt(at) }),
    awardBadges: introduced,
    // The guest hand-off runs before the app has read the plan or the
    // microphone, so it would deal the day's three blind and freeze them; the
    // provider's first catch-up deals them instead.
    dealQuests: sitting.source !== 'guest',
    live,
  });
  if (done === null || !live()) return null;

  // 4. The delta, from what is on disk now against the snapshot.
  const after = done.view;
  const beforeView = gameViewFrom({ ...before, outside: done.facts.outside, billing: done.facts.billing }, day);
  const restoredBy = restoredByOf(done.covers, after);
  // A milestone is one this sitting's own practice day crossed. A freeze, a
  // travel day or a repair written in this settle only brings back a run the
  // learner already had, so the run is measured as it stood once every cover
  // now held had bridged it, before this sitting's day: a 10-day run brought
  // back by a freeze is 10 going to 11, never 0 going to 11, and the 7 it
  // passed last week is not news.
  const bridged = streakFrom({ practiceDays: before.practiceDays, covers: [...before.game.covers, ...done.facts.game.covers], today: day });
  const ids: readonly QuestId[] = after.quests.ids ?? [];
  const claimedNow = new Set(done.claims.map((claim) => claim.questId));
  const credit = creditedXp(sitting.source, earned, before.activity, done.facts.activity);
  const delta: GameDelta = {
    key: `sitting:${sitting.source}:${at}`,
    source: sitting.source,
    at,
    activeMs: activeMs ?? null,
    xp: {
      earned,
      counted: credit.counted,
      capped: credit.landed && credit.counted < earned,
      bonus: bonusXp,
      questXp: done.claims.reduce((sum, claim) => sum + claim.xp, 0),
      totalBefore: beforeView.xp.total,
      totalAfter: after.xp.total,
    },
    goal: {
      target: after.goal.target,
      minutesBefore: beforeView.goal.minutes,
      minutesAfter: after.goal.minutes,
      metNow: after.goal.met && !beforeView.goal.met,
    },
    streak: {
      before: beforeView.streak,
      after: after.streak,
      extendedNow: (beforeView.streak.today === 'open' && after.streak.today === 'practised') || restoredBy === 'repair',
      milestone: milestoneCrossed(bridged.current, after.streak.current),
      restoredBy,
    },
    quests: {
      completedNow: ids.filter((id) => claimedNow.has(id)),
      done: after.quests.done,
      // From the merged facts this settle read back, less its own claims, never
      // from the snapshot: a quest another phone finished counts as done before,
      // even one that synced in while this sitting ran, so the day's third quest
      // is announced once (D22).
      doneBefore: questsDoneOf(after.quests.ids, after.quests.claimed.filter((id) => !claimedNow.has(id))),
    },
    level: { before: beforeView.level.level, after: after.level.level },
    badges: done.badges,
  };

  // 5. The moments, queued on this phone and handed to the host. Nothing plays
  //    on a phone the seed has not introduced yet.
  const events: CelebrationEvent[] = introduced
    ? eventsFromDelta(delta, 'account', day).filter((event) => !seenIn(done.facts.game, event.key) && !publishedThisLaunch.has(event.key))
    : [];
  if (events.length > 0 && live()) {
    await safely(() => enqueueCelebrations(events.map((event) => ({ key: event.key, at: now }))), 'failed' as PersistAck);
    for (const event of events) publishedThisLaunch.add(event.key);
    publishCelebrations(events);
  }
  for (const listener of settledListeners) {
    try {
      listener(delta);
    } catch {
      // A listener's failure is its own; the sitting is settled.
    }
  }
  return delta;
}

const finishedTokens = new WeakSet<SettleToken>();

/**
 * Settle a sitting whose write has landed, measured against `token`. Null when
 * the account changed, the snapshot could not be read, the facts could not be,
 * or this token was already used. Safe to repeat for one sitting with a fresh
 * token: every write is keyed, so the second settle changes nothing and
 * reports nothing new.
 */
export function finishSettle(token: SettleToken, sitting: SittingFacts): Promise<GameDelta | null> {
  if (finishedTokens.has(token)) return Promise.resolve(null);
  finishedTokens.add(token);
  return onSettleChain(async () => {
    try {
      return await settleNow(token, sitting);
    } catch {
      return null;
    } finally {
      openSettles.delete(token.marker);
    }
  });
}

/** Give up a token whose sitting will not be settled, so the quiet catch-up need not wait for it. */
export function releaseSettle(token: SettleToken): void {
  finishedTokens.add(token);
  openSettles.delete(token.marker);
}

/**
 * True when the account the token was taken for is still the active one. A
 * caller that awaited `beginSettle` checks this before its own write: the
 * stores bind a write to the account active when it is asked for, so a write
 * started after a sign-out mid-snapshot would land in whoever is signed in now.
 */
export function settleStillLive(token: SettleToken): boolean {
  return token.scope === scopeGeneration() && activeUserId() === token.uid;
}

/**
 * Begin, write, finish. `write` is the sitting's own record (its activity
 * entry, with `finished: true`); a write that does not land settles nothing,
 * and neither does one whose account changed while the snapshot was read: the
 * write is never started, as it would have been refused before the snapshot
 * existed (`clearActiveUserData`: a write asked for before a reset never lands
 * after it).
 */
export async function settleSitting(sitting: SittingFacts & { write: () => Promise<PersistAck> }): Promise<GameDelta | null> {
  const token = await beginSettle();
  if (!settleStillLive(token)) {
    releaseSettle(token);
    return null;
  }
  let ack: PersistAck;
  try {
    ack = await sitting.write();
  } catch {
    ack = 'failed';
  }
  if (ack !== 'durable') {
    releaseSettle(token);
    return null;
  }
  return finishSettle(token, { source: sitting.source, at: sitting.at, xpEarned: sitting.xpEarned, ...(sitting.activeMs === undefined ? {} : { activeMs: sitting.activeMs }) });
}
