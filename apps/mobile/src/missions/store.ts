/**
 * The missions this learner has finished, on the device.
 *
 * Storage shell only, the same shape as topics/store.ts: every rule about what
 * a completion *means* — new, done with support, done on their own, needing
 * review — belongs to core's `missionStates` projection, so this file is a
 * versioned envelope and a write chain and nothing else. The rung travels with
 * the record because independence is decided by code from the rung the win was
 * earned at, and a later read must not have to guess it.
 *
 * This is the `lessonDone` precedent, not a second phrase store. Phrase
 * strength is still only ever projected from the review deck; a completion is
 * a session fact, stored app-side and passed into the projection.
 *
 * **A short history per mission.** Core deliberately computes both the best
 * independence ever reached and how many times a situation has been finished.
 * Replacing the previous row made both claims impossible: `timesFinished`
 * could never exceed one, and a tired replay with more help erased an earlier
 * independent finish. Keep a bounded history instead. It preserves the facts
 * the projection needs without letting a keen learner grow storage forever.
 */

import { retainCompletions } from './retain.ts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onUserScopeReset, scopeGeneration, writeInUserScope, userKey } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';
import { clearScenarioProgress } from './progressStore.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('missions');

const VERSION = 1;

/** Enough history to show durable progress without an unbounded device blob. */
export const COMPLETIONS_PER_MISSION = 20;

export interface MissionCompletion {
  /**
   * Which mission. Typed `string` only until core's `MissionId` lands this
   * round (packages/core/src/missions/missions.ts) — replace it there, and
   * this store keeps working because it never inspects the value.
   */
  id: string;
  /** Epoch milliseconds, injected by the caller. */
  at: number;
  /** The independence rung the win was earned at. Core reads it, not this. */
  rung: number;
}

interface StoredMissions {
  version: typeof VERSION;
  completions: MissionCompletion[];
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

function isCompletion(value: unknown): value is MissionCompletion {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.at === 'number' && typeof record.rung === 'number';
}

async function readCompletions(key: string, strict = false): Promise<MissionCompletion[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as Partial<StoredMissions> | null;
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.completions)) {
      if (strict) throw new Error('Mission history is unreadable');
      return [];
    }
    if (strict && !parsed.completions.every(isCompletion)) throw new Error('Mission history is unreadable');
    return parsed.completions.filter(isCompletion);
  } catch (error) {
    if (strict) throw error;
    // Only explicitly forgiving callers normalize malformed legacy bytes.
    // Visible reads and new writes use strict mode so evidence is not erased.
    return [];
  }
}

/**
 * The envelope exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 *
 * Not `readCompletions`, which unwraps to a bare list and answers a missing key
 * with an empty one. The merge policy works on the shape that is on disk.
 */
async function persistedCompletions(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as unknown);
}

export function loadMissionCompletions(options?: { strict: boolean }): Promise<MissionCompletion[]> {
  // A recap opened during the win write must read that write, not stale history.
  // A screen must never interpret refused or corrupt evidence as a fresh path.
  // The internal writer still uses the forgiving reader for legacy repair.
  return serialized(key => readCompletions(key, options?.strict ?? true));
}

/**
 * Write the win. Called once at the moment the mission completes, with the
 * rung the view carried.
 *
 * **And forget where they left this scene.** A finished mission has nothing left
 * in it, so a partial record from an earlier walk-out would sit under the tutor's
 * resume door claiming minutes remaining on a scene the learner has already
 * come out the far side of. `progressStore.ts` keeps its own chain, so the two
 * writes are independent; both are asked for here, in this tick, so both bind
 * the account that earned the win rather than whoever is signed in when the
 * queues drain.
 */
export function recordMissionCompletion(id: string, rung: number, at = Date.now()): Promise<void> {
  const cleared = clearScenarioProgress(id);
  const written = serialized(async (key, owner) => {
    let existing: MissionCompletion[];
    try { existing = await readCompletions(key, true); } catch { return; }
    const mine = retainCompletions([...existing.filter((c) => c.id === id), { id, at, rung }]
      .sort((a, b) => a.at - b.at), COMPLETIONS_PER_MISSION);
    const completions = [...existing.filter((c) => c.id !== id), ...mine];
    await saveCompletions(key, owner, completions, 'local');
  });
  return Promise.all([written, cleared]).then(() => undefined);
}

async function saveCompletions(
  key: string,
  owner: number,
  completions: readonly MissionCompletion[],
  origin: WriteOrigin,
): Promise<boolean> {
  try {
    const saved = await writeInUserScope(owner, () => AsyncStorage.setItem(key, JSON.stringify({ version: VERSION, completions: [...completions] } satisfies StoredMissions)));
    if (saved && origin === 'local') markDirty('missions');
    return saved;
  } catch {
    // Storage full or unavailable. The learner still had the win, the recap
    // still banks the phrases, and the mission simply reads as new next time.
    return false;
  }
}

/**
 * Fold the account's completions into this device's, on this store's own chain.
 *
 * The engine hands over a fold rather than a finished set, because it read this
 * key before the pull: a mission finished during the round trip was written over
 * by a set computed before the win, and then pushed, so the win was gone on every
 * device. The fold is called here, inside the chain, between the read and the
 * write, with the set this store holds at that instant. The union is by
 * `(mission, finished at)`, so folding twice is the same as folding once.
 *
 * The per-mission cap is re-applied rather than trusted from the wire: a merged
 * set is the union of two devices' rows and can exceed it. Keeping the best valid rung and the most
 * recent by `at` is the same rule `recordMissionCompletion` uses, so a synced
 * device and a solo one age out the same wins. Missions are visited in sorted id
 * order because that is the order sync/policy.ts emits, and the disk has to end
 * up holding what the engine is about to push: a row differing from the account's
 * by nothing but array order is re-adopted on every cycle, forever. Following the
 * fold's own order would give the same answer today; stating the order means it
 * still does if the fold ever stops sorting.
 */
function adoptMissionCompletions(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key, owner) => {
    let current: unknown;
    try { current = await persistedCompletions(key); } catch { return 'declined'; }
    if (current !== null && (typeof current !== 'object' || current === null ||
      (current as Partial<StoredMissions>).version !== VERSION ||
      !Array.isArray((current as Partial<StoredMissions>).completions) ||
      !(current as StoredMissions).completions.every(isCompletion))) return 'declined';
    const folded = fold(current);
    if (typeof folded !== 'object' || folded === null) return 'declined';
    const envelope = folded as Partial<StoredMissions>;
    if (envelope.version !== VERSION || !Array.isArray(envelope.completions)) return 'declined';
    const byMission = new Map<string, MissionCompletion[]>();
    for (const completion of envelope.completions.filter(isCompletion)) {
      const rows = byMission.get(completion.id) ?? [];
      rows.push(completion);
      byMission.set(completion.id, rows);
    }
    const completions: MissionCompletion[] = [];
    for (const id of [...byMission.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      completions.push(...retainCompletions((byMission.get(id) ?? []).sort((a, b) => a.at - b.at), COMPLETIONS_PER_MISSION));
    }
    return await saveCompletions(key, owner, completions, 'adopted') ? 'adopted' : 'declined';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('missions', adoptMissionCompletions);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
