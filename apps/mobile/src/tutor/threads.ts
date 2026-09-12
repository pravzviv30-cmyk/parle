/**
 * The one thread a learner can pick up (F551).
 *
 * A conversation used to reset every time. Two records already say where
 * one could carry on: a scene walked out of part way, and a finished pack's
 * continuation seed, which the agent built for exactly this and only half of
 * the app read. This names the one thread worth offering, in that order, and
 * says in words whether the subject has come up before, off the topics store's
 * own dates. It invents nothing: a learner with neither record gets null.
 *
 * A pack already kept going on this phone is not the thread again; the mark
 * says so. Whether the door is open is the plan's call, in `capabilities.ts`,
 * and not this module's: this says what the thread is, the screen asks whether
 * it may be walked through.
 */

import type { ConversationPack, MissionProgress, PracticeTopic } from '@luvani/core';

import { latestReadyPack } from '../conversationPacks/model.ts';
import { continuedAt, type PackMark } from '../conversationPacks/marks.ts';
import type { ScenarioRecord } from '../missions/progressStore.ts';

export type Thread =
  | { kind: 'scene'; missionId: string; line: string }
  | { kind: 'pack'; packId: string; seedTopic: { fr: string; en: string }; line: string };

export const CAME_UP = {
  once: 'It has come up once before.',
  more: 'It has come up a few times before.',
} as const;

function lowerFirst(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

function unfinishedScene(progress: readonly MissionProgress[], records: readonly ScenarioRecord[]): MissionProgress | null {
  let best: { at: number; progress: MissionProgress } | null = null;
  for (const record of records) {
    const mine = progress.find((p) => p.mission.id === record.missionId);
    if (mine === undefined) continue;
    if (mine.lastFinishedAt !== null && record.at <= mine.lastFinishedAt) continue;
    if (best === null || record.at > best.at) best = { at: record.at, progress: mine };
  }
  return best === null ? null : best.progress;
}

/** How often the pack's subject has come up, said in words, or nothing. */
export function cameUpLine(pack: Pick<ConversationPack, 'title'>, topics: readonly PracticeTopic[]): string | null {
  const wanted = pack.title.en.trim().toLowerCase();
  const topic = topics.find((entry) => entry.title.en.trim().toLowerCase() === wanted);
  if (!topic) return null;
  const times = topic.discussed.length;
  if (times <= 1) return null;
  return times === 2 ? CAME_UP.once : CAME_UP.more;
}

export function threadFrom(input: {
  records: readonly ScenarioRecord[];
  progress: readonly MissionProgress[];
  packs: readonly ConversationPack[];
  marks: readonly PackMark[];
  topics: readonly PracticeTopic[];
}): Thread | null {
  const scene = unfinishedScene(input.progress, input.records);
  if (scene !== null) {
    return { kind: 'scene', missionId: scene.mission.id, line: `${scene.mission.titleEn} is waiting where you left it.` };
  }
  const pack = latestReadyPack(input.packs);
  if (pack === null) return null;
  if (continuedAt(pack, input.marks) !== null) return null;
  const before = cameUpLine(pack, input.topics);
  const line = `Keep talking about ${lowerFirst(pack.title.en)}.${before === null ? '' : ` ${before}`}`;
  return {
    kind: 'pack',
    packId: pack.id,
    seedTopic: { fr: pack.continuationSeed.titleFr, en: pack.continuationSeed.titleEn },
    line,
  };
}
