/**
 * What came of a goal, from recorded facts joined by id (Stage 4, item 1).
 *
 * Pure. A goal's trail is one row per conversation the learner opened from
 * that goal's card: the step joins its pack by id (the session id is the pack
 * id), then that pack's own practice outcomes through `packTargetsOf`, then the
 * learner's own "used outside" report for that step. Nothing is attributed by
 * time: a conversation not opened from the goal is never on its trail however
 * close in time it was, and no creation or practice time is compared to a step.
 *
 * Three things draw nothing, each on purpose:
 * - a step whose pack is no longer in the cache: a deleted conversation is
 *   never brought back by a goal step that still names it;
 * - a goal key that is not the `factKey` of one of the learner's current
 *   goals: a removed goal's rows stay until they age out, and are not shown;
 * - a `used-outside` whose step has aged out: a report with no referent.
 */

import type { ConversationPack } from '@luvani/core';

import { factKey } from '../profile/memory.ts';
import { packTargetsOf, type PracticeEvent } from '../practice/history.ts';
import { uniqueGoalSteps, usedOutsideId, type GoalStepEvent } from './model.ts';

/** What the newest sitting on the pack showed, in the practice history's own words. */
export type GoalPractice = 'recalled' | 'practised' | 'attempted';

export interface GoalTrailRow {
  /** The step's id, which is the session id and the pack id. */
  stepId: string;
  /** When the conversation opened from the goal, for the date line and nothing else. */
  at: number;
  /** The stored task id, such as `mission:cafe`. */
  task: string;
  pack: ConversationPack;
  /** The newest sitting on this pack, or null when it has not been practised. */
  practice: GoalPractice | null;
  /** The learner said they used this outside the app. Their word, nothing more. */
  usedOutside: boolean;
}

/** Whether a goal key belongs to one of the goals the learner has now. */
export function isCurrentGoal(goalKey: string, goals: readonly string[]): boolean {
  return goals.some((goal) => factKey(goal) === goalKey);
}

function practiceOf(packId: string, history: readonly PracticeEvent[]): GoalPractice | null {
  let newest: { at: number; practice: GoalPractice } | null = null;
  for (const event of history) {
    // The shared reader: review targets in the same sitting never count here.
    const own = packTargetsOf(event, packId);
    if (own.length === 0) continue;
    const practice: GoalPractice = own.some((t) => t.outcome === 'recalled')
      ? 'recalled'
      : own.some((t) => t.outcome === 'practised')
        ? 'practised'
        : 'attempted';
    if (newest === null || event.at > newest.at) newest = { at: event.at, practice };
  }
  return newest?.practice ?? null;
}

/**
 * The trail for one goal, newest step first. Empty when the goal is not one
 * the learner has now, and a row only for a step whose pack is in the cache.
 */
export function goalEvidence(
  goalKey: string,
  steps: readonly GoalStepEvent[],
  packs: readonly ConversationPack[],
  history: readonly PracticeEvent[],
  currentGoals: readonly string[],
): GoalTrailRow[] {
  if (!isCurrentGoal(goalKey, currentGoals)) return [];
  const view = uniqueGoalSteps(steps).filter((row) => row.goalKey === goalKey);
  const reported = new Set(view.filter((row) => row.kind === 'used-outside').map((row) => row.id));
  const byId = new Map(packs.map((pack) => [pack.id, pack]));
  const rows: GoalTrailRow[] = [];
  for (const row of view) {
    if (row.kind !== 'step-started') continue;
    const pack = byId.get(row.id);
    if (pack === undefined) continue;
    rows.push({
      stepId: row.id,
      at: row.at,
      task: row.task,
      pack,
      practice: practiceOf(pack.id, history),
      usedOutside: reported.has(usedOutsideId(row.id)),
    });
  }
  return rows.sort((a, b) => b.at - a.at || (a.stepId < b.stepId ? -1 : a.stepId > b.stepId ? 1 : 0));
}
