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
 * nullable. Version 5 added `ageStopAt`: the moment a session ended because the
 * learner said, in a scene, that they are under thirteen. Version 6 adds
 * `tutorVoice`: which voice from the catalogue in `@luvani/core` the learner
 * asked their tutor to speak with, null meaning they have never been asked or
 * never chosen, which resolves to the catalogue default at the agent. Version 7
 * adds `preferTyping`: whether a conversation opens with the reply box already
 * showing. A boolean, false until the learner says otherwise in Profile.
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
 * 3. **No branch invents an answer its version predates.** This is the rule
 *    `ageStopAt` arrived with and it now carries `tutorVoice` too: every
 *    version below 5 writes no stop, and every version below 6 writes no
 *    voice, because nothing that happened before a field existed can be read
 *    as an answer to it after the fact. It matters more for the voice than it
 *    looks, because the honest empty value here is also the one that sounds
 *    like a decision: null means "never chosen", the agent resolves that to
 *    the default, and a learner who picked nothing has therefore not picked
 *    Luc — they have simply not been asked yet, and the Profile row must be
 *    able to tell those two apart. `preferTyping` rides the same rule one
 *    version on: every version below 7 arrives false, and only a v7 blob's
 *    own `true` is a choice. Junk in the slot is false too, because the only
 *    thing this app ever writes there is a boolean.
 *
 * ## What a v7 blob costs an older build, said plainly
 *
 * A build that predates this version has no `version === 7` branch, so it
 * reads a v7 profile as unreadable and hands back null, exactly as it does for
 * a v99 blob. The chain never throws and never mutates what it was given, so
 * the blob on disk survives the read — but that build will run onboarding over
 * the top of it. That is the cost of every version bump in this chain and it is
 * not new here; what is new is that the field a downgrade discards is a safety
 * flag. `docs/STATE_AND_STORAGE.md` names the ceiling, and
 * `sync/envelope.ts:151` describes the same hazard for the account copy.
 */

import { isTutorVoiceKey, type TutorVoiceKey } from '@luvani/core';
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

/**
 * A stored tutor voice, as a catalogue key or as nothing.
 *
 * The catalogue in `@luvani/core` is the only thing that decides what a voice
 * key is, here and at the agent, so this asks it rather than keeping a second
 * list that could drift out of step with the first. Anything the catalogue does
 * not know — a key retired between builds, a vendor id somebody pasted in, a
 * number, a mangled byte — reads as null, which is the same reading the goal
 * and the age stop get: what is not a value this app wrote is not an answer.
 *
 * Null is safe in a way it is not everywhere. It does not strand anybody: the
 * agent resolves a missing voice to the catalogue default, so the worst a
 * dropped key costs is that the tutor sounds like Luc again and the learner
 * picks their voice a second time from a row that is always there. Keeping the
 * unknown string instead would push it down the wire to the token server and
 * into a vendor URL segment, which is precisely what F285's resolve exists to
 * stop.
 */
function storedVoice(value: unknown): TutorVoiceKey | null {
  return isTutorVoiceKey(value) ? value : null;
}

export function upgradeStored(parsed: unknown, now = Date.now()): UpgradedProfile | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const version = record.version;
  const dob = typeof record.dob === 'string' ? record.dob : null;

  if (version === 1) {
    return {
      version: 7,
      name: null,
      // v1 predates the date-of-birth question entirely, so there is nothing
      // here to keep and nothing to derive from.
      dob: null,
      ageConfirmed: null,
      // Rule 3. Every branch below 5 predates the field.
      ageStopAt: null,
      // Rule 3 again, for the field this version adds. Every branch below 6
      // predates the voice question, so nobody upgrading has answered it.
      tutorVoice: null,
      // And below 7, nobody has said how they like to answer.
      preferTyping: false,
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
      version: 7,
      name: typeof record.name === 'string' ? record.name : null,
      dob,
      ageConfirmed: ageConfirmedFromDob(dob, new Date(now)),
      ageStopAt: null,
      tutorVoice: null,
      preferTyping: false,
      onboardedAt: typeof record.onboardedAt === 'number' ? record.onboardedAt : now,
      motivation: typeof record.motivation === 'string' ? record.motivation : null,
      dailyGoalMin: storedGoal(record.dailyGoalMin),
      username: typeof record.username === 'string' ? record.username : null,
      brain: record.brain,
    };
  }
  if (version === 4 || version === 5 || version === 6 || version === 7) {
    return {
      ...(record as unknown as UpgradedProfile),
      version: 7,
      name: typeof record.name === 'string' ? record.name : null,
      dob,
      // Already asked and answered. A blob carrying anything else in that slot
      // has never been through the age question, whatever it says — and a
      // stored false, which nothing in this app writes, reads as not asked.
      ageConfirmed: record.ageConfirmed === true ? true : null,
      // A v4 blob predates the field, so its slot is empty however the spread
      // above filled it; from v5 on the stop on the disk is that blob's own.
      ageStopAt: version === 5 || version === 6 || version === 7 ? storedStop(record.ageStopAt) : null,
      // The same reading, one version later. v4 and v5 predate the voice
      // question, so whatever the spread carried up from their slot is not an
      // answer either — only a v6 blob's voice is its own. Spelling both
      // conditions out rather than testing `version >= 5` is deliberate:
      // `version` is unknown off the disk, and a relational compare against an
      // unknown is how a string "6" or a stray true would slip into a branch.
      tutorVoice: version === 6 || version === 7 ? storedVoice(record.tutorVoice) : null,
      // One version on, the same shape of reading: only a v7 blob has ever
      // been asked, and only its own `true` is an answer. Anything else in the
      // slot, a string, a number, a stray 1, is not a boolean this app wrote.
      preferTyping: version === 7 && record.preferTyping === true,
      onboardedAt: typeof record.onboardedAt === 'number' ? record.onboardedAt : now,
      motivation: typeof record.motivation === 'string' ? record.motivation : null,
      dailyGoalMin: storedGoal(record.dailyGoalMin),
      username: typeof record.username === 'string' ? record.username : null,
      brain: record.brain,
    };
  }
  return null;
}
