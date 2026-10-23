/**
 * What a stored answer about the speech dataset means, and the words a learner reads.
 *
 * Inert groundwork. A future, consented dataset of learners saying known
 * lesson lines, rated by French teachers to calibrate pronunciation scoring.
 * Nothing here records, uploads or keeps audio: today's promise that live
 * audio is not stored (legal/policy.ts) stands unchanged. The plan and the
 * conditions for switching it on live in docs/changes/speech-dataset.md.
 *
 * Mirrors analytics/consent.ts: this file decides what an answer means, and
 * `consentStore.ts` only says what is on the disk.
 */

/**
 * Whether Settings draws the speech-sharing switch at all.
 *
 * Stays false until legal review and the privacy policy change described in
 * docs/changes/speech-dataset.md have both landed. Flipping it alone collects
 * nothing: the server flag and the upload signer are also off.
 */
export const SPEECH_DATASET_ENABLED = false;

/**
 * The wording a learner agreed to. Bump it when what sharing means changes, so
 * an older yes reads as no until the learner is asked again.
 */
export const SPEECH_CONSENT_VERSION = 1;

/** What the learner said, and to which version of the wording. */
export interface StoredSpeechConsent {
  allowed: boolean;
  version: number;
}

/**
 * True only for a literal `true` given to the current wording. A missing
 * record, a malformed blob, a string `'true'`, a `1` and an older version all
 * read as no. Reading a genuine yes as no costs the learner nothing, because
 * Luvani works the same either way.
 */
export function speechConsentGranted(stored: unknown): boolean {
  if (typeof stored !== 'object' || stored === null) return false;
  const answer = stored as { allowed?: unknown; version?: unknown };
  return answer.allowed === true && answer.version === SPEECH_CONSENT_VERSION;
}

/** The switch itself. */
export const SPEECH_CONSENT_ROW = 'Share my practice recordings';

/** What sharing is for, in the row itself. */
export const SPEECH_CONSENT_SUB = 'French teachers rate the lesson lines you say, to make sound feedback fairer.';

/** What a screen reader announces for the switch. */
export const SPEECH_CONSENT_LABEL = 'Share recordings of the lesson lines you say with French teachers';

/** The disk refused the write. About this phone, not about the decision. */
export const SPEECH_CONSENT_SAVE_TROUBLE = 'Your phone could not save that. The switch is as it was, and you can try again.';

/** A short explainer for a later sheet. Never implies sharing is required. */
export const SPEECH_CONSENT_EXPLAINER: readonly string[] = [
  'You can choose to share recordings of the lesson lines you say.',
  'French teachers rate them to help make sound feedback fairer for English speakers.',
  'This is separate from usage data, and Luvani works the same either way.',
  'You can turn it off any time, and your recordings are removed.',
];

/** Every word this decision says to a learner, flattened for the copy scans. */
export const SPEECH_CONSENT_COPY: readonly string[] = [
  SPEECH_CONSENT_ROW,
  SPEECH_CONSENT_SUB,
  SPEECH_CONSENT_LABEL,
  SPEECH_CONSENT_SAVE_TROUBLE,
  ...SPEECH_CONSENT_EXPLAINER,
];
