/**
 * How much of a scene is probably left, from the learner's own pace.
 *
 * `missions/progressStore.ts` keeps two observed facts about a scene somebody
 * walked out of: how long they had been in it, and how many beats were behind
 * them. It keeps nothing derived, on purpose. This is where the deriving
 * happens, every time it is asked for, from those two facts and a beat count
 * read from the mission catalogue at the call site.
 *
 * ## Why the catalogue is the third input and not a stored field
 *
 * `beatsTotal` is deliberately absent from the store. A count kept in two
 * places is a count two devices can disagree about, and only one of the two can
 * be corrected by shipping a build. So the caller passes it, from `MISSIONS`,
 * at the moment the question is asked.
 *
 * ## Why silence beats a guess
 *
 * The estimate is a straight-line extrapolation: the time the first beats took,
 * applied to the beats that are left. That is rough, and it is honest as long
 * as it is measuring something. With `beatsDone` at zero there is nothing to
 * extrapolate from, and the only figure available would be an invention with a
 * minutes sign on it. A guess dressed as a measurement is worse than saying
 * nothing, so this returns null and the door simply carries no minutes line.
 *
 * Nothing here reads a clock. `lastFinishedAt` arrives from `MissionProgress`
 * and `now` is never needed, because "how much is left" is a fact about the
 * record rather than about the moment somebody looks at it.
 */

import type { ScenarioRecord } from './progressStore.ts';

const MS_PER_MINUTE = 60_000;

/**
 * About how many minutes are left in a part-finished scene, or null.
 *
 * Four ways to be null, each of them a claim this cannot honestly make:
 *
 *   - no record at all, so the learner has never left this scene part way;
 *   - `beatsDone === 0`, so there is no pace to extrapolate from;
 *   - `beatsDone` at or past `beatsTotal`, so there is nothing left to do, and
 *     a positive number would be inventing work;
 *   - the record is older than the mission's most recent finish, so they have
 *     been back and finished it since and the record is a leftover.
 *
 * The last one uses "at or before" rather than "strictly before", so a finish
 * and a record stamped at the same millisecond resolve to the finish.
 * `recordMissionCompletion` clears the record when a scene is completed, so a
 * tie here is a race between two writes, and of the two answers the finish is
 * the one the learner would recognise.
 *
 * The floor of one minute is a rounding rule, not a minimum effort: a scene
 * with a few seconds left says "a minute" because that is the smallest unit
 * this card speaks in.
 */
export function minutesRemaining(
  record: ScenarioRecord | null | undefined,
  beatsTotal: number,
  lastFinishedAt: number | null,
): number | null {
  if (!record) return null;
  if (!Number.isFinite(beatsTotal)) return null;
  if (record.beatsDone <= 0) return null;
  if (record.beatsDone >= beatsTotal) return null;
  if (lastFinishedAt !== null && record.at <= lastFinishedAt) return null;

  const msPerBeat = record.elapsedMs / record.beatsDone;
  const left = msPerBeat * (beatsTotal - record.beatsDone);
  return Math.max(1, Math.ceil(left / MS_PER_MINUTE));
}
