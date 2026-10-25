/**
 * Slower voice: the row's words and the one decision behind its switch.
 *
 * Separate from pace (pace.ts), which changes the sentences. This changes how
 * fast the voice speaks, and is read when a session starts. A learner who has
 * never touched it gets the tutor's own default: slower while a beginner (A0 or
 * A1, or no estimate yet). The switch shows that default rather than "off", so
 * it never says something the tutor is not doing.
 */
import type { StoredProfile } from '../profile/store.ts';
import type { VoiceSpeedChoice } from '../live/voiceSpeedPreference.ts';

export const VOICE_SPEED_ROW = 'Slower voice';
export const VOICE_SPEED_SUB = 'The tutor speaks a little more slowly. It starts on while you are a beginner.';

const BEGINNER: ReadonlySet<string> = new Set(['A0', 'A1']);

/** The tutor's default for a learner who has not chosen. */
export function voiceSpeedDefaultOn(cefr: string | null | undefined): boolean {
  return cefr == null || BEGINNER.has(cefr);
}

/** What the switch shows: the choice when there is one, the default otherwise. */
export function voiceSpeedSwitchValue(choice: VoiceSpeedChoice, cefr: string | null | undefined): boolean {
  if (choice === 'slower') return true;
  if (choice === 'normal') return false;
  return voiceSpeedDefaultOn(cefr);
}

/**
 * The same, read from a stored profile. Kept here so the settings screen never
 * touches the learner model itself: it only reads the estimate, never edits it.
 */
export function voiceSpeedSwitchFor(choice: VoiceSpeedChoice, profile: StoredProfile | null | undefined): boolean {
  return voiceSpeedSwitchValue(choice, profile?.brain?.cefr?.estimate);
}
