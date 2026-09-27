/**
 * The authored listening preview (Stage 4, item 4): a few lines a learner can
 * hear before a situation, and a label that names exactly where the sound
 * comes from.
 *
 * Pure. No network, no generation, and no import of the `@luvani/brain` root:
 * every line here is authored in core, and every recording is a bundled asset
 * looked up through `daily/tutorAudio.ts`, the same seam the daily cards use.
 *
 * ## Three sources, one label each
 *
 * - `recorded`: a bundled recording of the learner's chosen tutor voice. Only a
 *   daily situation can have one, and only for the line that was recorded.
 *   Another voice's recording is never borrowed (`tutorAudioFor` answers
 *   nothing for a voice that lacks the id).
 * - `device`: the phone's own French synthesiser. It is labelled "Device
 *   voice" and never the tutor's.
 * - `text`: neither. The lines are on screen and nothing plays.
 *
 * A mission has no recording anywhere in the app (the manifests hold `word:`
 * and `phrase:` keys only), so a mission is never `recorded`, whatever a
 * recordings pack passed in claims.
 *
 * ## Which situation line is recorded
 *
 * The recording `phrase:<sceneId>:0` is the text of `lines[0]`, the learner's
 * first line (`packages/core/src/daily/phrases.ts`). It is not `openingFr`,
 * which is a different sentence in every one of the five hundred scenes. So the
 * preview shows `lines`, and a recorded preview plays only the first of them.
 * The opening suggestion is shown only for a scene with no lines, as text.
 *
 * Every preview says it is an authored example, and nothing here judges or
 * listens to anything.
 */

import type { DailyScenario, Mission, TutorVoiceKey } from '@luvani/core';

import { AUTHORED_EXAMPLE, DEVICE_VOICE, RECORDED_AUDIO, TEXT_ONLY } from '../copy/access.ts';
import { tutorAudioFor, type TutorAudioPack } from '../daily/tutorAudio.ts';

export type PreviewSelection =
  | { kind: 'mission'; mission: Mission }
  | { kind: 'situation'; scenario: DailyScenario };

export interface PreviewEnv {
  /** The learner's chosen tutor voice (`dailyTutorVoice(profile.tutorVoice)`). */
  voice: TutorVoiceKey;
  /** The bundled recordings, normally `TUTOR_DAILY_AUDIO`. */
  recordings: TutorAudioPack;
  /** Whether `speech/tutorVoice.ts` found a French voice on this device. */
  deviceFrench: boolean;
}

export interface PreviewLine {
  fr: string;
  /** Null where core authors no English for the line; nothing is invented. */
  en: string | null;
}

export interface ListeningPreview {
  lines: PreviewLine[];
  /** One authored sentence of what the situation is. */
  context: string;
  audio: 'recorded' | 'device' | 'text';
  /** Exactly the source that plays. */
  label: string;
  /** Which lines the play control plays: every one, the recorded first one, or none. */
  plays: 'all' | 'first' | 'none';
  /** The bundled asset for a recorded preview, and only then. */
  asset?: number;
  note: string;
}

/** The control's own words. */
export const PREVIEW_COPY = {
  open: 'Hear an example first',
  close: 'Hide the example',
  play: 'Play the example',
  /** A recorded situation: only its first line has a recording. */
  playFirst: 'Play the first line',
  stop: 'Stop',
  failed: 'The example could not play. The lines are still here to read.',
} as const;

/** The recording id for a situation: its first line, as the daily phrase list names it. */
export function recordingIdFor(scenario: DailyScenario): string {
  return `phrase:${scenario.id}:0`;
}

function spoken(env: PreviewEnv, lines: readonly PreviewLine[]): Pick<ListeningPreview, 'audio' | 'label' | 'plays'> {
  if (lines.length > 0 && env.deviceFrench) return { audio: 'device', label: DEVICE_VOICE, plays: 'all' };
  return { audio: 'text', label: TEXT_ONLY, plays: 'none' };
}

export function previewFor(sel: PreviewSelection, env: PreviewEnv): ListeningPreview {
  if (sel.kind === 'mission') {
    const lines = sel.mission.referencePhrases.map((fr) => ({ fr, en: null }));
    return { lines, context: sel.mission.goalEn, ...spoken(env, lines), note: AUTHORED_EXAMPLE };
  }

  const scenario = sel.scenario;
  const authored = scenario.lines.map((line) => ({ fr: line.fr, en: line.en }));
  const lines = authored.length > 0 ? authored : [{ fr: scenario.openingFr, en: scenario.openingEn }];
  const asset = authored.length > 0 ? tutorAudioFor(env.recordings, recordingIdFor(scenario), env.voice) : undefined;
  if (asset !== undefined) {
    return { lines, context: scenario.bodyEn, audio: 'recorded', label: RECORDED_AUDIO, plays: 'first', asset, note: AUTHORED_EXAMPLE };
  }
  return { lines, context: scenario.bodyEn, ...spoken(env, lines), note: AUTHORED_EXAMPLE };
}
