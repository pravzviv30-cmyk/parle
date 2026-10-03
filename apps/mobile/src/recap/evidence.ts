import { getMission, independenceFrom, isEarned, type MissionCompletion, type MissionProgress } from '@luvani/core';
import { missionCompletionsFrom } from '../missions/chooserView.ts';

/** Celebration needs a real finish and core's independence rule. */
export function firstEarnedFinish(before: readonly MissionCompletion[] | null, finish: { id: string; rung: number }): boolean {
  if (before === null || getMission(finish.id) === undefined) return false;
  return !isEarned({ independence: independenceFrom(before.filter(row => row.id === finish.id)) })
    && isEarned({ independence: independenceFrom(missionCompletionsFrom([{ ...finish, at: 0 }])) });
}

export function recapCanDo(progress: readonly MissionProgress[], completedId?: string): string | null {
  const scene = progress.find(row => row.mission.id === completedId);
  return scene && isEarned(scene) ? scene.mission.earnedEn : null;
}

export function earnedPostcards(progress: readonly MissionProgress[]): MissionProgress[] {
  return progress.filter(isEarned);
}
