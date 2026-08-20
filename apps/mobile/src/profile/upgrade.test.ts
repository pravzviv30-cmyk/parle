import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { upgradeStored } from './upgrade.ts';

const NOW = Date.parse('2026-08-19T10:00:00Z');

describe('the profile version chain', () => {
  test('a v1 profile walks the whole chain and loses nothing it had', () => {
    const upgraded = upgradeStored({ version: 1, motivation: 'travel', onboardedAt: 123, brain: { seen: 1 } }, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 3);
    assert.equal(upgraded.name, null, 'v1 never asked for a name');
    assert.equal(upgraded.dob, null);
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

  test('a v2 profile keeps every answer and gains only an empty username', () => {
    const v2 = {
      version: 2,
      name: 'Camille',
      dob: '1999-04-01',
      motivation: 'work',
      dailyGoalMin: 15,
      onboardedAt: 456,
      brain: { seen: 2 },
    };
    const upgraded = upgradeStored(v2, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.version, 3);
    assert.equal(upgraded.name, 'Camille');
    assert.equal(upgraded.dob, '1999-04-01');
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
      dob: '1999-04-01',
      motivation: 'work',
      dailyGoalMin: 5,
      onboardedAt: 789,
      username: 'camille.4821',
      brain: {},
    };
    const upgraded = upgradeStored(v3, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.username, 'camille.4821');
    assert.equal(upgraded.name, 'Camille');
  });

  test('a v3 blob with a mangled username reads as unclaimed, not as junk', () => {
    const upgraded = upgradeStored({ version: 3, name: 'C', username: 42, brain: {} }, NOW);
    assert.ok(upgraded);
    assert.equal(upgraded.username, null);
  });

  test('what is not a profile comes back null', () => {
    assert.equal(upgradeStored(null, NOW), null);
    assert.equal(upgradeStored('profile', NOW), null);
    assert.equal(upgradeStored({ version: 99 }, NOW), null);
    assert.equal(upgradeStored({}, NOW), null);
  });
});
