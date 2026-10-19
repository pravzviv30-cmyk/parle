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
 *
 * Version 8 is the one that lets the learner edit what the tutor remembers
 * (F562, F563). The brain keeps up to twelve facts about the learner's life,
 * written by the post-session extraction, and until now no screen showed them
 * and nothing could remove one. `forgottenFacts` is the list of facts the
 * learner asked to forget, as the normalised keys the extraction itself dedupes
 * on, because a fact merely deleted from the brain returns the next session
 * that mentions it. `learnerGoals` is up to three lines the learner wrote
 * about what they want from French; they ride into a conversation appended
 * after the remembered facts, because the agent sends the last five. Both live
 * in `profile/memory.ts`, which is the only thing that writes either.
 *
 * Version 9 is the one with the fourth daily goal (founder decision D5):
 * `dailyGoalMin` may now be 20, Intense, beside 5, 10 and 15. No field is
 * added; the version moves because an older build reads 20 as "no goal", and
 * a profile it merged would push that loss to every device. With the version
 * moved, an older build goes quiet on profile sync until it updates instead.
 * `practiceDaysPerWeek` is no longer asked for; a value already on a disk is
 * still read and carried, never dropped.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfile, repairProfile, withoutForgottenMemory, validMemoryControl, type LearnerProfile } from '@luvani/brain/profile';
import { preferenceValue, preferenceClocks, sanitisePreferenceClocks, maxPreferenceCounter, newPreferenceClock, resolvePreferenceClocks, type PreferenceField, type PreferenceClock, type PreferenceClocks } from '@luvani/brain/profile/merge';
import type { TutorVoiceKey } from '@luvani/core';
import { activeUserId, onUserScopeReset, userKey, scopeGeneration, writeInUserScope } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';
import { ageConfirmedFromDob } from './age.ts';
import { upgradeStored } from './upgrade.ts';
import { storedPracticePreferences, type PracticePreferences } from './practicePreferences.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('profile');

export interface StoredProfile {
  version: 9;
  /** Explicit starting/support choices; independent of the brain's earned CEFR. */
  practicePreferences?: PracticePreferences;
  /** A new profile still owes its name question; absent on legacy profiles. */
  namePromptPending?: boolean;
  /** Exact-value-bound setting edits. No age, DOB, entitlement or identity authority. */
  preferenceClocks?: PreferenceClocks;
  practiceDaysPerWeek?: 3 | 5 | 7 | 'none' | null;
  onboardingGoal?: string | null;
  onboardingDrink?: 'coffee' | 'tea' | null;
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
  /**
   * Facts the learner asked the tutor to forget, as the normalised keys the
   * extraction dedupes on. A tombstone rather than a deletion, because the
   * next session that mentions the same wording would write it back. No expiry,
   * written only by `profile/memory.ts`, and unioned across devices by the
   * brain's merge so a forget anywhere is a forget everywhere.
   */
  forgottenFacts: string[];
  /**
   * What the learner wrote they want from French, up to three short lines.
   * Appended after the remembered facts in the session snapshot, because the
   * agent sends the last five and a goal placed first would never ride.
   */
  learnerGoals: string[];
  /** Why they came, as the tag chosen during onboarding. Null when skipped. */
  motivation: string | null;
  /** The daily practice promise in minutes, set in Profile. Null until they pick one. 20 since v9. */
  dailyGoalMin: 5 | 10 | 15 | 20 | null;
  onboardedAt: number;
  /** Friends identity, e.g. 'camille.4821'. Null until first claimed. */
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
  dailyGoalMin?: 5 | 10 | 15 | 20 | null;
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

interface PreferenceEdit {
  owner: string | null;
  generation: number;
  observed: number;
  value: unknown;
  clock?: PreferenceClock;
}
// Explicit UI intent cannot be inferred from a stale whole-profile/recap save.
// It stays in memory until the serialized durable write assigns a clock. The
// same object retried reuses that exact operation; adoption never creates one.
const preferenceEdits = new WeakMap<StoredProfile, Map<PreferenceField, PreferenceEdit>>();

/** Compose setting builders without detaching their account-bound, exact-value intent. */
export function carryPreferenceEdits(existing: StoredProfile, next: StoredProfile): StoredProfile {
  const edits = new Map([...(preferenceEdits.get(existing) ?? []), ...(preferenceEdits.get(next) ?? [])]);
  if (edits.size) preferenceEdits.set(next, edits);
  return next;
}

export function withPreferenceEdit(existing: StoredProfile, next: StoredProfile, field: PreferenceField): StoredProfile {
  carryPreferenceEdits(existing, next);
  const edits = new Map(preferenceEdits.get(next));
  if (preferenceValue(existing, field) !== preferenceValue(next, field)) {
    edits.set(field, { owner: activeUserId(), generation: scopeGeneration(), observed: maxPreferenceCounter(existing), value: preferenceValue(next, field) });
  }
  if (edits.size) preferenceEdits.set(next, edits);
  return next;
}

async function mutationId(): Promise<string> {
  // Web/Node expose WebCrypto; the native implementation is Expo's UUIDv4.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return (await import('expo-crypto')).randomUUID();
}

async function orderedPreferences(p: StoredProfile, held: StoredProfile | null, generation: number): Promise<StoredProfile> {
  const clocks = preferenceClocks(p);
  let observed = Math.max(maxPreferenceCounter(p, held), ...[...(preferenceEdits.get(p)?.values() ?? [])].map((edit) => Math.max(edit.observed, edit.clock?.counter ?? 0)));
  for (const [field, edit] of preferenceEdits.get(p) ?? []) {
    if (edit.owner !== activeUserId() || edit.generation !== generation) throw new Error('preference edit scope changed');
    if (generation !== scopeGeneration()) throw new Error('preference edit scope changed');
    if (edit.value !== preferenceValue(p, field)) throw new Error('preference edit value changed');
    if (!edit.clock) edit.clock = newPreferenceClock(p, field, await mutationId(), observed);
    if (edit.clock.value !== preferenceValue(p, field)) throw new Error('preference edit value changed');
    clocks[field] = edit.clock;
    observed = Math.max(observed, edit.clock.counter);
  }
  const candidate = sanitisePreferenceClocks({ ...p, preferenceClocks: clocks });
  // Persist a new brain while retaining independently newer settings. Missing
  // or stale clocks in a recap are never evidence of a new settings action.
  return resolvePreferenceClocks(candidate, held, candidate);
}

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
    return sanitisePreferenceClocks({ ...upgraded, brain: withoutForgottenMemory(repairProfile(upgraded.brain), upgraded.forgottenFacts) });
  } catch {
    // A corrupt profile is not worth crashing over. Onboarding runs again.
    return null;
  }
}

/** Read failures must not masquerade as absence and erase existing privacy choices. */
async function profileAt(key: string): Promise<StoredProfile | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  const value = upgradeStored(JSON.parse(raw) as unknown);
  if (!value) throw new Error('profile cannot be read');
  return sanitisePreferenceClocks({ ...value, brain: withoutForgottenMemory(repairProfile(value.brain), value.forgottenFacts) });
}

export function saveProfile(p: StoredProfile): Promise<boolean> {
  const generation = scopeGeneration();
  return serialized(async (key) => {
    try {
      const held = await profileAt(key);
      const ordered = await orderedPreferences(p, held, generation);
      const forgottenFacts = [...new Set([...(held?.forgottenFacts ?? []), ...p.forgottenFacts])];
      const before = validMemoryControl(held?.brain.memory.control);
      const proposed = validMemoryControl(p.brain.memory.control);
      const newerHeld = before && (!proposed || before.changedAt > proposed.changedAt || (before.changedAt === proposed.changedAt && before.paused && !proposed.paused));
      const memory = newerHeld && held ? held.brain.memory : p.brain.memory;
      const next = { ...ordered, forgottenFacts, brain: withoutForgottenMemory({ ...ordered.brain, memory }, forgottenFacts) };
      // A stale recap/profile object predating the onboarding choice is not a
      // withdrawal. Keep the existing bounded answer until a real one replaces it.
      const preferences = storedPracticePreferences(p.practicePreferences) ?? storedPracticePreferences(held?.practicePreferences);
      if (preferences) next.practicePreferences = preferences;
      else delete next.practicePreferences;
      // A recap captured before signup finished cannot erase its pending name
      // question. A causally retained nonblank name always finishes that ask.
      const namePrompt = typeof p.namePromptPending === 'boolean' ? p.namePromptPending : held?.namePromptPending;
      if (typeof namePrompt === 'boolean') next.namePromptPending = typeof next.name === 'string' && next.name.trim().length > 0 ? false : namePrompt;
      else delete next.namePromptPending;
      if (!(await writeInUserScope(generation, () => AsyncStorage.setItem(key, JSON.stringify(next))))) return false;
      markDirty('profile');
      return true;
    } catch { return false; }
  });
}

/** Privacy changes are read/edited/written on the same queue and acknowledged. */
export function saveMemoryChange(edit: (profile: StoredProfile) => StoredProfile): Promise<StoredProfile | null> {
  const generation = scopeGeneration();
  return serialized(async (key) => {
    try {
      if (generation !== scopeGeneration()) return null;
      const held = await profileAt(key);
      if (!held || generation !== scopeGeneration()) return null;
      const edited = await orderedPreferences(edit(held), held, generation);
      const next = { ...edited, brain: withoutForgottenMemory(edited.brain, edited.forgottenFacts) };
      if (!(await writeInUserScope(generation, () => AsyncStorage.setItem(key, JSON.stringify(next))))) return null;
      markDirty('profile');
      return next;
    } catch { return null; }
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
  const generation = scopeGeneration();
  return serialized(async (key) => {
    const persisted = await profileAt(key);
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
      const next = sanitisePreferenceClocks({ ...upgraded, ageStopAt: own, brain: withoutForgottenMemory(repairProfile(upgraded.brain), upgraded.forgottenFacts) });
      if (!(await writeInUserScope(generation, () => AsyncStorage.setItem(key, JSON.stringify(next))))) throw new Error('profile scope changed');
    } catch {
      // Throwing keeps the namespace pending; the engine retries on the next cycle.
      throw new Error('profile adoption could not be saved');
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
    version: 9,
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
    // And nobody arrives having forgotten anything or written a goal. Both
    // are said in Profile, through `profile/memory.ts`.
    forgottenFacts: [],
    learnerGoals: [],
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
  const ordered = withPreferenceEdit(existing, withPreferenceEdit(existing, answered, 'name'), 'dailyGoalMin');
  return answers.ageConfirmed === true ? withAgeGatePassed(ordered) : ordered;
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
  return carryPreferenceEdits(existing, { ...existing, ageStopAt: now });
}

/**
 * The learner has said, again, that they are thirteen or over.
 *
 * The doors open and the stop is forgotten. It is deliberately not kept as
 * history: nothing in the product reads "this learner was once stopped", and a
 * field nobody reads is a record of a child kept for no reason.
 */
export function withAgeGatePassed(existing: StoredProfile): StoredProfile {
  return carryPreferenceEdits(existing, { ...existing, ageStopAt: null });
}

/**
 * Set the daily practice promise. A plain spread, named so the field has one
 * write path — the goal is asked in Profile now, from exactly one row.
 */
export function withDailyGoal(existing: StoredProfile, dailyGoalMin: 5 | 10 | 15 | 20 | null): StoredProfile {
  return withPreferenceEdit(existing, { ...existing, dailyGoalMin }, 'dailyGoalMin');
}

/**
 * The days-a-week answer, which the daily goal replaces (decision D5).
 *
 * Kept only while the Profile row that calls it is still on screen; the field
 * itself is read and carried by the version chain for as long as any disk holds
 * one. Nothing new should write it.
 */
export function withPracticeDays(existing: StoredProfile, practiceDaysPerWeek: 3 | 5 | 7 | 'none'): StoredProfile {
  return { ...existing, practiceDaysPerWeek };
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
  return withPreferenceEdit(existing, { ...existing, tutorVoice }, 'tutorVoice');
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
  return withPreferenceEdit(existing, { ...existing, preferTyping }, 'preferTyping');
}

/**
 * Set what the learner asked to be called.
 *
 * A plain spread beside `withUsername`, and named for the reason every other
 * door on this object is named: the Name sheet wrote the field inline while
 * every neighbouring row went through a helper, and a field two places can set
 * is a field that can disagree with itself. Nothing here trims, titles or
 * validates — what someone calls themselves is theirs, and the sheet that
 * collects it already refuses a blank before it gets here.
 *
 * The parameter is `string`, not `string | null`, even though the field is
 * nullable. Null on `name` means the question was skipped at sign-up, which is
 * a thing only profile creation can say; nothing in the product offers a
 * learner a way to un-name themselves, so this door does not carry one.
 */
export function withName(existing: StoredProfile, name: string): StoredProfile {
  return withPreferenceEdit(existing, { ...existing, name, namePromptPending: false }, 'name');
}

/** Claim a leaderboard username. A plain spread, named so the field has one write path. */
export function withUsername(existing: StoredProfile, username: string): StoredProfile {
  return withPreferenceEdit(existing, { ...existing, username }, 'username');
}
