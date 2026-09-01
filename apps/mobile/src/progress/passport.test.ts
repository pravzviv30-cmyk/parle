/**
 * The passport — what the learner can walk into on their own.
 *
 * The first test in this file is the one that matters, and it is not really
 * about strings either. It is the thing standing between a record of situations
 * handled and a scoreboard that walks backwards: if somebody later reads
 * `lastRung` because it is right there on `MissionProgress`, a tired replay at
 * rung 1 starts erasing stamps, and every replay becomes a risk. That is the
 * exact failure Phase 6a's less-help replay would ship, so it is held here
 * rather than discovered there.
 *
 * The fixtures deliberately go through `missionStates` rather than hand-rolling
 * `MissionProgress` objects. A hand-built fixture could carry an independence
 * and a `lastRung` that no real completion history could ever produce, and then
 * the test would be checking a shape instead of the rule.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  MISSIONS,
  missionStates,
  newCard,
  type MissionCompletion,
  type MissionId,
  type ReviewCard,
  type Rung,
} from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { STAMP_STATES, hasStamps, stampLabel, stampsFrom, type Stamp } from './passport.ts';

const NOW = Date.parse('2026-08-22T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const CAFE: MissionId = 'mission:cafe';

const finishedAt = (rung: Rung, at: number, id: MissionId = CAFE): MissionCompletion => ({ id, at, rung });

/** Cards the scheduler wants back this morning: `newCard` is due the moment it exists. */
function dueCardsFor(id: string, now: number): ReviewCard[] {
  const mission = MISSIONS.find((m) => m.id === id)!;
  return mission.phraseKeys.map((key) =>
    newCard({ id: key, kind: 'turn', front: key, back: key, context: '', ipa: '' }, now),
  );
}

/** The same cards, held until next week, so the mission reads as complete. */
function settledCardsFor(id: string, now: number): ReviewCard[] {
  return dueCardsFor(id, now).map((card) => ({ ...card, reps: 2, intervalDays: 7, due: now + 7 * DAY }));
}

const stampFor = (stamps: readonly Stamp[], id: MissionId = CAFE): Stamp => stamps.find((s) => s.missionId === id)!;

describe('the passport — one stamp per situation handled alone', () => {
  test('a stamp is earned at best-ever independence and a lower replay cannot remove it', () => {
    // Monday: the whole café, no help at all. Thursday: the same scene again on
    // a tired evening, with the tutor handing over most of the lines.
    const completions = [finishedAt(4, NOW - 4 * DAY), finishedAt(1, NOW - DAY)];
    const progress = missionStates(completions, settledCardsFor(CAFE, NOW), NOW);
    const cafe = progress.find((p) => p.mission.id === CAFE)!;

    // The fixture is only interesting if the two readings disagree, so prove
    // they do before trusting the assertion below.
    assert.equal(cafe.lastRung, 1, 'the replay really was at the bottom rung');
    assert.equal(cafe.independence, 'on-your-own', 'core already answers this best-ever');

    assert.equal(
      stampFor(stampsFrom(progress)).state,
      'on-your-own',
      'a stamp records that it happened; coming back for another go cannot un-happen it',
    );

    // And the stamp was genuinely earned by the rung, not handed out for turning up.
    const helpedOnly = missionStates([finishedAt(2, NOW - DAY)], settledCardsFor(CAFE, NOW), NOW);
    assert.equal(stampFor(stampsFrom(helpedOnly)).state, 'with-help');
  });

  test('with no stamps the passport adds nothing to the screen', () => {
    const nothingYet = stampsFrom(missionStates([], [], NOW));
    assert.equal(nothingYet.length, MISSIONS.length, 'every situation is still described');
    assert.ok(
      nothingYet.every((stamp) => stamp.state === 'not-yet'),
      'a learner who has never spoken has handled nothing yet, and that is not a verdict',
    );
    assert.equal(
      hasStamps(nothingYet),
      false,
      'six empty marks is a quota, and a quota unmet at eleven at night is guilt in a hat',
    );

    // Neither does a learner who has finished a scene but always with help. The
    // situations list still tells them where they are; the passport stays quiet
    // until there is something on it.
    const helped = missionStates([finishedAt(3, NOW - DAY)], settledCardsFor(CAFE, NOW), NOW);
    assert.equal(hasStamps(stampsFrom(helped)), false);

    const alone = missionStates([finishedAt(4, NOW - DAY)], settledCardsFor(CAFE, NOW), NOW);
    assert.equal(hasStamps(stampsFrom(alone)), true, 'one situation handled alone is a passport');
  });

  test('a mission the scheduler wants back keeps its stamp', () => {
    const progress = missionStates([finishedAt(4, NOW - 30 * DAY)], dueCardsFor(CAFE, NOW), NOW);
    const cafe = progress.find((p) => p.mission.id === CAFE)!;
    assert.equal(cafe.state, 'needs-review', 'the fixture really is a mission asking to come back');

    assert.equal(
      stampFor(stampsFrom(progress)).state,
      'on-your-own',
      'dueness expires, evidence does not: the phrases want a look, the afternoon still happened',
    );
    assert.ok(hasStamps(stampsFrom(progress)));
  });

  test('the three middle rungs read as one state, because the question is whether you can do it alone', () => {
    const stateAt = (rung: Rung) =>
      stampFor(stampsFrom(missionStates([finishedAt(rung, NOW - DAY)], settledCardsFor(CAFE, NOW), NOW))).state;

    assert.equal(stateAt(1), 'with-help');
    assert.equal(stateAt(2), 'with-help');
    assert.equal(stateAt(3), 'with-help');
    assert.equal(stateAt(4), 'on-your-own');
    assert.equal(
      stampFor(stampsFrom(missionStates([], [], NOW))).state,
      'not-yet',
      'never attempted is its own state, and it is the only one that is not a completion',
    );
    assert.equal(STAMP_STATES.length, 3, 'three states, not five: the ladder keeps its own scale');
  });

  test('a stamp carries nothing that could be rendered as a count', () => {
    const stamp = stampFor(stampsFrom(missionStates([finishedAt(4, NOW)], settledCardsFor(CAFE, NOW), NOW)));
    assert.deepEqual(
      Object.keys(stamp).sort(),
      ['missionId', 'place', 'state', 'titleEn'],
      'no lines owned, no lines total, no focus: "3 of 6" has to be impossible, not merely unwritten',
    );
  });

  test('no stamp copy carries a digit, a share or a banned word', () => {
    const everyStamp = STAMP_STATES.flatMap((state) =>
      MISSIONS.map((mission): Stamp => ({
        missionId: mission.id,
        place: mission.place,
        titleEn: mission.titleEn,
        state,
      })),
    );

    for (const stamp of everyStamp) {
      const line = stampLabel(stamp);
      assert.ok(line.length > 0, `${stamp.state} must still say something a screen reader can read`);
      assert.doesNotMatch(line, /\d/, `a digit in "${line}" is a count on a screen that promised none`);
      assert.doesNotMatch(line, /%/, `a share in "${line}" needs a denominator this app does not have`);
      assert.equal(guiltIn(line), undefined, `"${line}" says a word the product promised not to say`);
    }
  });

  test('a situation nobody has walked into yet is an invitation, not a loss', () => {
    const line = stampLabel({
      missionId: 'mission:hotel',
      place: 'hotel',
      titleEn: 'Check into a hotel',
      state: 'not-yet',
    });
    // TodayRow's rule, kept: a thing that has not happened is not a state worth
    // signalling, so the copy is an open door rather than a report on an absence.
    assert.match(line, /ready when you are/i);
    assert.equal(guiltIn(line), undefined);
  });
});
