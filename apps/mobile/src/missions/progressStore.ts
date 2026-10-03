/**
 * Where a learner left a scene, on the device.
 *
 * Storage shell only, the same shape as missions/store.ts: a versioned
 * envelope, a serialised write chain, an adopter and a scope reset. Every rule
 * about what a partial scene *means* — how many minutes are probably left, which
 * door the tutor opens on — belongs to `missions/resume.ts`, which reads these
 * records and the mission catalogue together.
 *
 * **One record per mission, and the newest `at` wins.** A learner who leaves the
 * same scene twice has one place they left it, not a history: the older attempt
 * tells nobody anything the newer one does not. That is both the local rule and
 * the merge rule, deliberately, so a device that has synced and a device that
 * never has hold the same row for the same mission.
 *
 * **`beatsTotal` is never stored.** It is read from the mission catalogue at the
 * moment somebody asks how far through the scene this is. A count kept in two
 * places is a count two devices can disagree about, and the catalogue is the
 * only one of the two that can be corrected by shipping a build.
 *
 * **Nothing derived is stored either.** Not the minutes remaining, not a
 * percentage, not a pace. `elapsedMs` and `beatsDone` are the two things that
 * were actually observed; everything a screen shows is computed from them and
 * from the catalogue, every time.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { onUserScopeReset, userKey, scopeGeneration, setItemInUserScope } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('scenarioProgress');

const VERSION = 1;

/**
 * A ceiling on rows a fold can bring in.
 *
 * The catalogue is six missions, so no honest device ever comes near this. The
 * cap is here because the other side of a merge is a payload some other build
 * wrote, and a namespace with no bound is a namespace one bad row can grow
 * forever. The discard rule is the oldest partial scene, which is also the one
 * least likely to be picked back up.
 */
export const MAX_SCENARIO_RECORDS = 40;

export interface ScenarioRecord {
  /** Which mission. Typed `string`, the way missions/store.ts types its own id. */
  missionId: string;
  /** Epoch milliseconds the learner left, injected by the caller. */
  at: number;
  /** How long they had been in the scene, in wall-clock milliseconds. */
  elapsedMs: number;
  /** How many beats of the scene were behind them. Never the total. */
  beatsDone: number;
}

interface StoredScenarioProgress {
  version: typeof VERSION;
  records: ScenarioRecord[];
}

/** See progress/activity.ts for why an adopted write does not raise the flag. */
type WriteOrigin = 'local' | 'adopted';

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string, owner: number) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = KEY();
  const owner = scopeGeneration();
  const run = () => mutation(key, owner);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

function isRecordRow(value: unknown): value is ScenarioRecord {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.missionId === 'string' &&
    row.missionId.length > 0 &&
    typeof row.at === 'number' &&
    Number.isFinite(row.at) &&
    typeof row.elapsedMs === 'number' &&
    Number.isFinite(row.elapsedMs) &&
    row.elapsedMs >= 0 &&
    typeof row.beatsDone === 'number' &&
    Number.isFinite(row.beatsDone) &&
    row.beatsDone >= 0
  );
}

/**
 * Byte-stable rendering, used only to break a tie between two records claiming
 * the same instant. The same primitive `sync/policy.ts` orders by, restated
 * rather than imported because that file must load under plain node and this
 * one reaches AsyncStorage.
 */
function canonical(row: ScenarioRecord): string {
  return JSON.stringify([row.missionId, row.at, row.elapsedMs, row.beatsDone]);
}

/** The later of two records for one mission. A max, so folding twice is a no-op. */
function newerOf(x: ScenarioRecord, y: ScenarioRecord): ScenarioRecord {
  if (x.at !== y.at) return x.at > y.at ? x : y;
  return canonical(x) >= canonical(y) ? x : y;
}

/**
 * One row per mission, oldest first, capped.
 *
 * The order is part of the bytes, and the bytes have to match what the merge
 * policy produces from the same set: a row differing from the account's by
 * nothing but array order is re-adopted on every cycle, forever.
 */
function ordered(records: readonly ScenarioRecord[]): ScenarioRecord[] {
  const held = new Map<string, ScenarioRecord>();
  for (const row of records) {
    const seen = held.get(row.missionId);
    held.set(row.missionId, seen === undefined ? row : newerOf(seen, row));
  }
  return [...held.values()]
    .sort((a, b) => a.at - b.at || (a.missionId < b.missionId ? -1 : a.missionId > b.missionId ? 1 : 0))
    .slice(-MAX_SCENARIO_RECORDS);
}

async function readRecords(key: string): Promise<ScenarioRecord[]> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return [];
  const parsed = JSON.parse(raw) as Partial<StoredScenarioProgress> | null;
  if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.records) || !parsed.records.every(isRecordRow)) {
    throw new Error('scenario progress could not be read');
  }
  return parsed.records;
}

/**
 * The envelope exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 */
async function persistedRecords(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null ||
      (parsed as Partial<StoredScenarioProgress>).version !== VERSION ||
      !Array.isArray((parsed as Partial<StoredScenarioProgress>).records) ||
      !(parsed as StoredScenarioProgress).records.every(isRecordRow)) {
    throw new Error('scenario progress could not be read');
  }
  return parsed;
}

async function saveRecords(key: string, records: readonly ScenarioRecord[], origin: WriteOrigin, owner: number): Promise<boolean> {
  try {
    await setItemInUserScope(owner,
      key,
      JSON.stringify({ version: VERSION, records: [...records] } satisfies StoredScenarioProgress),
    );
    if (origin === 'local') markDirty('scenarioProgress');
    return true;
  } catch {
    // Storage full or unavailable. The scene simply opens from the top next
    // time, which is a smaller loss than anything this store could throw for.
    return false;
  }
}

export function loadScenarioProgress(): Promise<ScenarioRecord[]> {
  return readRecords(KEY());
}

/**
 * Write where the learner left this scene.
 *
 * Replaces that mission's older record and keeps every other mission's. An
 * incoming record older than the one on disk is not written, which is the same
 * rule the merge applies, so a queued write that lands late cannot undo a
 * fresher one.
 */
export function recordScenarioProgress(record: ScenarioRecord): Promise<void> {
  return serialized(async (key, owner) => {
    if (!isRecordRow(record)) return;
    let existing: ScenarioRecord[];
    try { existing = await readRecords(key); } catch { return; }
    await saveRecords(key, ordered([...existing, record]), 'local', owner);
  });
}

/**
 * Forget where the learner left this scene.
 *
 * Called by `recordMissionCompletion`: a scene that has been finished has
 * nothing left in it, and a stale record would put "minutes remaining" under a
 * mission the learner has already walked out of.
 *
 * A mission with no record writes nothing at all, so a finish cannot create an
 * empty row for an account that has never left a scene part way.
 */
export function clearScenarioProgress(missionId: string): Promise<void> {
  return serialized(async (key, owner) => {
    let existing: ScenarioRecord[];
    try { existing = await readRecords(key); } catch { return; }
    const remaining = existing.filter((row) => row.missionId !== missionId);
    if (remaining.length === existing.length) return;
    await saveRecords(key, ordered(remaining), 'local', owner);
  });
}

/**
 * Fold the account's records into this device's, on this store's own chain.
 *
 * The engine hands over a fold rather than a finished set, because it read this
 * key before the pull: a scene left during the round trip would otherwise be
 * written over by a set computed before the learner left it. The union is by
 * mission with the newer record winning, so folding twice is the same as
 * folding once, and the order and the cap are re-applied here rather than
 * trusted from the wire so that the disk ends up holding exactly what the
 * engine is about to push.
 */
function adoptScenarioProgress(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key, owner) => {
    let current: unknown;
    try { current = await persistedRecords(key); } catch { return 'declined'; }
    const folded = fold(current);
    if (typeof folded !== 'object' || folded === null) return 'declined';
    const envelope = folded as Partial<StoredScenarioProgress>;
    if (envelope.version !== VERSION || !Array.isArray(envelope.records)) return 'declined';
    if (!(await saveRecords(key, ordered(envelope.records.filter(isRecordRow)), 'adopted', owner))) return 'declined';
    return 'adopted';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('scenarioProgress', adoptScenarioProgress);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
