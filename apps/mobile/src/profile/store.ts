/**
 * The learner's profile on the device, keyed to the signed-in account.
 *
 * One small JSON object: who they are, why they came, and the brain's learner
 * model. Version 2 added the account-era fields (name, date of birth, daily
 * goal); version 3 adds the leaderboard username, claimed lazily the first
 * time the friends surface needs one. Older profiles upgrade in place through
 * the pure chain in upgrade.ts and the learner is asked only the questions
 * they have never answered — the brain's memory of them is never thrown away.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfile, repairProfile, type LearnerProfile } from '@parle/brain';
import { userKey } from '../storage/scope.ts';
import { upgradeStored } from './upgrade.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('profile');

export interface StoredProfile {
  version: 3;
  /** What they asked to be called. Null only on upgraded v1 profiles. */
  name: string | null;
  /** Date of birth as 'YYYY-MM-DD'. Null only on upgraded v1 profiles. */
  dob: string | null;
  /** Why they came, as the tag chosen during onboarding. */
  motivation: string;
  /** The daily practice promise they picked. */
  dailyGoalMin: 5 | 10 | 15;
  onboardedAt: number;
  /** Leaderboard identity, e.g. 'camille.4821'. Null until first claimed. */
  username: string | null;
  /** The brain's learner model. Updated after live conversations. */
  brain: LearnerProfile;
}

export interface OnboardingAnswers {
  name: string;
  dob: string;
  motivation: string;
  dailyGoalMin: 5 | 10 | 15;
}

export async function loadProfile(): Promise<StoredProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY());
    if (!raw) return null;
    const upgraded = upgradeStored(JSON.parse(raw) as unknown);
    if (!upgraded) return null;
    // The cast used to stop at the version check, which meant a blob with a
    // missing or half-written `brain` travelled all the way to the tutor
    // worker as the session snapshot and crashed it on open. Repair at the
    // door: this is the only place the device's copy is read, so it is the
    // only place that can stop a bad one leaving.
    return { ...upgraded, brain: repairProfile(upgraded.brain) };
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
  return { version: 3, ...answers, onboardedAt: now, username: null, brain: createProfile() };
}

/** Fold onboarding answers into an existing (upgraded) profile, keeping the brain. */
export function completeProfile(existing: StoredProfile, answers: OnboardingAnswers): StoredProfile {
  return { ...existing, ...answers };
}

/** Claim a leaderboard username. A plain spread, named so the field has one write path. */
export function withUsername(existing: StoredProfile, username: string): StoredProfile {
  return { ...existing, username };
}
