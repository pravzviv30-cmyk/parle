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
 * `name`, `dob`, `ageConfirmed` and `dailyGoalMin` are things the learner told
 * us, where `null` means "never asked". A non-null answer beats a null one from
 * either side, because forgetting an answer the learner gave is worse than
 * preferring the busier device.
 *
 * The second exception is the opposite, and there is exactly one of it.
 * `ageStopAt` is a fact about a device rather than about the learner, so the
 * merge drops it from both sides instead of choosing. `PROFILE_DEVICE_FIELDS`
 * carries the argument.
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
  type LearnerProfile,
} from './profile.ts';

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
  'username',
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

const DEVICE_FIELD_SET: ReadonlySet<string> = new Set(PROFILE_DEVICE_FIELDS);

const ANSWER_FIELD_SET: ReadonlySet<string> = new Set(PROFILE_ANSWER_FIELDS);

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
  const outer = upgraded as Record<string, unknown>;
  return { outer, brain: repairProfile(outer.brain), savedAt: finiteOr(side.savedAt, 0) };
}

/**
 * Everything the heavier side wins *whole*, rendered for comparison.
 *
 * The answer fields and the unioned brain are deliberately left out: the
 * comparison key must not move when the merge fills in a null answer or unions
 * a phrase, or the merged result would stop absorbing its own inputs and two
 * devices could hand the same state back and forth forever.
 */
function coreSlice(side: Side): string {
  const outer: Record<string, unknown> = {};
  for (const key of Object.keys(side.outer)) {
    if (key === 'brain' || ANSWER_FIELD_SET.has(key)) continue;
    outer[key] = side.outer[key];
  }
  return canonical({
    outer,
    cefr: side.brain.cefr,
    memory: side.brain.memory,
    preferences: side.brain.preferences,
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
function compareEvidence(a: Side, b: Side): number {
  if (a.brain.stats.sessions !== b.brain.stats.sessions) {
    return a.brain.stats.sessions - b.brain.stats.sessions;
  }
  if (a.brain.stats.totalTurns !== b.brain.stats.totalTurns) {
    return a.brain.stats.totalTurns - b.brain.stats.totalTurns;
  }
  if (a.savedAt !== b.savedAt) return a.savedAt - b.savedAt;
  return compareStrings(coreSlice(a), coreSlice(b));
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

const PHRASE_MERGED_FIELDS: readonly string[] = ['introducedAt', 'timesUsedWell', 'mastered'];
const PATTERN_MERGED_FIELDS: readonly string[] = ['count', 'lastSeen'];

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
  return { ...outer, brain: settle(outer.brain) };
}

/**
 * One answered question, from whichever side actually answered it.
 *
 * `cmp` is the evidence comparison of the two sides, already computed. When
 * both answered and the evidence is dead even, the value itself decides, so
 * that two devices with identical histories still agree.
 */
function pickAnswer(field: string, a: Side, b: Side, cmp: number): unknown {
  const av = a.outer[field] ?? null;
  const bv = b.outer[field] ?? null;
  if (av === null) return bv;
  if (bv === null) return av;
  if (cmp > 0) return av;
  if (cmp < 0) return bv;
  return compareStrings(canonical(av), canonical(bv)) >= 0 ? av : bv;
}

/**
 * Merge the brain's two learner models. Exported for the sync policy and for
 * anything that holds two `LearnerProfile`s without an outer envelope.
 *
 * `aSavedAt`/`bSavedAt` are the envelope timestamps and only ever break a tie
 * on sessions and turns.
 */
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
    memory: heavy.brain.memory,
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

  const cmp = compareEvidence(sa, sb);
  const heavy = cmp >= 0 ? sa : sb;

  const outer: Record<string, unknown> = {};
  for (const key of Object.keys(heavy.outer)) {
    if (key === 'brain') continue;
    outer[key] = heavy.outer[key];
  }
  for (const field of PROFILE_ANSWER_FIELDS) {
    outer[field] = pickAnswer(field, sa, sb, cmp);
  }

  const brain: LearnerProfile = {
    version: 2,
    cefr: heavy.brain.cefr,
    memory: heavy.brain.memory,
    preferences: heavy.brain.preferences,
    stats: heavy.brain.stats,
    errorPatterns: unionErrorPatterns(sa.brain.errorPatterns, sb.brain.errorPatterns),
    phrases: unionPhrases(sa.brain.phrases, sb.brain.phrases),
  };

  return finish({ outer, brain, savedAt: Math.max(sa.savedAt, sb.savedAt) }, deps);
}
