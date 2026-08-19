/**
 * The learner's profile on the device, keyed to the signed-in account.
 *
 * One small JSON object: who they are, why they came, and the brain's learner
 * model. Version 2 added the account-era fields (name, date of birth, daily
 * goal); a version-1 profile upgrades in place and the learner is asked only
 * the questions they have never answered — the brain's memory of them is
 * never thrown away.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfile, repairProfile, type LearnerProfile } from '@parle/brain';
import { userKey } from '../storage/scope.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('profile');

export interface StoredProfile {
  version: 2;
  /** What they asked to be called. Null only on upgraded v1 profiles. */
  name: string | null;
  /** Date of birth as 'YYYY-MM-DD'. Null only on upgraded v1 profiles. */
  dob: string | null;
  /** Why they came, as the tag chosen during onboarding. */
  motivation: string;
  /** The daily practice promise they picked. */
  dailyGoalMin: 5 | 10 | 15;
  onboardedAt: number;
  /** The brain's learner model. Updated after live conversations. */
  brain: LearnerProfile;
}

export interface OnboardingAnswers {
  name: string;
  dob: string;
  motivation: string;
  dailyGoalMin: 5 | 10 | 15;
}

function upgradeV1(parsed: Record<string, unknown>): StoredProfile {
  return {
    version: 2,
    name: null,
    dob: null,
    motivation: typeof parsed.motivation === 'string' ? parsed.motivation : 'want',
    dailyGoalMin: 10,
    onboardedAt: typeof parsed.onboardedAt === 'number' ? parsed.onboardedAt : Date.now(),
    // The one thing that must survive any migration: what the tutor knows.
    brain: repairProfile(parsed.brain),
  };
}

export async function loadProfile(): Promise<StoredProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY());
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const version = (parsed as { version?: unknown }).version;
    if (version === 1) return upgradeV1(parsed as Record<string, unknown>);
    if (version !== 2) return null;
    // The cast used to stop here, which meant a v2 blob with a missing or
    // half-written `brain` travelled all the way to the tutor worker as the
    // session snapshot and crashed it on open. Repair at the door: this is the
    // only place the device's copy is read, so it is the only place that can
    // stop a bad one leaving.
    const stored = parsed as StoredProfile;
    return { ...stored, brain: repairProfile(stored.brain) };
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

export function createStoredProfile(answers: OnboardingAnswers, now = Date.now()): StoredProfile {
  return { version: 2, ...answers, onboardedAt: now, brain: createProfile() };
}

/** Fold onboarding answers into an existing (upgraded) profile, keeping the brain. */
export function completeProfile(existing: StoredProfile, answers: OnboardingAnswers): StoredProfile {
  return { ...existing, ...answers };
}
