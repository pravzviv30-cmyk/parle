/**
 * Where the reminder's choice and its log live on the device.
 *
 * Storage shell only, the same shape as topics/store.ts and missions/store.ts:
 * every rule about what a reminder *is* (the presets, the smart mode, the
 * words, what a stored flag means over a revoked permission) belongs to
 * reminder.ts, and every rule about which day gets one belongs to plan.ts. This
 * file is a versioned envelope, a write chain and a scoped key.
 *
 * ## Version 2: the choice, and a short log (Come alive, README Part 5.F)
 *
 * `{ version: 2, reminder, log }`. `reminder` is what the learner chose:
 * enabled, the time (a preset or `smart`), the weekdays if any, and two flags
 * written only when they differ from the default (`mentionStreak: false`,
 * `paused: true`). `log` is what the planner needs to know when to pause: the
 * day keys a reminder arrived, was tapped, or was followed by a visit, the last
 * 14 of each, and the slots last handed to the OS. Day keys only: no words, no
 * counts, nothing the learner said.
 *
 * Version 1 (`{ enabled, time }`) is read and migrated with its time kept, so
 * an existing learner's evening stays the evening; its log starts empty. A
 * version 2 envelope without both halves is not one this build wrote, and reads
 * as unreadable.
 *
 * ## Off is remembered, with its time
 *
 * Turning the switch off writes `enabled: false` with the time rather than
 * clearing the key, so turning it back on months later restores the part of
 * the day the learner chose.
 *
 * ## A strict read keeps unknown separate from off
 *
 * A missing key means no choice and answers `null`. Settings and Recap request
 * a strict read: corrupt, unsupported or refused bytes throw, so neither can
 * show Off or offer scheduling over a choice this build cannot verify. The
 * default read remains lenient; it never guesses On.
 *
 * ## Not synced, and that is a decision
 *
 * The OS holds the schedule and notification permission is per install, so an
 * account that carried its reminder between devices would nudge one learner
 * from two phones. The reason is recorded in `SYNC_EXCLUSIONS` in
 * sync/policy.ts.
 *
 * ## The guest's log
 *
 * A guest who said yes on day one has no account, so no `userKey` to keep a
 * log under. Their choice rides in the first run's draft; their log (and
 * whether the pause note has gone out) is one device key,
 * `@luvani/guest-reminder/v1`, holding day keys only. The planner clears it
 * when the draft carries no reminder, and once an account plans instead.
 *
 * ## The plan the phone holds
 *
 * One more device key, `@luvani/reminder-held/v1`, holds one instant: the
 * `plannedAt` of the plan the OS was last handed, or null once a plan was
 * taken back. It is the device's and not an account's because a sign-out has
 * to write it after the account's own keys can no longer be written. A log
 * whose plan is not the one held counts none of its slots as arrived
 * (`plan.ts` `heldLog`), so a reminder that was turned off, or that left with
 * a sign-out, can never come back paused. No user id, no words, no days.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistAck } from '../storage/ack.ts';
import { userKey, scopeGeneration, setItemInUserScope } from '../storage/scope.ts';
import { boundLog, emptyLog, type PlannedSlot, type ReminderLog } from './plan.ts';
import { reminderTime, type ReminderMode, type ReminderTimeId, type StoredReminder } from './reminder.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = (): string => userKey('reminder');

/** The guest's log, before any account exists. */
const GUEST_KEY = '@luvani/guest-reminder/v1';

/** Which plan the OS holds, for whoever is on the phone. */
const HELD_KEY = '@luvani/reminder-held/v1';

const VERSION = 2;

interface StoredEnvelope {
  version: typeof VERSION;
  reminder: StoredReminder;
  log: ReminderLog;
}

let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Run a write alone on the chain, with the account bound at enqueue.
 *
 * A learner opening the sheet taps one preset and then another within a beat,
 * and two overlapping `setItem` calls leave which one survives to the
 * platform. Serialised, the disk ends up in tap order. The account is bound
 * when the work is requested: a sign-out while a write is queued must never
 * redirect that write into the next account's namespace.
 */
function serialized<T>(write: (key: string, owner: number) => Promise<T>): Promise<T> {
  const key = KEY();
  const owner = scopeGeneration();
  const run = (): Promise<T> => write(key, owner);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

/** Delegated on purpose: reminder.ts owns which presets exist and what junk becomes. */
function presetOf(raw: unknown): ReminderTimeId {
  return reminderTime(raw).value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Weekdays 1 to 7, once each. */
function weekdays(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((day): day is number => Number.isInteger(day) && day >= 1 && day <= 7))];
}

/**
 * A stored choice, or null when it is not one. `enabled` has to be a real
 * boolean or the whole thing is nothing, because it is the decision itself.
 * The time is repaired rather than discarded: a mangled hour costs the learner
 * the default time and not their choice to be reminded at all.
 */
function choiceOf(value: unknown, version: 1 | 2): StoredReminder | null {
  if (!isRecord(value) || typeof value.enabled !== 'boolean') return null;
  const time: ReminderMode = version === 2 && value.time === 'smart' ? 'smart' : presetOf(value.time);
  const days = weekdays(value.days);
  return {
    enabled: value.enabled,
    time,
    ...(days !== null ? { days } : {}),
    ...(version === 2 && value.mentionStreak === false ? { mentionStreak: false } : {}),
    ...(version === 2 && value.paused === true ? { paused: true } : {}),
  };
}

/** Exactly the fields this build writes for a choice, defaults left out. */
function written(reminder: StoredReminder): StoredReminder {
  const days = weekdays(reminder.days);
  return {
    enabled: reminder.enabled === true,
    time: reminder.time === 'smart' ? 'smart' : presetOf(reminder.time),
    ...(days !== null && days.length > 0 ? { days } : {}),
    ...(reminder.mentionStreak === false ? { mentionStreak: false } : {}),
    ...(reminder.paused === true ? { paused: true } : {}),
  };
}

function dayList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((day): day is string => typeof day === 'string') : [];
}

function slotList(value: unknown): PlannedSlot[] {
  if (!Array.isArray(value)) return [];
  const out: PlannedSlot[] = [];
  for (const slot of value) {
    if (!isRecord(slot) || typeof slot.day !== 'string' || typeof slot.at !== 'number') continue;
    out.push({
      day: slot.day,
      at: slot.at,
      ...(typeof slot.line === 'string' ? { line: slot.line } : {}),
      ...(slot.pause === true ? { pause: true as const } : {}),
    });
  }
  return out;
}

/** A stored log, repaired to what this build keeps, or null when it is not an object at all. */
function logOf(value: unknown): ReminderLog | null {
  if (!isRecord(value)) return null;
  const last = isRecord(value.last) && typeof value.last.day === 'string' && typeof value.last.line === 'string' ? { last: { day: value.last.day, line: value.last.line } } : {};
  const plannedAt = typeof value.plannedAt === 'number' ? { plannedAt: value.plannedAt } : {};
  return boundLog({ sent: dayList(value.sent), answered: dayList(value.answered), opened: dayList(value.opened), slots: slotList(value.slots), ...plannedAt, ...last });
}

/** The envelope on disk: null for a missing key; throws for anything this build cannot read. */
async function readEnvelope(key: string): Promise<{ reminder: StoredReminder; log: ReminderLog } | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return null;
  if (raw === '') throw new Error('Reminder choice could not be read');
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) throw new Error('Reminder choice could not be read');
  if (parsed.version === 1) {
    const reminder = choiceOf(parsed.reminder, 1);
    if (reminder === null) throw new Error('Reminder choice could not be read');
    return { reminder, log: emptyLog() };
  }
  if (parsed.version === VERSION) {
    const reminder = choiceOf(parsed.reminder, 2);
    const log = logOf(parsed.log);
    if (reminder === null || log === null) throw new Error('Reminder choice could not be read');
    return { reminder, log };
  }
  throw new Error('Reminder choice could not be read');
}

async function read(key: string, strict: boolean): Promise<StoredReminder | null> {
  try {
    return (await readEnvelope(key))?.reminder ?? null;
  } catch (error) {
    if (strict) throw error;
    return null;
  }
}

/**
 * What the learner chose, under their own key.
 *
 * Not `async`, so a read with nobody signed in throws where the caller can see
 * it rather than resolving to a shared key.
 */
export function loadReminder(options: { strict?: boolean } = {}): Promise<StoredReminder | null> {
  return read(KEY(), options.strict === true);
}

/** The planner's log under this learner's key: empty when there is none or it cannot be read. */
export function loadReminderLog(): Promise<ReminderLog> {
  const key = KEY();
  return readEnvelope(key).then(
    (envelope) => envelope?.log ?? emptyLog(),
    () => emptyLog(),
  );
}

/** Write one envelope, and say in one word whether it reached the disk. */
async function writeEnvelope(owner: number, key: string, reminder: StoredReminder, log: ReminderLog): Promise<PersistAck> {
  const envelope: StoredEnvelope = { version: VERSION, reminder: written(reminder), log: boundLog(log) };
  try {
    await setItemInUserScope(owner, key, JSON.stringify(envelope));
    return 'durable';
  } catch {
    // Storage full or unavailable. The switch on screen is unaffected this
    // launch; what the caller must not do is believe the choice survived it.
    return 'failed';
  }
}

/**
 * Write the choice, keep the log, and say in one word whether it reached the disk.
 *
 * `PersistAck` rather than a swallowed failure, because this store is the only
 * record of a decision made with a single tap and the OS holds the schedule
 * separately. Only the declared fields are written.
 */
export function saveReminder(reminder: StoredReminder): Promise<PersistAck> {
  return serialized(async (key, owner) => {
    let log = emptyLog();
    try {
      log = (await readEnvelope(key))?.log ?? emptyLog();
    } catch {
      // An unreadable envelope is replaced whole: the choice being written is
      // the newest fact there is, and the log only ever delays a pause.
    }
    return writeEnvelope(owner, key, reminder, log);
  });
}

/**
 * Write the planner's log beside the stored choice. `failed` when there is no
 * readable choice to keep it with: a log on its own is a reminder nobody chose.
 */
export function saveReminderLog(log: ReminderLog): Promise<PersistAck> {
  return serialized(async (key, owner) => {
    let held: { reminder: StoredReminder; log: ReminderLog } | null;
    try {
      held = await readEnvelope(key);
    } catch {
      return 'failed';
    }
    if (held === null) return 'failed';
    return writeEnvelope(owner, key, held.reminder, log);
  });
}

// ───────────────────────────────────────────────────────────── the guest

/** The guest's log, and whether their pause note has gone out. */
export interface GuestReminderLog {
  paused: boolean;
  log: ReminderLog;
}

let guestChain: Promise<unknown> = Promise.resolve();

function guestSerialized<T>(work: () => Promise<T>): Promise<T> {
  const next = guestChain.then(work, work);
  guestChain = next.catch(() => {});
  return next;
}

/** The guest's log: empty when there is none or it cannot be read. */
export async function loadGuestReminderLog(): Promise<GuestReminderLog> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_KEY);
    if (raw === null) return { paused: false, log: emptyLog() };
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) return { paused: false, log: emptyLog() };
    return { paused: parsed.paused === true, log: logOf(parsed.log) ?? emptyLog() };
  } catch {
    return { paused: false, log: emptyLog() };
  }
}

export function saveGuestReminderLog(value: GuestReminderLog): Promise<PersistAck> {
  return guestSerialized(async () => {
    try {
      await AsyncStorage.setItem(GUEST_KEY, JSON.stringify({ version: 1, paused: value.paused === true, log: boundLog(value.log) }));
      return 'durable';
    } catch {
      return 'failed';
    }
  });
}

/** Forget the guest's log: their reminder is off, or an account plans now. */
export function clearGuestReminderLog(): Promise<void> {
  return guestSerialized(async () => {
    try {
      await AsyncStorage.removeItem(GUEST_KEY);
    } catch {
      // Day keys only; the next clear tries again.
    }
  });
}

// ──────────────────────────────────────────────────── the plan the OS holds

let heldChain: Promise<unknown> = Promise.resolve();

/**
 * The `plannedAt` of the plan the OS holds, or null: none, taken back, or
 * unreadable. Null is the careful answer, because it only ever stops a log
 * counting slots, which delays a pause and never invents one.
 */
export async function loadHeldPlan(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(HELD_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) return null;
    const plan = parsed.plan;
    return typeof plan === 'number' && Number.isSafeInteger(plan) && plan > 0 ? plan : null;
  } catch {
    return null;
  }
}

/** Say which plan the OS holds now: the instant it was handed over, or null once it is taken back. */
export function saveHeldPlan(plan: number | null): Promise<PersistAck> {
  const next = heldChain.then(async (): Promise<PersistAck> => {
    try {
      await AsyncStorage.setItem(HELD_KEY, JSON.stringify({ version: 1, plan }));
      return 'durable';
    } catch {
      return 'failed';
    }
  });
  heldChain = next.catch(() => {});
  return next;
}
