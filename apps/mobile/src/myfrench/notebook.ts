/**
 * What My French draws in the notebook system (Phase 3, 2026-09-27), decided
 * here so the tab stays a layout.
 *
 * Four blocks, each only once it has something true to show:
 *
 * - The level and the can-dos earned: core's spine (`spineFrom`) over the
 *   learner's progress, one stop per scene. An earned stop reads its
 *   `earnedEn` line, the next scene is "here", and the rest are ahead. The
 *   level is A0 or A1 by core's rule. There is no rank name and no points:
 *   XP stays internal and nothing here reads it.
 * - The phrase bank: the newest kept phrases, each with audio that says whose
 *   voice it is. A bundled recording in the learner's chosen tutor voice is
 *   labelled as a recording; anything else is the phone's voice, and is named
 *   as the phone's.
 * - The sounds map: every sound in the inventory once, the example word first.
 *   A sound is marked only when a check the assessor measured called it out.
 *   An assessed-clear check names no sound, so nothing is ever marked "clear".
 *   The map is drawn only once a measured check exists at all.
 * - The first visit: one line on what will collect here, and nothing empty.
 */

import {
  FRENCH_PHONEMES,
  SCENE_SPINE,
  earnedMissionIds,
  getMission,
  reviewPhraseFor,
  spineFrom,
  type Mission,
  type MissionProgress,
  type ReviewCard,
  type TutorVoiceKey,
} from '@luvani/core';

import type { LevelStop, PathLevel } from '../components.tsx';
import { DEVICE_VOICE, RECORDED_AUDIO } from '../copy/access.ts';
import { tutorAudioForFrench, type TutorAudioPack } from '../daily/tutorAudio.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { isMeasuredCheck } from './sounds.ts';

export const NOTEBOOK = {
  /** The caps label over the level path. */
  levelLabel: 'Your level',
  /** Day one's one line: what this page will hold. */
  firstVisit: 'The things you can do in French, the phrases you keep, your sounds and your conversations will collect here.',
  /** The caps label over the sounds map. */
  soundsLabel: 'Your sounds',
  /** Under it: what the map is, and what may mark it. */
  soundsLine: 'Every French sound, led by a word that has it. Only a check the assessor measured can mark one.',
  /** Beside a sound a measured check called out. */
  calledOut: 'Called out in a check',
  /** The hear control on a phrase, and while it plays. */
  hear: 'Hear',
  stop: 'Stop',
} as const;

/** "You are working in A0." The level is the spine's, never a rank. */
export function levelLine(level: 'A0' | 'A1'): string {
  return `You are working in ${level}.`;
}

/**
 * What the phrase control says to a screen reader: what it will play and whose
 * voice it is at rest, and Stop while it plays, so the name matches the word
 * on the button (Phase 3 review, 2026-09-27).
 */
export function phraseControlLabel(fr: string, voice: string, playing: boolean): string {
  return playing ? `${NOTEBOOK.stop} ${fr}` : `${NOTEBOOK.hear} ${fr}. ${voice}`;
}

/** Every line this module can say, for the copy sweeps. */
export const NOTEBOOK_COPY: readonly string[] = [...Object.values(NOTEBOOK), levelLine('A0'), levelLine('A1')];

// ────────────────────────────────────────────────────────────── the level

export interface LevelPathView {
  level: 'A0' | 'A1';
  /** The levels that carry a scene, in order, each with its stops. */
  levels: readonly PathLevel[];
}

export function levelPathFrom(progress: readonly MissionProgress[]): LevelPathView {
  const spine = spineFrom(progress);
  const earned = earnedMissionIds(progress);
  const missions = SCENE_SPINE.map((id) => getMission(id)).filter((mission): mission is Mission => mission !== undefined);

  const stopOf = (mission: Mission): LevelStop => {
    if (earned.has(mission.id)) return { canDo: mission.earnedEn, state: 'earned' };
    if (spine.next !== null && spine.next.id === mission.id) return { canDo: mission.canDoEn, state: 'here' };
    return { canDo: mission.canDoEn, state: 'ahead' };
  };

  const levels: PathLevel[] = [];
  for (const cefr of ['A0', 'A1'] as const) {
    const stops = missions.filter((mission) => mission.cefr === cefr).map(stopOf);
    if (stops.length > 0) levels.push({ level: cefr, stops });
  }
  return { level: spine.level, levels };
}

// ────────────────────────────────────────────────────────── the phrase bank

/** How many kept phrases the bank shows before its door to the phrasebook. */
export const PHRASE_BANK_ROWS = 3;

export type PhraseAudio =
  | { kind: 'recorded'; asset: number; label: string }
  | { kind: 'device'; label: string };

export interface PhraseBankRow {
  id: string;
  fr: string;
  en: string;
  audio: PhraseAudio;
}

/**
 * The newest kept phrases, each with the most honest audio there is: a bundled
 * recording of exactly that line in the chosen voice, or the phone's voice,
 * named as the phone's.
 */
export function phraseBankFrom(input: {
  deck: readonly ReviewCard[];
  voice: TutorVoiceKey;
  recordings: TutorAudioPack;
  items: readonly { id: string; fr: string }[];
}): PhraseBankRow[] {
  return [...input.deck]
    .filter((card) => reviewPhraseFor(card) !== null)
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, PHRASE_BANK_ROWS)
    .map((card) => {
      const pair = reviewPhraseFor(card)!;
      const asset = tutorAudioForFrench(input.recordings, input.items, pair.fr, input.voice);
      const audio: PhraseAudio = asset === undefined ? { kind: 'device', label: DEVICE_VOICE } : { kind: 'recorded', asset, label: RECORDED_AUDIO };
      return { id: card.id, fr: pair.fr, en: pair.en, audio };
    });
}

// ─────────────────────────────────────────────────────────── the sounds map

export interface SoundCell {
  ipa: string;
  /** The inventory's own first example word, which leads the cell. */
  example: string;
  /** A measured check called this sound out. Never true for anything else. */
  calledOut: boolean;
}

export interface SoundsMap {
  cells: readonly SoundCell[];
  /** Drawn only once the assessor has measured something at all. */
  show: boolean;
}

export function soundsMapFrom(checks: readonly SoundCheckEvidence[], now: number): SoundsMap {
  const measured = checks.filter((check) => isMeasuredCheck(check) && Number.isFinite(check.at) && check.at <= now);
  const called = new Set(measured.filter((check) => check.kind === 'assessed-focus' && check.phoneme !== null).map((check) => check.phoneme!));
  return {
    cells: FRENCH_PHONEMES.map((phoneme) => ({ ipa: phoneme.ipa, example: phoneme.examples[0] ?? phoneme.ipa, calledOut: called.has(phoneme.ipa) })),
    show: measured.length > 0,
  };
}

// ────────────────────────────────────────────────────────── the first visit

/** Nothing earned, kept, measured or said yet. */
export function isFirstVisit(input: {
  progress: readonly MissionProgress[];
  deck: readonly ReviewCard[];
  checks: readonly SoundCheckEvidence[];
  packs: number;
}): boolean {
  return earnedMissionIds(input.progress).size === 0 && input.deck.length === 0 && !input.checks.some(isMeasuredCheck) && input.packs === 0;
}
