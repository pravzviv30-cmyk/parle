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
 * An unknown plan reads as the trial. The status read can fail, and a door
 * that opened because nobody could check is a door that lies about the plan.
 * A lapsed plan reads as the trial too, because that is what the server holds
 * for it: an exhausted trial standing where a paid period used to.
 */

import type { Plan } from '@luvani/core';

export type PlanTier = Plan | 'unknown';

/**
 * Streak freezes and the one-tap repair (founder decision D4, 2026-10-05).
 *
 * A paid perk on either tier, monthly or yearly, and during the store's free
 * trial too, because the server answers that trial as the plan itself. The
 * free tier and a lapsed plan get none: a missed day resets the run and the
 * lifetime total stays. This says what a plan opens and nothing about a
 * learner's streak; the game layer decides when a freeze is spent.
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
}

const EARNED = { packs: true, savedPhrases: true, missions: true, memory: true } as const;

/** What an unlapsed paid plan holds. Two freezes is D4's number, not a store's. */
const PAID_PROTECTION: StreakProtection = { freezes: 2, repair: true };
const NO_PROTECTION: StreakProtection = { freezes: 0, repair: false };

export function capabilitiesFor(plan: PlanTier, lapsed = false): Capabilities {
  if (plan === 'regular' && !lapsed) return { ...EARNED, liveMinutes: 'max', customRehearsal: true, continueArc: true, streakProtection: { ...PAID_PROTECTION } };
  if (plan === 'starter' && !lapsed) return { ...EARNED, liveMinutes: 'starter', customRehearsal: false, continueArc: false, streakProtection: { ...PAID_PROTECTION } };
  return { ...EARNED, liveMinutes: 'trial', customRehearsal: false, continueArc: false, streakProtection: { ...NO_PROTECTION } };
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
   * D4). True of both paid tiers, monthly or yearly and during the store's free
   * trial, because `streakProtection` above opens it for any unlapsed paid
   * plan; the free minutes never hold it, so this is not a line of
   * `planInclusions`, which the free minutes share with Starter.
   */
  streak: 'Every plan includes streak freezes and a one-tap repair.',
} as const;

export function planInclusions(plan: Plan): readonly string[] {
  const shared = [INCLUSIONS.packs, INCLUSIONS.phrases, INCLUSIONS.memory, INCLUSIONS.missions];
  if (plan === 'regular') return [...shared, INCLUSIONS.rehearsal, INCLUSIONS.arcs];
  return shared;
}

/** Every line this module can say, for the copy sweeps. */
export const CAPABILITY_COPY: readonly string[] = Object.values(INCLUSIONS);
