/**
 * The plan the first run builds, as data (come alive, README Part 5.C rows 1 to
 * 5). Pure, so a Node suite reads every rule:
 *
 * - `planTokens`: the slots of "Your French plan", one per answer, each empty
 *   until the learner gives that answer. A slot only ever shows an answer the
 *   learner gave; nothing is filled in for them.
 * - `GOAL_TIERS`: the four daily goals (founder decision D5) and the share of a
 *   ring each one fills, which `GoalDial` draws.
 * - `suggestedMinutes`: the tier marked "Suggested". It is derived from the
 *   learner's own earlier answers by `presetMinutes` (work and a move ask for
 *   fifteen, a beginner five, everyone else ten), never from what other people
 *   chose, and never from an answer nobody gave: where the level was not asked
 *   (the short variant) only work or a move suggest anything. Nothing is
 *   preselected: the mark is a word, not a choice.
 * - `ringShare`: the plan reveal's ring, the same share the goal's dial shows.
 *   "Choose each time" sets no target, so its ring is the empty track.
 */

import type { BulkIconName } from '../../icons/names.ts';
import type { GoalQuarters } from '../../icons/GoalDial.tsx';
import { levelOf, presetMinutes } from '../plan.ts';
import type { PlanMinutes, PreAccountOnboardingDraft, Reason, StartLevel } from '../preAccountDraft.ts';
import { FIRST_RUN_COPY } from './copy.ts';

export type GoalMinutes = 5 | 10 | 15 | 20;

export interface GoalTier {
  readonly minutes: GoalMinutes;
  readonly title: string;
  readonly quarters: GoalQuarters;
}

/** Casual, Regular, Serious, Intense: gentlest first. */
export const GOAL_TIERS: readonly GoalTier[] = [
  { minutes: 5, title: 'Casual', quarters: 1 },
  { minutes: 10, title: 'Regular', quarters: 2 },
  { minutes: 15, title: 'Serious', quarters: 3 },
  { minutes: 20, title: 'Intense', quarters: 4 },
];

/** What a goal tier says under its name. */
export function tierLine(minutes: GoalMinutes): string {
  return `${minutes} minutes a day`;
}

/** The one tier the learner's own answers point at. A true derivation, never "most common". */
export function suggestedMinutes(draft: PreAccountOnboardingDraft): GoalMinutes | null {
  // Without a level answer only the reason can point anywhere, and only work
  // and a move do; the default level is not something the learner said.
  if (draft.startLevel === null && draft.reason !== 'work' && draft.reason !== 'moving') return null;
  const preset = presetMinutes(levelOf(draft), draft.reason);
  return preset === 'none' ? null : preset;
}

/** What a screen reader says for one tier: its name, its size and, when true, that it is suggested. */
export function tierLabel(tier: GoalTier, suggested: boolean): string {
  return `${tier.title}, ${tierLine(tier.minutes)}${suggested ? ', suggested' : ''}`;
}

/** The share of the ring the plan reveal draws for a goal: a quarter per five minutes, none when no target is set. */
export function ringShare(minutes: PlanMinutes): number {
  return minutes === 'none' ? 0 : minutes / 20;
}

export type PlanSlot = 'drink' | 'reason' | 'level' | 'goal';

export interface PlanToken {
  readonly slot: PlanSlot;
  /** Short enough to sit in a slot. */
  readonly label: string;
  /** The Bulk icon it carries, or the goal's dial. */
  readonly icon?: BulkIconName;
  readonly dial?: GoalQuarters;
}

const REASON_TOKEN: Readonly<Record<Reason, { label: string; icon: BulkIconName }>> = {
  food: { label: 'Food and drinks', icon: 'food' },
  trip: { label: 'Trips', icon: 'trip' },
  family: { label: 'Friends and family', icon: 'family' },
  moving: { label: 'After a move', icon: 'moving' },
  work: { label: 'Work', icon: 'work' },
  because: { label: 'Exploring', icon: 'exploring' },
};

const LEVEL_TOKEN: Readonly<Record<StartLevel, { label: string; icon: BulkIconName }>> = {
  zero: { label: 'New to French', icon: 'bubble-empty' },
  few: { label: 'Hello and a drink', icon: 'bubble-line' },
  getby: { label: 'Short conversations', icon: 'bubbles' },
  confident: { label: 'Comfortable talking', icon: 'bubbles' },
};

/** The slots the card has: four, or three in the short variant, which never asks the level. */
export function planSlots(five: boolean): readonly PlanSlot[] {
  return five ? ['drink', 'reason', 'goal'] : ['drink', 'reason', 'level', 'goal'];
}

/** One slot's token, or null while that answer has not been given. */
export function planToken(draft: PreAccountOnboardingDraft, slot: PlanSlot): PlanToken | null {
  if (slot === 'drink') {
    if (draft.drink == null) return null;
    return { slot, label: draft.drink === 'tea' ? 'Tea' : 'Coffee', icon: draft.drink === 'tea' ? 'tea' : 'coffee' };
  }
  if (slot === 'reason') return draft.reason == null ? null : { slot, ...REASON_TOKEN[draft.reason] };
  if (slot === 'level') return draft.startLevel == null ? null : { slot, ...LEVEL_TOKEN[draft.startLevel] };
  if (draft.minutes == null) return null;
  if (draft.minutes === 'none') return { slot, label: FIRST_RUN_COPY.chooseEachTime, icon: 'clock' };
  const tier = GOAL_TIERS.find((t) => t.minutes === draft.minutes);
  return { slot, label: `${draft.minutes} min a day`, dial: tier?.quarters ?? 4 };
}

/** Every slot in order, filled or empty. */
export function planTokens(draft: PreAccountOnboardingDraft, five = false): readonly (PlanToken | null)[] {
  return planSlots(five).map((slot) => planToken(draft, slot));
}

/** The card as a screen reader hears it: what is in it, then how far along it is. */
export function planCardLabel(draft: PreAccountOnboardingDraft, five = false): string {
  const tokens = planTokens(draft, five);
  const filled = tokens.filter((t): t is PlanToken => t !== null);
  const list = filled.length > 0 ? `${filled.map((t) => t.label).join(', ')}. ` : '';
  return `${FIRST_RUN_COPY.planLabel}: ${list}${filled.length} of ${tokens.length} chosen.`;
}

/** Which slot an answer fills, by the draft field it is written to. */
export function slotFor(field: keyof PreAccountOnboardingDraft): PlanSlot | null {
  if (field === 'drink') return 'drink';
  if (field === 'reason') return 'reason';
  if (field === 'startLevel') return 'level';
  if (field === 'minutes') return 'goal';
  return null;
}
