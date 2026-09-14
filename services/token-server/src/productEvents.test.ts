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
        properties: { personalisedGreeting: true },
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

  // F116. The client union dropped `motivationAnswered` with the why page and
  // nothing forced the parser to follow, so every onboarding_completed was refused
  // and the funnel went dark. These two tests pin both halves of the new contract:
  // the shape the client actually sends is stored, and the shape it used to send is
  // refused rather than tolerated. A subset check would have made the first pass and
  // the second fail silently, which is why `exactKeys` stays exact.
  test('onboarding_completed is accepted without motivationAnswered', () => {
    assert.deepEqual(
      parseProductEvent({ name: 'onboarding_completed', properties: { personalisedGreeting: true } }),
      { name: 'onboarding_completed', properties: { personalisedGreeting: true } },
    );
    assert.deepEqual(
      parseProductEvent({ name: 'onboarding_completed', properties: { personalisedGreeting: false } }),
      { name: 'onboarding_completed', properties: { personalisedGreeting: false } },
    );
    assert.equal(parseProductEvent({ name: 'onboarding_completed', properties: { personalisedGreeting: 'yes' } }), null);
    assert.equal(parseProductEvent({ name: 'onboarding_completed', properties: {} }), null);
  });

  test('onboarding_completed carrying the retired motivationAnswered key is refused, not trimmed', () => {
    assert.equal(
      parseProductEvent({
        name: 'onboarding_completed',
        properties: { personalisedGreeting: true, motivationAnswered: false },
      }),
      null,
    );
    assert.equal(
      parseProductEvent({ name: 'onboarding_completed', properties: { motivationAnswered: true } }),
      null,
    );
  });

  test('rejects arbitrary event names', () => {
    assert.equal(parseProductEvent({ name: 'anything_we_felt_like', properties: {} }), null);
  });

  test('accepts every measured page in the limit-to-plan journey', () => {
    for (const [index, page] of ['limit', 'map', 'french', 'yours', 'plans'].entries()) {
      assert.deepEqual(
        parseProductEvent({ name: 'wall_page_seen', properties: { page, index } }),
        { name: 'wall_page_seen', properties: { page, index } },
      );
    }
    assert.equal(parseProductEvent({ name: 'wall_page_seen', properties: { page: 'countdown', index: 0 } }), null);
  });
});
