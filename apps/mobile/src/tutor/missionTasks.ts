import { readMissionTasks, type ConvoView, type MissionTasks } from '@luvani/core';

/** No inferred tasks for an older worker or a different active mission. */
export function visibleMissionTasks(view: Pick<ConvoView, 'missionTasks'>, missionId: string | null | undefined): MissionTasks['items'] {
  return readMissionTasks(view.missionTasks, missionId ?? null)?.items ?? [];
}
