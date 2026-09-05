/**
 * Coming back to a scene — the pace, and the door — F403.
 *
 * Two rules, one file, and the second of them lives in `chooserView.ts`.
 * `resumableMission` is asserted here rather than beside its own module on
 * purpose: `chooserView.test.ts` is held by another engineer this round, and a
 * rule about WHICH scene comes back reads better beside the rule about how much
 * of it is left than beside six cards and a promise line. Both are answers to
 * "the learner walked out of something, what do we say about it".
 *
 * Nothing here reads a clock. `NOW` is a constant, `lastFinishedAt` arrives as
 * a parameter, and how much of a scene is left is a fact about the record
 * rather than about the moment somebody looks at it.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { MISSIONS, missionStates, type MissionCompletion, type MissionId, type MissionProgress } from '@luvani/core';

import { resumableMission } from './chooserView.ts';
import type { ScenarioRecord } from './progressStore.ts';
import { minutesRemaining } from './resume.ts';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const NOW = Date.parse('2026-09-04T14:00:00Z');

// Typed as catalogue ids rather than plain strings: a completion record names a
// mission the build knows about, and a fixture naming one it does not should
// fail here rather than at the assertion.
const CAFE: MissionId = 'mission:cafe';
const HOTEL: MissionId = 'mission:hotel';
const MARCHE: MissionId = 'mission:marche';
const AMIS: MissionId = 'mission:amis';

/** How many beats a scene has, read from the catalogue, which is the only place it lives. */
function beatsOf(missionId: string): number {
  const mission = MISSIONS.find((m) => m.id === missionId);
  assert.ok(mission, `${missionId} is not in the catalogue, so this fixture is describing a scene nobody ships`);
  return mission.beatIds.length;
}

const record = (missionId: string, at: number, elapsedMs: number, beatsDone: number): ScenarioRecord => ({
  missionId,
  at,
  elapsedMs,
  beatsDone,
});

const finished = (id: MissionId, at: number): MissionCompletion => ({ id, at, rung: 2 });

/**
 * The rule `resumableMission` had before records existed, restated.
 *
 * Two screens still call the one-argument form while another engineer rewrites
 * the third, so this is not a paraphrase for readability: it is the thing the
 * one-argument answer has to keep agreeing with, and it fails here the moment
 * the fallback drifts.
 */
function ruleBeforeRecords(progress: readonly MissionProgress[]): MissionProgress | null {
  const started = progress.filter((p) => p.state !== 'new');
  return (
    started.find((p) => p.state === 'in-progress') ??
    started.find((p) => p.state === 'needs-review') ??
    started[0] ??
    null
  );
}

describe('how much of a scene is left — an estimate, or silence', () => {
  test("minutes remaining is an estimate from the learner's pace, and absent without a pace — F403", () => {
    const beats = beatsOf(CAFE);
    assert.ok(beats >= 4, 'the cafe scene needs a few beats for any of the arithmetic below to mean anything');

    // The estimate itself: the time the first beats took, applied to the rest.
    // Two beats in four minutes is two minutes a beat, so the remaining beats
    // are two minutes each.
    const half = record(CAFE, NOW, 4 * MINUTE_MS, 2);
    assert.equal(
      minutesRemaining(half, 6, null),
      8,
      'two beats in four minutes leaves four beats at two minutes each, which is eight',
    );

    // Rounded up, always. Half a minute of work left is still a minute of the
    // learner's evening.
    assert.equal(
      minutesRemaining(record(CAFE, NOW, 130_000, 2), 3, null),
      2,
      'a minute and five seconds left rounds up, because this card speaks in whole minutes',
    );
    assert.equal(
      minutesRemaining(record(CAFE, NOW, 2_000, 2), 6, null),
      1,
      'a scene with seconds left says a minute, which is the smallest thing it can honestly say',
    );

    // No record at all. The learner has never walked out of this scene part way.
    assert.equal(minutesRemaining(null, beats, null), null, 'no record is no measurement, so the door carries no minutes');
    assert.equal(minutesRemaining(undefined, beats, null), null, 'and an unloaded store is the same silence');

    // No pace. This is the one the whole module is built around: with no beat
    // behind them there is nothing to extrapolate from, and the only number
    // available would be an invention with a minutes sign on it.
    assert.equal(
      minutesRemaining(record(CAFE, NOW, 3 * MINUTE_MS, 0), beats, null),
      null,
      'three minutes and no beats is a learner who read the scene and left; a guess dressed as a measurement is worse than silence',
    );

    // Nothing left to do.
    assert.equal(
      minutesRemaining(record(CAFE, NOW, 9 * MINUTE_MS, beats), beats, null),
      null,
      'every beat is behind them, so a positive number here would be inventing work',
    );
    assert.equal(
      minutesRemaining(record(CAFE, NOW, 9 * MINUTE_MS, beats + 2), beats, null),
      null,
      'a record from a build with a longer scene must not produce negative minutes',
    );

    // They have finished it since. `recordMissionCompletion` clears the record,
    // so this is a leftover from a race, and a leftover must not send somebody
    // back into a room they walked out of finished.
    const stale = record(CAFE, NOW - 2 * DAY_MS, 4 * MINUTE_MS, 2);
    assert.equal(
      minutesRemaining(stale, beats, NOW - DAY_MS),
      null,
      'the scene was finished after this record was written, so the record describes a scene that no longer exists',
    );
    assert.equal(
      minutesRemaining(record(CAFE, NOW - DAY_MS, 4 * MINUTE_MS, 2), beats, NOW - DAY_MS),
      null,
      'a finish and a record stamped at the same instant resolve to the finish, because a finish is what the learner would recognise',
    );
    assert.equal(
      minutesRemaining(record(CAFE, NOW, 4 * MINUTE_MS, 2), 6, NOW - DAY_MS),
      8,
      'left again after finishing it once is a live record, and the estimate comes back',
    );

    // `beatsTotal` is the caller's, from the catalogue, and is never in the store.
    assert.equal(
      Object.prototype.hasOwnProperty.call(half, 'beatsTotal'),
      false,
      'a beat count kept in the store is a count two devices can disagree about; only the catalogue can be corrected by shipping a build',
    );
    assert.equal(minutesRemaining(half, Number.NaN, null), null, 'a beat count that is not a number produces no estimate');
  });
});

describe('which scene comes back — the one they actually left', () => {
  test('the resume door prefers the scene the learner actually left — F403', () => {
    const noRecords: ScenarioRecord[] = [];

    // Nothing started, nothing left part way.
    const untouched = missionStates([], [], NOW);
    assert.equal(resumableMission(untouched), null, 'nothing started is nothing to continue');
    assert.equal(resumableMission(untouched, noRecords), null, 'and an empty store adds nothing to continue either');

    // The old rule, unchanged, with one argument and with an empty list.
    const done = [finished(HOTEL, NOW - 5 * DAY_MS)];
    const progress = missionStates(done, [], NOW);
    const oldAnswer = ruleBeforeRecords(progress);
    assert.equal(oldAnswer?.mission.id, HOTEL, 'the fixture is only worth anything if the old rule names the hotel');
    assert.deepEqual(resumableMission(progress), oldAnswer, 'the one-argument answer must stay exactly what it was');
    assert.deepEqual(resumableMission(progress, undefined), oldAnswer, 'and an undefined list is the same as no list');
    assert.deepEqual(resumableMission(progress, noRecords), oldAnswer, 'an empty list falls back rather than answering null');

    // A record wins. The projection says what the completion log implies; a
    // record is the learner walking out of a room mid-sentence.
    const left = [record(MARCHE, NOW - HOUR_MS, 3 * MINUTE_MS, 2)];
    assert.equal(
      resumableMission(progress, left)?.mission.id,
      MARCHE,
      'they left the market an hour ago, and the hotel is only what the completion log implies',
    );

    // Newest wins among several.
    const several = [
      record(AMIS, NOW - 3 * DAY_MS, 5 * MINUTE_MS, 1),
      record(MARCHE, NOW - HOUR_MS, 3 * MINUTE_MS, 2),
      record(CAFE, NOW - 2 * DAY_MS, 2 * MINUTE_MS, 1),
    ];
    assert.equal(
      resumableMission(progress, several)?.mission.id,
      MARCHE,
      'three scenes left part way, and the door opens on the most recent one',
    );

    // A record for a scene finished since it was written is not live, so it
    // does not get to outrank an older record that is.
    const staleWinsIfUnfiltered = [
      record(HOTEL, NOW - 6 * DAY_MS, 4 * MINUTE_MS, 2),
      record(MARCHE, NOW - 7 * DAY_MS, 4 * MINUTE_MS, 2),
    ];
    assert.equal(
      resumableMission(progress, staleWinsIfUnfiltered)?.mission.id,
      MARCHE,
      'the hotel record is newer but the hotel was finished after it, so the live market record is the one that counts',
    );

    // A record naming a mission this build has never heard of is ignored
    // rather than crashed on, the same way `missionCompletionsFrom` drops one.
    const unknown = [record('mission:from-a-later-build', NOW, 4 * MINUTE_MS, 2)];
    assert.deepEqual(
      resumableMission(progress, unknown),
      oldAnswer,
      'a row from a build with more scenes must leave the learner with the door they had, not with no door',
    );

    // And a record outranks the projection entirely: a scene nobody has
    // finished is still the scene they were in.
    assert.equal(
      resumableMission(untouched, [record(AMIS, NOW - HOUR_MS, 2 * MINUTE_MS, 1)])?.mission.id,
      AMIS,
      'they were in the middle of talking about friends, whatever the completion log has never recorded',
    );
  });
});
