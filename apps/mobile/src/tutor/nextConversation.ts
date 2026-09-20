/** The Tutor recommendation uses recorded history; it never invents continuity. */
import { FIRST_MISSION, getMission, type MissionProgress } from '@luvani/core';
import { headMissionId } from '../missions/chooserView.ts';
import { estimateMinutes } from '../home/estimate.ts';
import type { Thread } from './threads.ts';

export function nextConversation(progress: readonly MissionProgress[], thread: Thread | null, continueAllowed: boolean) {
  if (thread?.kind === 'pack' && continueAllowed) {
    return {
      label: 'Continue your conversation', title: thread.seedTopic.en,
      body: thread.line, detail: 'Open conversation · Go at your pace',
      params: { seedTopic: thread.seedTopic, continuationPackId: thread.packId },
    };
  }
  const id = thread?.kind === 'scene' ? thread.missionId : headMissionId({ progress, spokenBefore: true });
  const mission = getMission(id) ?? getMission(FIRST_MISSION)!;
  return {
    label: thread?.kind === 'scene' ? 'Pick up where you left off' : 'Your next conversation',
    title: mission.titleEn, body: mission.goalEn,
    detail: `About ${estimateMinutes({ kind: 'mission', beats: mission.beatIds.length })} min · Guided`,
    params: { missionId: mission.id },
  };
}
