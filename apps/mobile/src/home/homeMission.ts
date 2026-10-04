/**
 * The scene Today leads with (F543, F571, notebook Phase 3).
 *
 * Today opens on one real scene, because the question a learner brings to the
 * first screen is "what shall I do now". This module answers it and
 * `MissionHero.tsx` draws the answer on the scene brief. Nothing on the screen
 * chooses.
 *
 * ## The next scene on the spine
 *
 * Rewritten 2026-09-27. The hero is `spineFrom(progress).next`: the first scene
 * on the CEFR spine the learner has not earned on their own. That is the opener
 * on a first run, the café once the opener is earned, and so on up to A1. The
 * brief says what is true of that scene and nothing else: its level, its French
 * title, what the learner will be able to do, two or three lines they will say,
 * and how long it takes. If they walked out of that very scene part way, the
 * minutes are measured from their own pace and the caps line says so.
 *
 * Only a learner who has earned every scene on the spine meets the day's scene
 * instead, drawn from the daily pool at their tier, which is also the one card
 * that can be bookmarked.
 *
 * ## Why the union
 *
 * A daily scene and a mission open differently: a scene opens on its seed topic
 * and a mission opens on its id. The common half is everything the brief draws,
 * so `MissionHero` never asks which kind it has except at the start.
 */

import {
  DAILY_SCENARIOS,
  SCENE_SPINE,
  dailyPick,
  getMission,
  scenariosForLevel,
  seedTopicOf,
  spineFrom,
  type DailyScenario,
  type Mission,
  type MissionId,
  type MissionProgress,
} from '@luvani/core';

import type { ScenarioRecord } from '../missions/progressStore.ts';
import { minutesRemaining } from '../missions/resume.ts';
import { estimateMinutes, missionMinutes } from './estimate.ts';

/** Everything the brief draws, whichever kind it turned out to be. */
export interface HeroFacts {
  /** A0 or A1 for a spine scene; null for a daily scene, which carries no level. */
  level: 'A0' | 'A1' | null;
  /** The one caps label, only when there is something true to say with it. */
  label: string | null;
  /** The scene's name in French, the brief's serif hero. */
  french: string | null;
  /** The scene's name in the learner's language. */
  title: string;
  /** One plain line about a daily scene. Null for a spine scene, which has a can-do. */
  summary: string | null;
  /** What the learner will be able to do, read after "You'll be able to". */
  canDo: string | null;
  /** Two or three lines the learner will say, in French. */
  lines: readonly string[];
  /** How long, as a number, so the one sanctioned numeral line can say it. */
  minutes: number;
}

export type HomeMission =
  | (HeroFacts & { kind: 'scene'; mission: Mission })
  | (HeroFacts & { kind: 'today'; scenario: DailyScenario });

export const HERO_LABELS = {
  /** A scene on the spine the learner walked out of part way. */
  resume: 'Pick up where you left off',
} as const;

/** The brief's one primary action. */
export const START = 'Start';

/** Every line this module can say, for the copy sweeps. */
export const HERO_COPY: readonly string[] = [...Object.values(HERO_LABELS), START];

/** The most recent record for this mission not finished since, or null. */
function leftPartWay(progress: MissionProgress, records: readonly ScenarioRecord[]): ScenarioRecord | null {
  let best: ScenarioRecord | null = null;
  for (const record of records) {
    if (record.missionId !== progress.mission.id) continue;
    if (progress.lastFinishedAt !== null && record.at <= progress.lastFinishedAt) continue;
    if (best === null || record.at > best.at) best = record;
  }
  return best;
}

/** A spine scene as a brief. */
function sceneHero(mission: Mission, minutes: number, label: string | null): HomeMission {
  return {
    kind: 'scene',
    mission,
    level: mission.cefr,
    label,
    french: mission.title,
    title: mission.titleEn,
    summary: null,
    canDo: mission.canDoEn,
    lines: mission.referencePhrases.slice(0, 3),
    minutes,
  };
}

export function homeMissionFrom(input: {
  progress: readonly MissionProgress[];
  records: readonly ScenarioRecord[];
  /** The learner's level standing, so the daily pool is pitched at them. */
  levelIndex: number;
  /** An unassessed setup suggestion; never awards or skips earned evidence. */
  startingMissionId?: MissionId;
  now: number;
}): HomeMission | null {
  if (input.progress.length === 0) return null;

  // An unfinished, still-catalogued scene is the most concrete next step,
  // even when another scene is first on the spine. Never infer a resume from
  // an old record superseded by a finish.
  const unfinished = input.progress
    .map((mine) => ({ mine, record: leftPartWay(mine, input.records) }))
    .filter((item): item is { mine: MissionProgress; record: ScenarioRecord } => item.record !== null)
    .sort((a, b) => b.record.at - a.record.at)[0];
  if (unfinished !== undefined) {
    const remaining = minutesRemaining(unfinished.record, unfinished.mine.mission.beatIds.length, unfinished.mine.lastFinishedAt);
    const minutes = remaining === null ? missionMinutes(unfinished.mine.mission) : estimateMinutes({ kind: 'measured', minutes: remaining });
    return sceneHero(unfinished.mine.mission, minutes, HERO_LABELS.resume);
  }

  const untouched = input.progress.every(item => item.lastFinishedAt === null);
  const suggested = untouched && input.startingMissionId !== undefined ? getMission(input.startingMissionId) : null;
  const next = suggested ?? spineFrom(input.progress).next;
  if (next !== null) {
    return sceneHero(next, missionMinutes(next), null);
  }

  // Every scene on the spine earned: today's scene, from the learner's own tier.
  const scenario = dailyPick(scenariosForLevel(DAILY_SCENARIOS, input.levelIndex), input.now);
  return {
    kind: 'today',
    scenario,
    level: null,
    label: null,
    french: null,
    title: scenario.titleEn,
    summary: scenario.bodyEn,
    canDo: null,
    lines: [],
    minutes: estimateMinutes({ kind: 'scenario', lines: scenario.lines.length }),
  };
}

/**
 * How the conversation opens, and what a start should be recorded against.
 *
 * A mission opens by id, directly, which is the first run's whole route: Start
 * on Today goes into the scene without passing through the chooser. A daily
 * scene goes through `seedTopicOf`. `missionId` is null for a daily scene so
 * it is never counted as a mission start.
 */
export interface HeroStart {
  params: { missionId: MissionId } | { seedTopic: { fr: string; en: string } };
  missionId: MissionId | null;
}

export function heroStart(hero: HomeMission): HeroStart {
  if (hero.kind === 'today') return { params: { seedTopic: seedTopicOf(hero.scenario) }, missionId: null };
  return { params: { missionId: hero.mission.id }, missionId: hero.mission.id };
}

/**
 * The situation this card can be saved to come back to, or null. Only a daily
 * scene can be: the shelf holds scene ids, and a mission is already permanent
 * on the path.
 */
export function heroBookmark(hero: HomeMission): { id: string; titleEn: string } | null {
  return hero.kind === 'today' ? { id: hero.scenario.id, titleEn: hero.scenario.titleEn } : null;
}

/**
 * The hero for a page whose storage read failed: the first scene on the spine,
 * with no caps label. What it says is true of the scene for every learner, so
 * nothing about the one who could not be read is invented, and the page keeps
 * its one Start.
 */
export function fallbackHero(): HomeMission {
  const first = getMission(SCENE_SPINE[0]!)!;
  return sceneHero(first, missionMinutes(first), null);
}
