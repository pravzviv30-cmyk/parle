/**
 * The tiny first-run answer that exists before an account exists.
 *
 * A voice and an age confirmation are enough to make the account-creation
 * hand-off personal without turning an unsigned device into a second profile
 * store.  There is deliberately no name, transcript, audio, or free-form
 * answer here.  Once an account exists the draft is folded into that account's
 * normal, user-scoped profile and this key is cleared.
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
}

export function freshPreAccountDraft(): PreAccountOnboardingDraft {
  return { version: 1, ageConfirmed: true, tutorVoice: DEFAULT_TUTOR_VOICE };
}

function readable(value: unknown): value is PreAccountOnboardingDraft {
  return typeof value === 'object' && value !== null &&
    (value as { version?: unknown }).version === 1 &&
    (value as { ageConfirmed?: unknown }).ageConfirmed === true &&
    isTutorVoiceKey((value as { tutorVoice?: unknown }).tutorVoice);
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
    return readable(parsed) ? parsed : null;
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
