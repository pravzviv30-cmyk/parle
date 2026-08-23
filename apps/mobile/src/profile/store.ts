/**
 * The learner's profile on the device, keyed to the signed-in account.
 *
 * One small JSON object: who they are, why they came, and the brain's learner
 * model. Version 2 added the account-era fields (name, date of birth, daily
 * goal); version 3 added the leaderboard username, claimed lazily the first
 * time the friends surface needs one. Older profiles upgrade in place through
 * the pure chain in upgrade.ts and the learner is asked only the questions
 * they have never answered — the brain's memory of them is never thrown away.
 *
 * Version 4 is the data-minimisation version. A new learner is never asked for
 * a date of birth, only whether they are thirteen or over, so `ageConfirmed`
 * joins and `createStoredProfile` writes `dob: null` for everyone who signs up
 * from here on. The `dob` field itself stays forever: thousands of learners
 * already answered that question, and dropping the field would be deleting
 * their answer rather than declining to ask the next person.
 *
 * `motivation` and `dailyGoalMin` widen to nullable in the same version,
 * because neither is on the critical path any more — the goal is asked in
 * Profile now, and both may honestly be unanswered. Nothing outside this file
 * and the onboarding flow reads either one.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfile, repairProfile, type LearnerProfile } from '@parle/brain/profile';
import { userKey } from '../storage/scope.ts';
import { ageConfirmedFromDob } from './age.ts';
import { upgradeStored } from './upgrade.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('profile');

export interface StoredProfile {
  version: 4;
  /** What they asked to be called. Null when they skipped the question. */
  name: string | null;
  /**
   * Date of birth as 'YYYY-MM-DD', for the learners who were asked for one
   * before v4. Null for everyone who joined after, and never asked for again.
   * The field is kept forever: it is their answer, not ours to delete.
   */
  dob: string | null;
  /**
   * Did the learner say they are thirteen or over? True when they tapped the
   * confirmation, or when a stored dob puts them at or over the floor. Null
   * means nobody has ever asked — it is never false, because a denial is a
   * statement only the learner can make, and one they are never let past.
   */
  ageConfirmed: boolean | null;
  /** Why they came, as the tag chosen during onboarding. Null when skipped. */
  motivation: string | null;
  /** The daily practice promise, set in Profile. Null until they pick one. */
  dailyGoalMin: 5 | 10 | 15 | null;
  onboardedAt: number;
  /** Leaderboard identity, e.g. 'camille.4821'. Null until first claimed. */
  username: string | null;
  /** The brain's learner model. Updated after live conversations. */
  brain: LearnerProfile;
}

/**
 * What onboarding hands back.
 *
 * `dob` and `dailyGoalMin` are optional and transitional: the three-page flow
 * asks for neither, but the flow on the tree still passes both, and a type
 * that refuses them would leave the repo red between two waves of this round.
 * frontend-engineer tightens this to `{ name, ageConfirmed, motivation }` when
 * the new OnboardingFlow lands.
 */
export interface OnboardingAnswers {
  name: string | null;
  /** The learner tapped "I am 13 or older". */
  ageConfirmed?: boolean;
  /** Transitional — the old date-of-birth page. Removed with that page. */
  dob?: string | null;
  motivation: string | null;
  /** Transitional — the old goal page. The goal is a Profile row now. */
  dailyGoalMin?: 5 | 10 | 15 | null;
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

/**
 * What the learner's answers let us say about their age.
 *
 * A tap on the confirmation is them saying it. A date of birth at or over the
 * floor is them having said it a longer way. Nothing else is an answer, and
 * the result is never false: the flow does not let anyone through who cannot
 * confirm, so a stored false could only ever be something we made up.
 */
function confirmedFrom(answers: OnboardingAnswers, now: Date): boolean | null {
  if (answers.ageConfirmed === true) return true;
  return ageConfirmedFromDob(answers.dob, now);
}

export function createStoredProfile(answers: OnboardingAnswers, now = Date.now()): StoredProfile {
  return {
    version: 4,
    name: answers.name,
    // Data minimisation, discharged without touching one stored record: from
    // v4 on nobody is asked for a date, so nobody has one written down. While
    // the old page is still on the tree it hands one over, which is enough to
    // answer the age question on the line below — and then it is let go.
    dob: null,
    ageConfirmed: confirmedFrom(answers, new Date(now)),
    motivation: answers.motivation,
    dailyGoalMin: answers.dailyGoalMin ?? null,
    onboardedAt: now,
    username: null,
    brain: createProfile(),
  };
}

/**
 * Fold onboarding answers into an existing (upgraded) profile, keeping the
 * brain — and keeping anything the new flow no longer asks about. A learner
 * running onboarding a second time is answering the questions in front of
 * them, not withdrawing the ones that are gone.
 */
export function completeProfile(existing: StoredProfile, answers: OnboardingAnswers, now = Date.now()): StoredProfile {
  const dob = answers.dob ?? existing.dob;
  return {
    ...existing,
    name: answers.name,
    dob,
    ageConfirmed: existing.ageConfirmed ?? confirmedFrom({ ...answers, dob }, new Date(now)),
    motivation: answers.motivation,
    dailyGoalMin: answers.dailyGoalMin ?? existing.dailyGoalMin,
  };
}

/**
 * Set the daily practice promise. A plain spread, named so the field has one
 * write path — the goal is asked in Profile now, from exactly one row.
 */
export function withDailyGoal(existing: StoredProfile, dailyGoalMin: 5 | 10 | 15): StoredProfile {
  return { ...existing, dailyGoalMin };
}

/** Claim a leaderboard username. A plain spread, named so the field has one write path. */
export function withUsername(existing: StoredProfile, username: string): StoredProfile {
  return { ...existing, username };
}
