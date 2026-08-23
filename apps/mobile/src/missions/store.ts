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

import AsyncStorage from '@react-native-async-storage/async-storage';
import { userKey } from '../storage/scope.ts';

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

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = KEY();
  const run = () => mutation(key);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

function isCompletion(value: unknown): value is MissionCompletion {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.at === 'number' && typeof record.rung === 'number';
}

async function readCompletions(key: string): Promise<MissionCompletion[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredMissions> | null;
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.completions)) return [];
    return parsed.completions.filter(isCompletion);
  } catch {
    // A corrupt store is not worth crashing over, and it costs the learner
    // nothing they can feel: the missions read as new again, and the phrases
    // they earned are in the review deck either way.
    return [];
  }
}

export function loadMissionCompletions(): Promise<MissionCompletion[]> {
  return readCompletions(KEY());
}

/**
 * Write the win. Called once at the moment the mission completes, with the
 * rung the view carried.
 */
export function recordMissionCompletion(id: string, rung: number, at = Date.now()): Promise<void> {
  return serialized(async (key) => {
    const existing = await readCompletions(key);
    const mine = [...existing.filter((c) => c.id === id), { id, at, rung }]
      .sort((a, b) => a.at - b.at)
      .slice(-COMPLETIONS_PER_MISSION);
    const completions = [...existing.filter((c) => c.id !== id), ...mine];
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ version: VERSION, completions } satisfies StoredMissions));
    } catch {
      // Storage full or unavailable. The learner still had the win, the recap
      // still banks the phrases, and the mission simply reads as new next time.
    }
  });
}
