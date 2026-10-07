/**
 * What Home last showed, so a number that rose since can count up from where
 * the learner last saw it, once (F767).
 *
 * Home's flame, goal minutes, level, quests done and lifetime days are each a
 * persisted fact the game layer reads. When one of them has risen since Home
 * last drew it, the number counts up from the old value to the new one. Then
 * the new value is remembered here, so the same rise never plays twice.
 *
 * The rules, pure (`startFrom`, `withShown`) so they are tested without a
 * renderer:
 *
 * - **Never down.** A value that fell (a reset streak) is drawn as it is,
 *   with nothing counting. A fresh start is said in words elsewhere, never by
 *   a number running backwards.
 * - **Never a replay.** A value already shown starts where it is.
 * - **Nothing invented.** With nothing remembered for a value (a new phone,
 *   the first visit) it is drawn as it is: there is no earlier value to count
 *   from, and counting up from nought would claim a rise that did not happen.
 * - **A new day starts the day's numbers at nought.** Today's minutes and
 *   quests begin each day at nothing, so a rise since midnight counts up from
 *   nought without yesterday's figure ever being drawn going down.
 *
 * Device-local under `userKey('home-seen')`: what one phone last drew is a
 * fact about that phone, so it is excluded from sync (`sync/policy.ts`) and
 * cleared with the account (`storage/scope.ts`). The last value written is
 * also held in memory for the account, so a write the disk refused still
 * never lets the same rise play again while the app is open.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDayKey, type DayKey } from '@luvani/core';

import { readOwnedCache } from '../storage/ownedRead.ts';
import { scopeGeneration, userKey, writeInUserScope } from '../storage/scope.ts';

/** The numbers Home counts up. */
export type ShownField = 'streak' | 'minutes' | 'level' | 'questsDone' | 'lifetimeDays';

export const SHOWN_FIELDS: readonly ShownField[] = ['streak', 'minutes', 'level', 'questsDone', 'lifetimeDays'];

/** The numbers that belong to one day and start each day at nought. */
export const DAILY_FIELDS: readonly ShownField[] = ['minutes', 'questsDone'];

export type ShownValues = Partial<Record<ShownField, number>>;

export const HOME_SEEN_VERSION = 1;

export interface HomeSeen {
  version: typeof HOME_SEEN_VERSION;
  /** The local day the values were last drawn on. */
  day: DayKey;
  values: ShownValues;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function isHomeSeen(value: unknown): value is HomeSeen {
  if (typeof value !== 'object' || value === null) return false;
  const seen = value as Record<string, unknown>;
  if (seen.version !== HOME_SEEN_VERSION || !isDayKey(seen.day)) return false;
  if (typeof seen.values !== 'object' || seen.values === null || Array.isArray(seen.values)) return false;
  for (const [field, count] of Object.entries(seen.values)) {
    if (!SHOWN_FIELDS.includes(field as ShownField) || !isCount(count)) return false;
  }
  return true;
}

/** The value a field was last drawn at, as today sees it, or null when nothing is remembered. */
function lastShown(seen: HomeSeen | null, field: ShownField, today: DayKey): number | null {
  if (seen === null) return null;
  if (DAILY_FIELDS.includes(field) && seen.day !== today) return 0;
  const value = seen.values[field];
  return isCount(value) ? value : null;
}

/**
 * Where a number starts when Home draws `fresh`: the last value shown when the
 * number has risen since, otherwise `fresh` itself, so it never counts down
 * and never replays.
 */
export function startFrom(seen: HomeSeen | null, field: ShownField, fresh: number, today: DayKey): number {
  const last = lastShown(seen, field, today);
  if (last === null || !(fresh > last)) return fresh;
  return last;
}

/** Where every given number starts. */
export function startsFrom(seen: HomeSeen | null, fresh: ShownValues, today: DayKey): ShownValues {
  const out: ShownValues = {};
  for (const field of SHOWN_FIELDS) {
    const value = fresh[field];
    if (isCount(value)) out[field] = startFrom(seen, field, value, today);
  }
  return out;
}

/**
 * What is remembered once `values` are drawn today. A new day drops the day's
 * numbers from before it; every other value is kept until it is drawn again.
 */
export function withShown(seen: HomeSeen | null, values: ShownValues, today: DayKey): HomeSeen {
  const kept: ShownValues = {};
  if (seen !== null) {
    for (const field of SHOWN_FIELDS) {
      const value = seen.values[field];
      if (!isCount(value)) continue;
      if (DAILY_FIELDS.includes(field) && seen.day !== today) continue;
      kept[field] = value;
    }
  }
  for (const field of SHOWN_FIELDS) {
    const value = values[field];
    if (isCount(value)) kept[field] = value;
  }
  return { version: HOME_SEEN_VERSION, day: today, values: kept };
}

// ───────────────────────────────────────────────────────────── on this phone

const KEY = () => userKey('home-seen');

/** The last snapshot written for this account in this launch, ahead of the disk. */
let memory: { generation: number; seen: HomeSeen } | null = null;

let writeChain: Promise<unknown> = Promise.resolve();

/** What this phone last drew for the signed-in learner, or null. A read that fails reads as nothing remembered. */
export async function loadHomeSeen(): Promise<HomeSeen | null> {
  try {
    const generation = scopeGeneration();
    if (memory !== null && memory.generation === generation) return memory.seen;
    return readOwnedCache(await AsyncStorage.getItem(KEY()), isHomeSeen);
  } catch {
    return null;
  }
}

/**
 * Remember that `values` were drawn today, over `read` (what `loadHomeSeen`
 * answered for this draw). Held in memory at once, so the next draw this
 * launch starts where this one ended even if the disk refuses the write; then
 * written, one write at a time, bound to the account it was asked for.
 */
export function markShown(values: ShownValues, today: DayKey, read: HomeSeen | null): Promise<boolean> {
  let key: string;
  try {
    key = KEY();
  } catch {
    return Promise.resolve(false);
  }
  const generation = scopeGeneration();
  const held = memory !== null && memory.generation === generation ? memory.seen : read;
  const next = withShown(held, values, today);
  memory = { generation, seen: next };
  const work = (): Promise<boolean> =>
    writeInUserScope(generation, () => AsyncStorage.setItem(key, JSON.stringify(next))).catch(() => false);
  const run = writeChain.then(work, work);
  writeChain = run;
  return run;
}

/** For tests: forget what this launch drew. */
export function forgetShownInMemory(): void {
  memory = null;
}
