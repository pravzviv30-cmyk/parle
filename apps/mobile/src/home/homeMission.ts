/**
 * Tonight's French: the one thing Home leads with (F543, F571).
 *
 * Home opens on one real situation with a reason and a time, because the
 * question a learner brings to the first screen is "what shall I do tonight",
 * not "what is a word". This module answers it and `MissionHero.tsx` draws the
 * answer. Nothing on the screen chooses.
 *
 * ## Three kinds, in priority
 *
 * A scene the learner walked out of part way comes back first: they meant that
 * scene whatever the deck says is due, and the minutes on it are measured from
 * their own pace rather than assumed. Then, for somebody who has never spoken
 * to the tutor at all, the café, because a first conversation should be the one
 * the whole product was built around. Otherwise today's scene, drawn from the
 * daily pool at the learner's own tier, which is the card the founder's mockup
 * shows: an English title, two lines of what is happening, and the place.
 *
 * Revamp A folded the daily situation card into this one. Home used to offer
 * the next guided mission as a hero and today's scene as a second card lower
 * down, with a pill on one and an outline on the other, which is two ways into
 * a conversation on a screen whose whole job is to open one. The six guided
 * missions are reached from the Tutor tab and from My French now, and the hero
 * is the day.
 *
 * ## Why the union rather than one shape with optional halves
 *
 * A daily scene and a guided mission open differently: a scene opens on its
 * seed topic and a mission opens on its id. Carrying both as optional fields is
 * how a card comes to be started with neither. The common half is everything
 * the card draws, so `HeroCard` never asks which kind it has, and the kind is
 * only read at the one place it decides something, which is the start.
 */

import {
  DAILY_SCENARIOS,
  FIRST_MISSION,
  MISSIONS,
  dailyPick,
  scenariosForLevel,
  seedTopicOf,
  type DailyScenario,
  type Mission,
  type MissionId,
  type MissionPlace,
  type MissionProgress,
} from '@luvani/core';

import { heroArt } from '../art/maps.ts';
import type { ArtKey } from '../art/registry.ts';
import type { ScenarioRecord } from '../missions/progressStore.ts';
import { minutesRemaining } from '../missions/resume.ts';
import { estimateMinutes } from './estimate.ts';
import { localHour } from './greeting.ts';

export type HomeMissionKind = 'resume' | 'first' | 'today';

/** Everything the card draws, whichever kind it turned out to be. */
export interface HeroFacts {
  /** The caps line over the card: what kind of offer this is. */
  label: string;
  /** The name of the thing, in the learner's language, for the serif line. */
  title: string;
  /** Two plain sentences: what is happening, and what they will be doing. */
  body: string;
  /** Where it happens. Picks the picture, and names a place rather than a colour. */
  place: MissionPlace;
  /** How long, as a number, so the one sanctioned numeral line can say it. */
  minutes: number;
  /** One honest line explaining why this is the conversation in front of them. */
  reason: string;
  /** The scene behind the card, from the one registry that owns sizes. */
  art: ArtKey;
}

export type HomeMission =
  | (HeroFacts & { kind: 'resume' | 'first'; mission: Mission })
  | (HeroFacts & { kind: 'today'; scenario: DailyScenario });

export const HERO_LABELS = {
  resume: 'Pick up where you left off',
  first: 'Your first French',
  evening: "Tonight's French",
  day: "Today's French",
} as const;

/**
 * Why Home put this particular scene first.
 *
 * These stay deliberately plain. They explain the recommendation without
 * exposing a level, score or ranking, and the fallback says nothing about a
 * learner whose local history could not be read.
 */
export const HERO_REASONS = {
  resume: 'Return to this situation for another short conversation.',
  first: 'A short, supported café scene to help you start speaking.',
  today: 'A fresh situation chosen for the French you are practising now.',
  fallback: 'A short café scene you can start whenever you are ready.',
} as const;

export const START_CONVERSATION = 'Start conversation';

/** Every line this module can say, for the copy sweeps. */
export const HERO_COPY: readonly string[] = [
  ...Object.values(HERO_LABELS),
  ...Object.values(HERO_REASONS),
  START_CONVERSATION,
];

/** The greeting's own evening: from six until the small hours. */
export function heroLabel(now: number): string {
  const hour = localHour(now);
  return hour >= 18 || hour < 5 ? HERO_LABELS.evening : HERO_LABELS.day;
}

/** The scene most recently walked out of and not finished since, or null. */
function leftPartWay(
  progress: readonly MissionProgress[],
  records: readonly ScenarioRecord[],
): { progress: MissionProgress; record: ScenarioRecord } | null {
  let best: { progress: MissionProgress; record: ScenarioRecord } | null = null;
  for (const record of records) {
    const mine = progress.find((p) => p.mission.id === record.missionId);
    if (mine === undefined) continue;
    if (mine.lastFinishedAt !== null && record.at <= mine.lastFinishedAt) continue;
    if (best === null || record.at > best.record.at) best = { progress: mine, record };
  }
  return best;
}

/** The common half of a mission hero, so the two mission kinds cannot drift. */
function fromMission(mission: Mission, label: string, minutes: number, reason: string): HeroFacts {
  return {
    label,
    title: mission.titleEn,
    body: mission.goalEn,
    place: mission.place,
    minutes,
    reason,
    art: heroArt(mission.place),
  };
}

export function homeMissionFrom(input: {
  progress: readonly MissionProgress[];
  records: readonly ScenarioRecord[];
  spokenBefore: boolean;
  /** The learner's level standing, so the daily pool is pitched at them. */
  levelIndex: number;
  now: number;
}): HomeMission | null {
  if (input.progress.length === 0) return null;

  // A scene left part way, with the minutes measured from this learner's own
  // pace through the beats they already did. No pace behind it means the
  // mission's own shape instead, which is an estimate rather than a guess.
  const left = leftPartWay(input.progress, input.records);
  if (left !== null) {
    const mission = left.progress.mission;
    const remaining = minutesRemaining(left.record, mission.beatIds.length, left.progress.lastFinishedAt);
    const minutes =
      remaining === null
        ? estimateMinutes({ kind: 'mission', beats: mission.beatIds.length })
        : estimateMinutes({ kind: 'measured', minutes: remaining });
    return {
      kind: 'resume',
      mission,
      ...fromMission(mission, HERO_LABELS.resume, minutes, HERO_REASONS.resume),
    };
  }

  if (!input.spokenBefore) {
    const first = input.progress.find((p) => p.mission.id === FIRST_MISSION) ?? input.progress[0]!;
    const mission = first.mission;
    return {
      kind: 'first',
      mission,
      ...fromMission(
        mission,
        HERO_LABELS.first,
        estimateMinutes({ kind: 'mission', beats: mission.beatIds.length }),
        HERO_REASONS.first,
      ),
    };
  }

  // Today's scene, picked by the day out of the learner's own tier. The pick is
  // core's and the clock is the screen's one reading, so the hero, the label
  // and anything else drawn from today can never disagree about the day.
  const scenario = dailyPick(scenariosForLevel(DAILY_SCENARIOS, input.levelIndex), input.now);
  return { kind: 'today', scenario, ...fromScenario(scenario, heroLabel(input.now)) };
}

/** The common half of a daily scene, from the scene's own fields. */
function fromScenario(scenario: DailyScenario, label: string): HeroFacts {
  return {
    label,
    title: scenario.titleEn,
    body: scenario.bodyEn,
    place: scenario.place,
    minutes: estimateMinutes({ kind: 'scenario', lines: scenario.lines.length }),
    reason: HERO_REASONS.today,
    art: heroArt(scenario.place),
  };
}

/**
 * How the conversation opens, and what a start should be recorded against.
 *
 * The two kinds open differently and this is the only place that difference is
 * read. A daily scene goes through `seedTopicOf`, which turns it into the two
 * plain strings the token server already carries, so the tutor opens on this
 * scene without anything new being taught to the agent. A mission goes by id,
 * the way the chooser and My French open one.
 *
 * `missionId` is null for a daily scene on purpose: the catalogue of missions
 * is what a mission start is counted against, and counting a daily scene as one
 * would put a number about the six guided situations next to something that is
 * not one of them.
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
 * The situation this card can be saved to come back to, or null.
 *
 * Only a daily scene can be. The bookmark store holds scene ids and My French
 * resolves them back against the daily pool, so a mission id written into it
 * would be a save that quietly resolved to nothing the next time the shelf was
 * drawn. A mission is already permanent: it is in the passport and on My
 * French, and it does not need saving to be found again.
 */
export function heroBookmark(hero: HomeMission): { id: string; titleEn: string } | null {
  return hero.kind === 'today' ? { id: hero.scenario.id, titleEn: hero.scenario.titleEn } : null;
}

/**
 * The hero for a page whose storage read failed: the café, offered as the
 * hour's French.
 *
 * True of the café for every learner alive, so nothing about the one who could
 * not be read is invented, and the page keeps its one pill. The label is the
 * hour's rather than "Your first French", because a learner of two years whose
 * disk would not answer is not on their first anything.
 */
export function fallbackHero(now: number): HomeMission {
  const cafe = MISSIONS.find((mission) => mission.id === FIRST_MISSION) ?? MISSIONS[0]!;
  return {
    kind: 'first',
    mission: cafe,
    ...fromMission(
      cafe,
      heroLabel(now),
      estimateMinutes({ kind: 'mission', beats: cafe.beatIds.length }),
      HERO_REASONS.fallback,
    ),
  };
}
