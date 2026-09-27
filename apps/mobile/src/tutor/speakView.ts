/**
 * Speak, decided (notebook Phase 3, B1, 2026-09-27).
 *
 * The Speak tab draws, in order: the tutor card, one Start for the next
 * conversation with a quiet "Type instead" under it, the A0 to A1 level path
 * from the CEFR spine with "you are here" on the next scene, every scene as a
 * ledger row that opens its brief in the chooser, and, only after a first
 * finished scene, "More ways to practise". Every decision in that list lives
 * here, where a test can ask it, rather than in the `.tsx`.
 *
 * Nothing here invents a number or a rank. The minutes come from
 * `home/estimate.ts`, the levels and the "here" from `spineFrom`, and earned is
 * core's `isEarned` through the spine, never a second opinion.
 */

import {
  DEFAULT_TUTOR_VOICE,
  SCENE_SPINE,
  earnedMissionIds,
  getMission,
  spineFrom,
  tutorSampleLine,
  tutorVoice,
  type Mission,
  type MissionProgress,
  type TutorVoiceKey,
} from '@luvani/core';

import type { PathLevel, LevelStop } from '../components.tsx';
import { minutesLine, missionMinutes } from '../home/estimate.ts';
import { entryStart, tutorDoors } from './gate.ts';

/** The quiet second way into a conversation, under the one Start. */
export const TYPE_INSTEAD = 'Type instead';
/** The same link for a learner whose standing choice is to type. */
export const SPEAK_INSTEAD = 'Speak instead';

export interface StartModes {
  /** The mode the one Start opens in. */
  mode: 'speak' | 'type';
  textMode: boolean;
  /** The quiet link under the Start: the other mode. */
  other: { label: string; textMode: boolean };
}

/**
 * Which way the one Start opens, from Profile's standing "Prefer typing"
 * choice, and the quiet link that offers the other way. Speaking unless the
 * learner chose otherwise; either way both modes are one tap away.
 */
export function startModes(prefersTyping: boolean): StartModes {
  return prefersTyping
    ? { mode: 'type', textMode: true, other: { label: SPEAK_INSTEAD, textMode: false } }
    : { mode: 'speak', textMode: false, other: { label: TYPE_INSTEAD, textMode: true } };
}

export const PATH_LABEL = 'Your path';
export const MORE_WAYS_LABEL = 'More ways to practise';
export const CHANGE_VOICE = 'Change voice';

/** Who is teaching, as the scene brief's tutor line. */
export function withTutor(name: string): string {
  return `With ${name}`;
}

// ─────────────────────────────────────────────────────────────── the tutor card

export interface TutorCardFacts {
  /** The persona's name, from TUTOR_VOICES. */
  name: string;
  /** The catalogue's own sound line, unchanged. */
  voice: string;
  /** The French half of the voice sample, which is what the clip says first. */
  signature: string;
}

/**
 * The card for one voice. The signature is the sample's French sentence, taken
 * off the same line the bundled clip was synthesised from, so the words on the
 * card are the words the play control sounds.
 */
export function tutorCardFacts(key: TutorVoiceKey): TutorCardFacts {
  const voice = tutorVoice(key);
  const sample = tutorSampleLine(key);
  const stop = sample.indexOf('. ');
  return {
    name: voice.persona.name,
    voice: voice.sound,
    signature: stop === -1 ? sample : sample.slice(0, stop + 1),
  };
}

// ─────────────────────────────────────────────────────────────── the level path

export type SceneState = LevelStop['state'];

export interface SpeakRow {
  missionId: Mission['id'];
  /** The scene's name in the learner's language. */
  title: string;
  /** The can-do, or the earned line once it is earned. */
  gloss: string;
  /** "About N min", from the mission's own shape. */
  meta: string;
  state: SceneState;
  /** Opens this scene's brief, first in the chooser. */
  route: { screen: 'Missions'; params: { focus: Mission['id'] } };
}

export interface SpeakPath {
  /** A0 then A1, each only when a scene carries it. */
  levels: PathLevel[];
  groups: { level: 'A0' | 'A1'; rows: SpeakRow[] }[];
}

const LEVELS = ['A0', 'A1'] as const;

export function speakPath(progress: readonly MissionProgress[]): SpeakPath {
  const earned = earnedMissionIds(progress);
  const next = spineFrom(progress).next;
  const spine = SCENE_SPINE.map((id) => getMission(id)).filter((mission): mission is Mission => mission !== undefined);

  const stateOf = (mission: Mission): SceneState =>
    earned.has(mission.id) ? 'earned' : next !== null && mission.id === next.id ? 'here' : 'ahead';

  const groups = LEVELS.map((level) => ({
    level,
    rows: spine
      .filter((mission) => mission.cefr === level)
      .map((mission): SpeakRow => {
        const state = stateOf(mission);
        return {
          missionId: mission.id,
          title: mission.titleEn,
          gloss: state === 'earned' ? mission.earnedEn : mission.canDoEn,
          meta: minutesLine(missionMinutes(mission)),
          state,
          route: { screen: 'Missions', params: { focus: mission.id } },
        };
      }),
  })).filter((group) => group.rows.length > 0);

  return {
    levels: groups.map((group) => ({
      level: group.level,
      stops: group.rows.map((row) => ({ canDo: row.gloss, state: row.state })),
    })),
    groups,
  };
}

// ─────────────────────────────────────────────────────── more ways to practise

export interface MoreWay {
  key: 'free' | 'rehearse' | 'memory';
  title: string;
  gloss: string;
  /** Null for the open conversation, which probes the tutor like the Start. */
  screen: 'Missions' | 'RealMoment' | 'TutorMemory' | null;
}

/**
 * The three other ways in. The open conversation and the real moment are the
 * door model's own rows, worded and routed by `gate.ts` (`tutorDoors()` and
 * `entryStart(key)`), so Speak keeps no second copy of either answer. The
 * chooser's door is not one of them: every scene row on the path opens it.
 */
export const MORE_WAYS: readonly MoreWay[] = [
  ...tutorDoors()
    .filter((door): door is typeof door & { key: 'free' | 'rehearse' } => door.key !== 'everyday')
    .map(({ key, label, gloss }): MoreWay => {
      const start = entryStart(key);
      return { key, title: label, gloss, screen: start.probe ? null : start.screen };
    }),
  { key: 'memory', title: 'What your tutor remembers', gloss: 'Your goals, remembered details and correction style.', screen: 'TutorMemory' },
];

/** Only after a first finished scene, earned or not. */
export function moreWaysOpen(progress: readonly MissionProgress[]): boolean {
  return progress.some((p) => p.timesFinished > 0);
}

/** Every line this module can put on Speak, for the copy sweeps. */
export const SPEAK_COPY: readonly string[] = [
  TYPE_INSTEAD,
  SPEAK_INSTEAD,
  PATH_LABEL,
  MORE_WAYS_LABEL,
  CHANGE_VOICE,
  withTutor(tutorVoice(DEFAULT_TUTOR_VOICE).persona.name),
  ...MORE_WAYS.flatMap((way) => [way.title, way.gloss]),
];
