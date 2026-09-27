/**
 * The goal rows My French draws (Stage 4, 2026-09-25), as a value.
 *
 * Pure, so the tab decides nothing: one row per goal the learner wrote, in
 * their words, with the one mission `next.ts` suggests and the fit said
 * honestly. No goals, no rows, and the tab draws no block at all.
 */

import type { Mission } from '@luvani/core';

import { GOALS_ROW_OPEN } from '../myfrench/copy.ts';
import { factKey } from '../profile/memory.ts';
import { missionOfTask, nextLine, nextTaskForGoal } from './next.ts';

export interface GoalRow {
  /** The goal exactly as the profile holds it. Routes carry `goalRouteKey(goal)`, never this. */
  goal: string;
  /** "Next: … (matches your goal)" or "A good place to start: …", or null with no catalogue. */
  line: string | null;
  /** What a screen reader hears: where the row goes, the goal, the next task. */
  spoken: string;
}

function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * An opaque key for a goal, for routes (Stage 4 review, 2026-09-25).
 *
 * On the web a route's params are the address bar and the browser history, and
 * a goal is the learner's own words, so no route carries them. This is FNV-1a
 * over the goal's `factKey`, in base 36: the same goal however it is cased,
 * accented or punctuated gives the same key, and the key says nothing about the
 * words. Screens look the goal up again from the profile by it.
 */
export function goalRouteKey(goal: string): string {
  let hash = 0x811c9dc5;
  for (const char of factKey(goal)) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export function goalRows(goals: readonly string[], missions: readonly Mission[]): GoalRow[] {
  return goals.map((goal) => {
    const next = nextTaskForGoal(goal, { missions });
    const mission = next === null ? null : missions.find((m) => m.id === next.task.id) ?? missionOfTask(next.task.id);
    const line = next === null || mission === null ? null : nextLine(mission, next.fit);
    const spoken = [GOALS_ROW_OPEN, goal, line].filter((part): part is string => part !== null).map(sentence).join(' ');
    return { goal, line, spoken };
  });
}
