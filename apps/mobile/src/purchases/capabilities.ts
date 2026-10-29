/**
 * What a plan opens, said in one place (F564, F565).
 *
 * The server gates minutes and nothing else. Everything a learner has earned
 * is theirs whatever they pay: the packs, the phrases, the missions, the
 * drills, the review, the tutor's memory. What a paid plan adds is live
 * minutes, and on Max the two doors that exist only because of this table:
 * bringing a real moment to rehearse, and continuing a conversation as a
 * thread across sessions. A screen that gates a door asks here, and the plans
 * page lists only what this table opens, so nothing is marketed that the app
 * does not actually do.
 *
 * An unknown plan reads as the free plan, with one difference: it holds no
 * streak freeze, because a freeze applied while nobody could check the plan is
 * a perk the plan may not hold. The status read can fail, and a door that
 * opened because nobody could check is a door that lies about the plan. A
 * lapsed plan reads as the free plan too, because that is what the server
 * holds for it: a weekly taste standing where a paid period used to (D24).
 *
 * D24 (2026-10-20, the Headspace model) adds `unlocks`: the features the free
 * plan shows as locked and a plan or the store's trial opens. They are
 * presentation locks, read through `featureLocks.ts`; the server still meters
 * every live minute whatever this table says.
 */

import type { Plan } from '@luvani/core';

/**
 * The D24 features a free learner sees locked, in the order of direction B's
 * seam (`access/featureAccess.ts`). Defined here so the table below owns what
 * each plan opens; `featureLocks.ts` re-exports it for every surface.
 */
export const LOCKED_FEATURES = [
  /** Your fixes. */
  'fixes',
  /** Then and now. */
  'thenAndNow',
  /** Review and drills of conversation phrases. */
  'conversationPractice',
  /** Your sounds. */
  'sounds',
  /** Prepare for something real. */
  'realMoment',
  /** Continue an arc, and the same-scene replay. */
  'continueArc',
  /** The full Journey. */
  'fullJourney',
  /** What the tutor remembers. */
  'tutorMemory',
] as const;

export type LockedFeature = (typeof LOCKED_FEATURES)[number];

export type PlanTier = Plan | 'unknown';

/**
 * Streak freezes and the one-tap repair (founder decision D4, 2026-10-05).
 *
 * Two freezes and the repair on either paid tier, monthly or yearly, and during
 * the store's free trial too, because the server answers that trial as the
 * plan itself. The free plan and a lapsed plan hold one freeze and no repair
 * (D23, 2026-10-20). An unknown plan holds none. This says what a plan opens
 * and nothing about a learner's streak; the game layer decides when a freeze
 * is spent.
 */
export interface StreakProtection {
  /** How many freezes the plan holds. */
  freezes: number;
  repair: boolean;
}

export interface Capabilities {
  liveMinutes: 'trial' | 'starter' | 'max';
  /** Earned learning is never gated. Typed true so a gate cannot be written. */
  packs: true;
  savedPhrases: true;
  missions: true;
  memory: true;
  customRehearsal: boolean;
  continueArc: boolean;
  streakProtection: StreakProtection;
  /** The D24 features this plan opens. Every key, every plan. */
  unlocks: Readonly<Record<LockedFeature, boolean>>;
}

const EARNED = { packs: true, savedPhrases: true, missions: true, memory: true } as const;

/** What an unlapsed paid plan holds. Two freezes is D4's number, not a store's. */
const PAID_PROTECTION: StreakProtection = { freezes: 2, repair: true };
/** What the free plan holds (D23): one freeze, no repair. */
const FREE_PROTECTION: StreakProtection = { freezes: 1, repair: false };
const NO_PROTECTION: StreakProtection = { freezes: 0, repair: false };

const unlocksWhere = (open: (feature: LockedFeature) => boolean): Readonly<Record<LockedFeature, boolean>> =>
  Object.fromEntries(LOCKED_FEATURES.map((feature) => [feature, open(feature)])) as Record<LockedFeature, boolean>;

/** Core opens every lock but the two Max doors, which stay Max's as before. */
const MAX_ONLY: ReadonlySet<LockedFeature> = new Set(['realMoment', 'continueArc']);

export function capabilitiesFor(plan: PlanTier, lapsed = false): Capabilities {
  if (plan === 'regular' && !lapsed) return { ...EARNED, liveMinutes: 'max', customRehearsal: true, continueArc: true, streakProtection: { ...PAID_PROTECTION }, unlocks: unlocksWhere(() => true) };
  if (plan === 'starter' && !lapsed) return { ...EARNED, liveMinutes: 'starter', customRehearsal: false, continueArc: false, streakProtection: { ...PAID_PROTECTION }, unlocks: unlocksWhere((f) => !MAX_ONLY.has(f)) };
  const protection = plan === 'unknown' ? NO_PROTECTION : FREE_PROTECTION;
  return { ...EARNED, liveMinutes: 'trial', customRehearsal: false, continueArc: false, streakProtection: { ...protection }, unlocks: unlocksWhere(() => false) };
}

/**
 * What each plan opens, for the plans page, in words a learner reads under
 * the minutes the page already draws from the catalogue. No digit here: the
 * wall's copy rule forbids one, and the minutes are the page's own numeral.
 */
export const INCLUSIONS = {
  packs: 'Every conversation becomes a pack of phrases and practice',
  phrases: 'The phrases you earn stay yours',
  memory: 'Your tutor remembers you between conversations',
  missions: 'Every everyday situation',
  rehearsal: 'Bring a real moment of your own to rehearse',
  arcs: 'Continue a conversation across sessions',
  maxCompact: 'Rehearse your moments + continue conversations.',
  /**
   * Streak protection, said once on the plans page for every plan on it (F734,
   * D4, D23). True of both paid tiers, monthly or yearly and during the store's
   * free trial, because `streakProtection` above opens two freezes and the
   * repair for any unlapsed paid plan; the free plan holds one freeze and no
   * repair, so this is not a line of `planInclusions`, which the free plan
   * shares with Core.
   */
  streak: 'Paid plans add a second streak freeze and a one-tap repair.',
} as const;

export function planInclusions(plan: Plan): readonly string[] {
  const shared = [INCLUSIONS.packs, INCLUSIONS.phrases, INCLUSIONS.memory, INCLUSIONS.missions];
  if (plan === 'regular') return [...shared, INCLUSIONS.rehearsal, INCLUSIONS.arcs];
  return shared;
}

/** Every line this module can say, for the copy sweeps. */
export const CAPABILITY_COPY: readonly string[] = Object.values(INCLUSIONS);
