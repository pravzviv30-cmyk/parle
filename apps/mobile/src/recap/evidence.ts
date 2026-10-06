import { getMission, independenceFrom, isEarned, type MissionCompletion, type MissionProgress } from '@luvani/core';
import { missionCompletionsFrom } from '../missions/chooserView.ts';

/** Celebration needs a real finish and core's independence rule. */
export function firstEarnedFinish(before: readonly MissionCompletion[] | null, finish: { id: string; rung: number }): boolean {
  if (before === null || getMission(finish.id) === undefined) return false;
  return !isEarned({ independence: independenceFrom(before.filter(row => row.id === finish.id)) })
    && earnedFinish(finish);
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

/** Which postcard stamp the recap plays: the first earn, an earn again, or none. */
export type PostcardStampKind = 'first' | 'again';

/**
 * The stamp for this session's finish. Every independent finish gets one, and
 * the first earn gets the bigger one; an assisted finish gets none, even on a
 * can-do earned before, because the stamp says "you did this on your own" and
 * this time somebody helped. Nothing that did not happen this session stamps.
 */
export function postcardStamp(finish: { independent: boolean; firstEarned: boolean }): PostcardStampKind | null {
  if (!finish.independent) return null;
  return finish.firstEarned ? 'first' : 'again';
}

/** The line under the postcard. Plain, warm, and true of this session. */
export function postcardLine(stamp: PostcardStampKind | null): string {
  if (stamp === 'first') return 'Your first independent finish here.';
  if (stamp === 'again') return 'You did it on your own again.';
  return 'A can-do you have earned.';
}

export function recapCanDo(progress: readonly MissionProgress[], completedId?: string): string | null {
  const scene = progress.find(row => row.mission.id === completedId);
  return scene && isEarned(scene) ? scene.mission.earnedEn : null;
}

export function earnedPostcards(progress: readonly MissionProgress[]): MissionProgress[] {
  return progress.filter(isEarned);
}
