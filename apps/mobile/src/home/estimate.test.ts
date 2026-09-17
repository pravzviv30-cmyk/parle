/**
 * How long the hero card says the next few minutes will be — F571.
 *
 * The founder's mockup puts "Ready for 7 min" on the one card Home leads with,
 * and a number on a first screen is the kind of thing that quietly becomes
 * untrue: a pool grows, a mission gains a beat, and a card is still promising
 * seven. So the arithmetic is a function over the real catalogues, and this is
 * where it is held to them rather than to an example.
 *
 * The second test is about the numeral itself. Home shows no counts, no scores
 * and no percentages, and this line is the single sanctioned exception, so it
 * is worth proving it stays a single exception: one number, no percent sign,
 * nothing that could be read as a mark out of anything.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAILY_SCENARIOS, MISSIONS } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { MAX_MINUTES, MIN_MINUTES, estimateMinutes, readyLine } from './estimate.ts';

describe('how long the hero card says a scene takes — F571', () => {
  test('a three-line scene is ready for seven minutes', () => {
    // The founder's number, from the founder's mockup: three beats of the
    // learner's own side, four minutes of opening, seven on the card.
    assert.equal(estimateMinutes({ kind: 'scenario', lines: 3 }), 7);
    assert.equal(readyLine(estimateMinutes({ kind: 'scenario', lines: 3 })), 'Ready for 7 min');

    // A mission is longer per beat, because a mission beat can be handed back.
    assert.equal(estimateMinutes({ kind: 'mission', beats: 4 }), 9, 'a four beat mission is not three minutes plus a minute and a half a beat');
    assert.equal(estimateMinutes({ kind: 'mission', beats: 3 }), 8, 'a fractional estimate is rounded down rather than up');

    // Every authored scene and every authored mission lands inside the bound,
    // walked over the real catalogues rather than over an example. A pool that
    // grows a one-beat scene or a twelve-beat mission is caught here rather
    // than by a learner reading a card that promises three minutes.
    assert.ok(DAILY_SCENARIOS.length > 0 && MISSIONS.length > 0, 'the catalogues are empty, so this walk proves nothing');
    for (const scenario of DAILY_SCENARIOS) {
      const minutes = estimateMinutes({ kind: 'scenario', lines: scenario.lines.length });
      assert.ok(
        minutes >= MIN_MINUTES && minutes <= MAX_MINUTES,
        `${scenario.id} is offered as ${minutes} minutes, which is outside the bound an invitation can keep`,
      );
    }
    for (const mission of MISSIONS) {
      const minutes = estimateMinutes({ kind: 'mission', beats: mission.beatIds.length });
      assert.ok(
        minutes >= MIN_MINUTES && minutes <= MAX_MINUTES,
        `${mission.id} is offered as ${minutes} minutes, which is outside the bound an invitation can keep`,
      );
    }

    // The clamp, at both ends, so a future one-beat scene is still an honest
    // five and a fifteen-beat mission is still a tappable twelve.
    assert.equal(estimateMinutes({ kind: 'scenario', lines: 0 }), MIN_MINUTES, 'a scene with no beats promises less time than a conversation takes');
    assert.equal(estimateMinutes({ kind: 'mission', beats: 40 }), MAX_MINUTES, 'a long mission is offered as an evening rather than as a session');

    // And the one measurement is passed through untouched. It came from this
    // learner's own pace through the beats they already did, so clamping it
    // would be the app overruling its own measurement.
    assert.equal(estimateMinutes({ kind: 'measured', minutes: 2 }), 2, 'a measured remainder is rounded up to the floor, which invents time the learner does not need');
    assert.equal(estimateMinutes({ kind: 'measured', minutes: 21 }), 21, 'a measured remainder is trimmed to the ceiling, which is the app editing its own measurement');
  });

  test('the ready line carries exactly one numeral', () => {
    // Home shows no counts and no scores. This line is the one sanctioned
    // numeral on the page, so it carries one number and nothing that could be
    // read as a score: no percent, no slash, no "out of".
    for (let minutes = MIN_MINUTES; minutes <= MAX_MINUTES; minutes += 1) {
      const line = readyLine(minutes);
      assert.deepEqual(line.match(/\d+/g), [String(minutes)], `"${line}" carries more than one number, so something on it is a count`);
      assert.doesNotMatch(line, /%|\/| out of /, `"${line}" reads as a score rather than as a duration`);
      assert.equal(guiltIn(line), undefined, `"${line}" carries the banned word "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—/, `"${line}" carries an em dash, which no learner-facing line may`);
      assert.match(line, /^Ready for \d+ min$/, `"${line}" is not the invitation the founder's mockup asks for`);
    }
    // A measured remainder is said the same way, so a learner never meets two
    // shapes of the same sentence on the same card.
    assert.equal(readyLine(estimateMinutes({ kind: 'measured', minutes: 3 })), 'Ready for 3 min');
  });
});
