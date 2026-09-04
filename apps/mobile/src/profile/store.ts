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
 *
 * Version 5 is the one that remembers. The tutor's safety policy can end a
 * session because the learner said in a scene that they are under thirteen,
 * and until now that stop lasted exactly one session: the learner tapped start
 * and was in another scene seconds later, which made the product's one hard
 * boundary a per-utterance speed bump. `ageStopAt` is the moment that stop
 * landed, and it is a single nullable number rather than anything richer for
 * two reasons. It has to answer one question — is a stop standing — and it has
 * to be bounded, because a profile field that grows per session is a profile
 * that eventually will not fit anywhere it is sent.
 *
 * Its ceiling is named rather than hidden. It is a fact about this device: the
 * merge drops it, `adoptProfile` keeps this device's own across a fold, and so
 * a reinstall clears it and a second phone never learns about it. That is the
 * same strength the age gate already had, and it is what the founder accepted
 * rather than wait for the strong shape, which is a server-side account flag
 * needing durable server storage and an authenticated write path from the
 * agent. `docs/STATE_AND_STORAGE.md` records the ceiling where a learner's data
 * is described.
 *
 * Version 6 is the one that lets the learner choose who they are talking to.
 * `tutorVoice` is a key from the catalogue in `@luvani/core`, never a vendor id
 * — the vendor ids live in the agent alone, so a voice re-cloned or moved to
 * another vendor is a one-table edit there and this stored preference outlives
 * it. Null means never chosen, which the agent resolves to the catalogue
 * default; it is deliberately not written as 'luc', because "has not been asked
 * yet" and "asked for Luc" are different facts and the Profile row has to be
 * able to tell them apart. The field is bounded by construction: one key out of
 * eight, replaced on every choice, so nothing here grows per session.
 *
 * Version 7 is the one that remembers how the learner likes to answer.
 * `preferTyping` is a plain boolean: true means a conversation opens with the
 * reply box already showing and the microphone closed until the circle is
 * tapped, and the tutor still speaks. It is deliberately not the silent text
 * mode, which is a per-session door rather than a standing choice. False is
 * what every new profile and every upgraded one gets, because nobody has said
 * otherwise; `withPreferTyping` is its one door.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfile, repairProfile, type LearnerProfile } from '@luvani/brain/profile';
import type { TutorVoiceKey } from '@luvani/core';
import { onUserScopeReset, userKey } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';
import { ageConfirmedFromDob } from './age.ts';
import { upgradeStored } from './upgrade.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('profile');

export interface StoredProfile {
  version: 7;
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
  /**
   * When a session ended because the learner said they are under thirteen, as
   * a millisecond epoch. Null until one does, and null again once they pass
   * the age gate. Written by `withAgeStop`, cleared by `withAgeGatePassed`,
   * and read by `ageStopStanding` in `profile/age.ts` — three named doors
   * rather than a field anything may set, because this one closes the tutor.
   */
  ageStopAt: number | null;
  /**
   * Which catalogue voice the learner asked their tutor to speak with, as an
   * app-level key from `@luvani/core` — never a vendor id, which no process
   * outside the agent is allowed to hold. Null until they choose one, and the
   * agent reads null as the catalogue default. Written by `withTutorVoice`,
   * one named door, because the persona the tutor introduces itself with is
   * derived from this key and a field two places can set is a tutor that can
   * disagree with its own voice.
   */
  tutorVoice: TutorVoiceKey | null;
  /**
   * Does a conversation open with the reply box showing? The microphone stays
   * closed until the circle is tapped and the tutor still speaks, so this is a
   * way of answering, not a way of going quiet. Written by `withPreferTyping`,
   * one named door; false for everyone until they say otherwise.
   */
  preferTyping: boolean;
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

/**
 * Every write to this key, one at a time, with the account bound at enqueue.
 *
 * This file had no chain, which is the defect the F83 correction note recorded
 * in `recordSession`: two read-modify-writes over one key lose one of them, and
 * this key has two writers now — a finished session saving the brain's model,
 * and the sync engine folding the account's profile in through `adoptProfile`.
 * Without the chain the adoption's read and the session's write interleave and
 * whichever finishes second wins the whole blob.
 *
 * The key is resolved when the work is *asked for*, not when it runs, for the
 * reason review/store.ts states: a sign-out while a write is queued must never
 * redirect that write into the next learner's account.
 */
let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  const key = KEY();
  const run = () => mutation(key);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

/**
 * The profile exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 *
 * Deliberately *not* `loadProfile`. That upgrades and repairs on the way out,
 * and the merge policy runs its own version chain over both sides so that two
 * builds are compared like for like. Handing it an already-upgraded blob would
 * be this store deciding a schema question the merge owns.
 */
async function persistedProfile(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    // Unreadable is the same as absent: the fold merges against nothing and the
    // account's profile is adopted whole, which is what a fresh device does.
    return null;
  }
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

export function saveProfile(p: StoredProfile): Promise<void> {
  return serialized(async (key) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(p));
      markDirty('profile');
    } catch {
      // Storage full or unavailable. The profile still holds for this launch.
    }
  });
}

/**
 * Fold the account's profile into this device's, on this store's own chain.
 *
 * The engine hands over a fold rather than a finished profile, because it read
 * this key before the pull. A conversation that ended during the round trip
 * wrote the brain's new phrases and error patterns here, and a profile computed
 * before that conversation was written straight over them — then pushed, because
 * the save had already raised the dirty flag, so the session's learning was gone
 * on every device. Calling the fold here, inside the chain, between the read and
 * the write, is what keeps it: `mergeStoredProfiles` unions phrases and error
 * patterns by key and is idempotent, so folding a merge into a newer profile
 * cannot lose either side's learning.
 *
 * It is honest about what it still cannot promise. Everything outside those two
 * unions is taken whole from the evidence-heavier side, so a `cefr` or `memory`
 * delta written during the cycle can still lose the tiebreak. That is strictly
 * better than what it replaced, where such a write lost *every* field, and
 * field-wise merge is Phase 4's job with the rest of the mastery reconciliation.
 *
 * The result goes through the same two doors every read goes through:
 * `upgradeStored` for the schema version and `repairProfile` for the brain. The
 * merge came from a payload another device wrote, possibly on an older build, so
 * it gets exactly the scepticism a blob off this device's own disk gets — no
 * more, and above all no less. An unreadable one is declined rather than
 * written, because onboarding running again is recoverable and a corrupt profile
 * reaching the tutor worker is not.
 *
 * No `markDirty`: adopting is this device catching up with the account, not a
 * new local change. See sync/registry.ts.
 */
function adoptProfile(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key) => {
    const persisted = await persistedProfile(key);
    const folded = fold(persisted);
    const upgraded = upgradeStored(folded);
    if (!upgraded) return 'declined';
    // The one field an adoption may not touch. `ageStopAt` says a session ended
    // on THIS device because the learner said in a scene that they are under
    // thirteen, and the merge drops it from the account copy on purpose (see
    // `PROFILE_DEVICE_FIELDS` in @luvani/brain). Dropped from the account and
    // then adopted back would clear the stop on the first sync cycle after it
    // landed, which is the whole defect this field exists to fix, arriving by a
    // different door. So the device keeps its own, whatever the account says.
    const own = upgradeStored(persisted)?.ageStopAt ?? null;
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ ...upgraded, ageStopAt: own, brain: repairProfile(upgraded.brain) }));
    } catch {
      // Storage full or unavailable. The next cycle hands the same fold back.
    }
    return 'adopted';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('profile', adoptProfile);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);

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
    version: 7,
    name: answers.name,
    // Data minimisation, discharged without touching one stored record: from
    // v4 on nobody is asked for a date, so nobody has one written down. While
    // the old page is still on the tree it hands one over, which is enough to
    // answer the age question on the line below — and then it is let go.
    dob: null,
    ageConfirmed: confirmedFrom(answers, new Date(now)),
    // Nobody arrives already stopped. A learner reaching this function is one
    // the age gate has just let through.
    ageStopAt: null,
    // And nobody arrives having chosen a voice: onboarding does not ask, the
    // Profile row does. Writing the default key here instead would record a
    // choice the learner never made, and would make the row unable to say
    // whether they had picked Luc or simply never looked.
    tutorVoice: null,
    // And nobody arrives preferring to type. The row in Profile is where that
    // is said, and until it is said the circle is the way in.
    preferTyping: false,
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
  const confirmed = existing.ageConfirmed ?? confirmedFrom({ ...answers, dob }, new Date(now));
  const answered: StoredProfile = {
    ...existing,
    name: answers.name,
    dob,
    ageConfirmed: confirmed,
    motivation: answers.motivation,
    dailyGoalMin: answers.dailyGoalMin ?? existing.dailyGoalMin,
  };
  // Tapping through the age page is passing the age gate, wherever the page was
  // reached from. A learner sent back here by a stop is answering the same
  // question in the same words, so it clears through the same door the
  // standalone gate uses rather than a second rule that could disagree with it.
  return answers.ageConfirmed === true ? withAgeGatePassed(answered) : answered;
}

/**
 * Remember that a session ended because the learner said they are under
 * thirteen.
 *
 * Idempotent in the way that matters: a second stop overwrites the moment and
 * changes nothing else, so a child who meets the boundary twice is not recorded
 * twice and nothing accumulates. `frontend-engineer` calls this from the live
 * screens when `isUnderAgeStop` is true of the safety frame, and the ordinary
 * `update` on the profile context is the whole of the write.
 */
export function withAgeStop(existing: StoredProfile, now = Date.now()): StoredProfile {
  return { ...existing, ageStopAt: now };
}

/**
 * The learner has said, again, that they are thirteen or over.
 *
 * The doors open and the stop is forgotten. It is deliberately not kept as
 * history: nothing in the product reads "this learner was once stopped", and a
 * field nobody reads is a record of a child kept for no reason.
 */
export function withAgeGatePassed(existing: StoredProfile): StoredProfile {
  return { ...existing, ageStopAt: null };
}

/**
 * Set the daily practice promise. A plain spread, named so the field has one
 * write path — the goal is asked in Profile now, from exactly one row.
 */
export function withDailyGoal(existing: StoredProfile, dailyGoalMin: 5 | 10 | 15): StoredProfile {
  return { ...existing, dailyGoalMin };
}

/**
 * Choose the voice the tutor speaks with.
 *
 * A plain spread beside `withDailyGoal`, and named for the same reason: one
 * write path for a field several surfaces read. The parameter is the catalogue
 * key type rather than a string, so a voice that is not in `@luvani/core`'s
 * catalogue is a compile error here rather than an unknown key travelling to
 * the token server and on towards a vendor URL.
 *
 * There is no `withoutTutorVoice`. Null is what "never chosen" means, and
 * nothing in the product asks a learner to un-choose a voice — the row always
 * offers all eight, so changing their mind is picking another one.
 */
export function withTutorVoice(existing: StoredProfile, tutorVoice: TutorVoiceKey): StoredProfile {
  return { ...existing, tutorVoice };
}

/**
 * Say whether conversations should open with the reply box showing.
 *
 * A plain spread beside the other doors, and a boolean rather than a mode: the
 * microphone stays closed until the circle is tapped either way, and the tutor
 * speaks either way. The session reads it through `prefersTyping` in
 * `profile/typing.ts`, which is the one place the field is interpreted.
 */
export function withPreferTyping(existing: StoredProfile, preferTyping: boolean): StoredProfile {
  return { ...existing, preferTyping };
}

/** Claim a leaderboard username. A plain spread, named so the field has one write path. */
export function withUsername(existing: StoredProfile, username: string): StoredProfile {
  return { ...existing, username };
}
