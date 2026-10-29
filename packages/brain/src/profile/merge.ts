/**
 * Merging two copies of one learner.
 *
 * A learner can be signed in on a phone and a tablet, take a session on each
 * while both are offline, and hand the sync engine two profiles that are both
 * true. This is the rule for putting them back together. It is pedagogy, not
 * plumbing — every choice here is a claim about what a learner has actually
 * learned — so it lives in the brain beside `profile.ts` and has exactly one
 * implementation.
 *
 * ## What is unioned, and what is taken whole
 *
 * **Phrases and error patterns are unioned by key.** These are the learning
 * itself: what the learner has been taught and what they keep getting wrong.
 * Losing either is losing months. Per key the counts take the **max**, never
 * the sum, and `mastered` is an **OR**:
 *
 * - Max, because a sum is not idempotent. The engine retries, replays and
 *   reconnects; a sum would let one phrase reach mastery because the network
 *   was flaky. Max under-counts when two devices genuinely saw the same error
 *   separately, and that undercount is the price of a merge that cannot
 *   inflate a learner's record. Mastery must be earned once, not twice.
 * - `mastered` is **carried, never recomputed**. There are already four places
 *   in this repo that decide what mastery means. This is not a fifth: it reads
 *   the flag each side stored and ORs it. A merged phrase can therefore sit at
 *   `timesUsedWell: 2, mastered: false` where a naive recomputation would call
 *   it mastered, and that is correct — nobody watched those two uses happen in
 *   one learner's history.
 *
 * **Everything else is taken whole from the evidence-heavier side**: `cefr`,
 * `memory`, `preferences`, `stats`, and the outer stored-profile fields. Heavier
 * means more `stats.sessions`, then more `stats.totalTurns`, then the later
 * envelope `savedAt`. `cefr.estimate` is derived from an evidence window by
 * `finishSession`; blending two windows would produce a reading no session ever
 * supported. `memory.facts` are a capped, ordered list the extraction owns.
 * These are judgements, and a merge is not entitled to make them.
 *
 * The one exception is an **answered question**. `motivation`, `username`,
 * `name`, `dob`, `ageConfirmed`, `dailyGoalMin` and `tutorVoice` are things the
 * learner told us, where `null` means "never asked". A non-null answer beats a
 * null one from either side, because forgetting an answer the learner gave is
 * worse than preferring the busier device. `tutorVoice` is the sharpest case:
 * forgetting it changes who the tutor *is*, because the persona follows the
 * voice and two of the catalogue's voices are women.
 *
 * The second exception is the opposite, and there is exactly one of it.
 * `ageStopAt` is a fact about a device rather than about the learner, so the
 * merge drops it from both sides instead of choosing. `PROFILE_DEVICE_FIELDS`
 * carries the argument.
 *
 * The third is a **set the learner grows**. `forgottenFacts` is the list of
 * memory facts the learner asked the tutor to forget, and riding it whole with
 * the heavier side would let a busier phone undo a forget made on a lighter
 * one. It is unioned as a sorted set instead, so a forget anywhere is a forget
 * everywhere; `PROFILE_UNION_FIELDS` names it. `learnerGoals`, the lines the
 * learner wrote about what they want, deliberately stays with the heavier
 * side: there is no clock to order two lists by, and a per-field newest-wins
 * would break the absorption the property tests hold.
 *
 * ## The accepted loss
 *
 * Two simultaneous offline sessions lose the smaller one's `memory` and `cefr`
 * deltas. That is real and it is deliberate: a field-wise merge of those is a
 * pedagogy decision that belongs with reconciling the four mastery
 * calculations, and both are Phase 4. What makes the loss acceptable is that
 * phrases and error patterns — the actual learning — always survive via the
 * union. The learner loses a nudge to their level estimate, never their book.
 *
 * ## Convergence
 *
 * The union is a lattice join and the whole-side pick is an argmax over a
 * **total** order, so the merge is commutative, idempotent, and **absorbing**:
 * once `m = merge(a, b)`, merging `m` with either input again returns `m`
 * unchanged. That is what makes duplicate pushes, replays and reconnects
 * harmless without an operation log, and `merge.test.ts` property-tests it
 * rather than asserting it in prose.
 *
 * User settings now have a separate causal rule when an exact-value-bound
 * `preferenceClocks` entry is present: daily goal, voice, typing, name,
 * username, strictness, pace and the stated level (`practicePreferences.level`)
 * join by counter, mutation ID, then value. The stated level's clock moves only
 * `level`, on top of `practicePreferences` already merged per sub-answer, so
 * confidence and focus keep the answer rule.
 * Null/default choices can therefore undo previous choices. Clocks never
 * govern age, DOB, device stops, account ownership or learning evidence. In
 * clock-aware merges these settings are omitted from the evidence tie key so
 * their independent adoption cannot choose a different CEFR/history winner.
 * Profiles with no clocks retain the legacy rules described above.
 *
 * It is **not** fully associative, and the counterexample is worth naming
 * rather than discovering. Three devices holding three different values for one
 * answered question — the heaviest holding `null`, the other two disagreeing —
 * settle on whichever answer reached the heaviest device first:
 *
 *   a = { motivation: null,     sessions: 9 }
 *   b = { motivation: 'travel', sessions: 5 }
 *   c = { motivation: 'work',   sessions: 1 }
 *   merge(merge(a, b), c).motivation === 'travel'
 *   merge(merge(a, c), b).motivation === 'work'
 *
 * Both are answers the learner really gave, all three devices still converge on
 * the same one, and no learning is at stake. The alternative — ordering two
 * non-null answers by their text rather than by evidence — would buy
 * associativity by letting a stale name beat the one the learner just typed on
 * the device they actually use. The gossip property test covers this case
 * explicitly.
 *
 * ## Everything comes back through the one door
 *
 * `repairProfile` is the only way a stored profile is brought forward, and
 * `upgradeStored` is the only way the outer envelope is. Both run on each side
 * *before* the merge — so two different schema versions are compared like for
 * like — and once more on the result. Neither is forked here. `upgradeStored`
 * is injected rather than imported because it belongs to the app and the brain
 * must not depend on the app; `apps/mobile/src/sync/policy.ts` is the caller
 * that supplies it.
 *
 * Both sides arrive as `unknown`. A blob that cannot be brought forward
 * contributes nothing and never takes good local data with it.
 */

import {
  evictOverflowPhrases,
  evictStalePatterns,
  repairProfile,
  validMemoryControl,
  withoutForgottenMemory,
  type LearnerProfile,
} from './profile.ts';
import { preferenceClocks, resolvePreferenceClocks, sanitisePreferenceClocks } from './preferenceClock.ts';
export { PREFERENCE_FIELDS, MAX_PREFERENCE_COUNTER, preferenceValue, preferenceClocks, sanitisePreferenceClocks, maxPreferenceCounter, newPreferenceClock, comparePreferenceClocks, resolvePreferenceClocks, type PreferenceField, type PreferenceClocks, type PreferenceClock } from './preferenceClock.ts';

/** One side of the merge: a stored blob and the envelope `savedAt` that carried it. */
export interface ProfileSide {
  /** The stored profile exactly as it came off disk or off the wire. */
  stored: unknown;
  /** The envelope's `savedAt`, epoch ms. The last evidence tiebreak, never the first. */
  savedAt: number;
}

/** What the merge needs from the app, injected so the brain stays app-free. */
export interface ProfileMergeDeps {
  /**
   * The app's stored-profile version chain — `apps/mobile/src/profile/upgrade.ts`.
   * Returns null for a blob it cannot bring forward.
   */
  upgrade: (stored: unknown, now: number) => Record<string, unknown> | null;
  /** The clock the version chain derives from. Injected so the merge is testable. */
  now: number;
}

/** A merged stored profile: the app's outer shape with a repaired brain inside. */
export type MergedStoredProfile = Record<string, unknown> & { brain: LearnerProfile };

/**
 * The outer fields that are answers to questions, where `null` means the
 * learner was never asked. A non-null one of these beats a null one whichever
 * side it is on. Everything else outer rides with the evidence-heavier side.
 */
export const PROFILE_ANSWER_FIELDS = [
  'name',
  'dob',
  'ageConfirmed',
  'motivation',
  'dailyGoalMin',
  'practiceDaysPerWeek',
  'onboardingGoal',
  'onboardingDrink',
  // Explicit onboarding support choices, independent of earned CEFR. Merged
  // per sub-answer (`pickPracticePreferences`), so a busy legacy device that
  // never asked one of level, confidence or focus cannot erase another
  // device's real answer to it.
  'practicePreferences',
  'username',
  // Which catalogue voice the learner asked their tutor to speak with, as the
  // app-level key `@luvani/core` owns. It is here rather than riding with the
  // heavier side because losing it does not degrade to "some other voice": two
  // of the eight voices are women and the tutor's persona is derived from the
  // key, so a null overwriting `marie` makes the tutor introduce herself as a
  // man on the busier device. Null means never chosen, and the agent — not this
  // merge — is what resolves never-chosen to the default, so the merge never
  // writes a key nobody picked.
  'tutorVoice',
] as const;

/**
 * The outer fields the account holds no opinion about, dropped from every
 * merge rather than carried by either side.
 *
 * There is one, `ageStopAt`, and it is here because neither of the two rules
 * above is right for it. It records that a session ended on this device
 * because the learner said in a scene that they are under thirteen.
 *
 * Riding with the evidence-heavier side would let a child's busier phone
 * merge the closed door back open. Treating it as an answer, where a non-null
 * beats a null, is worse in the other direction: the learner's own clearing
 * of it is a write of `null`, so the moment one device had synced the stop, no
 * device could ever clear it again and the only way back into the product
 * would be a reinstall. A stop that cannot be lifted is not a gate, it is a
 * ban, and this stop is answered by one tap on the age gate by design.
 *
 * So the merge declines the question. The stop stays a fact about the device
 * that recorded it — `profile/store.ts`'s adopter keeps its own across a fold —
 * the account copy always reads null, and two devices never argue about it, so
 * nothing churns the revision. That is the founder-accepted ceiling written
 * into the merge: a reinstall clears the flag, and so does a second phone. The
 * strong shape is a server-side account flag, which needs a durable server and
 * an authenticated write path from the agent. `docs/STATE_AND_STORAGE.md` says
 * so where a learner's data is described, and it is not hidden anywhere else.
 */
export const PROFILE_DEVICE_FIELDS = ['ageStopAt'] as const;

/**
 * The outer fields that are sets the learner grows, unioned across devices
 * rather than taken from one side.
 *
 * `forgottenFacts` holds the normalised keys of memory facts the learner asked
 * to forget (`apps/mobile/src/profile/memory.ts`). A forget is a statement
 * the learner made on one device, and the merge exists so the other device
 * hears it: taken whole from the evidence-heavier side, a forget made on the
 * lighter phone would be undone by the next sync. The union is sorted, so two
 * devices that forgot the same things in a different order agree byte for
 * byte, and the app's version chain does not expire any marker by count.
 */
export const PROFILE_UNION_FIELDS = ['forgottenFacts'] as const;

const DEVICE_FIELD_SET: ReadonlySet<string> = new Set(PROFILE_DEVICE_FIELDS);

const ANSWER_FIELD_SET: ReadonlySet<string> = new Set(PROFILE_ANSWER_FIELDS);

const UNION_FIELD_SET: ReadonlySet<string> = new Set(PROFILE_UNION_FIELDS);

/**
 * A byte-stable rendering, used only where two sides are otherwise dead even.
 * Keys are sorted so two devices that wrote the same object in a different
 * field order compare equal rather than flipping a coin every reconnect.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const rec = value as Record<string, unknown>;
  return `{${Object.keys(rec)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(rec[k])}`)
    .join(',')}}`;
}

/** Ordinary string order, not `localeCompare`: this decides data, not display. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The strings on either side, each once, in one order both devices compute identically. */
function unionStrings(a: unknown, b: unknown): string[] {
  const out = new Set<string>();
  for (const side of [a, b]) {
    if (!Array.isArray(side)) continue;
    for (const value of side) if (typeof value === 'string') out.add(value);
  }
  return [...out].sort(compareStrings);
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

interface Side {
  outer: Record<string, unknown>;
  brain: LearnerProfile;
  savedAt: number;
}

/**
 * Bring one side forward through both doors before anything is compared.
 *
 * A brain that fails `repairProfile` comes back fresh and therefore weightless,
 * so a half-corrupt payload loses on evidence instead of being trusted.
 */
function normaliseSide(side: ProfileSide, deps: ProfileMergeDeps): Side | null {
  const upgraded = deps.upgrade(side.stored, deps.now);
  if (upgraded === null || typeof upgraded !== 'object' || Array.isArray(upgraded)) return null;
  const brain = repairProfile(upgraded.brain);
  const outer = sanitisePreferenceClocks({ ...upgraded, brain });
  return { outer, brain, savedAt: finiteOr(side.savedAt, 0) };
}

/**
 * Everything the heavier side wins *whole*, rendered for comparison.
 *
 * The answer fields and the unioned brain are deliberately left out: the
 * comparison key must not move when the merge fills in a null answer or unions
 * a phrase, or the merged result would stop absorbing its own inputs and two
 * devices could hand the same state back and forth forever.
 */
function coreSlice(side: Side, causal = false): string {
  const outer: Record<string, unknown> = {};
  for (const key of Object.keys(side.outer)) {
    // The union fields are left out for the answer fields' reason: a key that
    // moved when the merge unioned a tombstone in would stop the result from
    // absorbing its own inputs.
    if (key === 'brain' || key === 'preferenceClocks' || (causal && key === 'preferTyping') || ANSWER_FIELD_SET.has(key) || UNION_FIELD_SET.has(key)) continue;
    outer[key] = side.outer[key];
  }
  return canonical({
    outer,
    cefr: side.brain.cefr,
    memory: side.brain.memory,
    // In clock-aware merges settings are independent joins. Their values must
    // not move the evidence order when a lighter device's edit is adopted.
    preferences: causal ? Object.fromEntries(Object.entries(side.brain.preferences).filter(([key]) => key !== 'strictness' && key !== 'pace')) : side.brain.preferences,
    stats: side.brain.stats,
  });
}

/**
 * Which side carries more evidence about this learner. Positive means `a`.
 *
 * Sessions first, because a session is the unit of evidence this product
 * actually collects. Turns next. `savedAt` only breaks ties, so clock skew
 * between two devices can never outrank a session that really happened. The
 * canonical rendering is the last resort, so the order is total and the answer
 * is the same on both devices rather than "whichever one asked".
 */
function compareEvidence(a: Side, b: Side, causal = false): number {
  if (a.brain.stats.sessions !== b.brain.stats.sessions) {
    return a.brain.stats.sessions - b.brain.stats.sessions;
  }
  if (a.brain.stats.totalTurns !== b.brain.stats.totalTurns) {
    return a.brain.stats.totalTurns - b.brain.stats.totalTurns;
  }
  if (a.savedAt !== b.savedAt) return a.savedAt - b.savedAt;
  return compareStrings(coreSlice(a, causal), coreSlice(b, causal));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every key on either side, in one order both devices compute identically. */
function unionKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(compareStrings);
}

/**
 * The tiebreak identity of an entry: everything about it *except* the fields
 * being lattice-merged. Excluding those is what keeps the union associative —
 * a key built from a value the merge is about to change is a key that depends
 * on the order the merges happened in.
 */
function identityOf(entry: Record<string, unknown>, merged: readonly string[]): string {
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(entry).sort(compareStrings)) {
    if (merged.includes(key)) continue;
    rest[key] = entry[key];
  }
  return canonical(rest);
}

const PHRASE_MERGED_FIELDS: readonly string[] = ['introducedAt', 'timesUsedWell', 'timesAssisted', 'mastered'];
const PATTERN_MERGED_FIELDS: readonly string[] = ['count', 'lastSeen', 'sessions', 'lastSession'];

/**
 * The larger of a count both sides may or may not carry. Absent on both stays
 * absent, so merging two profiles stored before the field existed changes
 * nothing about their shape.
 */
function maxOfOptional(key: string, x: Record<string, unknown>, y: Record<string, unknown>): Record<string, number> {
  if (!(key in x) && !(key in y)) return {};
  return { [key]: Math.max(finiteOr(x[key], 0), finiteOr(y[key], 0)) };
}

/**
 * Union the phrase books. The learner's actual French: never dropped, never
 * doubled.
 */
function unionPhrases(
  a: LearnerProfile['phrases'],
  b: LearnerProfile['phrases'],
): LearnerProfile['phrases'] {
  const out: Record<string, unknown> = {};
  for (const key of unionKeys(a as Record<string, unknown>, b as Record<string, unknown>)) {
    const x: unknown = (a as Record<string, unknown>)[key];
    const y: unknown = (b as Record<string, unknown>)[key];
    if (!isRecord(x)) {
      if (isRecord(y)) out[key] = y;
      continue;
    }
    if (!isRecord(y)) {
      out[key] = x;
      continue;
    }
    const usedX = finiteOr(x.timesUsedWell, 0);
    const usedY = finiteOr(y.timesUsedWell, 0);
    // The wording of the phrase comes from the side that has more evidence for
    // it, with the entry's own identity as the only tiebreak.
    let richer = x;
    if (usedY > usedX) richer = y;
    else if (usedY === usedX && compareStrings(identityOf(y, PHRASE_MERGED_FIELDS), identityOf(x, PHRASE_MERGED_FIELDS)) > 0) richer = y;
    const introX = typeof x.introducedAt === 'string' ? x.introducedAt : '';
    const introY = typeof y.introducedAt === 'string' ? y.introducedAt : '';
    out[key] = {
      ...richer,
      // A phrase was introduced when it was first introduced, on whichever
      // device the learner happened to be holding.
      introducedAt: compareStrings(introX, introY) <= 0 ? introX : introY,
      timesUsedWell: Math.max(usedX, usedY),
      // Kept apart from `timesUsedWell` and merged the same way, so assisted
      // uses never leak into `convoUses` through a merge.
      ...maxOfOptional('timesAssisted', x, y),
      // Carried from what each side stored. Not recomputed, not from a count.
      mastered: x.mastered === true || y.mastered === true,
    };
  }
  return out as LearnerProfile['phrases'];
}

/** Union the recurring-error patterns. Same rules, same reasons. */
function unionErrorPatterns(
  a: LearnerProfile['errorPatterns'],
  b: LearnerProfile['errorPatterns'],
): LearnerProfile['errorPatterns'] {
  const out: Record<string, unknown> = {};
  for (const key of unionKeys(a as Record<string, unknown>, b as Record<string, unknown>)) {
    const x: unknown = (a as Record<string, unknown>)[key];
    const y: unknown = (b as Record<string, unknown>)[key];
    if (!isRecord(x)) {
      if (isRecord(y)) out[key] = y;
      continue;
    }
    if (!isRecord(y)) {
      out[key] = x;
      continue;
    }
    const countX = finiteOr(x.count, 0);
    const countY = finiteOr(y.count, 0);
    let richer = x;
    if (countY > countX) richer = y;
    else if (countY === countX && compareStrings(identityOf(y, PATTERN_MERGED_FIELDS), identityOf(x, PATTERN_MERGED_FIELDS)) > 0) richer = y;
    const seenX = typeof x.lastSeen === 'string' ? x.lastSeen : '';
    const seenY = typeof y.lastSeen === 'string' ? y.lastSeen : '';
    out[key] = {
      ...richer,
      count: Math.max(countX, countY),
      lastSeen: compareStrings(seenX, seenY) >= 0 ? seenX : seenY,
      ...maxOfOptional('sessions', x, y),
      ...maxOfOptional('lastSession', x, y),
    };
  }
  return out as LearnerProfile['errorPatterns'];
}

/** Rebuild a keyed record in sorted key order. */
function inKeyOrder<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(record).sort(compareStrings)) out[key] = record[key] as T;
  return out;
}

/**
 * The last step for every path out of here: repair, put the keys in one order,
 * then re-apply the existing caps — patterns before phrases, always.
 *
 * The key ordering is not tidiness. Both caps break ties with a stable sort
 * over `Object.entries`, so insertion order decides which entry is evicted; two
 * devices that learned the same phrases in a different order would otherwise
 * forget different ones and never converge.
 */
function settle(brain: unknown): LearnerProfile {
  const repaired = repairProfile(brain);
  const known: ReadonlySet<string> = new Set(['version', 'cefr', 'errorPatterns', 'phrases', 'memory', 'preferences', 'stats']);
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(repaired).sort(compareStrings)) {
    if (known.has(key)) continue;
    rest[key] = (repaired as unknown as Record<string, unknown>)[key];
  }
  // One output shape, whichever path got here: the declared field order of
  // `LearnerProfile`, then anything a newer version added, in key order. Two
  // devices that merge the same two profiles must produce the same bytes, or
  // the engine's compare-and-swap sees a change that nobody made.
  const ordered = {
    version: 2,
    cefr: repaired.cefr,
    errorPatterns: inKeyOrder(repaired.errorPatterns),
    phrases: inKeyOrder(repaired.phrases),
    memory: repaired.memory,
    preferences: repaired.preferences,
    stats: repaired.stats,
    ...rest,
  } as LearnerProfile;
  evictStalePatterns(ordered);
  evictOverflowPhrases(ordered);
  return ordered;
}

/** Run a settled side back out through the app's version chain and the repair door. */
function finish(side: Side, deps: ProfileMergeDeps): MergedStoredProfile {
  // Key order settled before the chain runs, for the same reason `settle`
  // settles the brain's: the merged payload has to be a function of its inputs'
  // contents and nothing else.
  const kept: Record<string, unknown> = {};
  for (const key of Object.keys(side.outer)) {
    // Every path out of this file goes through here, including the two where
    // one side was unreadable and the other is returned whole, so this is the
    // one place that can promise the account copy never carries a device field.
    if (DEVICE_FIELD_SET.has(key)) continue;
    kept[key] = side.outer[key];
  }
  const candidate: Record<string, unknown> = inKeyOrder({ ...kept, brain: side.brain });
  const upgraded = deps.upgrade(candidate, deps.now);
  const outer = upgraded === null || !isRecord(upgraded) ? candidate : upgraded;
  const forgotten = Array.isArray(outer.forgottenFacts) ? outer.forgottenFacts.filter((key): key is string => typeof key === 'string') : [];
  return sanitisePreferenceClocks({ ...outer, brain: settle(withoutForgottenMemory(settle(outer.brain), forgotten)) });
}

/**
 * The answer rule over two raw values: a null loses from either side, `cmp`
 * (the evidence comparison, already computed) decides a real-versus-real
 * conflict, and a dead-even tie goes to the value itself, so that two devices
 * with identical histories still agree.
 */
function pickValue(av: unknown, bv: unknown, cmp: number): unknown {
  const a = av ?? null;
  const b = bv ?? null;
  if (a === null) return b;
  if (b === null) return a;
  if (cmp > 0) return a;
  if (cmp < 0) return b;
  return compareStrings(canonical(a), canonical(b)) >= 0 ? a : b;
}

/** One answered question, from whichever side actually answered it. */
function pickAnswer(field: string, a: Side, b: Side, cmp: number): unknown {
  return pickValue(a.outer[field], b.outer[field], cmp);
}

const PRACTICE_PREFERENCE_KEYS = ['level', 'confidence', 'focus'] as const;
const PLACEMENTS: readonly unknown[] = ['basics', 'everyday'];

/**
 * `practicePreferences` is three independent answers, so each one follows the
 * answer rule on its own: a partial object from a heavier device (an older
 * install's Settings level edit writes confidence and focus as null) cannot
 * erase another device's real confidence or focus. Only the three known keys (and a valid placement)
 * survive, and all three unanswered is "never asked", which is null.
 */
function pickPracticePreferences(a: Side, b: Side, cmp: number): unknown {
  const av = isRecord(a.outer.practicePreferences) ? a.outer.practicePreferences : {};
  const bv = isRecord(b.outer.practicePreferences) ? b.outer.practicePreferences : {};
  const merged: Record<string, unknown> = {};
  for (const key of PRACTICE_PREFERENCE_KEYS) merged[key] = pickValue(av[key], bv[key], cmp);
  // The onboarding placement (F917) follows the same answer rule, and is
  // written only when one side holds a real one.
  const placement = pickValue(PLACEMENTS.includes(av.placement as never) ? av.placement : null, PLACEMENTS.includes(bv.placement as never) ? bv.placement : null, cmp);
  if (placement !== null) merged.placement = placement;
  return PRACTICE_PREFERENCE_KEYS.every((key) => merged[key] === null) && placement === null ? null : merged;
}

/**
 * Merge the brain's two learner models. Exported for the sync policy and for
 * anything that holds two `LearnerProfile`s without an outer envelope.
 *
 * `aSavedAt`/`bSavedAt` are the envelope timestamps and only ever break a tie
 * on sessions and turns.
 */
function mergeMemoryControl(held: LearnerProfile['memory'], a: LearnerProfile['memory'], b: LearnerProfile['memory']): LearnerProfile['memory'] {
  const ac = validMemoryControl(a.control);
  const bc = validMemoryControl(b.control);
  const control = !ac ? bc : !bc ? ac : ac.changedAt === bc.changedAt
    ? { changedAt: ac.changedAt, paused: ac.paused || bc.paused }
    : ac.changedAt > bc.changedAt ? ac : bc;
  return control ? { ...held, control, ...(control.paused ? { opener: null } : {}) } : held;
}

export function mergeLearnerProfiles(
  a: unknown,
  b: unknown,
  aSavedAt: number,
  bSavedAt: number,
): LearnerProfile {
  const sa: Side = { outer: {}, brain: repairProfile(a), savedAt: finiteOr(aSavedAt, 0) };
  const sb: Side = { outer: {}, brain: repairProfile(b), savedAt: finiteOr(bSavedAt, 0) };
  const heavy = compareEvidence(sa, sb) >= 0 ? sa : sb;
  return settle({
    version: 2,
    cefr: heavy.brain.cefr,
    memory: mergeMemoryControl(heavy.brain.memory, sa.brain.memory, sb.brain.memory),
    preferences: heavy.brain.preferences,
    stats: heavy.brain.stats,
    errorPatterns: unionErrorPatterns(sa.brain.errorPatterns, sb.brain.errorPatterns),
    phrases: unionPhrases(sa.brain.phrases, sb.brain.phrases),
  });
}

/**
 * Merge two stored profiles — outer envelope and brain together.
 *
 * Returns null only when neither side can be brought forward at all, which is
 * the caller's cue to quarantine rather than write. One unreadable side is not
 * a merge: the readable one comes back, brought forward and capped, so a
 * corrupt payload off the wire can never overwrite a good profile on disk.
 */
export function mergeStoredProfiles(
  a: ProfileSide,
  b: ProfileSide,
  deps: ProfileMergeDeps,
): MergedStoredProfile | null {
  const sa = normaliseSide(a, deps);
  const sb = normaliseSide(b, deps);
  if (sa === null) return sb === null ? null : finish(sb, deps);
  if (sb === null) return finish(sa, deps);

  const causal = Object.keys(preferenceClocks(sa.outer)).length > 0 || Object.keys(preferenceClocks(sb.outer)).length > 0;
  const cmp = compareEvidence(sa, sb, causal);
  const heavy = cmp >= 0 ? sa : sb;

  const outer: Record<string, unknown> = {};
  for (const key of Object.keys(heavy.outer)) {
    if (key === 'brain') continue;
    outer[key] = heavy.outer[key];
  }
  for (const field of PROFILE_ANSWER_FIELDS) {
    if (!(field in sa.outer) && !(field in sb.outer)) continue;
    outer[field] = field === 'practicePreferences' ? pickPracticePreferences(sa, sb, cmp) : pickAnswer(field, sa, sb, cmp);
  }
  for (const field of PROFILE_UNION_FIELDS) {
    outer[field] = unionStrings(sa.outer[field], sb.outer[field]);
  }

  const brain: LearnerProfile = {
    version: 2,
    cefr: heavy.brain.cefr,
    memory: mergeMemoryControl(heavy.brain.memory, sa.brain.memory, sb.brain.memory),
    preferences: heavy.brain.preferences,
    stats: heavy.brain.stats,
    errorPatterns: unionErrorPatterns(sa.brain.errorPatterns, sb.brain.errorPatterns),
    phrases: unionPhrases(sa.brain.phrases, sb.brain.phrases),
  };

  // A dead-even evidence tie used to be settled by these very settings. Once
  // clocks remove them from that key, give unclocked values their own stable
  // tie so operand order cannot choose a legacy default accidentally.
  if (causal && cmp === 0) {
    outer.preferTyping = compareStrings(canonical(sa.outer.preferTyping), canonical(sb.outer.preferTyping)) >= 0 ? sa.outer.preferTyping : sb.outer.preferTyping;
    brain.preferences = { ...brain.preferences };
    for (const field of ['strictness', 'pace'] as const) {
      const av = sa.brain.preferences[field], bv = sb.brain.preferences[field];
      const value = compareStrings(canonical(av), canonical(bv)) >= 0 ? av : bv;
      if (field === 'pace') {
        if (value === undefined) delete brain.preferences.pace;
        else brain.preferences.pace = value as LearnerProfile['preferences']['pace'];
      } else brain.preferences.strictness = value as LearnerProfile['preferences']['strictness'];
    }
  }

  const resolved = resolvePreferenceClocks({ ...outer, brain }, sa.outer, sb.outer);
  return finish({ outer: resolved, brain: resolved.brain, savedAt: Math.max(sa.savedAt, sb.savedAt) }, deps);
}
