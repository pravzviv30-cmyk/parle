/**
 * The two quiet passes over the game layer: the one-time seed for a learner
 * who had practice before this layer existed (F745), and the catch-up that runs
 * when the app comes back to the foreground.
 *
 * Quiet means nothing takes over the screen. Both mark what is already true as
 * seen, so a level, badge or milestone the learner already has never bursts
 * onto the screen as news (game.md 3.6 and 5). The one exception is a durable
 * moment a settle on this phone handed to the host and a crash cut short
 * before it played: that plays once (motion-sound.md 4.3, "Durable catch-up").
 * A moment a settle published in this launch is left alone; the host has it.
 *
 * Both run on the settle chain, so neither can mark a moment seen between a
 * sitting's write and its settle, and the catch-up does nothing while a sitting
 * is between `beginSettle` and `finishSettle` (the next foreground runs it).
 * A sitting that begins while the catch-up is already running stops it too:
 * the catch-up reads `settleEpochNow()` when it starts and writes nothing more,
 * claims nothing and marks nothing seen once that has moved, so a sitting whose
 * write lands under the catch-up's reads still celebrates its own moments.
 */

import { FREEZE_CAP, localDayKey, newBadges } from '@luvani/core';

import { publishCelebrations, type CelebrationEvent } from '../celebrate/events.ts';
import { activeUserId, onUserScopeReset, scopeGeneration } from '../storage/scope.ts';
import { durableEventFor } from './events.ts';
import { dropCelebrations, loadGameLocal, markIntroduced, setPaidSince, setProtectedSince } from './gameLocal.ts';
import { isDaySeenKey, seenIn, type BadgeAward } from './model.ts';
import {
  gameEnvironment,
  onSettleChain,
  publishedInThisLaunch,
  readGameFacts,
  reconcileGame,
  settleEpochNow,
  settleInFlight,
} from './settle.ts';
import { awardBadges, markSeen, raiseXpMonths } from './store.ts';
import {
  activityMonths,
  badgeFactsFrom,
  currentMomentKeys,
  finishedOfKind,
  gameViewFrom,
  protectionOf,
  type GameFacts,
  type GameView,
} from './view.ts';

async function safely<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

/** What the one intro sheet says, or null when there is nothing to introduce. */
export interface IntroFacts {
  current: number;
  level: number;
}

/**
 * The account has been introduced to this layer, on some phone, or its first
 * practice arrived through the first run, where the flame already lit. A
 * durable key in the synced `seen` list (never aged out, see `isDaySeenKey`),
 * so the one-time sheet is one time per account and not once per phone.
 */
export const INTRO_SEEN_KEY = 'intro';

/**
 * Pure: whether the one-time "Your streak and level" sheet is worth showing.
 * Only to a learner with practice days to be told about (review finding 14),
 * and only when the account was never introduced: the sheet's words, "counted
 * from the practice already saved on your account", are about practice from
 * before this layer, never about a practice kept a moment ago.
 */
export function shouldShowIntro(view: Pick<GameView, 'streak'>, introducedBefore: boolean): boolean {
  return view.streak.lifetimeDays > 0 && !introducedBefore;
}

/**
 * A badge counted from practice already saved, dated from the data when the
 * data says when, and otherwise left undated ("counted from practice already
 * saved"). No date is ever invented.
 */
function datedFromData(id: string, facts: GameFacts): number | null {
  if (id === 'first-conversation') {
    const finished = finishedOfKind(facts, 'convo');
    return finished.length === 0 ? null : Math.min(...finished);
  }
  return null;
}

/**
 * Seed a learner the first time this layer runs on this phone
 * (`gameLocal.introducedAt` absent): badges already earned, the monthly XP
 * rollups, and every current moment marked seen. No cover is written. A paid
 * subscriber starts with both freezes from today. Null when the seed did not
 * land (it runs again next time) or there is nothing to introduce.
 *
 * The intro sheet's facts are answered only for a learner who has practice
 * days (review finding 14) and whose account was never introduced: a
 * brand-new learner is introduced silently, and so is one whose account was
 * introduced on another phone first, or whose first practice was a guest
 * practice kept at sign-up. Either way the account is marked introduced.
 */
export function seedExistingLearner(): Promise<IntroFacts | null> {
  return onSettleChain(async () => {
    const uid = activeUserId();
    const scope = scopeGeneration();
    const live = () => uid !== null && scope === scopeGeneration() && activeUserId() === uid;
    if (uid === null) return null;
    const env = gameEnvironment();
    const now = env.now();
    const today = localDayKey(now);
    const local = await safely(() => loadGameLocal(), null);
    if (local === null || local.introducedAt !== null) return null;

    const billing = await safely(() => env.billing(), null);
    const outside = await env.outside(today, now);
    let facts = await safely(() => readGameFacts(outside, billing), null);
    if (facts === null || !live()) return null;
    const introducedBefore = seenIn(facts.game, INTRO_SEEN_KEY);
    let view = gameViewFrom(facts, today);

    const earned = newBadges(badgeFactsFrom(facts, view), facts.game.badges.map((badge) => badge.id));
    const awards: BadgeAward[] = earned.map((id) => ({ id, at: datedFromData(id, facts!) }));
    if (awards.length > 0 && (await awardBadges(awards)) !== 'durable') return null;
    const months = activityMonths(facts.activity);
    if (!live()) return null;
    if (months.length > 0 && (await raiseXpMonths(months)) !== 'durable') return null;
    // From the day of the update: two freezes for a paid plan, the free plan's one (D23).
    const protection = protectionOf(billing);
    if (protection !== null && protection.cap >= FREEZE_CAP && local.paidSince === null && live()) await setPaidSince(today);
    if (protection?.freezes === true && local.protectedSince === null && live()) await setProtectedSince(today);

    facts = await safely(() => readGameFacts(outside, billing), null);
    if (facts === null || !live()) return null;
    view = gameViewFrom(facts, today);
    const keys = [INTRO_SEEN_KEY, ...currentMomentKeys(view).filter((key) => !publishedInThisLaunch(key))];
    if ((await markSeen(keys.map((key) => ({ key, at: now })))) !== 'durable') return null;
    if (!live() || (await markIntroduced(now)) !== 'durable') return null;
    return shouldShowIntro(view, introducedBefore) ? { current: view.streak.current, level: view.level.level } : null;
  });
}

export interface CatchUpPlan {
  /** Mark seen without playing. */
  quiet: string[];
  /** Durable moments a crash cut short: play once. */
  replay: string[];
  /** Drop from this phone's pending queue. */
  drop: string[];
}

/**
 * Pure: what the quiet catch-up does with each moment.
 *
 * - Already seen: nothing, and dropped from pending.
 * - Published in this launch: the host has it; left alone.
 * - Pending from an earlier launch, durable, current and not yet replayed in
 *   this launch: played once.
 * - Anything else that is true now, or left pending and no longer current:
 *   marked seen quietly.
 */
export function catchUpPlan(input: {
  current: readonly string[];
  seen: ReadonlySet<string>;
  pending: readonly string[];
  published: (key: string) => boolean;
  replayed: ReadonlySet<string>;
}): CatchUpPlan {
  const quiet = new Set<string>();
  const replay = new Set<string>();
  const drop = new Set<string>();
  const pending = new Set(input.pending);
  for (const key of input.current) {
    if (input.seen.has(key)) {
      if (pending.has(key)) drop.add(key);
      continue;
    }
    if (input.published(key)) continue;
    if (pending.has(key) && !isDaySeenKey(key)) {
      if (!input.replayed.has(key)) replay.add(key);
      continue;
    }
    quiet.add(key);
  }
  for (const key of pending) {
    if (input.published(key) || replay.has(key) || input.replayed.has(key)) continue;
    if (input.seen.has(key)) {
      drop.add(key);
      continue;
    }
    if (!input.current.includes(key)) quiet.add(key);
  }
  for (const key of quiet) if (pending.has(key)) drop.add(key);
  return { quiet: [...quiet], replay: [...replay], drop: [...drop] };
}

const replayedThisLaunch = new Set<string>();
onUserScopeReset(() => replayedThisLaunch.clear());

/**
 * Recompute quietly: spend a freeze the learner is owed, deal today's quests,
 * claim any quest already done, raise the rollups, award badges, and mark what
 * is true now as seen. Returns the durable moments it replayed (at most once
 * each per launch). Does nothing until the seed has run, and nothing while a
 * sitting is settling.
 */
export function catchUpQuietly(): Promise<CelebrationEvent[]> {
  return onSettleChain(async () => {
    const uid = activeUserId();
    const scope = scopeGeneration();
    // Read synchronously, before any await: a sitting that begins after this
    // line raises the epoch, and from then on this pass writes nothing more.
    const epoch = settleEpochNow();
    const live = () => uid !== null && scope === scopeGeneration() && activeUserId() === uid && settleEpochNow() === epoch;
    if (uid === null) return [];
    const env = gameEnvironment();
    const now = env.now();
    if (settleInFlight(now)) return [];
    const local = await safely(() => loadGameLocal(), null);
    if (local === null || local.introducedAt === null) return [];
    const done = await safely(() => reconcileGame({ uid, today: localDayKey(now), now, mode: 'quiet', awardBadges: true, dealQuests: true, live }), null);
    if (done === null || !live()) return [];

    const plan = catchUpPlan({
      current: currentMomentKeys(done.view),
      seen: new Set(done.facts.game.seen.map((mark) => mark.key)),
      pending: local.pending.map((row) => row.key),
      published: publishedInThisLaunch,
      replayed: replayedThisLaunch,
    });
    if (plan.quiet.length > 0 && live()) await markSeen(plan.quiet.map((key) => ({ key, at: now })));
    if (plan.drop.length > 0 && live()) await dropCelebrations(plan.drop);
    const events = plan.replay
      .map((key) => durableEventFor(key, done.view, 'account', now))
      .filter((event): event is CelebrationEvent => event !== null);
    if (events.length > 0 && live()) {
      for (const event of events) replayedThisLaunch.add(event.key);
      publishCelebrations(events);
    }
    return events;
  });
}
