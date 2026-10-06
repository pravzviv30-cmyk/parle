/**
 * What a first-run guest has, as plain data (come alive, first run section 3.7).
 *
 * Pure: no storage, no network and no renderer, so the rules here are tested
 * directly and every screen that needs one of them asks this module rather than
 * deciding for itself.
 *
 * - `starterMinutes`: the daily goal a learner chose, as the starter service and
 *   `starterTasks` know it. The goal page offers Intense, twenty minutes a day
 *   (founder decision D5); the service validates 5, 10, 15 and "choose each
 *   time", and a twenty-minute goal runs the same three exchanges as fifteen.
 *   Every path that sends minutes or builds the starter tasks goes through here,
 *   so a twenty never reaches the server and is never refused there.
 * - `keptPhrase`: the line a kept first-run phrase stores. Always the task's
 *   natural line, never what the learner typed or what a recogniser heard: an
 *   accepted reply is checked against a short list of authored answers, not for
 *   spelling, so the learner's own words can carry a typo into the phrasebook
 *   and onto Home (F757).
 */

import type { StarterTask } from '@luvani/core';
import type { PlanMinutes } from './preAccountDraft.ts';

/** The minutes the starter service and `starterTasks` accept. */
export type StarterMinutes = 5 | 10 | 15 | 'none';

/** The chosen daily goal as the starter knows it: twenty runs as fifteen, nothing chosen runs as five. */
export function starterMinutes(minutes: PlanMinutes | null | undefined): StarterMinutes {
  if (minutes === 20) return 15;
  return minutes ?? 5;
}

/** The French a kept first-run phrase saves: the task's natural line (F757). */
export function keptPhrase(task: Pick<StarterTask, 'model'>): string {
  return task.model;
}
