/**
 * "Your sound to tune": the one sound Practice leads with (notebook Phase 3,
 * 2026-09-27).
 *
 * Sound is the signature of Practice, so the page opens on one sound, named by
 * its symbol and an example word (/ɔ̃/ bonjour), with the inventory's plain
 * mouth cue under it. Which sound, which word and which recording are decided
 * here, over data other modules own, and nothing is invented:
 *
 * - The sound is the newest one a MEASURED sound check called out
 *   (`isMeasuredCheck`). Pronunciation scoring is off by default, so most
 *   learners have none, and then the sound is the first one the guided café
 *   lesson works on, in the word it opens with: "Bonjour". That is authored
 *   teaching, not a claim about the learner, so it carries no measured fact.
 * - The example word is always one of the inventory's own examples.
 * - Native audio is a bundled tutor or daily recording, in the learner's chosen
 *   voice, of a line that says the example word. With none there is no audio:
 *   the phone's synthesiser is never offered here, so it can never be heard as
 *   the tutor.
 * - The learner's own recording is never offered. The app keeps none: every
 *   spoken attempt is discarded after it is scored (`speech/discardRecording.ts`),
 *   and this redesign adds no audio retention. `own` is always null and says so.
 */

import { CAFE_LESSON, getPhoneme, type TutorVoiceKey } from '@luvani/core';

import { LESSON_MINUTES, RECORDED_AUDIO } from '../copy/access.ts';
import { soundLine, isMeasuredCheck } from '../myfrench/sounds.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { tutorAudioFor, type TutorAudioPack } from '../daily/tutorAudio.ts';

export const SOUND_LEAD = {
  /** The block's one caps label. */
  label: 'Your sound to tune',
  /** Day one's one primary action: the guided lesson that opens on "Bonjour". */
  lesson: 'Start the bonjour sound lesson',
  /** Said under it, in the shared words for a lesson's cost. */
  lessonCost: LESSON_MINUTES,
  /** Where an unmeasured sound comes from, said plainly. */
  fromLesson: 'The first sound in the café lesson.',
  /** The quiet way to measure a sound a check already named. */
  check: 'Check this sound',
  /** The hear control, and what it says while playing. */
  hear: 'Hear it',
  stop: 'Stop',
} as const;

/** Every line this module can say, for the copy sweeps. */
export const SOUND_LEAD_COPY: readonly string[] = Object.values(SOUND_LEAD);

/** A catalogue line that may have a bundled recording: a daily word or phrase. */
export interface RecordedItem {
  id: string;
  fr: string;
}

/** A bundled recording of a line that says the example word. */
export interface RecordedLine {
  id: string;
  fr: string;
  asset: number;
  /** Always `RECORDED_AUDIO`: a recording is said to be one. */
  label: string;
}

export interface SoundLead {
  /** The IPA symbol, without slashes. */
  ipa: string;
  /** One of the inventory's own example words for the sound. */
  example: string;
  /** The inventory's plain-English mouth cue. */
  cue: string;
  /** The measured fact and the situation it was measured in, only when a check measured it. */
  measured: { line: string; missionId: string } | null;
  /** Where an unmeasured sound comes from, or null when it was measured. */
  source: string | null;
  /** A bundled recording that says the example word, or null. Never device speech. */
  native: RecordedLine | null;
  /** The learner's own recording. Always null: the app keeps none. */
  own: null;
}

/** Lowercased whole words, split on anything that is not a letter. */
function words(line: string): string[] {
  return line.toLowerCase().split(/[^\p{L}]+/u).filter((word) => word !== '');
}

/**
 * The day-one sound: the first sound the guided lesson works on, in the word
 * it opens with, as long as that word is one of the inventory's examples.
 */
function lessonSound(): { ipa: string; example: string } {
  const first = CAFE_LESSON.turns[0]!;
  const ipa = first.focusPhonemes[0]!;
  const examples = getPhoneme(ipa)?.examples ?? [];
  const said = new Set(words(first.target));
  const example = examples.find((word) => said.has(word.toLowerCase())) ?? examples[0] ?? first.target;
  return { ipa, example };
}

export const LESSON_SOUND: { readonly ipa: string; readonly example: string } = lessonSound();

/**
 * The shortest bundled line, in this voice, that says `word` as a whole word.
 *
 * Shortest, so the sound is heard with as little around it as possible. Only
 * the chosen voice: `tutorAudioFor` never fills a gap from another tutor.
 */
export function recordedLineFor(
  word: string,
  voice: TutorVoiceKey,
  recordings: TutorAudioPack,
  items: readonly RecordedItem[],
): RecordedLine | null {
  const target = word.toLowerCase();
  let best: RecordedLine | null = null;
  for (const item of items) {
    if (!words(item.fr).includes(target)) continue;
    const asset = tutorAudioFor(recordings, item.id, voice);
    if (asset === undefined) continue;
    if (best === null || item.fr.length < best.fr.length) best = { id: item.id, fr: item.fr, asset, label: RECORDED_AUDIO };
  }
  return best;
}

/** The newest measured check that named a sound this build knows, or null. */
function measuredSound(checks: readonly SoundCheckEvidence[], now: number): SoundCheckEvidence | null {
  let newest: SoundCheckEvidence | null = null;
  for (const check of checks) {
    if (!isMeasuredCheck(check) || check.phoneme === null || check.phoneme === '') continue;
    if (!Number.isFinite(check.at) || check.at > now) continue;
    if (getPhoneme(check.phoneme) === undefined) continue;
    if (newest === null || check.at > newest.at) newest = check;
  }
  return newest;
}

/**
 * The sound Practice leads with, or null when not even the lesson's sound can
 * be named (an inventory without it), in which case the block is not drawn.
 */
export function soundLead(input: {
  checks: readonly SoundCheckEvidence[];
  now: number;
  voice: TutorVoiceKey;
  recordings: TutorAudioPack;
  items: readonly RecordedItem[];
}): SoundLead | null {
  const measured = measuredSound(input.checks, input.now);
  const ipa = measured?.phoneme ?? LESSON_SOUND.ipa;
  const phoneme = getPhoneme(ipa);
  if (phoneme === undefined) return null;
  const example = measured === null ? LESSON_SOUND.example : phoneme.examples[0];
  if (example === undefined) return null;
  const line = measured === null ? null : soundLine(measured);
  return {
    ipa,
    example,
    cue: phoneme.cue,
    measured: measured === null || line === null ? null : { line, missionId: measured.missionId },
    source: measured === null ? SOUND_LEAD.fromLesson : null,
    native: recordedLineFor(example, input.voice, input.recordings, input.items),
    own: null,
  };
}
