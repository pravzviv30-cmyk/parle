/**
 * Where the learner's answer about usage data lives on the device.
 *
 * Storage shell only, the same shape as reminders/store.ts: a versioned
 * envelope, a serialised write chain and a scoped key, and nothing else. What a
 * consent *means* — that only a literal `true` counts, that a learner nobody
 * asked has not agreed to anything — belongs to analytics/consent.ts, so this
 * file never decides on the learner's behalf. It answers what is on the disk,
 * or that nothing readable is.
 *
 * ## One field, and nothing that grows
 *
 * There is no timestamp here, no history of the switch being flipped, no record
 * of which screen asked. That is not an omission waiting to be filled in: a
 * consent that remembers is a consent that can be argued with, and every extra
 * field is another fact about a learner kept for a reason nobody wrote down.
 * The blob is bounded at one boolean by construction, so nothing about it needs
 * a cap or a discard rule.
 *
 * ## Why this is not a field on `StoredProfile`
 *
 * Because a consent must never be able to come back after it is withdrawn.
 * `mergeStoredProfiles` (packages/brain/src/profile/merge.ts:441-449) picks
 * scalar answers by evidence weight, so a `yes` sitting on the profile of a
 * heavier device would win against a `no` written on a lighter one, and the
 * learner who turned the switch off on their phone would find it back on after
 * a sync. A consent that can resurrect itself is a privacy defect, not a merge
 * quirk, and the only reliable way to make it impossible is to keep the answer
 * out of the merged object entirely.
 *
 * ## Not synced, and that is the same decision said twice
 *
 * This store registers no sync adopter and raises no dirty flag. A consent is
 * given to the device that asked for it, and the reason is recorded where a
 * reader would look for it, in `SYNC_EXCLUSIONS` in sync/policy.ts, rather than
 * by being quietly absent from the table. What it costs a learner is that
 * saying yes on a phone leaves the switch off on a tablet, which is the
 * conservative direction to be wrong in.
 *
 * ## Withdrawal while storage is pending
 *
 * Off masks an older Yes immediately in this process, including after a failed
 * write. Only a later durable On may clear that fence. Reads await queued writes
 * and recheck the fence after storage returns. A failed Off still needs retry
 * before relaunch; the UI receives the failure rather than claiming durability.
 *
 * ## Every unreadable shape resolves to nothing
 *
 * A missing key, a half-written blob, a version this build does not know and a
 * storage layer that refuses the read all answer `null`. The asymmetry only
 * runs one way and it is the whole point: reading junk as agreement would send
 * events for a learner who never said yes, which is exactly the failure the
 * consent exists to prevent. Reading it as nothing costs the learner one tap in
 * Settings.
 *
 * It is registered in `USER_KEY_SUFFIXES` (storage/scope.ts), so deleting an
 * account wipes the answer with everything else and the data export carries it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistAck } from '../storage/ack.ts';
import { userKey, scopeGeneration, writeInUserScope } from '../storage/scope.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = (): string => userKey('analytics');

const VERSION = 1;

/**
 * What the learner said, and nothing about when or where they said it.
 *
 * `allowed` is the decision itself. There is deliberately no third state on
 * this type: "never asked" is the absence of the whole record, which is what
 * `null` from `loadConsent` means, and collapsing the two would let a build
 * that could not read the disk claim the learner had declined rather than
 * admitting it does not know.
 */
export interface StoredConsent {
  allowed: boolean;
}

interface StoredEnvelope {
  version: typeof VERSION;
  consent: StoredConsent;
}

let writeChain: Promise<unknown> = Promise.resolve();
const deniedKeys = new Set<string>();
const saveVersions = new Map<string, number>();
let saveVersion = 0;

/**
 * Run a write alone on the chain, with the account bound at enqueue.
 *
 * The chain is not decoration on a whole-value write. A learner who turns the
 * switch on and straight back off leaves two overlapping `setItem` calls, and
 * which one survives is then the platform's decision: the disk can end up
 * holding the tap they changed away from while the row on screen shows the tap
 * they finished on. For this key that means events sent for someone who is
 * looking at an off switch. Serialised, the disk ends up in tap order.
 *
 * The account is bound when the work is requested, for the reason every store
 * here states: a sign-out while a write is queued must never redirect that
 * write into the next account's namespace. Scope fencing also refuses an old queued
 * write after a switch or reset, and reset waits any native write already dispatched. For a consent that is the sharpest
 * version of the rule, because it would be one person answering for another.
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
 * The stored answer, or null when there is nothing readable under this key.
 *
 * Sceptical on purpose: this value has been through a JSON blob and a device's
 * disk, and it is the record of something a person decided. `allowed` has to be
 * a real boolean or the whole thing is nothing, because there is no safe way to
 * guess at a permission. Nothing here is repaired forward, unlike the reminder's
 * preset, since the one field is the decision and a repaired consent would be a
 * consent this file invented.
 */
async function read(key: string): Promise<StoredConsent | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredEnvelope> | null;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    if (parsed.version !== VERSION) return null;
    const stored = parsed.consent as Partial<StoredConsent> | null | undefined;
    if (typeof stored !== 'object' || stored === null) return null;
    if (typeof stored.allowed !== 'boolean') return null;
    return { allowed: stored.allowed };
  } catch {
    // Unreadable or unavailable. Nothing readable is not a yes, and the caller
    // draws an off switch, which is the honest thing to show for a permission
    // this build cannot prove was ever given.
    return null;
  }
}

/**
 * What the learner answered, under their own key.
 *
 * Not `async`, so a read with nobody signed in throws where the caller can see
 * it rather than resolving to a shared key — the same shape `loadReminder` has.
 * An un-namespaced consent would be the worst version of a shared-key bug: one
 * account on a phone agreeing to something on another account's behalf.
 */
export function loadConsent(): Promise<StoredConsent | null> {
  const key = KEY();
  return writeChain.then(async () => {
    const answer = await read(key);
    return deniedKeys.has(key) && answer !== null ? { allowed: false } : answer;
  });
}

/**
 * Write the answer, and say in one word whether it reached the disk.
 *
 * `PersistAck` rather than a swallowed failure, because this store is the only
 * record of a decision made with a single tap. A write that quietly failed
 * leaves the switch on screen showing one answer while the disk holds the other,
 * and on the next launch the learner's withdrawal is simply gone. The caller has
 * to be able to tell, and a screen that cannot promise the answer survived is
 * better off saying so.
 *
 * Only the one declared field is written, so an object with more on it than
 * `StoredConsent` cannot grow what lands on disk.
 */
export function saveConsent(next: StoredConsent): Promise<PersistAck> {
  const requestedKey = KEY();
  const allowed = next.allowed === true;
  const version = ++saveVersion;
  saveVersions.set(requestedKey, version);
  if (!allowed) deniedKeys.add(requestedKey);
  return serialized(async (key, owner) => {
    const envelope: StoredEnvelope = { version: VERSION, consent: { allowed } };
    try {
      if (!(await writeInUserScope(owner, () => AsyncStorage.setItem(key, JSON.stringify(envelope))))) return 'failed';
      if (allowed && saveVersions.get(key) === version) deniedKeys.delete(key);
      return 'durable';
    } catch {
      // Storage full or unavailable. What the caller must not do is believe the
      // choice survived this launch, because the direction that fails silently
      // is a learner who said no and goes on being counted.
      return 'failed';
    }
  });
}
