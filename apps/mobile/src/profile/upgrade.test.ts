import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { upgradeStored } from './upgrade.ts';

const NOW = Date.parse('2026-08-19T10:00:00Z');

/** Old enough on any clock this suite uses. */
const ADULT_DOB = '1999-04-01';
/** Too young on any clock this suite uses. */
const CHILD_DOB = '2020-01-01';

/**
 * Every branch that can carry a date of birth, shaped the way that version
 * shipped, with what each should say about the learner's age afterwards.
 *
 * v2 and v3 derive the confirmation from the date. v4 records already went
 * through that derivation at the hop, so what is on their disk is the answer —
 * including the fourth entry, a denial no version of this app has ever
 * written, which must not be handed back as one.
 */
function branchesCarrying(dob: string, adult: boolean): { name: string; blob: Record<string, unknown>; confirmed: true | null }[] {
  const derived = adult ? true : null;
  return [
    {
      name: 'v2',
      blob: { version: 2, name: 'Camille', dob, motivation: 'work', dailyGoalMin: 15, onboardedAt: 456, brain: {} },
      confirmed: derived,
    },
    {
      name: 'v3',
      blob: { version: 3, name: 'Camille', dob, motivation: 'work', dailyGoalMin: 5, onboardedAt: 789, username: 'camille.4821', brain: {} },
      confirmed: derived,
    },
    {
      name: 'v4 as the hop left it',
      blob: { version: 4, name: 'Camille', dob, ageConfirmed: derived, motivation: 'work', dailyGoalMin: null, onboardedAt: 789, username: null, brain: {} },
      confirmed: derived,
    },
    {
      name: 'v4 carrying a denial nothing wrote',
      blob: { version: 4, name: 'Camille', dob, ageConfirmed: false, motivation: 'work', dailyGoalMin: null, onboardedAt: 789, username: null, brain: {} },
      confirmed: null,
    },
  ];
}

describe('the profile version chain', () => {
  test('a v1 profile still reaches the latest version in one pass, brain intact', () => {
    const upgraded = upgradeStored({ version: 1, motivation: 'travel', onboardedAt: 123, brain: { seen: 1 } }, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 5, 'the chain runs direct to the latest version, never a step at a time');
    assert.equal(upgraded.name, null, 'v1 never asked for a name');
    assert.equal(upgraded.dob, null);
    assert.equal(upgraded.ageConfirmed, null, 'v1 never asked about age either, so nothing is claimed on the learner behalf');
    assert.equal(upgraded.motivation, 'travel');
    assert.equal(upgraded.dailyGoalMin, 10);
    assert.equal(upgraded.onboardedAt, 123);
    assert.equal(upgraded.username, null, 'the username is claimed later, not invented here');
    assert.deepEqual(upgraded.brain, { seen: 1 }, 'the brain passes through untouched for the door to repair');
  });

  test('a v1 profile missing its fields gets the old defaults', () => {
    const upgraded = upgradeStored({ version: 1 }, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.motivation, 'want');
    assert.equal(upgraded.onboardedAt, NOW);
  });

  test('a v2 profile keeps every answer it ever gave', () => {
    const v2 = {
      version: 2,
      name: 'Camille',
      dob: ADULT_DOB,
      motivation: 'work',
      dailyGoalMin: 15,
      onboardedAt: 456,
      brain: { seen: 2 },
    };
    const upgraded = upgradeStored(v2, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 5);
    assert.equal(upgraded.name, 'Camille');
    assert.equal(upgraded.dob, ADULT_DOB, 'the date they typed is theirs and stays');
    assert.equal(upgraded.motivation, 'work');
    assert.equal(upgraded.dailyGoalMin, 15);
    assert.equal(upgraded.onboardedAt, 456);
    assert.equal(upgraded.username, null);
    assert.deepEqual(upgraded.brain, { seen: 2 });
  });

  test('a v3 profile passes through with its username intact', () => {
    const v3 = {
      version: 3,
      name: 'Camille',
      dob: ADULT_DOB,
      motivation: 'work',
      dailyGoalMin: 5,
      onboardedAt: 789,
      username: 'camille.4821',
      brain: {},
    };
    const upgraded = upgradeStored(v3, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 5);
    assert.equal(upgraded.username, 'camille.4821');
    assert.equal(upgraded.name, 'Camille');
  });

  test('a v3 profile with an adult dob arrives at v4 already age-confirmed', () => {
    const upgraded = upgradeStored(
      { version: 3, name: 'Camille', dob: ADULT_DOB, motivation: 'work', dailyGoalMin: 5, onboardedAt: 789, username: null, brain: {} },
      NOW,
    );
    assert.ok(upgraded);
    assert.equal(upgraded.version, 5);
    assert.equal(
      upgraded.ageConfirmed,
      true,
      'a learner who gave a date putting them over thirteen already answered the age question, in a longer form',
    );
    assert.equal(upgraded.dob, ADULT_DOB, 'deriving the confirmation is not a reason to drop the answer it came from');
  });

  test('a dob that reads young derives nothing, because nobody denied anything', () => {
    const upgraded = upgradeStored(
      { version: 3, name: 'Sam', dob: CHILD_DOB, motivation: 'school', dailyGoalMin: 5, onboardedAt: 789, username: null, brain: {} },
      NOW,
    );
    assert.ok(upgraded);
    assert.equal(upgraded.ageConfirmed, null, 'false would be this code claiming a learner said something they were never asked');
    assert.equal(upgraded.dob, CHILD_DOB, 'the answer stays on file even when it confirms nothing');
  });

  test('a v4 profile keeps the confirmation the learner actually gave', () => {
    const v4 = {
      version: 4,
      name: 'Camille',
      dob: null,
      ageConfirmed: true,
      motivation: null,
      dailyGoalMin: null,
      onboardedAt: 999,
      username: null,
      brain: { seen: 4 },
    };
    const upgraded = upgradeStored(v4, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 5);
    assert.equal(upgraded.ageConfirmed, true, 'a tap on the confirmation is an answer, and it survives every later read');
    assert.equal(upgraded.dob, null, 'a v4 learner was never asked for a date, and none is invented for them');
    assert.equal(upgraded.motivation, null, 'a skipped question stays skipped');
    assert.equal(upgraded.dailyGoalMin, null, 'the goal is asked in Profile now, and until then it is honestly empty');
    assert.deepEqual(upgraded.brain, { seen: 4 });
  });

  test('no upgrade branch ever drops the dob or invents a confirmation', () => {
    const v1 = upgradeStored({ version: 1, motivation: 'travel', onboardedAt: 123, brain: {} }, NOW);
    assert.ok(v1);
    assert.equal(v1.dob, null, 'v1 predates the question, so there is no answer to lose');
    assert.equal(v1.ageConfirmed, null, 'and none to derive');

    for (const dob of [ADULT_DOB, CHILD_DOB, '2013-xx-01']) {
      for (const { name, blob, confirmed } of branchesCarrying(dob, dob === ADULT_DOB)) {
        const upgraded = upgradeStored(blob, NOW);
        assert.ok(upgraded, `${name} must still upgrade`);
        assert.equal(upgraded.dob, dob, `${name} kept the date the learner typed, whatever v4 stopped asking for`);
        assert.notEqual(upgraded.ageConfirmed, false, `${name} must never hand back a denial the learner never made`);
        assert.ok(
          upgraded.ageConfirmed === true || upgraded.ageConfirmed === null,
          `${name} says either what the learner answered or nothing at all`,
        );
        assert.equal(upgraded.ageConfirmed, confirmed, `${name} confirms only an age the learner actually answered for`);
      }
    }
  });

  test('a v3 blob with a mangled username reads as unclaimed, not as junk', () => {
    const upgraded = upgradeStored({ version: 3, name: 'C', username: 42, brain: {} }, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.username, null);
  });

  test('a blob with a goal nobody was ever offered reads as unanswered', () => {
    const upgraded = upgradeStored({ version: 3, name: 'C', dailyGoalMin: 7, brain: {} }, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.dailyGoalMin, null, 'five, ten and fifteen are the only answers the app ever offered');
  });

  test('what is not a profile comes back null', () => {
    assert.equal(upgradeStored(null, NOW), null);
    assert.equal(upgradeStored('profile', NOW), null);
    assert.equal(upgradeStored({ version: 99 }, NOW), null);
    assert.equal(upgradeStored({}, NOW), null);
  });
});
