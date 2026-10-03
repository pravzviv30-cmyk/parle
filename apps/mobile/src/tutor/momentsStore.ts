/**
 * The moments a learner has brought, kept on this phone (F549).
 *
 * A moment typed once should be there to rehearse again, so the kind and the
 * learner's own line are kept, newest first, capped. It is free text about
 * the learner's own life, which is why this store is device-local and named
 * in `sync/policy.ts`'s exclusions with that reason written down: what a
 * learner types about a job interview stays on the phone they typed it on.
 *
 * The shape every other store keeps. A versioned envelope, so a build that
 * cannot read it returns nothing rather than throwing; the account key bound
 * when a write is asked for, never when it runs, so a sign-out mid-write
 * cannot redirect one learner's moment into the next learner's key; and the
 * suffix on `USER_KEY_SUFFIXES`, which is what gives it a place in the export
 * and takes it away on a reset.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { userKey, scopeGeneration, setItemInUserScope } from '../storage/scope.ts';
import type { RealMomentKey } from './realMoments.ts';

const VERSION = 1;

export const MAX_MOMENTS = 20;

export interface RealMoment {
  id: string;
  kind: RealMomentKey;
  /** The learner's own line, already cut to what the seed can carry. May be empty. */
  detail: string;
  /** When it was first brought. */
  at: number;
  /** When it was last rehearsed. */
  lastUsedAt: number;
}

interface StoredMoments {
  version: typeof VERSION;
  moments: RealMoment[];
}

const KEY = () => userKey('moments');

let writeChain: Promise<unknown> = Promise.resolve();

function serialized<T>(mutation: (key: string, owner: number) => Promise<T>): Promise<T> {
  const key = KEY();
  const owner = scopeGeneration();
  const run = () => mutation(key, owner);
  const next = writeChain.then(run, run);
  writeChain = next.catch(() => {});
  return next;
}

function isMoment(value: unknown): value is RealMoment {
  if (typeof value !== 'object' || value === null) return false;
  const { id, kind, detail, at, lastUsedAt } = value as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    typeof kind === 'string' &&
    typeof detail === 'string' &&
    typeof at === 'number' &&
    Number.isFinite(at) &&
    typeof lastUsedAt === 'number' &&
    Number.isFinite(lastUsedAt)
  );
}

async function readStored(key: string): Promise<RealMoment[]> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return [];
  const parsed = JSON.parse(raw) as Partial<StoredMoments> | null;
  if (!parsed || parsed.version !== VERSION || !Array.isArray(parsed.moments) || !parsed.moments.every(isMoment)) {
    throw new Error('saved moments could not be read');
  }
  return parsed.moments;
}

/** Newest rehearsed first. */
export function loadMoments(): Promise<RealMoment[]> {
  return readStored(KEY()).then((moments) => [...moments].sort((a, b) => b.lastUsedAt - a.lastUsedAt));
}

/**
 * Keep a moment, or move the same one to the front.
 *
 * Identity is the kind and the line together: the same interview typed twice
 * is one moment rehearsed twice, and a second row for it would be the list
 * filling up with one thing. The cap drops the least recently rehearsed.
 */
export function saveMoment(kind: RealMomentKey, detail: string, now: number): Promise<RealMoment> {
  return serialized(async (key, owner) => {
    const current = await readStored(key);
    const same = current.find((moment) => moment.kind === kind && moment.detail === detail);
    const kept: RealMoment = same
      ? { ...same, lastUsedAt: now }
      : { id: `m${now.toString(36)}.${Math.random().toString(36).slice(2, 8)}`, kind, detail, at: now, lastUsedAt: now };
    const rest = current.filter((moment) => moment !== same).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
    const next: StoredMoments = { version: VERSION, moments: [kept, ...rest].slice(0, MAX_MOMENTS) };
    try {
      await setItemInUserScope(owner, key, JSON.stringify(next));
    } catch {
      // Storage full or unavailable. The moment still opens the conversation it
      // was brought for; it is only not there to rehearse again.
    }
    return kept;
  });
}

/** Pure, so the cap and the ordering can be asked without a disk. */
export function withMoment(current: readonly RealMoment[], kind: RealMomentKey, detail: string, now: number): RealMoment[] {
  const same = current.find((moment) => moment.kind === kind && moment.detail === detail);
  const kept: RealMoment = same ? { ...same, lastUsedAt: now } : { id: `m${now.toString(36)}`, kind, detail, at: now, lastUsedAt: now };
  const rest = current.filter((moment) => moment !== same).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  return [kept, ...rest].slice(0, MAX_MOMENTS);
}
