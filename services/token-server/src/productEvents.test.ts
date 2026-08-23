import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseProductEvent } from './productEvents.ts';

describe('product event privacy boundary', () => {
  test('accepts an allowlisted behaviour fact', () => {
    assert.deepEqual(parseProductEvent({ name: 'mission_started', properties: { missionId: 'mission:cafe', entry: 'chooser' } }), {
      name: 'mission_started',
      properties: { missionId: 'mission:cafe', entry: 'chooser' },
    });
    assert.notEqual(
      parseProductEvent({
        name: 'onboarding_completed',
        properties: { personalisedGreeting: true, motivationAnswered: false },
      }),
      null,
    );
    assert.notEqual(
      parseProductEvent({ name: 'my_french_opened', properties: { situationsDone: 2, linesKept: 8 } }),
      null,
    );
  });

  test('rejects content and identity even on an allowed event', () => {
    assert.equal(parseProductEvent({ name: 'mission_started', properties: { transcript: 'bonjour' } }), null);
    assert.equal(parseProductEvent({ name: 'onboarding_completed', properties: { email: 'learner@example.com' } }), null);
    assert.equal(
      parseProductEvent({ name: 'mission_started', properties: { missionId: 'mission:cafe', entry: 'chooser', payload: 'bonjour' } }),
      null,
    );
  });

  test('rejects wrong property types and unknown enum values', () => {
    assert.equal(parseProductEvent({ name: 'mission_completed', properties: { missionId: 'mission:cafe', rung: '4' } }), null);
    assert.equal(parseProductEvent({ name: 'mission_started', properties: { missionId: 'mission:cafe', entry: 'advert' } }), null);
    assert.equal(parseProductEvent({ name: 'my_french_opened', properties: { situationsDone: -1, linesKept: 2 } }), null);
  });

  test('rejects arbitrary event names', () => {
    assert.equal(parseProductEvent({ name: 'anything_we_felt_like', properties: {} }), null);
  });
});
