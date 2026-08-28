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
 * Version 4 added `ageConfirmed` and widened `motivation` and `dailyGoalMin` to
 * nullable. Version 5 adds `ageStopAt`: the moment a session ended because the
 * learner said, in a scene, that they are under thirteen.
 *
 * Three rules hold this file together, and the first two are about not putting
 * words in the learner's mouth:
 *
 * 1. **No branch drops the dob.** A learner who typed a date typed it. v4
 *    stops asking, which is not the same as forgetting the answer.
 * 2. **No branch writes `ageConfirmed: false`.** A dob at or over the floor
 *    derives true, because that learner did answer the age question, just in a
 *    longer form. Everything else — no dob, a corrupt dob, a dob that reads
 *    young — derives null, meaning "never asked". False would be this code
 *    claiming the learner denied something they were never asked.
 * 3. **No branch invents an age stop.** Every version below 5 predates the
 *    field, so all four of those branches write null. Nothing that happened
 *    before the field existed can be read as a stop after the fact.
 *
 * ## What a v5 blob costs an older build, said plainly
 *
 * A build that predates this version has no `version === 5` branch, so it
 * reads a v5 profile as unreadable and hands back null, exactly as it does for
 * a v99 blob. The chain never throws and never mutates what it was given, so
 * the blob on disk survives the read — but that build will run onboarding over
 * the top of it. That is the cost of every version bump in this chain and it is
 * not new here; what is new is that the field a downgrade discards is a safety
 * flag. `docs/STATE_AND_STORAGE.md` names the ceiling, and
 * `sync/envelope.ts:151` describes the same hazard for the account copy.
 */

import { ageConfirmedFromDob } from './age.ts';
import type { StoredProfile } from './store.ts';

/** A profile through the chain but before the brain is repaired. */
export type UpgradedProfile = Omit<StoredProfile, 'brain'> & { brain: unknown };

/** The only three goals ever offered. Anything else on disk is not an answer. */
function storedGoal(value: unknown): 5 | 10 | 15 | null {
  return value === 5 || value === 10 || value === 15 ? value : null;
}

/**
 * A stored age stop, as a moment or as nothing.
 *
 * The same reading every other field in this chain gets: what is not a value
 * this app writes is not an answer. It is worth saying why, because the safe
 * direction looks like the other one. A stop is a locked door, so it is
 * tempting to read junk as "something happened here, keep it locked" — but the
 * only ways to get junk into this slot are a hand-edited blob and a corrupt
 * disk, and somebody who can hand-edit AsyncStorage can delete the profile
 * outright. Reading junk as a stop would therefore buy nothing against the one
 * attacker it aims at, while locking a real learner out of the tutor over a
 * mangled byte with no way back except a reinstall. `docs/STATE_AND_STORAGE.md`
 * records that the reinstall ceiling is the same one the founder accepted.
 */
function storedStop(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function upgradeStored(parsed: unknown, now = Date.now()): UpgradedProfile | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const version = record.version;
  const dob = typeof record.dob === 'string' ? record.dob : null;

  if (version === 1) {
    return {
      version: 5,
      name: null,
      // v1 predates the date-of-birth question entirely, so there is nothing
      // here to keep and nothing to derive from.
      dob: null,
      ageConfirmed: null,
      // Rule 3. Every branch below 5 predates the field.
      ageStopAt: null,
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
      version: 5,
      name: typeof record.name === 'string' ? record.name : null,
      dob,
      ageConfirmed: ageConfirmedFromDob(dob, new Date(now)),
      ageStopAt: null,
      onboardedAt: typeof record.onboardedAt === 'number' ? record.onboardedAt : now,
      motivation: typeof record.motivation === 'string' ? record.motivation : null,
      dailyGoalMin: storedGoal(record.dailyGoalMin),
      username: typeof record.username === 'string' ? record.username : null,
      brain: record.brain,
    };
  }
  if (version === 4 || version === 5) {
    return {
      ...(record as unknown as UpgradedProfile),
      version: 5,
      name: typeof record.name === 'string' ? record.name : null,
      dob,
      // Already asked and answered. A blob carrying anything else in that slot
      // has never been through the age question, whatever it says — and a
      // stored false, which nothing in this app writes, reads as not asked.
      ageConfirmed: record.ageConfirmed === true ? true : null,
      // The two versions differ here and nowhere else. A v4 blob predates the
      // field, so its slot is empty however the spread above filled it; a v5
      // blob is the only one whose stop is its own.
      ageStopAt: version === 5 ? storedStop(record.ageStopAt) : null,
      onboardedAt: typeof record.onboardedAt === 'number' ? record.onboardedAt : now,
      motivation: typeof record.motivation === 'string' ? record.motivation : null,
      dailyGoalMin: storedGoal(record.dailyGoalMin),
      username: typeof record.username === 'string' ? record.username : null,
      brain: record.brain,
    };
  }
  return null;
}
