/**
 * The tiny first-run answer that exists before an account exists.
 *
 * A voice, an age confirmation and the usage-data answer are enough to make the
 * account-creation hand-off personal without turning an unsigned device into a
 * second profile store.  There is deliberately no transcript, audio, or
 * free-form answer here, and the one typed value, an optional first name, is
 * bounded and stays on the device.  Once an account exists the draft is folded into that
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
 *
 * ## The plan answers ride here too (notebook Phase 5, spine contract section 3)
 *
 * The three one-tap answers, the minutes and reminder time chosen on the plan,
 * the page the learner is on, and an optional first name typed on the save
 * page. Still version 1: every new field is optional on disk, and anything a
 * disk can hand back that is not one of this build's values repairs to null,
 * which reads as "not answered yet". Nothing here leaves the device before an
 * account exists; `onboarding/createFromDraft.ts` writes it into the account's
 * own stores at creation, and the draft is then cleared.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_TUTOR_VOICE, isTutorVoiceKey, type TutorVoiceKey } from '@luvani/core';
import { REMINDER_TIMES, type ReminderTimeId } from '../reminders/reminder.ts';

const KEY = '@luvani/pre-account-onboarding/v1';

/**
 * Every page a draft can resume on, current and retired. Held here because
 * the draft resumes on one of them. Day one (`remind`) and the save card
 * (`keep`) come after the win (come alive, README Part 5.C rows 9 and 10) and
 * are appended, so every older page keeps its place.
 */
export const PRE_ACCOUNT_PAGES = ['hear-it', 'first-line', 'start-level', 'reason', 'time', 'frequency', 'plan', 'practice', 'recap', 'home', 'save', 'remind', 'keep'] as const;
export type PreAccountPage = (typeof PRE_ACCOUNT_PAGES)[number];

export const START_LEVEL_KEYS = ['zero', 'few', 'getby'] as const;
export type StartLevel = (typeof START_LEVEL_KEYS)[number];

export const REASON_KEYS = ['food', 'trip', 'family', 'moving', 'work', 'because'] as const;
export type Reason = (typeof REASON_KEYS)[number];

/**
 * The daily goal (founder decision D5): Casual 5, Regular 10, Serious 15 and
 * Intense 20 minutes, or "choose each time". Twenty is a goal, not a longer
 * starter: `guestProgress.ts` `starterMinutes` sends it to the starter as 15.
 */
export const PLAN_MINUTES = [5, 10, 15, 20, 'none'] as const;
export type PlanMinutes = (typeof PLAN_MINUTES)[number];

/** A first name, not a biography: long enough for any name, short enough for a greeting. */
export const MAX_FIRST_NAME_CHARS = 40;

export interface PreAccountOnboardingDraft {
  version: 1;
  drink?: 'coffee' | 'tea' | null;
  frequency?: 3 | 5 | 7 | 'none' | null;
  eligibilityConfirmed?: boolean;
  quickStart?: boolean;
  rememberLearning?: boolean;
  reminderEnabled?: boolean;
  reminderDays?: number[];
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
  /** Where the learner was, so leaving and coming back resumes there. */
  page: PreAccountPage | null;
  startLevel: StartLevel | null;
  reason: Reason | null;
  /** Null until changed on the plan; the plan shows the preset until then. */
  minutes: PlanMinutes | null;
  reminderTime: ReminderTimeId | null;
  /** Optional, typed on the save page. Never sent anywhere before an account exists. */
  firstName: string | null;
}

export function freshPreAccountDraft(): PreAccountOnboardingDraft {
  return {
    version: 1,
    ageConfirmed: true,
    tutorVoice: DEFAULT_TUTOR_VOICE,
    analyticsConsent: false,
    drink: null, frequency: null, eligibilityConfirmed: false, quickStart: false, rememberLearning: false, reminderEnabled: false, reminderDays: [],
    page: null,
    startLevel: null,
    reason: null,
    minutes: null,
    reminderTime: null,
    firstName: null,
  };
}

/** One of `allowed`, or null: the whole repair rule for a closed answer. */
function oneOf<T>(allowed: readonly T[], value: unknown): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

/**
 * A first name as the draft keeps it: trimmed, one line, no control characters,
 * and within the bound, or null. An over-long value is refused rather than cut,
 * because a cut name is a name nobody typed.
 */
export function firstNameFrom(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Joiners carry spelling in scripts such as Persian and Sinhala. All other
  // format/control characters are removed, including bidi overrides and ZWSP.
  const trimmed = value.replace(/(?![\u200c\u200d])[\p{Cf}\p{Cc}]/gu, '').trim();
  if (trimmed.replace(/[\u200c\u200d]/gu, '').trim().length === 0 || trimmed.length > MAX_FIRST_NAME_CHARS) return null;
  return trimmed;
}

/** The two answers that decide whether a draft is a draft at all. */
function readable(value: unknown): boolean {
  // The VOICE is deliberately not part of this. A key that has left the
  // catalogue is a repair, not a corruption: `repaired` lands it on the default
  // the same way `resolveTutorVoice` does at the agent and `tutorVoiceOf` does
  // on a stored profile. Requiring it here meant that retiring a voice threw the
  // whole draft away, and with it the learner's age confirmation and their
  // usage-data answer — the one thing this draft exists to carry across sign-up.
  return typeof value === 'object' && value !== null &&
    (value as { version?: unknown }).version === 1 &&
    (value as { ageConfirmed?: unknown }).ageConfirmed === true;
}

/**
 * The stored draft as this build's shape, with the consent repaired forward.
 *
 * Only a literal `true` is agreement.  A missing field, a string, a number and
 * anything else a disk can hand back all read as `false`, because the question
 * is whether this learner said yes and every one of those means they did not.
 */
export function repaired(value: object): PreAccountOnboardingDraft {
  const draft = value as PreAccountOnboardingDraft;
  return {
    version: 1,
    ageConfirmed: true,
    // A retired key becomes the default rather than nothing. Six voices replaced
    // eight in F503, so a draft written last week can name somebody who is no
    // longer in the catalogue, and that learner should meet the default tutor
    // rather than be asked every question again.
    tutorVoice: isTutorVoiceKey(draft.tutorVoice) ? draft.tutorVoice : DEFAULT_TUTOR_VOICE,
    analyticsConsent: (value as { analyticsConsent?: unknown }).analyticsConsent === true,
    // Every plan answer is optional on disk: a draft from before these pages
    // existed, or one with junk in a slot, reads as not answered yet.
    drink: oneOf(['coffee', 'tea'] as const, (value as { drink?: unknown }).drink),
    frequency: oneOf([3, 5, 7, 'none'] as const, (value as { frequency?: unknown }).frequency),
    eligibilityConfirmed: (value as { eligibilityConfirmed?: unknown }).eligibilityConfirmed === true,
    rememberLearning: (value as { rememberLearning?: unknown }).rememberLearning === true,
    reminderEnabled: (value as { reminderEnabled?: unknown }).reminderEnabled === true,
    quickStart: (value as { quickStart?: unknown }).quickStart === true,
    reminderDays: Array.isArray((value as { reminderDays?: unknown }).reminderDays) ? [...new Set((value as { reminderDays: unknown[] }).reminderDays.filter((n): n is number => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 7))] : [],
    page: oneOf(PRE_ACCOUNT_PAGES, (value as { page?: unknown }).page),
    startLevel: oneOf(START_LEVEL_KEYS, (value as { startLevel?: unknown }).startLevel),
    reason: oneOf(REASON_KEYS, (value as { reason?: unknown }).reason),
    minutes: oneOf(PLAN_MINUTES, (value as { minutes?: unknown }).minutes),
    reminderTime: oneOf(
      REMINDER_TIMES.map((time) => time.value),
      (value as { reminderTime?: unknown }).reminderTime,
    ),
    firstName: firstNameFrom((value as { firstName?: unknown }).firstName),
  };
}

// Saves and clears share one queue. A refusal invalidates answers not yet
// written, then removes the draft after any already-issued disk write settles.
let draftGeneration = 0;
let draftChain: Promise<void> = Promise.resolve();
function enqueueDraft(work: () => Promise<void>): Promise<void> {
  const next = draftChain.then(work, work).catch(() => {});
  draftChain = next;
  return next;
}

/** A best-effort local hand-off; no account is ever blocked by a full disk. */
export function savePreAccountDraft(draft: PreAccountOnboardingDraft): Promise<void> {
  const owner = draftGeneration;
  const encoded = JSON.stringify(draft);
  return enqueueDraft(async () => {
    if (owner !== draftGeneration) return;
    await AsyncStorage.setItem(KEY, encoded);
  });
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

/** Discarded on refusal or explicit account adoption/discard. Authentication preserves it. */
export function clearPreAccountDraft(): Promise<void> {
  draftGeneration++;
  return enqueueDraft(() => AsyncStorage.removeItem(KEY));
}
