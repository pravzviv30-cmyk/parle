/**
 * What the learner has actually been measured saying.
 *
 * Storage shell only, the same shape as missions/store.ts: one versioned
 * envelope, one write chain, the key bound at enqueue. Every judgement about
 * what a check *means* lives in model.ts.
 *
 * The `kind` on each row is load-bearing and is never widened here: a
 * self-guided check is not a score, and a store that let one become one would
 * be inventing a pronunciation measurement that never happened.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { onUserScopeReset, scopeGeneration, writeInUserScope, userKey } from '../storage/scope.ts';
import { markDirty, registerSyncAdopter, type SyncAdoption, type SyncFold } from '../sync/registry.ts';
import type { SoundCheckEvidence, SoundCheckKind } from './model.ts';

const KEY = () => userKey('soundChecks');
const VERSION = 1;
const MAX_EVIDENCE = 60;

/** See progress/activity.ts for why an adopted write does not raise the flag. */
type WriteOrigin = 'local' | 'adopted';

interface StoredSoundChecks {
  version: typeof VERSION;
  evidence: SoundCheckEvidence[];
}

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string, owner: number) => Promise<T>): Promise<T> {
  // Bind the account when the work is requested. A sign-out while a background
  // write is queued must never redirect that write into the next account.
  const key = KEY();
  const owner = scopeGeneration();
  const run = () => mutation(key, owner);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => undefined);
  return next;
}

function isKind(value: unknown): value is SoundCheckKind {
  return value === 'assessed-clear' || value === 'assessed-focus' || value === 'self-guided' || value === 'unavailable';
}

function isEvidence(value: unknown): value is SoundCheckEvidence {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.missionId === 'string' &&
    typeof item.reference === 'string' &&
    typeof item.at === 'number' &&
    isKind(item.kind) &&
    (item.focus === null || typeof item.focus === 'string') &&
    // Absent is legal: a row written before F468 carries no phoneme, and
    // discarding it would be the data loss a version bump would have caused.
    (item.phoneme === undefined || item.phoneme === null || typeof item.phoneme === 'string')
  );
}

async function read(key: string, strict = false): Promise<SoundCheckEvidence[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as Partial<StoredSoundChecks> | null;
    if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.evidence)) {
      if (strict) throw new Error('Sound checks are unreadable');
      return [];
    }
    if (strict && !parsed.evidence.every(isEvidence)) throw new Error('Sound checks are unreadable');
    return parsed.evidence.filter(isEvidence);
  } catch (error) {
    if (strict) throw error;
    return [];
  }
}

/**
 * The envelope exactly as the sync engine reads it: the parsed key, or null when
 * this account has never written one.
 *
 * Not `read`, which unwraps to a bare list and answers a missing key with an
 * empty one. The merge policy works on the shape that is on disk.
 */
async function persisted(key: string): Promise<unknown> {
  const raw = await AsyncStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as unknown);
}

export function loadSoundChecks(options?: { strict: boolean }): Promise<SoundCheckEvidence[]> {
  return read(KEY(), options?.strict);
}

async function save(key: string, owner: number, evidence: readonly SoundCheckEvidence[], origin: WriteOrigin): Promise<boolean> {
  try {
    const saved = await writeInUserScope(owner, () => AsyncStorage.setItem(key, JSON.stringify({ version: VERSION, evidence: [...evidence] } satisfies StoredSoundChecks)));
    if (saved && origin === 'local') markDirty('soundChecks');
    return saved;
  } catch {
    // The learner still completed the check; a full device must not block the screen.
    return false;
  }
}

export function recordSoundCheck(evidence: SoundCheckEvidence): Promise<void> {
  return serialized(async (key, owner) => {
    let current: SoundCheckEvidence[];
    try { current = await read(key, true); } catch { return; }
    const next = [...current, evidence].sort((a, b) => a.at - b.at).slice(-MAX_EVIDENCE);
    await save(key, owner, next, 'local');
  });
}

/**
 * Fold the account's evidence into this device's, on this store's own chain.
 *
 * The engine hands over a fold rather than a finished set, because it read this
 * key before the pull: a check the learner completed during the round trip was
 * written over by a set computed before the attempt, and then pushed, so the
 * measurement was gone everywhere. The fold is called here, inside the chain,
 * between the read and the write, with the set this store holds at that instant.
 * The union is by attempt identity, so folding twice is the same as folding once.
 *
 * Every row is re-validated and the cap re-applied: a merged set is the union of
 * two devices' attempts and can be longer than either, and a row whose `kind` did
 * not survive the trip is dropped rather than guessed at. Guessing would be this
 * store deciding, on no evidence, that a learner had been measured — which is the
 * one thing the sound check must never do.
 */
function adoptSoundChecks(fold: SyncFold): Promise<SyncAdoption> {
  return serialized(async (key, owner) => {
    let current: unknown;
    try { current = await persisted(key); } catch { return 'declined'; }
    if (current !== null && (typeof current !== 'object' || current === null ||
      (current as Partial<StoredSoundChecks>).version !== VERSION ||
      !Array.isArray((current as Partial<StoredSoundChecks>).evidence) ||
      !(current as StoredSoundChecks).evidence.every(isEvidence))) return 'declined';
    const folded = fold(current);
    if (typeof folded !== 'object' || folded === null) return 'declined';
    const envelope = folded as Partial<StoredSoundChecks>;
    if (envelope.version !== VERSION || !Array.isArray(envelope.evidence)) return 'declined';
    const evidence = envelope.evidence.filter(isEvidence).sort((a, b) => a.at - b.at).slice(-MAX_EVIDENCE);
    return await save(key, owner, evidence, 'adopted') ? 'adopted' : 'declined';
  });
}

function registerAdopter(): void {
  registerSyncAdopter('soundChecks', adoptSoundChecks);
}

// Registered at load, and again whenever the account scope changes: the sync
// registry is cleared on an account switch, and a module only evaluates once.
registerAdopter();
onUserScopeReset(registerAdopter);
