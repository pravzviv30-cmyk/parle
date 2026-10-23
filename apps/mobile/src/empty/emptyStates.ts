/**
 * The words of the B-Empty-States cards that a screen decides from data
 * (DECISIONS.md UI-008, 2026-10-21). Pure, so `emptyStates.test.ts` in this
 * folder holds them.
 *
 * "Out of speaking time" is drawn on Speak only when the server said the free
 * plan cannot start a session now. Its refill is the plan band's own line
 * ("Your next free conversation is ready on Thursday at 4:10 pm.", REV-001),
 * never a time this file works out,
 * and its door is the plans, in Phase B's words: a store free trial is the
 * store's offer and is not promised here.
 */

import { PLAN_LABELS, type PlanStatusView } from '../purchases/planStatus.ts';
import { PLANS_LEAD } from '../home/nextAction.ts';

/** The drawings, at the artboard's sizes. Kept here so a screen reads a name rather than spelling one. */
export const AWAY_ART = { name: 'coffee-break', width: 150, height: 137 } as const;
export const OUT_OF_TIME_ART = { name: 'clock-calendar', width: 140, height: 124 } as const;
/** The empty phrase, conversation and memory pages (no artboard of their own; the B card with the phrasebook drawing). */
export const NOTEBOOK_ART = { name: 'phrasebook', width: 150 } as const;
export const ALL_DONE_ART = { name: 'cloud-cheer', width: 150, height: 114 } as const;

export const OUT_OF_TIME = {
  title: "You've used your free conversation",
  still: 'Practice, review and your phrases are all still here.',
  action: PLANS_LEAD.action,
} as const;

/** The card's words, or null when the learner can still speak or the plan is not the free one. */
export function outOfTimeCard(view: PlanStatusView | null): { title: string; body: string; action: string } | null {
  if (view === null || !view.known || view.planLabel !== PLAN_LABELS.trial || view.band !== 'none') return null;
  return { title: OUT_OF_TIME.title, body: `${view.bandLine} ${OUT_OF_TIME.still}`, action: OUT_OF_TIME.action };
}
