/**
 * The passport — the situations this learner can walk into on their own.
 *
 * A learner who comes back after a fortnight has one question, and it is not
 * how many words they know. It is "what can I actually do now". The passport
 * answers it in the only currency the product has ever promised: one stamp per
 * situation they got through unaided. Café. Hotel. Market. The stamps are the
 * page, and the page is the evidence.
 *
 * ## Nothing here is new
 *
 * This is not a feature that computes something. Every judgement it needs is
 * already made and already owned: `independenceFrom` says how much help was
 * still in play, `missionStates` says where each scene stands, and the mission
 * catalogue names the place. This file is the projection those three have
 * always been fragments of, in the shape a screen can draw.
 *
 * That is also why it is here and not in `packages/core`. A `buildPassport`
 * next to `missionStates` would be a second projection of one set of facts, and
 * the two would part company the first time one of them was tuned. Decisions
 * and copy in a `.ts`, rendering in the `.tsx`, is the same arrangement as
 * `missions/chooserView.ts` and `phrases/phrasebook.ts`.
 *
 * There is no store, and there must not be one. `sync/policy.ts` states the
 * rule outright — "Nothing is recomputed. No mastery, no interval, no CEFR
 * estimate, no independence rung" — and a saved passport would be exactly that:
 * a copy of a derived value that two devices could disagree about. `stampsFrom`
 * takes what the caller already has and returns a value. Nothing is written.
 *
 * ## Three states, when the ladder has five
 *
 * `Independence` keeps its five, because the ladder is the scale for how much
 * support a turn gets and it is the only one. The learner's question at this
 * screen is narrower and nearly binary: can I do this on my own, or not yet.
 * So the three middle rungs fold into one, and the fold happens here, in the
 * view, rather than in the scale. Project, never replace.
 *
 * ## Why a replay can never cost a stamp
 *
 * The state is read off `progress.independence`, which is `independenceFrom` —
 * the best a learner has ever managed, not the most recent. `lastRung` is right
 * there on the same record and reading it would be the whole bug: a scene
 * replayed on a tired Thursday with the tutor handing over lines would quietly
 * un-stamp a Monday that actually happened, and every replay would become a
 * risk. Phase 6a is about to ship a replay that deliberately asks for less
 * help. A stamp records that something happened, and coming back cannot make it
 * un-happen.
 *
 * The same reasoning covers a mission the scheduler wants back. `needs-review`
 * is about phrases going quiet, not about the afternoon in the café: dueness
 * expires and evidence does not (`review/evidence.ts`). The nudge to return is
 * `missionStatus`'s job on the card. The stamp stays.
 *
 * ## What is deliberately not on a stamp
 *
 * No total, no share, no "3 of 6", and no count of lines owned. Partly because
 * a rendered fraction is the guilt mechanic PRODUCT.md has refused twice, and
 * partly because the number would not even be true: `evidence.ts` grandfathers
 * older cards on `reps >= 1`, so any per-mission tally is untrustworthy on a
 * deck that predates it. The phrasebook already answers "which lines are mine".
 * The fields are absent rather than merely unused, so the fraction is not
 * available to be rendered by someone who has not read this comment.
 *
 * And nothing renders at zero: `hasStamps` is the gate, on `today.ts`'s rule
 * that a rail of empty marks is a quota, and a quota you have not met at eleven
 * at night is guilt wearing a different hat. An empty passport is an
 * invitation, which the screen already carries. It is not a page of blanks.
 */

import type { Independence, MissionId, MissionPlace, MissionProgress } from '@luvani/core';

/** The three states in order, weakest evidence first. Exported so tests can walk them. */
export const STAMP_STATES = ['not-yet', 'with-help', 'on-your-own'] as const;

export type StampState = (typeof STAMP_STATES)[number];

export interface Stamp {
  missionId: MissionId;
  /** Where it happened, so the row can carry the mission's own art. */
  place: MissionPlace;
  /** The situation in the learner's language, e.g. "Order at a café". */
  titleEn: string;
  state: StampState;
}

/**
 * The fold, written out per rung rather than as a comparison.
 *
 * A `Record` over the union means adding a sixth rung to `Independence` fails
 * this file's typecheck instead of silently landing in whichever branch an
 * inequality happened to put it.
 */
const STATE_BY_INDEPENDENCE: Record<Independence, StampState> = {
  new: 'not-yet',
  'with-help': 'with-help',
  'getting-there': 'with-help',
  'mostly-yours': 'with-help',
  'on-your-own': 'on-your-own',
};

/**
 * One stamp per situation, in the order the caller gave them.
 *
 * Every mission is here, including the untouched ones, because the passport is
 * a page of places rather than a list of achievements — the ones not yet
 * visited are what makes it a passport. Which of them are drawn, and how, is
 * the screen's decision; this only says which state each is in.
 */
export function stampsFrom(progress: readonly MissionProgress[]): readonly Stamp[] {
  return progress.map((item) => ({
    missionId: item.mission.id,
    place: item.mission.place,
    titleEn: item.mission.titleEn,
    // `independence` is best-ever by construction. `item.lastRung` is not.
    state: STATE_BY_INDEPENDENCE[item.independence],
  }));
}

/** Earned: this situation was handled with nothing handed over. */
export function isStamped(stamp: Stamp): boolean {
  return stamp.state === 'on-your-own';
}

/** True when the passport has something on it. False means the screen draws none of it. */
export function hasStamps(stamps: readonly Stamp[]): boolean {
  return stamps.some(isStamped);
}

/**
 * What one mark means, said in words.
 *
 * Written for a screen reader first, which is why it names the situation rather
 * than assuming the row above was read. It is not a second copy of
 * `missionStatus`: that line says what to do with a scene next, this one says
 * what the mark beside it is claiming.
 *
 * `not-yet` gets an open door and never a report on an absence, on `TodayRow`'s
 * rule that a thing which has not happened is not a state worth signalling.
 */
const LINE: Record<StampState, string> = {
  'not-yet': 'ready when you are',
  'with-help': 'you have been through this one with help',
  'on-your-own': 'you handled this one on your own',
};

export function stampLabel(stamp: Stamp): string {
  return `${stamp.titleEn}: ${LINE[stamp.state]}.`;
}
