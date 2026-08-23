import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ageConfirmedFromDob, ageOn, MIN_AGE } from './age.ts';

/**
 * A fixed clock. Nothing here is allowed to read the wall, and it is built
 * from local parts because `ageOn` counts in local time — a UTC literal would
 * make this suite pass or fail depending on which side of the world runs it.
 */
const TODAY = new Date(2026, 7, 22, 10, 0, 0);

describe('age — counting the years the learner has actually had', () => {
  test('a learner whose birthday has passed this year has had the whole year', () => {
    assert.equal(ageOn('1999-04-01', TODAY), 27, 'April is behind us, so the year counts');
  });

  test('a learner whose birthday is still ahead has not had this year yet', () => {
    assert.equal(ageOn('1999-12-01', TODAY), 26, 'December has not happened, so the year does not count');
  });

  test('a learner on their birthday has had the year that day, not the day after', () => {
    assert.equal(ageOn('2000-08-22', TODAY), 26, 'the birthday itself is the day the year lands');
  });

  test('a date that is not a date gives no number to argue with', () => {
    assert.ok(Number.isNaN(ageOn('not a date', TODAY)), 'junk must not read as an age');
    assert.ok(Number.isNaN(ageOn('', TODAY)), 'an empty string is not a birthday');
  });

  test('a half-mangled date is refused rather than half-believed', () => {
    // The loose version of this function split on dashes and trusted what came
    // back, so '2013-xx-01' answered "thirteen" and let a stranger's corrupt
    // blob confirm an age nobody had confirmed.
    assert.ok(Number.isNaN(ageOn('2013-xx-01', TODAY)), 'a month that is not a month makes the whole date unusable');
    assert.ok(Number.isNaN(ageOn('2013-1-1', TODAY)), 'a date that is not the stored format is not read at all');
    assert.equal(ageConfirmedFromDob('2013-xx-01', TODAY), null, 'a corrupt date must never stand in for an answer');
  });
});

describe('age — what a stored date of birth lets us say', () => {
  test('a learner old enough for the product has confirmed their age by giving it', () => {
    assert.equal(ageConfirmedFromDob('1999-04-01', TODAY), true, 'a date at or over thirteen is the learner having answered');
  });

  test('a learner who is exactly thirteen today is old enough', () => {
    assert.equal(
      ageConfirmedFromDob('2013-08-22', TODAY),
      true,
      `${MIN_AGE} is the floor the product is made for, not the first year above it`,
    );
  });

  test('a learner too young is not marked as having denied anything', () => {
    assert.equal(
      ageConfirmedFromDob('2020-01-01', TODAY),
      null,
      'false would be a denial the learner never made; null is the truthful not-asked',
    );
  });

  test('a learner with no date on file has simply never been asked', () => {
    assert.equal(ageConfirmedFromDob(null, TODAY), null, 'an absent date is a question nobody put to them');
    assert.equal(ageConfirmedFromDob(undefined, TODAY), null, 'a missing field is a question nobody put to them');
    assert.equal(ageConfirmedFromDob('', TODAY), null, 'an empty string is not an answer');
    assert.equal(ageConfirmedFromDob('nonsense', TODAY), null, 'a mangled date says nothing about the learner');
  });
});
