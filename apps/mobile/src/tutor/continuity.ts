/**
 * What the tutor remembers, said in one line (F546).
 *
 * The brain stores an opener for next time, the packs store what the last
 * conversation was about, and the progress store knows a scene left part way.
 * None of it reached a screen. This reads them in one priority and hands Home
 * and Tutor a single line with, where there is one, the thing to do about it.
 *
 * The order is the order of how much a learner would recognise. A scene they
 * walked out of is theirs; a conversation they had last time is theirs; the
 * tutor's own opener is what the tutor decided to say next; the last scene
 * title is the faintest. A learner with none of these gets null, and the
 * screen draws nothing: this module invents no history, ever.
 *
 * Pure, and it reads no clock of its own. `now` rides in for the same reason
 * it does everywhere else in progress, so a rule about recency is a rule a
 * test can ask across a boundary.
 */

import type { ConversationPack, MissionProgress } from '@luvani/core';
import type { LearnerProfile } from '@luvani/brain/profile';

import { latestReadyPack } from '../conversationPacks/model.ts';
import { lowerFirst } from '../copy/text.ts';
import type { ScenarioRecord } from '../missions/progressStore.ts';

export type ContinuityAction =
  | { kind: 'resume'; missionId: string }
  | { kind: 'continue'; seedTopic: { fr: string; en: string } };

export interface Continuity {
  line: string;
  action: ContinuityAction | null;
}

/**
 * "<Name> remembers", for the one tab that names the tutor. Home draws the
 * line alone and never the name: F363 keeps the tutor's name off Home, and the
 * hero already says whose memory it is by where it sits.
 */
export function continuityHeadline(tutorName: string): string {
  return `${tutorName} remembers`;
}

/**
 * Re-exported rather than written here. The rule moved to `copy/text.ts` when
 * Home's joined can-do sentence became the third caller, and this line keeps
 * every existing reader of it working through the name they already know.
 */
export { lowerFirst };

/** The scene most recently walked out of and not finished since, or null. */
function unfinishedScene(
  progress: readonly MissionProgress[],
  records: readonly ScenarioRecord[],
): MissionProgress | null {
  let best: { at: number; progress: MissionProgress } | null = null;
  for (const record of records) {
    const mine = progress.find((p) => p.mission.id === record.missionId);
    if (mine === undefined) continue;
    if (mine.lastFinishedAt !== null && record.at <= mine.lastFinishedAt) continue;
    if (best === null || record.at > best.at) best = { at: record.at, progress: mine };
  }
  return best === null ? null : best.progress;
}

export function continuityFrom(input: {
  brain: LearnerProfile | null;
  packs: readonly ConversationPack[];
  records: readonly ScenarioRecord[];
  progress: readonly MissionProgress[];
}): Continuity | null {
  const scene = unfinishedScene(input.progress, input.records);
  if (scene !== null) {
    return {
      line: `${scene.mission.titleEn} is waiting where you left it.`,
      action: { kind: 'resume', missionId: scene.mission.id },
    };
  }

  const pack = latestReadyPack(input.packs);
  if (pack !== null) {
    return {
      line: `Last time you talked about ${lowerFirst(pack.title.en)}.`,
      action: { kind: 'continue', seedTopic: { fr: pack.continuationSeed.titleFr, en: pack.continuationSeed.titleEn } },
    };
  }

  const opener = input.brain?.memory?.opener ?? null;
  if (opener !== null && typeof opener.en === 'string' && opener.en.trim().length > 0) {
    return { line: opener.en.trim(), action: null };
  }

  const last = input.brain?.preferences?.lastScenarios?.[0];
  if (typeof last === 'string' && last.trim().length > 0) {
    return { line: `Last time: ${last.trim()}.`, action: null };
  }

  return null;
}
