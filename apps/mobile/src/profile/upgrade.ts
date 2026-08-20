/**
 * The stored profile's version chain, pure.
 *
 * Extracted from store.ts so it can be tested under plain node: the store
 * imports AsyncStorage, which no node test can load, and the chain is exactly
 * the part of the store that must never silently lose a field. It runs 1 → 2
 * → 3 in one pass and leaves the brain untouched — store.ts repairs that at
 * the door, once, whatever version the blob arrived at.
 *
 * Version 3 adds `username`, the leaderboard identity. Every older profile
 * upgrades with it null; the friends surface claims one on first open.
 */

import type { StoredProfile } from './store.ts';

/** A profile through the chain but before the brain is repaired. */
export type UpgradedProfile = Omit<StoredProfile, 'brain'> & { brain: unknown };

export function upgradeStored(parsed: unknown, now = Date.now()): UpgradedProfile | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const version = record.version;
  if (version === 1) {
    return {
      version: 3,
      name: null,
      dob: null,
      motivation: typeof record.motivation === 'string' ? record.motivation : 'want',
      dailyGoalMin: 10,
      onboardedAt: typeof record.onboardedAt === 'number' ? record.onboardedAt : now,
      username: null,
      // The one thing that must survive any migration: what the tutor knows.
      brain: record.brain,
    };
  }
  if (version === 2) {
    // A v2 blob was trusted wholesale before this chain existed (the brain is
    // repaired at the door either way); v3 adds one field, arriving empty.
    return {
      ...(record as unknown as Omit<UpgradedProfile, 'version' | 'username'>),
      version: 3,
      username: null,
    };
  }
  if (version === 3) {
    const upgraded = record as unknown as UpgradedProfile;
    return { ...upgraded, username: typeof record.username === 'string' ? record.username : null };
  }
  return null;
}
