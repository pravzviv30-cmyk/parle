import { getMission, independenceFrom, isEarned, type MissionCompletion, type MissionProgress } from '@luvani/core';
import { missionCompletionsFrom } from '../missions/chooserView.ts';

/**
 * Whether this finish is the scene's first earn. Celebration needs a real
 * finish and core's independence rule, so a finish with help, or of a scene
 * this build does not know, is never one (false). For a finish on the
 * learner's own it is true or false from their finish history, and null when
 * that history is `null`: it could not be read (F777), so nobody knows whether
 * this is the first time or the tenth, and nothing may claim either.
 */
export function firstEarnedFinish(before: readonly MissionCompletion[] | null, finish: { id: string; rung: number }): boolean | null {
  if (!earnedFinish(finish)) return false;
  if (before === null) return null;
  return !isEarned({ independence: independenceFrom(before.filter(row => row.id === finish.id)) });
}

/**
 * This finish, on its own, was done with nothing handed over: core's
 * independence rule on the rung the winning view carried (come alive, core loop
 * 2.9). True for every such finish, the first or the tenth; false for a finish
 * with help, whatever was earned before, and for a scene this build does not know.
 */
export function earnedFinish(finish: { id: string; rung: number }): boolean {
  if (getMission(finish.id) === undefined) return false;
  return isEarned({ independence: independenceFrom(missionCompletionsFrom([{ ...finish, at: 0 }])) });
}

/**
 * Which postcard stamp the recap plays: the first earn, an earn again, or an
 * earn whose history could not be read (`neutral`), or none.
 */
export type PostcardStampKind = 'first' | 'again' | 'neutral';

/**
 * The stamp for this session's finish. Every independent finish gets one, and
 * the first earn gets the bigger one; an assisted finish gets none, even on a
 * can-do earned before, because the stamp says "you did this on your own" and
 * this time somebody helped. Nothing that did not happen this session stamps.
 *
 * An independent finish whose history could not be read (`firstEarned` null,
 * F777) is `neutral`: it stamps with the first earn's weight, because it may be
 * the first, and its line claims neither a first time nor an earlier one.
 */
export function postcardStamp(finish: { independent: boolean; firstEarned: boolean | null }): PostcardStampKind | null {
  if (!finish.independent) return null;
  if (finish.firstEarned === null) return 'neutral';
  return finish.firstEarned ? 'first' : 'again';
}

/** The line under the postcard. Plain, warm, and true of this session. */
export function postcardLine(stamp: PostcardStampKind | null): string {
  if (stamp === 'first') return 'Your first independent finish here.';
  if (stamp === 'again') return 'You did it on your own again.';
  if (stamp === 'neutral') return 'You did it on your own.';
  return 'A can-do you have earned.';
}

export function recapCanDo(progress: readonly MissionProgress[], completedId?: string): string | null {
  const scene = progress.find(row => row.mission.id === completedId);
  return scene && isEarned(scene) ? scene.mission.earnedEn : null;
}

export function earnedPostcards(progress: readonly MissionProgress[]): MissionProgress[] {
  return progress.filter(isEarned);
}
