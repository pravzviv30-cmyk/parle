/**
 * The stored profile's version chain, pure.
 *
 * Extracted from store.ts so it can be tested under plain node: the store
 * imports AsyncStorage, which no node test can load, and the chain is exactly
 * the part of the store that must never silently lose a field. Every branch
 * runs direct to the latest version in one pass and leaves the brain
 * untouched — store.ts repairs that at the door, once, whatever version the
 * blob arrived at.
 *
 * Version 3 added `username`, the leaderboard identity, claimed on first open.
 * Version 4 adds `ageConfirmed` and widens `motivation` and `dailyGoalMin` to
 * nullable.
 *
 * Two rules hold this file together, and both are about not putting words in
 * the learner's mouth:
 *
 * 1. **No branch drops the dob.** A learner who typed a date typed it. v4
 *    stops asking, which is not the same as forgetting the answer.
 * 2. **No branch writes `ageConfirmed: false`.** A dob at or over the floor
 *    derives true, because that learner did answer the age question, just in a
 *    longer form. Everything else — no dob, a corrupt dob, a dob that reads
 *    young — derives null, meaning "never asked". False would be this code
 *    claiming the learner denied something they were never asked.
 */

import { ageConfirmedFromDob } from './age.ts';
import type { StoredProfile } from './store.ts';

/** A profile through the chain but before the brain is repaired. */
export type UpgradedProfile = Omit<StoredProfile, 'brain'> & { brain: unknown };

/** The only three goals ever offered. Anything else on disk is not an answer. */
function storedGoal(value: unknown): 5 | 10 | 15 | null {
  return value === 5 || value === 10 || value === 15 ? value : null;
}

export function upgradeStored(parsed: unknown, now = Date.now()): UpgradedProfile | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const version = record.version;
  const dob = typeof record.dob === 'string' ? record.dob : null;

  if (version === 1) {
    return {
      version: 4,
      name: null,
      // v1 predates the date-of-birth question entirely, so there is nothing
      // here to keep and nothing to derive from.
      dob: null,
      ageConfirmed: null,
      motivation: typeof record.motivation === 'string' ? record.motivation : 'want',
      // Ten minutes is what the old chain wrote to these learners' disks years
      // ago, and it has been their goal ever since. Re-deciding it now would
      // be a rewrite wearing an upgrade's clothes.
      dailyGoalMin: 10,
      onboardedAt: typeof record.onboardedAt === 'number' ? record.onboardedAt : now,
      username: null,
      // The one thing that must survive any migration: what the tutor knows.
      brain: record.brain,
    };
  }
  if (version === 2 || version === 3) {
    // A v2 blob was trusted wholesale before this chain existed (the brain is
    // repaired at the door either way). v3 differs only by carrying a
    // username, so the two branches say the same thing about everything else.
    return {
      ...(record as unknown as UpgradedProfile),
      version: 4,
      name: typeof record.name === 'string' ? record.name : null,
      dob,
      ageConfirmed: ageConfirmedFromDob(dob, new Date(now)),
      onboardedAt: typeof record.onboardedAt === 'number' ? record.onboardedAt : now,
      motivation: typeof record.motivation === 'string' ? record.motivation : null,
      dailyGoalMin: storedGoal(record.dailyGoalMin),
      username: typeof record.username === 'string' ? record.username : null,
      brain: record.brain,
    };
  }
  if (version === 4) {
    return {
      ...(record as unknown as UpgradedProfile),
      version: 4,
      name: typeof record.name === 'string' ? record.name : null,
      dob,
      // Already asked and answered. A blob carrying anything else in that slot
      // has never been through the age question, whatever it says — and a
      // stored false, which nothing in this app writes, reads as not asked.
      ageConfirmed: record.ageConfirmed === true ? true : null,
      onboardedAt: typeof record.onboardedAt === 'number' ? record.onboardedAt : now,
      motivation: typeof record.motivation === 'string' ? record.motivation : null,
      dailyGoalMin: storedGoal(record.dailyGoalMin),
      username: typeof record.username === 'string' ? record.username : null,
      brain: record.brain,
    };
  }
  return null;
}
