/**
 * The conversation Speak's one Start opens. It uses recorded history and never
 * invents continuity.
 *
 * 2026-09-27 (notebook Phase 3): without a thread to pick up, the next
 * conversation is the next scene on the CEFR spine, the same one Today leads
 * with, and it carries the lines the learner will say.
 *
 * Revamp B (F603): Speak draws this as the blue scene brief, the same card Home
 * leads with, so it hands over what that card is built from rather than a
 * joined-up detail line. `french` is the scene's own name, `minutes` the
 * estimate the mission derives (the opener reads about three), and `canDo` the
 * catalogue's line that the card turns into a sentence. The brief's meta line
 * joins them with commas (`sceneMeta`), so nothing here joins anything. An open
 * conversation has no scene behind it, so all three are null and the card says
 * only what it can back: `body`, the thread's own line.
 */
import { FIRST_MISSION, getMission, spineFrom, type MissionProgress } from '@luvani/core';
import { missionMinutes } from '../home/estimate.ts';
import type { Thread } from './threads.ts';

export function nextConversation(progress: readonly MissionProgress[], thread: Thread | null, continueAllowed: boolean) {
  if (thread?.kind === 'pack' && continueAllowed) {
    return {
      label: 'Continue your conversation', title: thread.seedTopic.en,
      body: thread.line,
      french: null, minutes: null, canDo: null,
      lines: [] as readonly string[],
      params: { seedTopic: thread.seedTopic, continuationPackId: thread.packId },
    };
  }
  const id = thread?.kind === 'scene' ? thread.missionId : spineFrom(progress).next?.id ?? FIRST_MISSION;
  const mission = getMission(id) ?? getMission(FIRST_MISSION)!;
  return {
    label: thread?.kind === 'scene' ? 'Pick up where you left off' : 'Your next conversation',
    title: mission.titleEn, body: mission.canDoEn,
    french: mission.title, minutes: missionMinutes(mission), canDo: mission.canDoEn,
    lines: mission.referencePhrases.slice(0, 3),
    params: { missionId: mission.id },
  };
}
