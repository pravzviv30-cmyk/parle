/**
 * The learner's profile on the device.
 *
 * AsyncStorage is enough for now. The profile is one small JSON object — why
 * they came, what they are aiming for, and the brain's learner model — and
 * nothing here needs a backend. When accounts arrive this file is the only
 * thing that changes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfile, type LearnerProfile } from '@parle/brain';
import { userKey } from '../storage/scope.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('profile');

export interface StoredProfile {
  version: 1;
  /** Why they came, as the tag chosen during onboarding. */
  motivation: string;
  /** What they want French for, same provenance. */
  goal: string;
  onboardedAt: number;
  /** The brain's learner model. Updated after live conversations, later. */
  brain: LearnerProfile;
}

export async function loadProfile(): Promise<StoredProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY());
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if ((parsed as { version?: unknown }).version !== 1) return null;
    return parsed as StoredProfile;
  } catch {
    // A corrupt profile is not worth crashing over. Onboarding runs again.
    return null;
  }
}

export async function saveProfile(p: StoredProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(), JSON.stringify(p));
  } catch {
    // Storage full or unavailable. The profile still holds for this launch.
  }
}

export function createStoredProfile(motivation: string, goal: string, now = Date.now()): StoredProfile {
  return { version: 1, motivation, goal, onboardedAt: now, brain: createProfile() };
}
