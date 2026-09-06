/**
 * Where the suggestion card had got to, and which deal it is walking.
 *
 * Two integers, per account: the seed that decides the order and the position
 * in it. It is a convenience and not learning state, which is why it carries no
 * version envelope, joins no sync adoption, and forgives every failure by
 * dealing a fresh walk. The worst a lost value can do is give the learner a new
 * order, and that is not worth a try/catch that reports anything.
 *
 * The seed is deliberately not synced. It is an index into a pool that grows
 * between releases, so the same number names a different situation on two
 * builds; `sync/policy.ts` records that reasoning against the namespace.
 *
 * Keyed through `userKey` like every other store, so two accounts on one device
 * do not walk each other's pool.
 */

import { userKey } from '../storage/scope.ts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Walk } from './suggestion.ts';

/** Resolved per call: the active account can change between calls. */
const KEY = () => userKey('suggestions');

/**
 * A first deal for a learner who has never had one.
 *
 * Seeded off the clock, because the alternative is every learner in the world
 * meeting the same five hundred situations in the same order. This is the one
 * place in the suggestion path that reads a clock, and it is here rather than
 * in `suggestion.ts` so that every rule about the walk stays testable by being
 * handed its inputs.
 */
export function firstWalk(now: number): Walk {
  return { seed: Math.trunc(now) >>> 0, position: 0 };
}

export async function loadWalk(now: number): Promise<Walk> {
  try {
    const raw = await AsyncStorage.getItem(KEY());
    if (!raw) return firstWalk(now);
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return firstWalk(now);
    const { seed, position } = parsed as { seed?: unknown; position?: unknown };
    if (typeof seed !== 'number' || !Number.isFinite(seed)) return firstWalk(now);
    return {
      seed: Math.trunc(seed),
      position: typeof position === 'number' && Number.isFinite(position) ? Math.max(0, Math.trunc(position)) : 0,
    };
  } catch {
    return firstWalk(now);
  }
}

export async function saveWalk(walk: Walk): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(), JSON.stringify({ seed: Math.trunc(walk.seed), position: Math.max(0, Math.trunc(walk.position)) }));
  } catch {
    // The card still moved on screen. Losing where it got to costs the learner
    // one repeated suggestion, and nothing worth interrupting them for.
  }
}
