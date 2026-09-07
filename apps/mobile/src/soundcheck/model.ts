import type { Mission, SessionPhonemeReport } from '@luvani/core';

export type SoundCheckKind = 'assessed-clear' | 'assessed-focus' | 'self-guided' | 'unavailable';

export interface SoundCheckEvidence {
  missionId: string;
  reference: string;
  at: number;
  kind: SoundCheckKind;
  /** The assessor's one learner-safe sentence. Never a number. */
  focus: string | null;
  /**
   * Which sound it was about, as an IPA symbol, or null when nothing was named.
   *
   * The assessor has always known this and always thrown it away: `focus` kept
   * the sentence and the identity went with the report. That left every later
   * surface with prose it could print and nothing it could look up, so My
   * French could say "one sound is ready to revisit" and never say which. The
   * key is nullable at `version: 1` rather than a new version on purpose: this
   * store has no upgrade function and returns an empty array on a version it
   * does not recognise, so a bump would silently delete every check every
   * learner has ever recorded. It is written on every row, `null` included, so
   * a device on this build and one on the old do not read the same attempt as
   * two rows under whole-row merge identity (F468).
   */
  phoneme: string | null;
}

export interface SoundCheckDecision {
  kind: SoundCheckKind;
  focus: string | null;
  phoneme: string | null;
  headline: string;
  detail: string;
}

/**
 * Pick the next known-reference line, rotating only after real attempts.
 * Nothing arbitrary from a transcript is ever eligible for assessment.
 */
export function nextSoundCheckReference(
  mission: Mission,
  evidence: readonly SoundCheckEvidence[],
): string | null {
  if (mission.referencePhrases.length === 0) return null;
  const mine = evidence
    .filter((item) => item.missionId === mission.id)
    .sort((a, b) => b.at - a.at)[0];
  if (!mine) return mission.referencePhrases[0] ?? null;
  const previous = mission.referencePhrases.indexOf(mine.reference);
  return mission.referencePhrases[(previous + 1) % mission.referencePhrases.length] ?? mission.referencePhrases[0] ?? null;
}

/** Convert scorer evidence into words the learner can safely act on. */
export function soundCheckDecision(
  observations: number,
  report: SessionPhonemeReport | null,
): SoundCheckDecision {
  if (observations <= 0 || report === null) {
    return {
      kind: 'unavailable',
      focus: null,
      phoneme: null,
      headline: 'No pronunciation verdict this time.',
      detail: 'Your attempt still counts as practice. The assessor did not return enough evidence to judge it reliably.',
    };
  }
  if (report.focus !== null) {
    return {
      kind: 'assessed-focus',
      focus: report.focus.reason,
      phoneme: report.focus.phoneme.ipa,
      headline: 'One sound to try again.',
      detail: report.focus.reason,
    };
  }
  return {
    kind: 'assessed-clear',
    focus: null,
    phoneme: null,
    headline: 'That line held together.',
    detail: 'The assessor found no single sound with enough evidence to call out.',
  };
}

export const SELF_GUIDED: SoundCheckDecision = {
  kind: 'self-guided',
  focus: null,
  phoneme: null,
  headline: 'You said the line.',
  detail: 'This was listen-and-repeat practice. Luvani did not assess your pronunciation.',
};
