/**
 * Where the reminder's chosen time lives on the device.
 *
 * Storage shell only, the same shape as topics/store.ts and missions/store.ts:
 * every rule about what a reminder *is* — the four presets, the words, what a
 * stored flag means over a revoked permission — belongs to reminder.ts, so this
 * file is a versioned envelope, a write chain and a scoped key, and nothing
 * else. `StoredReminder` and the default preset are imported from there rather
 * than restated, because a second opinion about which times exist is how a
 * store and a screen come to disagree about what the learner picked.
 *
 * ## Two fields, and nothing that grows
 *
 * There is no history here, no last-fired timestamp, no count of days. That is
 * not an omission to be filled in later: a reminder that remembers is a
 * reminder that can compare, and reminder.ts exists to make that impossible.
 * The blob this file writes is bounded at two fields by construction, so
 * nothing about it needs a cap or a discard rule.
 *
 * ## Off is remembered, with its time
 *
 * Turning the switch off writes `{ enabled: false, time }` rather than clearing
 * the key, so turning it back on months later restores the part of the day the
 * learner chose instead of silently moving their reminder to the default.
 *
 * ## A strict read keeps unknown separate from off
 *
 * A missing key means no choice and answers `null`. Settings and Recap request
 * a strict read: corrupt, unsupported or refused bytes throw, so neither can
 * show Off or offer scheduling over a choice this build cannot verify. The
 * default read remains lenient for older callers; it never guesses On.
 *
 * ## Not synced, and that is a decision
 *
 * This store registers no sync adopter and raises no dirty flag. The OS holds
 * the schedule and notification permission is per install, so an account that
 * carried its reminder between devices would fire twice at one learner from two
 * phones, and would turn a reminder on for a device that never asked. The
 * reason is recorded where a reader would look for it, in `SYNC_EXCLUSIONS` in
 * sync/policy.ts, rather than by being quietly absent from the table.
 *
 * ## What it may import
 *
 * `reminders/` is under the F227 source scan: nothing in this directory may
 * reach progress/, missions/, review/, practice/ or the history store, by path
 * or by symbol name. A store has no business asking what the learner has done,
 * and this one holds two fields that could not express the answer anyway.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistAck } from '../storage/ack.ts';
import { userKey, scopeGeneration, setItemInUserScope } from '../storage/scope.ts';
import { reminderTime, type ReminderTimeId, type StoredReminder } from './reminder.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = (): string => userKey('reminder');

const VERSION = 1;

interface StoredEnvelope {
  version: typeof VERSION;
  reminder: StoredReminder;
}

let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Run a write alone on the chain, with the account bound at enqueue.
 *
 * The chain is not decoration on a whole-value write. A learner opening the
 * sheet taps one preset and then another within a beat, and two overlapping
 * `setItem` calls leave which one survives to the platform: the disk can end up
 * holding the tap they changed away from while the row on screen shows the tap
 * they finished on. Serialised, the disk ends up in tap order.
 *
 * The account is bound when the work is requested, for the reason every store
 * here states: a sign-out while a write is queued must never redirect that
 * write into the next account's namespace.
 */
function serialized<T>(write: (key: string, owner: number) => Promise<T>): Promise<T> {
  const key = KEY();
  const owner = scopeGeneration();
  const run = (): Promise<T> => write(key, owner);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

/**
 * The learner's choice, or null when there is nothing readable under this key.
 *
 * Sceptical in the same way `reminderTime` is, and for the same reason: this
 * value has been through a JSON blob and a device's disk. `enabled` has to be a
 * real boolean or the whole thing is nothing, because it is the decision itself
 * and there is no safe way to guess it. The preset is repaired rather than
 * discarded — reminder.ts already owns what an unknown id resolves to, so a
 * mangled hour costs the learner the default time and not their choice to be
 * reminded at all.
 */
async function read(key: string, strict: boolean): Promise<StoredReminder | null> {
  const unreadable = (): null => {
    if (strict) throw new Error('Reminder choice could not be read');
    return null;
  };
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    if (raw === '') return unreadable();
    const parsed = JSON.parse(raw) as Partial<StoredEnvelope> | null;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return unreadable();
    if (parsed.version !== VERSION) return unreadable();
    const stored = parsed.reminder as Partial<StoredReminder> | null | undefined;
    if (typeof stored !== 'object' || stored === null) return unreadable();
    if (typeof stored.enabled !== 'boolean') return unreadable();
    return { enabled: stored.enabled, time: presetOf(stored.time) };
  } catch (error) {
    if (strict) throw error;
    return null;
  }
}

/** Delegated on purpose: reminder.ts owns which presets exist and what junk becomes. */
function presetOf(raw: unknown): ReminderTimeId {
  return reminderTime(raw).value;
}

/**
 * What the learner chose, under their own key.
 *
 * Not `async`, so a read with nobody signed in throws where the caller can see
 * it rather than resolving to a shared key — the same shape `loadTopics` has.
 */
export function loadReminder(options: { strict?: boolean } = {}): Promise<StoredReminder | null> {
  return read(KEY(), options.strict === true);
}

/**
 * Write the choice, and say in one word whether it reached the disk.
 *
 * `PersistAck` rather than a swallowed failure, because this store is the only
 * record of a decision made with a single tap and the OS holds the schedule
 * separately. A write that quietly failed leaves the app believing the reminder
 * is off while the phone keeps delivering it daily, and the row the learner
 * would use to stop it is the row that already says Off. The caller has to be
 * able to tell.
 *
 * Only the two declared fields are written, so an object with more on it than
 * `StoredReminder` cannot grow what lands on disk.
 */
export function saveReminder(reminder: StoredReminder): Promise<PersistAck> {
  return serialized(async (key, owner) => {
    const envelope: StoredEnvelope = {
      version: VERSION,
      reminder: { enabled: reminder.enabled, time: reminder.time },
    };
    try {
      await setItemInUserScope(owner, key, JSON.stringify(envelope));
      return 'durable';
    } catch {
      // Storage full or unavailable. The switch on screen is unaffected this
      // launch; what the caller must not do is believe the choice survived it.
      return 'failed';
    }
  });
}
