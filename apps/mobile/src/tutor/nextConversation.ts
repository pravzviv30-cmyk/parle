/**
 * The conversation Speak's one Start opens. It uses recorded history and never
 * invents continuity.
 *
 * 2026-09-27 (notebook Phase 3): without a thread to pick up, the next
 * conversation is the next scene on the CEFR spine, the same one Today leads
 * with. The detail line says the level and the minutes the mission derives, so
 * the opener reads about three, and it carries the lines the learner will say.
 */
import { FIRST_MISSION, getMission, spineFrom, type MissionProgress } from '@luvani/core';
import { minutesLine, missionMinutes } from '../home/estimate.ts';
import type { Thread } from './threads.ts';

export function nextConversation(progress: readonly MissionProgress[], thread: Thread | null, continueAllowed: boolean) {
  if (thread?.kind === 'pack' && continueAllowed) {
    return {
      label: 'Continue your conversation', title: thread.seedTopic.en,
      body: thread.line, detail: 'Open conversation · Go at your pace',
      lines: [] as readonly string[],
      params: { seedTopic: thread.seedTopic, continuationPackId: thread.packId },
    };
  }
  const id = thread?.kind === 'scene' ? thread.missionId : spineFrom(progress).next?.id ?? FIRST_MISSION;
  const mission = getMission(id) ?? getMission(FIRST_MISSION)!;
  return {
    label: thread?.kind === 'scene' ? 'Pick up where you left off' : 'Your next conversation',
    title: mission.titleEn, body: mission.canDoEn,
    detail: `${mission.cefr} · ${minutesLine(missionMinutes(mission))}`,
    lines: mission.referencePhrases.slice(0, 3),
    params: { missionId: mission.id },
  };
}
