/**
 * The words at the top of the Tutor tab — F404.
 *
 * The tab used to open on a greeting that changed with the hour, so the header
 * said something different at breakfast and at bedtime and was never a landmark.
 * The founder's screenshot opens on the tutor instead. That is the change these
 * assertions hold: a header that names one person and does not move, a purpose
 * line under it, and one line under the circle that promises nothing about how
 * well anybody is going to do.
 *
 * `firstNameOf` outlived the greeting that needed it, because `home/greeting.ts`
 * imports it. One name rule for the whole app, so no two screens can disagree
 * about what a learner is called.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { guiltIn } from '../copy/guilt.ts';
import * as dashboard from './dashboard.ts';
import { TUTOR_ORB_SUBLINE, TUTOR_PURPOSE, firstNameOf, tutorHeading } from './dashboard.ts';

describe('the tutor tab opens on the tutor, not on the hour — F404', () => {
  test("the tutor heading names the tutor and the subline is the screenshot's — F404", () => {
    // The name is the tutor's. `tutorNameOf` has already resolved whichever
    // voice the learner chose, so this only sets it.
    assert.equal(tutorHeading('Margot'), 'Your Tutor, Margot', 'the header does not name the tutor the learner chose');
    assert.equal(tutorHeading('Céline'), 'Your Tutor, Céline', 'a name written with an accent is not set as it is written');

    // Same header at every hour. The clock is gone from this module, and with
    // it the reason a learner could not use the top of the page as a landmark.
    assert.ok(!('tutorGreeting' in dashboard), 'the hourly greeting is back, so the header changes by the time of day again');
    assert.ok(!('tutorGreetingSubline' in dashboard), 'the greeting subline is back beside the one the screenshot asked for');
    assert.deepEqual(
      Object.keys(dashboard).sort(),
      ['TUTOR_ORB_SUBLINE', 'TUTOR_PURPOSE', 'firstNameOf', 'tutorHeading'],
      'the header module grew or lost an export, and a fourth line up here is a fourth thing to read before speaking',
    );

    // The two lines the screenshot puts under the header and under the circle.
    // British spelling on purpose: the rest of the app says "judgement", and a
    // second convention inside one app costs more than either spelling is worth.
    assert.equal(TUTOR_PURPOSE, 'Speak naturally. Zero judgement.');
    assert.equal(TUTOR_ORB_SUBLINE, 'Gentle guidance, no pressure.');

    // Nothing up here is a count, a dash, a scold or a hurry. The circle's line
    // says what the conversation is like, and it names no pressure at all.
    for (const line of [tutorHeading('Margot'), TUTOR_PURPOSE, TUTOR_ORB_SUBLINE]) {
      assert.ok(!/\d/.test(line), `"${line}" carries a number, and the header is not a place a count belongs`);
      assert.ok(!/[—%]/.test(line), `"${line}" carries an em dash or a percentage`);
      assert.equal(guiltIn(line), undefined, `"${line}" says a word the app promised never to say`);
      assert.ok(!/\b(hurry|quick|only|score|wrong)\b/i.test(line), `"${line}" puts something on the learner before they have spoken`);
    }
  });

  test('a learner who gave a full name is called by the first of it, and one who skipped is not named at all', () => {
    assert.equal(firstNameOf('  Amina Rahman  '), 'Amina', 'a padded full name is not split down to the name a learner uses');
    assert.equal(firstNameOf('Amina'), 'Amina', 'a single name is left alone');
    assert.equal(firstNameOf('  '), null, 'a blank name is read as a name');
    assert.equal(firstNameOf(null), null, 'a learner who skipped the name page is named anyway');
    assert.equal(firstNameOf(undefined), null, 'a profile with no name yet is named anyway');
  });
});
