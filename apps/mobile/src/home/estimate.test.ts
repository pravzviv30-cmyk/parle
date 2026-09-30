/**
 * How long a scene is said to take — F571, and the notebook redesign.
 *
 * A number on a first screen is the kind of thing that quietly becomes untrue:
 * a pool grows, a mission gains a beat, and a card is still promising seven.
 * So the arithmetic is a function over the real catalogues, and this is where
 * it is held to them rather than to an example.
 *
 * Rewritten 2026-09-27 (notebook Phase 3, B1). The opener, "Le premier café",
 * read "About 8 min" on every surface, from the open-mission formula and the
 * five-minute floor. The plan says about three. The fix is derived from the
 * mission rather than special-cased: a scene whose every beat is one fixed
 * reference line is scripted, and a scripted scene takes about a minute a
 * line. Only the opener is shaped that way today, which this suite checks
 * against the catalogue rather than by id.
 *
 * Revamp B (F602): the line says "minutes" in full, and the blue scene brief
 * reads one meta line joining the label, the minutes and the tutor. That line
 * is built here, so its wording is held here.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAILY_SCENARIOS, FIRST_MISSION, MISSIONS, getMission } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { TUTOR_NAME } from '../tutor/tutorName.ts';
import { MAX_MINUTES, MIN_MINUTES, estimateMinutes, minutesLine, missionEstimate, missionMinutes, sceneMeta } from './estimate.ts';

describe('how long a scene is said to take — F571', () => {
  test('a three-line daily scene is about seven minutes, and an open mission is longer per beat', () => {
    assert.equal(estimateMinutes({ kind: 'scenario', lines: 3 }), 7);
    assert.equal(estimateMinutes({ kind: 'mission', beats: 4 }), 9, 'a four beat mission is not three minutes plus a minute and a half a beat');
    assert.equal(estimateMinutes({ kind: 'mission', beats: 3 }), 8, 'a fractional estimate is rounded down rather than up');

    assert.ok(DAILY_SCENARIOS.length > 0 && MISSIONS.length > 0, 'the catalogues are empty, so this walk proves nothing');
    for (const scenario of DAILY_SCENARIOS) {
      const minutes = estimateMinutes({ kind: 'scenario', lines: scenario.lines.length });
      assert.ok(minutes >= MIN_MINUTES && minutes <= MAX_MINUTES, `${scenario.id} is offered as ${minutes} minutes`);
    }

    // The clamp, at both ends, for the open kinds.
    assert.equal(estimateMinutes({ kind: 'scenario', lines: 0 }), MIN_MINUTES);
    assert.equal(estimateMinutes({ kind: 'mission', beats: 40 }), MAX_MINUTES);

    // The one measurement is passed through untouched.
    assert.equal(estimateMinutes({ kind: 'measured', minutes: 2 }), 2);
    assert.equal(estimateMinutes({ kind: 'measured', minutes: 21 }), 21);
  });

  test('the opener reads about three minutes, derived from its script rather than named', () => {
    const opener = getMission(FIRST_MISSION)!;
    assert.equal(opener.id, 'mission:premier-cafe', 'the first mission moved, so this test is reading a different scene');
    assert.deepEqual(missionEstimate(opener), { kind: 'scripted', lines: 3 }, 'the opener is not recognised as a scripted scene');
    assert.equal(missionMinutes(opener), 3, 'the opener is still offered as the open-mission eight');
    assert.equal(minutesLine(missionMinutes(opener)), 'About 3 minutes');

    // The rule is the shape of the data, not the id: a scene is scripted when
    // every beat has a fixed line, and no other scene in the catalogue is.
    for (const mission of MISSIONS) {
      const scripted = mission.referencePhrases.length >= mission.beatIds.length;
      const estimate = missionEstimate(mission);
      assert.equal(estimate.kind, scripted ? 'scripted' : 'mission', `${mission.id} is estimated as the wrong kind of scene`);
      const minutes = missionMinutes(mission);
      if (!scripted) {
        assert.equal(minutes, estimateMinutes({ kind: 'mission', beats: mission.beatIds.length }), `${mission.id} changed length`);
        assert.ok(minutes >= MIN_MINUTES && minutes <= MAX_MINUTES, `${mission.id} is offered as ${minutes} minutes`);
      }
    }
    assert.deepEqual(
      MISSIONS.filter((mission) => missionEstimate(mission).kind === 'scripted').map((mission) => mission.id),
      [FIRST_MISSION],
      'a second scene became scripted, so its card now reads a minute a line; check that is true before changing this',
    );

    // A script is still bounded: never under a minute, never over the ceiling.
    assert.equal(estimateMinutes({ kind: 'scripted', lines: 0 }), 1);
    assert.equal(estimateMinutes({ kind: 'scripted', lines: 40 }), MAX_MINUTES);
  });

  test("a scene's minutes read in full, and its meta line joins the label, the minutes and the tutor", () => {
    // The minutes line: one numeral, a duration, the word in full.
    for (let minutes = 1; minutes <= MAX_MINUTES; minutes += 1) {
      const line = minutesLine(minutes);
      assert.deepEqual(line.match(/\d+/g), [String(minutes)], `"${line}" carries more than one number`);
      assert.doesNotMatch(line, /%|\/| out of /, `"${line}" reads as a score rather than as a duration`);
      assert.equal(guiltIn(line), undefined, `"${line}" carries the banned word "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /[—–·]/, `"${line}" carries a dash or a middot`);
      assert.match(line, /^About \d+ minutes?$/);
      assert.doesNotMatch(line, /\bmin\b/, `"${line}" still abbreviates the minutes`);
    }
    assert.equal(minutesLine(7), 'About 7 minutes');
    assert.equal(minutesLine(1), 'About 1 minute', 'a measured remainder of one reads "1 minutes"');

    // The meta line over the blue brief: label, minutes, tutor, in that order.
    assert.equal(sceneMeta('Next scene', 3, TUTOR_NAME), `Next scene, about 3 minutes with ${TUTOR_NAME}`);
    assert.equal(sceneMeta('Pick up where you left off', 1, 'Camille'), 'Pick up where you left off, about 1 minute with Camille');
    // With no estimate, it says who the scene is with and invents no number.
    assert.equal(sceneMeta('Next scene', null, TUTOR_NAME), `Next scene, with ${TUTOR_NAME}`);
    assert.doesNotMatch(sceneMeta('Next scene', null, TUTOR_NAME), /\d/);

    for (let minutes = 1; minutes <= MAX_MINUTES; minutes += 1) {
      const meta = sceneMeta('Next scene', minutes, TUTOR_NAME);
      // The minutes are the same words the minutes line says, so the two cannot drift.
      assert.ok(meta.includes(minutesLine(minutes).toLowerCase()), `"${meta}" words the minutes differently from "${minutesLine(minutes)}"`);
      assert.deepEqual(meta.match(/\d+/g), [String(minutes)], `"${meta}" carries more than one number`);
      assert.doesNotMatch(meta, /[—–·]/, `"${meta}" carries a dash or a middot`);
      assert.equal(meta, meta.replace(/[A-Z]{2,}/g, ''), `"${meta}" carries a caps label`);
      assert.equal(guiltIn(meta), undefined, `"${meta}" carries the banned word "${guiltIn(meta)}"`);
    }
  });
});
