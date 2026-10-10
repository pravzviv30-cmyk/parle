/**
 * Which voice the tutor speaks in, as a thing the learner can set.
 *
 * The catalogue itself is in `@luvani/core` and is shared with the token server
 * and the agent, because the chosen voice is a wire value before it is a
 * setting. What lives here is the app's half: how the six are offered, what a
 * learner reads while choosing, and how a stored key is turned back into a
 * choice. Same division `strictness.ts` makes, and this file is deliberately
 * shaped like it, because it is the same kind of question: a short closed list,
 * one tap, and nothing to fail.
 *
 * Two things are NOT here and must not move here.
 *
 * The vendor ids. They exist in exactly one process, the agent, which is the
 * only one holding the key that bills for them. Core's own test reads its
 * source back to prove none has leaked that far; this module is a further hop
 * from them again, and it ships inside the app bundle on a phone.
 *
 * The learner-facing description of a voice. `sound` comes off the catalogue
 * unchanged. A second sentence written here would be an unverified claim about
 * a recording nobody in this file has heard, and the rule the catalogue states
 * — gender, accent, and "young" for the one voice whose age band is known, and
 * nothing comparative — would then be enforced in one place and ignored in the
 * other.
 *
 * Everything here is a rule rather than a drawing, for the reason
 * `tutor/choosingView.ts` states: apps/mobile has no renderer, so a decision
 * inside a `.tsx` is a decision nothing can ask a question about.
 */

import {
  DEFAULT_TUTOR_VOICE,
  TUTOR_VOICES,
  isTutorVoiceKey,
  tutorVoice,
  tutorSampleLine,
  type TutorVoiceKey,
} from '@luvani/core';
import type { StoredProfile } from '../profile/store.ts';

export type { TutorVoiceKey };

/**
 * The order the sheet lists them in, taken from the catalogue rather than
 * restated.
 *
 * `Object.keys` on a frozen literal preserves insertion order for string keys,
 * and the catalogue's own comment says its order is the order a chooser shows
 * them in: the default first, then the rest. Retyping the six here would be a
 * second list that another voice would silently fall out of.
 */
export const TUTOR_VOICE_ORDER: readonly TutorVoiceKey[] = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];

export interface TutorVoiceOption {
  value: TutorVoiceKey;
  /** The persona's name, which is how a learner will refer to this voice. */
  label: string;
  /** The catalogue's own `sound` line, carried through untouched. */
  gloss: string;
  /**
   * The bilingual introduction this voice speaks in its sample clip, off the
   * catalogue unchanged. It is here for the same reason `gloss` is: the first-run
   * voice page prints it and the sample clip says it, so it is copy a learner
   * reads, and it belongs in the scan below. It was once typed out inside the
   * screen instead, and the screen and the audio drifted apart.
   */
  sample: string;
}

/**
 * The six options, in the order the sheet lists them.
 *
 * Built from the catalogue at import, so adding a voice in core adds a row here
 * and nowhere else has to be told.
 */
export const TUTOR_VOICE_OPTIONS: readonly TutorVoiceOption[] = TUTOR_VOICE_ORDER.map((value) => ({
  value,
  label: tutorVoice(value).persona.name,
  gloss: tutorVoice(value).sound,
  sample: tutorSampleLine(value),
}));

/** The row label on Profile. Says whose voice, not which field. */
export const TUTOR_VOICE_ROW = "Tutor's voice";

/** The sheet's own two lines. Honest about when a change is felt. */
export const TUTOR_VOICE_TITLE = "Tutor's voice";
export const TUTOR_VOICE_SUB = 'Change this whenever you like. Your daily audio and next conversation follow your choice.';

/**
 * Every learner-facing string this setting can put on a screen, flattened.
 *
 * The copy scan reads this list rather than the exports one by one, the way
 * `REMINDER_COPY` does, so a sentence added to this file is covered the moment
 * it is added. The catalogue's six `sound` lines are in it because they are
 * rendered by this sheet, and the rule about what a voice may be said to sound
 * like has to bite where a learner reads it.
 */
export const TUTOR_VOICE_COPY: readonly string[] = [
  TUTOR_VOICE_ROW,
  TUTOR_VOICE_TITLE,
  TUTOR_VOICE_SUB,
  ...TUTOR_VOICE_OPTIONS.flatMap((option) => [option.label, option.gloss, option.sample]),
];

/**
 * What this learner has chosen.
 *
 * Sceptical about the one field, the way `strictnessOf` and `reminderTime` are:
 * the value has been through a JSON blob, a version chain and possibly another
 * device's disk. Null means never chosen, which is the ordinary state of a new
 * account and not an error.
 *
 * It never answers null. That is the whole of F291: the app and the agent both
 * resolve an unchosen voice to `DEFAULT_TUTOR_VOICE`, so "unchosen" cannot come
 * to mean two different people at the two ends of the wire.
 */
export function tutorVoiceOf(profile: StoredProfile | null | undefined): TutorVoiceKey {
  const stored: unknown = profile?.tutorVoice;
  return isTutorVoiceKey(stored) ? stored : DEFAULT_TUTOR_VOICE;
}

/** The name shown on the settings row for what is currently set. */
export function tutorVoiceLabel(profile: StoredProfile | null | undefined): string {
  return tutorVoice(tutorVoiceOf(profile)).persona.name;
}

/**
 * Which sample is playing after a listen was tapped, and there is only ever
 * one.
 *
 * The rule this exists for: a learner comparing two voices taps the second one
 * while the first is still going, and hears both at once, which tells them
 * nothing about either. So a tap on a different voice REPLACES what is playing
 * rather than joining it, and a tap on the voice already playing stops it,
 * because the same control that started a sound is the obvious place to reach
 * to make it stop.
 *
 * Returning the key rather than mutating a player is what makes this checkable
 * at all. The screen holds one player and feeds it whatever this answers, so
 * "one at a time" is a property of the shape rather than a discipline somebody
 * has to remember on the next sheet that plays audio.
 */
export function nextSample(playing: TutorVoiceKey | null, tapped: TutorVoiceKey): TutorVoiceKey | null {
  return playing === tapped ? null : tapped;
}
