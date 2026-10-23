/**
 * Where the learner's answer about sharing practice recordings lives.
 *
 * Device-local on purpose for now, and the same shape as
 * analytics/consentStore.ts: a versioned envelope under a scoped key, a
 * serialised write chain bound to the account at enqueue, and a withdrawal
 * fence so Off masks an older Yes immediately in this process even when the
 * write fails. What an answer means belongs to ./consent.ts.
 *
 * Before the dataset is ever activated it needs a server consent record
 * (wording version, granted and withdrawn times) so that a withdrawal reaches
 * clips already stored. See docs/changes/speech-dataset.md.
 *
 * Not synced (SYNC_EXCLUSIONS in sync/policy.ts) and registered in
 * USER_KEY_SUFFIXES (storage/scope.ts), so erasure clears it and the export
 * carries it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistAck } from '../storage/ack.ts';
import { userKey, scopeGeneration, writeInUserScope } from '../storage/scope.ts';
import type { StoredSpeechConsent } from './consent.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = (): string => userKey('speechDataset');

const VERSION = 1;

interface StoredEnvelope {
  version: typeof VERSION;
  consent: StoredSpeechConsent;
}

let writeChain: Promise<unknown> = Promise.resolve();
const deniedKeys = new Set<string>();
const saveVersions = new Map<string, number>();
let saveVersion = 0;

/** Run a write alone on the chain, with the account bound at enqueue. */
function serialized<T>(write: (key: string, owner: number) => Promise<T>): Promise<T> {
  const key = KEY();
  const owner = scopeGeneration();
  const run = (): Promise<T> => write(key, owner);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

/** The stored answer, or null when nothing readable is under this key. */
async function read(key: string): Promise<StoredSpeechConsent | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredEnvelope> | null;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    if (parsed.version !== VERSION) return null;
    const stored = parsed.consent as Partial<StoredSpeechConsent> | null | undefined;
    if (typeof stored !== 'object' || stored === null) return null;
    if (typeof stored.allowed !== 'boolean') return null;
    if (typeof stored.version !== 'number' || !Number.isInteger(stored.version)) return null;
    return { allowed: stored.allowed, version: stored.version };
  } catch {
    return null;
  }
}

/**
 * What the learner answered, under their own key. Not `async`, so a read with
 * nobody signed in throws rather than resolving to a shared key.
 */
export function loadSpeechConsent(): Promise<StoredSpeechConsent | null> {
  const key = KEY();
  return writeChain.then(async () => {
    const answer = await read(key);
    return deniedKeys.has(key) && answer !== null ? { allowed: false, version: answer.version } : answer;
  });
}

/** Write the answer, and say in one word whether it reached the disk. */
export function saveSpeechConsent(next: StoredSpeechConsent): Promise<PersistAck> {
  const requestedKey = KEY();
  const allowed = next.allowed === true;
  const consentVersion = next.version;
  const version = ++saveVersion;
  saveVersions.set(requestedKey, version);
  if (!allowed) deniedKeys.add(requestedKey);
  return serialized(async (key, owner) => {
    const envelope: StoredEnvelope = { version: VERSION, consent: { allowed, version: consentVersion } };
    try {
      if (!(await writeInUserScope(owner, () => AsyncStorage.setItem(key, JSON.stringify(envelope))))) return 'failed';
      if (allowed && saveVersions.get(key) === version) deniedKeys.delete(key);
      return 'durable';
    } catch {
      return 'failed';
    }
  });
}
