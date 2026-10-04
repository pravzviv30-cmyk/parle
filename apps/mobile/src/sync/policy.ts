/**
 * What happens when two devices disagree — one table, twenty-five namespaces, no exceptions.
 *
 * The engine in `engine.ts` decides *when* to reconcile. This file decides *what the
 * answer is*, and it is the only file in the app that holds an opinion about how two
 * copies of a learner become one. Fourteen namespaces are synced under three merge classes;
 * eleven are excluded with a stated reason, because a namespace that is silently absent
 * from a sync table is indistinguishable from one somebody forgot.
 *
 * | namespace     | class      | the rule                                                  |
 * |---------------|------------|-----------------------------------------------------------|
 * | `profile`     | structured | brain's `mergeStoredProfiles`: phrases and error patterns  |
 * |               |            | key-unioned with max counts and `mastered` ORed; the rest  |
 * |               |            | whole from the evidence-heavier side; answered questions   |
 * |               |            | beat nulls. Delegated, never reimplemented.                |
 * | `review`      | per-item   | core's `mergeDecks`: union by card id, the whole card from |
 * |               |            | the side with more grades applied. Scheduling is carried.  |
 * | `drills`      | per-item   | union on the drill identity — `drill/merge.ts`'s identity  |
 * |               |            | — then that file's own cap. `micSuppressedUntil` is later. |
 * | `topics`      | per-item   | union by topic id; sitting dates and deck ids unioned.     |
 * | `bookmarks`   | per-item   | union by situation; the newer decision wins, so an un-save |
 * |               |            | survives. Oldest first, last 3000.                         |
 * | `scenarioProgress` | per-item | union by mission; the newer record wins. Oldest first,   |
 * |               |            | last 40. `beatsTotal` is never stored, so never merged.    |
 * | `history`     | set-union  | union by session identity, oldest first, last 50.          |
 * | `activity`    | set-union  | union by `(at, kind, xp)`, the copy carrying an `activeMs`, then a `durationMs` |
 * |               |            | winning the pick, 400-day prune, `backfilled` OR.          |
 * | `missions`    | set-union  | union by `(id, at)`, then the per-mission cap.             |
 * | `soundChecks` | set-union  | union by attempt identity, oldest first, last 60.          |
 * | `coachMarks`  | set-union  | union of ids seen. Seen anywhere is seen.                  |
 * | `tutorIntro`  | set-union  | OR. A one-time flag only ever turns on.                    |
 * | `practiceHistory` | set-union | union by (kind, id) under practice/history.ts's strict |
 * |               |            | validator, canonical pick, oldest first, last 150.         |
 * | `goalSteps`   | set-union  | union by whole row under goals/model.ts's strict validator,|
 * |               |            | oldest first, last 60. Nothing is attributed by time.      |
 * | `practiceSession` | **excluded** — see SYNC_EXCLUSIONS                      |
 * | `journal`     | **excluded** — see SYNC_EXCLUSIONS                          |
 * | `friends`     | **excluded** — see SYNC_EXCLUSIONS                          |
 * | `reminder`    | **excluded** — see SYNC_EXCLUSIONS                          |
 * | `conversationPacks` | **excluded** — see SYNC_EXCLUSIONS                   |
 * | `suggestions` | **excluded** — see SYNC_EXCLUSIONS                          |
 * | `analytics`   | **excluded** — see SYNC_EXCLUSIONS                          |
 * | `moments`     | **excluded** — see SYNC_EXCLUSIONS                          |
 * | `packMarks`   | **excluded** — see SYNC_EXCLUSIONS                          |
 * | `pendingPurchase` | **excluded** — see SYNC_EXCLUSIONS                     |
 * | `onboarding-practice` | **excluded** — see SYNC_EXCLUSIONS                 |
 *
 * ## Every policy is commutative and idempotent by construction
 *
 * That is not a nicety; it is the whole reason `engine.ts` needs no operation log, no
 * vector clock and no ordering infrastructure. Two devices that merge the same pair in
 * opposite order get the same bytes, so a duplicate push, a replayed retry and a
 * reconnect are all no-ops rather than corruption. `policy.test.ts` property-tests it
 * over generated blobs rather than asserting it in prose.
 *
 * The three ingredients, and each one is load-bearing:
 *
 * - **Unions are folded with a commutative, associative `pick`.** Every per-item winner
 *   is an argmax over a *total* order, and where the domain has no evidence to order by
 *   the order is the canonical rendering of the item itself. Never a wall clock: two
 *   devices whose clocks disagree would then disagree about the answer, which is the one
 *   input a merge must not trust.
 * - **Every list is sorted before it is capped.** A cap over an unsorted union is decided
 *   by insertion order, so two devices holding the same items in a different order would
 *   forget different ones and never converge. Every cap here is "keep the last k of a
 *   sorted set", which survives being applied twice and in any grouping.
 * - **Nothing is recomputed.** No mastery, no interval, no CEFR estimate, no independence
 *   rung. Those are pedagogy judgements with owners elsewhere, and a merge that made them
 *   again would be a fifth opinion about what a learner has learned.
 *
 * ## `savedAt` is deliberately not a tiebreak here
 *
 * The design named the envelope's `savedAt` as the last tiebreak for `profile`. It is
 * passed as `0` on both sides instead, and that is a correction, not an omission. Only
 * the *remote* side arrives in an envelope — this device's blob comes off disk with no
 * timestamp on it at all — so the only value available for the local side is "now", and
 * "now" is always newer than whatever the other device saved. Both devices would then
 * believe they were the fresher one, both would push, and the two would trade revisions
 * forever. With `0` on both sides the order falls through to sessions, then turns, then
 * the canonical rendering, which is total, clock-free and identical on both devices.
 *
 * ## Never push over a payload from a newer app version
 *
 * The cross-cutting rule, and the reason `SyncQuietReason` exists. Each versioned
 * namespace declares the inner schema version *this build writes*. If either side's blob
 * carries a higher one, the namespace goes quiet: no merge, no adoption, no push. An
 * older app that merged a newer app's blob would silently drop every field it did not
 * recognise and then push that loss to every other device, permanently. Going quiet costs
 * this device its sync for that namespace until the learner updates. That is the cheaper
 * of the two failures by a very long way.
 *
 * Everything here takes `unknown` and validates its way to a type, because a blob off the
 * wire may have been written by a newer app, an older app, a half-finished write or an
 * operator with a service-role key. A row that cannot be read contributes nothing and
 * never takes good local data with it.
 *
 * No react-native import belongs in this file. It is reached from `engine.ts`, which runs
 * under plain `node --test`, and the three modules it leans on — `profile/upgrade.ts`,
 * `drill/merge.ts`, `@luvani/core` — are all pure for exactly that reason.
 */

import { retainCompletions } from '../missions/retain.ts';
import { innerVersion, stableStringify } from './envelope.ts';
import { mergeActiveDays } from '../progress/activeDays.ts';
import type { SyncMergeRequest, SyncMergeResult, SyncPolicy } from './engine.ts';
import { mergeStoredProfiles } from '@luvani/brain/profile/merge';
import { MAX_DISCUSSED_DATES, MAX_STORED_TOPICS, mergeDecks } from '@luvani/core';
import type { DrillExercise, PracticeTopic } from '@luvani/core';
import { upgradeStored } from '../profile/upgrade.ts';
import { exerciseIdentity, mergeExerciseBank } from '../drill/merge.ts';
import { mergePracticeHistory, PRACTICE_HISTORY_VERSION } from '../practice/history.ts';
import { GOAL_STEPS_VERSION, mergeGoalSteps } from '../goals/model.ts';

// ─────────────────────────────────────────────────────── the stores' own caps
//
// Six numbers below belong to store files this engine cannot import: they all reach
// AsyncStorage, and the sync engine has to load under plain node. They are copied here,
// each naming its owner, and `policy.test.ts` reads the owning source and fails if the
// two ever drift. A cap applied here that disagreed with the cap applied by the adopter
// would leave the merge and the disk permanently different, and the engine would re-adopt
// on every single cycle for the rest of that install's life.

/** `MAX_SESSIONS` in progress/store.ts. */
export const MAX_HISTORY_SESSIONS = 50;
/** `MAX_EVIDENCE` in soundcheck/store.ts. */
export const MAX_SOUND_CHECKS = 60;
/** `COMPLETIONS_PER_MISSION` in missions/store.ts. */
export const MAX_COMPLETIONS_PER_MISSION = 20;
/** `KEEP_DAYS` in progress/activity.ts. */
export const ACTIVITY_KEEP_DAYS = 400;
/** `MAX_BOOKMARKS` in bookmarks/store.ts. */
export const MAX_BOOKMARKS = 3000;
/** `MAX_SCENARIO_RECORDS` in missions/progressStore.ts. */
export const MAX_SCENARIO_RECORDS = 40;

const DAY_MS = 86_400_000;

// ──────────────────────────────────────────────────────────────── the spine

/**
 * A byte-stable rendering with keys in one order, used as both an identity and an
 * ordering. Two devices that built the same value in a different field order have to
 * compare equal, or the merge itself becomes a source of divergence.
 */
const canonical = stableStringify;

/** Plain string order, not `localeCompare`: this decides data, not display. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The record a versioned store wrote, or an empty one. Never throws, never guesses. */
function envelopeOf(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringsOf(value: unknown): string[] {
  return arrayOf(value).filter((item): item is string => typeof item === 'string');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The larger of two values under the canonical order — a max, so it is commutative,
 * associative and idempotent, which is what makes the fold below order-independent.
 */
function laterOf<T>(x: T, y: T): T {
  return compareText(canonical(x), canonical(y)) >= 0 ? x : y;
}

/**
 * Union two lists on an identity, folding collisions with `pick`.
 *
 * `pick` must be a max over a total order. Anything else — "the second one wins", "the
 * longer one wins" — makes the answer depend on which device asked, which is the exact
 * failure this whole file exists to prevent. The result is unsorted on purpose: every
 * caller sorts it with the order its own domain reads in, before capping.
 */
function unionBy<T>(
  a: readonly T[],
  b: readonly T[],
  identity: (item: T) => string,
  pick: (x: T, y: T) => T = laterOf,
): T[] {
  const held = new Map<string, T>();
  for (const item of [...a, ...b]) {
    const id = identity(item);
    const seen = held.get(id);
    held.set(id, seen === undefined ? item : pick(seen, item));
  }
  return [...held.values()];
}

/**
 * Returned by a merge that had nothing readable to work with on either side.
 *
 * A symbol rather than `null`, because `null` is a legitimate merged value for a flag
 * nobody has ever set, and a sentinel that collides with real data is a sentinel that
 * eventually means the wrong thing.
 */
const UNREADABLE = Symbol('luvani.sync.unreadable');

// ────────────────────────────────────────────────────────────────── profile

/**
 * Delegated whole to `@luvani/brain`. The rule for putting two copies of a learner back
 * together is pedagogy — it is a claim about what somebody has actually learned — and a
 * second copy of it here is how a repo grows two answers to that question.
 *
 * `upgradeStored` is injected into the brain rather than imported by it, because the
 * stored envelope belongs to the app; this is the caller the brain's header names.
 */
function mergeProfile(local: unknown, remote: unknown, now: number): unknown | typeof UNREADABLE {
  const merged = mergeStoredProfiles(
    { stored: local, savedAt: 0 },
    { stored: remote, savedAt: 0 },
    { upgrade: (stored, when) => upgradeStored(stored, when), now },
  );
  return merged === null ? UNREADABLE : merged;
}

// ─────────────────────────────────────────────────────────────────── review

/**
 * Delegated whole to `@luvani/core`. Union by card id; the whole card comes from the side
 * with more grades applied, and no interval is ever regenerated. See that file for why
 * the ordering primitive is `reps + lapses` and not a timestamp.
 */
function mergeReview(local: unknown, remote: unknown): unknown {
  return mergeDecks(local, remote);
}

// ─────────────────────────────────────────────────────────────────── drills

function isExercise(value: unknown): value is DrillExercise {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.phraseKey === 'string' && typeof value.kind === 'string';
}

/**
 * Authored fixtures first, then generated, each by id.
 *
 * Not "newest last", because a generated exercise carries no timestamp — its id is
 * `gen:<phraseKey>:<kind>`, a pure function of its identity — so there is no honest way to
 * tell which of two devices generated one first. Id order is arbitrary and it is the same
 * arbitrary on both devices, which is the property that matters. The authored/generated
 * split is kept because `mergeExerciseBank`'s cap reads it.
 */
function compareExercises(x: DrillExercise, y: DrillExercise): number {
  const xGen = x.id.startsWith('gen:') ? 1 : 0;
  const yGen = y.id.startsWith('gen:') ? 1 : 0;
  return xGen - yGen || compareText(x.id, y.id) || compareText(canonical(x), canonical(y));
}

/** The later of two suppressions, ISO strings. Null is "not suppressed", never later. */
function laterSuppression(x: unknown, y: unknown): string | null {
  const a = typeof x === 'string' ? x : null;
  const b = typeof y === 'string' ? y : null;
  if (a === null) return b;
  if (b === null) return a;
  return compareText(a, b) >= 0 ? a : b;
}

function mergeDrills(local: unknown, remote: unknown): unknown {
  const l = envelopeOf(local);
  const r = envelopeOf(remote);
  const exercises = unionBy(
    arrayOf(l.exercises).filter(isExercise),
    arrayOf(r.exercises).filter(isExercise),
    exerciseIdentity,
  ).sort(compareExercises);
  return {
    version: 1,
    // The cap is `drill/merge.ts`'s, applied by handing it an empty batch. Re-stating it
    // here would be a second rule about what a learner is allowed to forget.
    exercises: mergeExerciseBank(exercises, []),
    micSuppressedUntil: laterSuppression(l.micSuppressedUntil, r.micSuppressedUntil),
  };
}

// ─────────────────────────────────────────────────────────────────── topics

function isTopic(value: unknown): value is PracticeTopic {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0;
}

/** The first day this topic was talked about, or the empty string when it says none. */
function firstDiscussed(topic: PracticeTopic): string {
  return stringsOf(topic.discussed).sort(compareText)[0] ?? '';
}

/**
 * One topic from two. Dates and deck ids union; the title is the canonical max, because a
 * topic's two titles are two curators' wordings of the same subject and neither is more
 * true than the other.
 */
function joinTopics(x: PracticeTopic, y: PracticeTopic): PracticeTopic {
  const discussed = [...new Set([...stringsOf(x.discussed), ...stringsOf(y.discussed)])]
    .sort(compareText)
    .slice(-MAX_DISCUSSED_DATES);
  const phraseKeys = [...new Set([...stringsOf(x.phraseKeys), ...stringsOf(y.phraseKeys)])].sort(compareText);
  const title = laterOf(x.title, y.title);
  return { id: x.id, title, discussed, phraseKeys };
}

function mergeTopicList(local: unknown, remote: unknown): unknown {
  const l = envelopeOf(local);
  const r = envelopeOf(remote);
  const topics = unionBy(
    arrayOf(l.topics).filter(isTopic),
    arrayOf(r.topics).filter(isTopic),
    (topic) => topic.id,
    joinTopics,
  ).sort((x, y) => compareText(firstDiscussed(x), firstDiscussed(y)) || compareText(x.id, y.id));
  return { version: 1, topics: topics.slice(-MAX_STORED_TOPICS) };
}

// ──────────────────────────────────────────────── bookmarks and partial scenes

/**
 * The later of two decisions about the same thing, ties broken canonically.
 *
 * A wall clock, and this file says everywhere else not to trust one. It is trusted here
 * because these two domains have nothing else: a bookmark tap and a walk-out of a scene
 * produce no count that goes up, no grade, no session, so there is no clock-free evidence
 * to order two of them by. The alternative is a canonical max, which would mean the answer
 * to "is this saved" was decided by which string sorts higher, and would make an un-save
 * permanent or impossible depending on the id. `at` is a real observation of the learner's
 * own device; the order it induces is total, so the fold is still commutative, associative
 * and idempotent, which is what the engine actually needs from it.
 */
function newerOf<T extends { at: number }>(x: T, y: T): T {
  if (x.at !== y.at) return x.at > y.at ? x : y;
  return laterOf(x, y);
}

interface Bookmarkish {
  scenarioId: string;
  at: number;
  saved: boolean;
}

function isBookmark(value: unknown): value is Bookmarkish {
  return (
    isRecord(value) &&
    typeof value.scenarioId === 'string' &&
    value.scenarioId.length > 0 &&
    isFiniteNumber(value.at) &&
    typeof value.saved === 'boolean'
  );
}

/**
 * One row per situation, the newer decision winning, oldest first, capped.
 *
 * The `saved: false` rows are the reason this namespace is per-item rather than a set
 * union. A union of saved ids can only add, so an un-save on one phone would be undone
 * the next time any other device folded its older copy in — silently, and again every
 * cycle. Keeping the decision, and taking the newer of two decisions, is what lets a
 * learner take something off the list and have it stay off.
 */
function mergeBookmarks(local: unknown, remote: unknown): unknown {
  const items = unionBy(
    arrayOf(envelopeOf(local).items).filter(isBookmark),
    arrayOf(envelopeOf(remote).items).filter(isBookmark),
    (item) => item.scenarioId,
    newerOf,
  ).sort((x, y) => x.at - y.at || compareText(x.scenarioId, y.scenarioId) || compareText(canonical(x), canonical(y)));
  return { version: 2, items: items.slice(-MAX_BOOKMARKS) };
}

interface ScenarioRecordish {
  missionId: string;
  at: number;
  elapsedMs: number;
  beatsDone: number;
}

function isScenarioRecord(value: unknown): value is ScenarioRecordish {
  return (
    isRecord(value) &&
    typeof value.missionId === 'string' &&
    value.missionId.length > 0 &&
    isFiniteNumber(value.at) &&
    isFiniteNumber(value.elapsedMs) &&
    value.elapsedMs >= 0 &&
    isFiniteNumber(value.beatsDone) &&
    value.beatsDone >= 0
  );
}

/**
 * One row per mission, the newer walk-out winning, oldest first, capped.
 *
 * Nothing is recomputed and nothing is combined: two devices that each left the same
 * scene hold two accounts of one thing, and the older one is stale rather than partial.
 * Adding the elapsed times, or taking the further `beatsDone`, would invent a sitting
 * that never happened and put a pace estimate under it.
 *
 * `beatsTotal` is not in this shape, so it cannot be merged. It lives in the mission
 * catalogue, where a build can correct it, instead of in two devices that can disagree.
 */
function mergeScenarioProgress(local: unknown, remote: unknown): unknown {
  const records = unionBy(
    arrayOf(envelopeOf(local).records).filter(isScenarioRecord),
    arrayOf(envelopeOf(remote).records).filter(isScenarioRecord),
    (record) => record.missionId,
    newerOf,
  ).sort((x, y) => x.at - y.at || compareText(x.missionId, y.missionId) || compareText(canonical(x), canonical(y)));
  return { version: 1, records: records.slice(-MAX_SCENARIO_RECORDS) };
}

// ────────────────────────────────────────────────────────────────── history

interface StoredSessionish {
  endedAt: number;
  summary: Record<string, unknown>;
}

/** The same shape `adoptHistory` accepts, so the merge and the disk agree on the set. */
function isSession(value: unknown): value is StoredSessionish {
  return isRecord(value) && isFiniteNumber(value.endedAt) && isRecord(value.summary);
}

function mergeHistory(local: unknown, remote: unknown): unknown {
  const sessions = unionBy(arrayOf(local).filter(isSession), arrayOf(remote).filter(isSession), canonical).sort(
    (x, y) => x.endedAt - y.endedAt || compareText(canonical(x), canonical(y)),
  );
  return sessions.slice(-MAX_HISTORY_SESSIONS);
}

// ───────────────────────────────────────────────────────────────── activity

const ACTIVITY_KINDS: ReadonlySet<string> = new Set(['lesson', 'convo', 'drill', 'review']);

interface ActivityEntryish {
  at: number;
  kind: string;
  xp: number;
  durationMs?: number;
  activeMs?: number;
}

/**
 * The same shape `isEntry` accepts in progress/activity.ts, `durationMs` and `activeMs` included, so
 * the merge and the disk agree on which rows exist. A validator here that was looser
 * than the store's would answer with entries the adopter then drops, and the engine
 * would find the disk different from the fold on every single cycle.
 */
function isActivityEntry(value: unknown): value is ActivityEntryish {
  return (
    isRecord(value) &&
    isFiniteNumber(value.at) &&
    isFiniteNumber(value.xp) &&
    ACTIVITY_KINDS.has(String(value.kind)) &&
    (value.durationMs === undefined || (isFiniteNumber(value.durationMs) && value.durationMs >= 0)) &&
    (value.activeMs === undefined || (isFiniteNumber(value.activeMs) && value.activeMs >= 0))
  );
}

/**
 * Between two copies of the same sitting, the one that recorded how long it took.
 *
 * The identity is still `(at, kind, xp)`, so a device that logged the sitting before
 * `durationMs` existed and a device that logged it after are the same row rather than
 * two, and the XP is counted once. That leaves the question of which copy survives, and
 * only one answer is safe: the measurement, every time. The other order would let the
 * older device erase a number the newer one actually observed, on every cycle, quietly.
 *
 * `activeMs` (Phase 1B, active learning time) ranks first on the same argument: it is
 * the measurement Home's Practice time reads, and a copy from a device that only knew
 * wall time must not erase it.
 *
 * A max over `(has an active total, has a duration, canonical rendering)`, which is a
 * lexicographic total order, so this is commutative, associative and idempotent like
 * every other pick in this file.
 */
function withDuration(x: ActivityEntryish, y: ActivityEntryish): ActivityEntryish {
  const xActive = x.activeMs === undefined ? 0 : 1;
  const yActive = y.activeMs === undefined ? 0 : 1;
  if (xActive !== yActive) return xActive > yActive ? x : y;
  const xHas = x.durationMs === undefined ? 0 : 1;
  const yHas = y.durationMs === undefined ? 0 : 1;
  if (xHas !== yHas) return xHas > yHas ? x : y;
  return laterOf(x, y);
}

/**
 * Union the log, then prune to the same 400 days the store keeps — but against the
 * newest entry in the union, not against a clock.
 *
 * Pruning against `Date.now()` is what it looks like it should be and it does not
 * converge. Two devices whose clocks differ by a day sit either side of the cutoff for
 * every entry in between: one drops the entry, pushes, the other re-adds it from its own
 * disk, pushes, and the pair trade revisions for as long as both are running. Deriving
 * the cutoff from the data makes both devices compute the same number from the same
 * union, and the newest entry in a learner's activity log is a better estimate of "now"
 * for this purpose than either device's clock.
 *
 * The 400-day rule itself still belongs to `progress/activity.ts`. This re-applies it; it
 * does not own it.
 */
function mergeActivity(local: unknown, remote: unknown): unknown {
  const l = envelopeOf(local);
  const r = envelopeOf(remote);
  const entries = unionBy(
    arrayOf(l.entries).filter(isActivityEntry),
    arrayOf(r.entries).filter(isActivityEntry),
    (entry) => `${entry.at}\u0000${entry.kind}\u0000${entry.xp}`,
    withDuration,
  ).sort((x, y) => x.at - y.at || compareText(canonical(x), canonical(y)));
  const newest = entries.length === 0 ? 0 : (entries[entries.length - 1]?.at ?? 0);
  const cutoff = newest - ACTIVITY_KEEP_DAYS * DAY_MS;
  return {
    version: 2,
    activeDays: mergeActiveDays(entries, l.activeDays, r.activeDays),
    entries: entries.filter((entry) => entry.at >= cutoff),
    // A one-time guard, so it only ever turns on. Letting it fall back to false would
    // credit this learner's whole pre-log history a second time.
    backfilled: l.backfilled === true || r.backfilled === true,
  };
}

// ───────────────────────────────────────────────────────────────── missions

interface MissionCompletionish {
  id: string;
  at: number;
  rung: number;
}

function isCompletion(value: unknown): value is MissionCompletionish {
  return isRecord(value) && typeof value.id === 'string' && isFiniteNumber(value.at) && isFiniteNumber(value.rung);
}

/**
 * Union by `(mission, finished at)`, then the store's own per-mission cap.
 *
 * Grouped in sorted mission order, each group oldest first, so the array this produces is
 * exactly the array `adoptMissionCompletions` would rebuild from it. That equality is the
 * difference between adopting once and adopting on every cycle forever.
 */
function mergeMissions(local: unknown, remote: unknown): unknown {
  const all = unionBy(
    arrayOf(envelopeOf(local).completions).filter(isCompletion),
    arrayOf(envelopeOf(remote).completions).filter(isCompletion),
    (row) => `${row.id}\u0000${row.at}`,
  );
  const byMission = new Map<string, MissionCompletionish[]>();
  for (const row of all) {
    const rows = byMission.get(row.id) ?? [];
    rows.push(row);
    byMission.set(row.id, rows);
  }
  const completions: MissionCompletionish[] = [];
  for (const id of [...byMission.keys()].sort(compareText)) {
    const rows = (byMission.get(id) ?? []).sort(
      (x, y) => x.at - y.at || compareText(canonical(x), canonical(y)),
    );
    completions.push(...retainCompletions(rows, MAX_COMPLETIONS_PER_MISSION));
  }
  return { version: 1, completions };
}

// ────────────────────────────────────────────────────────────── sound checks

const SOUND_CHECK_KINDS: ReadonlySet<string> = new Set([
  'assessed-clear',
  'assessed-focus',
  'self-guided',
  'unavailable',
]);

interface SoundCheckish {
  missionId: string;
  reference: string;
  at: number;
  kind: string;
  focus: string | null;
  phoneme?: string | null;
}

function isSoundCheck(value: unknown): value is SoundCheckish {
  return (
    isRecord(value) &&
    typeof value.missionId === 'string' &&
    typeof value.reference === 'string' &&
    isFiniteNumber(value.at) &&
    SOUND_CHECK_KINDS.has(String(value.kind)) &&
    (value.focus === null || typeof value.focus === 'string') &&
    (value.phoneme === undefined || value.phoneme === null || typeof value.phoneme === 'string')
  );
}

/**
 * Every attempt either device measured, oldest first, capped.
 *
 * Whole-row identity on purpose: two attempts at the same reference a second apart are
 * two attempts, and a merge that folded them would quietly delete evidence of practice.
 * `kind` is never widened by anything here — a self-guided check is not a score.
 */
function mergeSoundChecks(local: unknown, remote: unknown): unknown {
  const evidence = unionBy(
    arrayOf(envelopeOf(local).evidence).filter(isSoundCheck),
    arrayOf(envelopeOf(remote).evidence).filter(isSoundCheck),
    canonical,
  ).sort((x, y) => x.at - y.at || compareText(canonical(x), canonical(y)));
  return { version: 1, evidence: evidence.slice(-MAX_SOUND_CHECKS) };
}

// ───────────────────────────────────────────────────────── one-time flags

/**
 * Union of the marks seen anywhere, sorted.
 *
 * Sorted rather than "this device's order, then the rest", because an array's order is
 * part of its bytes and the two devices must produce the same ones. An id this build has
 * never heard of is kept: it belongs to a mark some other build showed, and dropping it
 * would show that mark again to somebody who has already read it.
 */
function mergeCoachMarks(local: unknown, remote: unknown): unknown {
  return [...new Set([...stringsOf(local), ...stringsOf(remote)])].sort(compareText);
}

/** Anything the store would read as "seen". `tutorIntro` is stored as the JSON number 1. */
function isSeen(value: unknown): boolean {
  return value !== null && value !== undefined && value !== false && value !== 0;
}

/**
 * OR, and there is no way back. That is what a one-time flag is: a merge that could clear
 * it would show a learner the four-page explainer again on a new phone.
 */
function mergeTutorIntro(local: unknown, remote: unknown): unknown {
  return isSeen(local) || isSeen(remote) ? 1 : null;
}

// ──────────────────────────────────────────────────────────────── the table

/** Which of the three shapes a namespace's answer is built with. */
export type SyncMergeClass = 'structured' | 'per-item' | 'set-union';

export interface NamespacePolicy {
  readonly namespace: string;
  readonly merges: SyncMergeClass;
  /**
   * The inner schema version this build writes into this namespace's blob, or null when
   * the blob carries no version at all (a bare array). A payload declaring a higher one
   * came from a newer app and this device goes quiet rather than merging it.
   */
  readonly writes: number | null;
  /** The rule in one sentence, in the same words the table at the top of this file uses. */
  readonly rule: string;
  merge(local: unknown, remote: unknown, now: number): unknown | typeof UNREADABLE;
}

export const SYNC_POLICIES: readonly NamespacePolicy[] = [
  {
    namespace: 'profile',
    merges: 'structured',
    // Moves with `StoredProfile.version`, and moves in the same commit the store
    // does. v5 added `ageStopAt`, v6 the chosen `tutorVoice`, v7 `preferTyping`,
    // v8 `forgottenFacts` and `learnerGoals`; left a version
    // behind, this build calls its own merge output a newer schema and goes
    // pull-quiet on every profile cycle, forever, with nothing in the log. What
    // a learner would see is the voice they picked on one phone never reaching
    // the other. `policy.test.ts` reads the number back out of profile/store.ts.
    writes: 8,
    rule: 'phrases and error patterns union with max counts and mastered ORed; forgotten facts union as a set; the rest whole from the evidence-heavier side',
    merge: mergeProfile,
  },
  {
    namespace: 'review',
    merges: 'per-item',
    writes: null,
    rule: 'union by card id; the whole card from the side with more grades applied, scheduling carried never recomputed',
    merge: (local, remote) => mergeReview(local, remote),
  },
  {
    namespace: 'drills',
    merges: 'per-item',
    writes: 1,
    rule: 'union on drill identity (including translation direction) under the drill bank cap; micSuppressedUntil takes the later',
    merge: (local, remote) => mergeDrills(local, remote),
  },
  {
    namespace: 'topics',
    merges: 'per-item',
    writes: 1,
    rule: 'union by topic id; sitting dates and deck ids union, and the title is the canonical max',
    merge: (local, remote) => mergeTopicList(local, remote),
  },
  {
    namespace: 'bookmarks',
    merges: 'per-item',
    writes: 2,
    rule: 'union by situation id; the newer decision wins, so an un-save survives a fold, oldest first under the store cap',
    merge: (local, remote) => mergeBookmarks(local, remote),
  },
  {
    namespace: 'scenarioProgress',
    merges: 'per-item',
    writes: 1,
    rule: 'union by mission id; the newer record of where a scene was left wins, and the beat total is never stored',
    merge: (local, remote) => mergeScenarioProgress(local, remote),
  },
  {
    namespace: 'history',
    merges: 'set-union',
    writes: null,
    rule: 'union by session identity, oldest first, last fifty',
    merge: (local, remote) => mergeHistory(local, remote),
  },
  {
    namespace: 'activity',
    merges: 'set-union',
    writes: 2,
    rule: 'union by (at, kind, xp) with the copy carrying an activeMs, then a durationMs, winning, pruned to 400 days from the newest entry, backfilled ORed',
    merge: (local, remote) => mergeActivity(local, remote),
  },
  {
    namespace: 'missions',
    merges: 'set-union',
    writes: 1,
    rule: 'union by (mission, finished at), then the per-mission completion cap',
    merge: (local, remote) => mergeMissions(local, remote),
  },
  {
    namespace: 'soundChecks',
    merges: 'set-union',
    writes: 1,
    rule: 'union by attempt identity, oldest first, last sixty, kind never widened',
    merge: (local, remote) => mergeSoundChecks(local, remote),
  },
  {
    namespace: 'coachMarks',
    merges: 'set-union',
    writes: null,
    rule: 'union of the ids seen anywhere, sorted, never cleared',
    merge: (local, remote) => mergeCoachMarks(local, remote),
  },
  {
    namespace: 'tutorIntro',
    merges: 'set-union',
    writes: null,
    rule: 'OR; seen anywhere is seen and there is no way back',
    merge: (local, remote) => mergeTutorIntro(local, remote),
  },
  {
    namespace: 'practiceHistory',
    merges: 'set-union',
    // Moves with PRACTICE_HISTORY_VERSION in practice/history.ts, which is imported
    // rather than copied because that file is pure and shares the validator.
    writes: PRACTICE_HISTORY_VERSION,
    rule: 'union by (kind, id) of strictly validated practice events, canonical pick, oldest first, last 150',
    merge: (local, remote) => mergePracticeHistory(local, remote),
  },
  {
    namespace: 'goalSteps',
    merges: 'set-union',
    // Moves with GOAL_STEPS_VERSION in goals/model.ts, imported rather than
    // copied because that file is pure and shares the validator with the store.
    writes: GOAL_STEPS_VERSION,
    rule: 'union by whole row of strictly validated goal-step events, oldest first, last sixty, nothing attributed by time',
    merge: (local, remote) => mergeGoalSteps(local, remote),
  },
];

export interface SyncExclusion {
  readonly namespace: string;
  /** Why syncing it would make the product worse, not why nobody got round to it. */
  readonly reason: string;
}

/**
 * The eleven namespaces that are on the device and stay on the device.
 *
 * Each is here because syncing it is *wrong*, not because it is hard. A namespace
 * missing from the table above without an entry here is a store somebody forgot, and
 * `policy.test.ts` cannot tell the two apart unless the reason is written down.
 */
export const SYNC_EXCLUSIONS: readonly SyncExclusion[] = [
  { namespace: 'onboarding-practice', reason: 'A temporary first-use task on this phone. Its explicitly saved phrase enters the ordinary synced review deck; the local guest capability never syncs.' },
  { namespace: 'pendingPurchase', reason: 'A checkout started on this phone stays fenced here until its matching paid entitlement is verified. It is transaction recovery, never learning evidence or cross-device billing authority.' },
  {
    namespace: 'suggestions',
    reason:
      'a seed and a position in one learner\'s deal of the authored pool, rather than anything they have learned. The position is an index into an order the seed produced over a pool that grows between releases, so the same pair names a different situation on two builds: syncing it would carry a phone that is three suggestions along onto a tablet that lands somewhere unrelated. What excluding it costs is one repeated suggestion on a second device, against a value that cannot mean the same thing twice.',
  },
  {
    namespace: 'journal',
    reason:
      'a device-local crash buffer whose whole meaning is bank-then-delete: an entry exists only between a recap arriving and its phrases reaching the deck. Syncing it would hand a second device a recap the first has already banked, and it would bank it again, which is the duplicate the journal was built to prevent.',
  },
  {
    namespace: 'friends',
    reason:
      'a dormant surface running on labelled sample profiles while social sits outside primary navigation. Syncing it would write fixtures into the account, server-side, where they would outlive the decision to ship the feature and be indistinguishable from a real roster.',
  },
  {
    namespace: 'reminder',
    reason:
      'a property of one phone rather than of one learner: the OS holds the schedule and permission is asked for per install, so an account-level time would arrive on every device someone is signed in on. Two phones nudging at six is one learner reminded twice for one evening, which is the pestering the fixed, practice-blind wording exists to avoid, and a device that was never asked for permission would be told it already has a reminder. What excluding it costs a learner is one tap among four presets.',
  },
  {
    namespace: 'analytics',
    reason:
      'a consent, which is given to the device that asked for it and to nothing else. Every merge in this table resolves a disagreement by picking a winner, and the only winner a permission may have is the most recent thing the learner actually said: a fold that can carry an older yes over a newer no would turn a withdrawal into a setting that comes back by itself, which is why it is not a field on the profile either, where mergeStoredProfiles picks scalars by evidence weight. What excluding it costs is a second device that reports nothing until it is asked in Settings, and reporting nothing is the answer we are content to be wrong with.',
  },
  {
    namespace: 'moments',
    reason:
      'the moments a learner brought to rehearse: a kind and one line in their own words about their own life, an interview next week, a call to a doctor. That is the most personal text the app holds, and it is held on the phone that typed it and nowhere else: syncing it would put a sentence about somebody\'s job hunt into an account envelope so that a second device could offer it back, which is a smaller convenience than the promise it spends. What excluding it costs is typing a line again on another phone.',
  },
  {
    namespace: 'packMarks',
    reason:
      'what this phone did with a server-owned pack: practised it, kept its conversation going. It annotates the pack cache and is excluded for the cache\'s own reason: the pack is server-owned and its cache is replaced by the server\'s copy on every refresh, so a mark that rode the account envelope would be a second authority over a record that has one. What excluding it costs is a second phone re-offering a pack this one already practised, once.',
  },
  {
    namespace: 'practiceSession',
    reason:
      'the one unfinished practice sitting on this phone and the frozen plan for finishing it: exercise ids in queue order, settled outcomes and miss counts. Its meaning is local to the bank and deck this device holds, and its completion plan is what stops grades and XP being applied twice, so a second device holding a copy could finish the same sitting again against a different deck. Completed sittings reach the account through practiceHistory. What excluding it costs is resuming an interrupted sitting only on the phone it started on.',
  },
  {
    namespace: 'conversationPacks',
    reason:
      'a cache of an explicitly server-owned learning record. The Tutor agent writes the canonical pack after session completion and Practice refreshes from that authenticated API, so folding this cache through learner_state would create two authorities, allow an older device to push a stale deletion back over the server record, and duplicate the exercises the Pack already carries into the existing drill bank.',
  },
];

// ────────────────────────────────────────────────────────────── the policy

export interface SyncPolicyOptions {
  /** Injected so the profile version chain is deterministic under test. */
  readonly now?: () => number;
}

/**
 * The engine's view of all of the above: a list of namespaces and one `merge`.
 *
 * Three guards sit in front of the table, in this order and for these reasons:
 *
 *  1. **A namespace nobody declared goes quiet.** Not an error and not a merge — the
 *     engine never asks for one, but an excluded store reaching this by some other route
 *     must not be answered with a merge of two blobs this file has no rule for.
 *  2. **Both sides absent is the answer `null`.** Without it every unused namespace on a
 *     fresh install would create an empty row on the server, once per launch, forever.
 *  3. **A newer inner schema on either side goes quiet.** The cross-cutting rule. Both
 *     sides are checked, not only the remote one: a device running an older build over a
 *     disk a newer build wrote would lose exactly the same fields in exactly the same way.
 *
 * And the merge itself runs inside a `try`. A blob off the wire is untrusted input; a
 * throw in here would reject the engine's cycle rather than costing one namespace one
 * pass, and a corrupt payload must never be able to stop a learner's sync.
 */
export function createSyncPolicy(options: SyncPolicyOptions = {}): SyncPolicy {
  const now = options.now ?? Date.now;
  const table = new Map(SYNC_POLICIES.map((policy) => [policy.namespace, policy]));

  return {
    namespaces: SYNC_POLICIES.map((policy) => policy.namespace),
    merge(request: SyncMergeRequest): SyncMergeResult {
      const policy = table.get(request.namespace);
      if (policy === undefined) return { kind: 'quiet', reason: 'not-synced' };
      if (request.local === null && request.remote === null) return { kind: 'merged', data: null };
      try {
        if (policy.writes !== null) {
          for (const side of [request.local, request.remote]) {
            const version = innerVersion(side);
            if (version !== null && version > policy.writes) return { kind: 'quiet', reason: 'newer-schema' };
          }
        }
        const merged = policy.merge(request.local, request.remote, now());
        if (merged === UNREADABLE) return { kind: 'quiet', reason: 'unreadable-local' };
        return { kind: 'merged', data: merged };
      } catch {
        // Including the version read itself. A payload can be a JSON document with a
        // throwing accessor on it — the test that found this was reading `version`, not
        // merging — and a throw from anywhere past this point costs one namespace one
        // pass instead of rejecting the engine's whole cycle.
        return { kind: 'quiet', reason: 'unreadable-local' };
      }
    },
  };
}

/** The one the app runs. Bound to the wall clock; tests build their own. */
export const syncPolicy: SyncPolicy = createSyncPolicy();
