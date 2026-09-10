/**
 * The tiny first-run answer that exists before an account exists.
 *
 * A voice, an age confirmation and the usage-data answer are enough to make the
 * account-creation hand-off personal without turning an unsigned device into a
 * second profile store.  There is deliberately no name, transcript, audio, or
 * free-form answer here.  Once an account exists the draft is folded into that
 * account's normal, user-scoped profile and this key is cleared.
 *
 * ## The consent rides here, and the version does not move
 *
 * `analyticsConsent` is the answer to the question the first run asks once,
 * carried across account creation because the account it belongs to does not
 * exist yet when it is given.  The version deliberately stays at 1: a draft
 * written before the field existed is a learner nobody asked, so the missing
 * field is repaired to `false` on load rather than rejecting the whole draft or
 * inventing an agreement.  That is the safe direction, and it is the only
 * direction — reading an absence as consent would opt in exactly the people who
 * were never given the chance to say no.
 *
 * The durable copy is `analytics/consentStore.ts` under the signed-in account.
 * This is a hand-off, not a second authority, and it is cleared with the rest of
 * the draft once the profile exists.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_TUTOR_VOICE, isTutorVoiceKey, type TutorVoiceKey } from '@luvani/core';

const KEY = '@luvani/pre-account-onboarding/v1';

export interface PreAccountOnboardingDraft {
  version: 1;
  /** The only eligibility fact the product needs at account creation. */
  ageConfirmed: true;
  /** A real choice, including the displayed default, never a vendor id. */
  tutorVoice: TutorVoiceKey;
  /**
   * Whether the learner agreed to usage data being sent, as asked once on the
   * first run.  False for anyone who has not said otherwise, which includes
   * every draft written before the question existed.
   */
  analyticsConsent: boolean;
}

export function freshPreAccountDraft(): PreAccountOnboardingDraft {
  return { version: 1, ageConfirmed: true, tutorVoice: DEFAULT_TUTOR_VOICE, analyticsConsent: false };
}

/** The two answers that decide whether a draft is a draft at all. */
function readable(value: unknown): boolean {
  return typeof value === 'object' && value !== null &&
    (value as { version?: unknown }).version === 1 &&
    (value as { ageConfirmed?: unknown }).ageConfirmed === true &&
    isTutorVoiceKey((value as { tutorVoice?: unknown }).tutorVoice);
}

/**
 * The stored draft as this build's shape, with the consent repaired forward.
 *
 * Only a literal `true` is agreement.  A missing field, a string, a number and
 * anything else a disk can hand back all read as `false`, because the question
 * is whether this learner said yes and every one of those means they did not.
 */
function repaired(value: object): PreAccountOnboardingDraft {
  const draft = value as PreAccountOnboardingDraft;
  return {
    version: 1,
    ageConfirmed: true,
    tutorVoice: draft.tutorVoice,
    analyticsConsent: (value as { analyticsConsent?: unknown }).analyticsConsent === true,
  };
}

/** A best-effort local hand-off; no account is ever blocked by a full disk. */
export async function savePreAccountDraft(draft: PreAccountOnboardingDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // The in-memory hand-off still covers this launch. Account creation must
    // never turn a storage write into an unexplained dead end.
  }
}

export async function loadPreAccountDraft(): Promise<PreAccountOnboardingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return readable(parsed) ? repaired(parsed as object) : null;
  } catch {
    return null;
  }
}

/** Called only after the draft has become the signed-in learner's profile. */
export async function clearPreAccountDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // It contains only a voice choice and a confirmation, and the account now
    // owns the durable copy. A later launch will safely try to clear it again.
  }
}
