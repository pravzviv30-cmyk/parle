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

  test('the wall accepts the launch and locked doors and no others (D24)', () => {
    for (const entry of ['path-complete', 'refused', 'settings', 'recap', 'launch', 'locked']) {
      assert.notEqual(parseProductEvent({ name: 'wall_shown', properties: { entry, pages: 4 } }), null, `wall_shown refused the ${entry} door`);
      assert.notEqual(
        parseProductEvent({ name: 'wall_left', properties: { entry, outcome: 'unchanged', destination: 'back' } }),
        null,
        `wall_left refused the ${entry} door`,
      );
    }
    assert.equal(parseProductEvent({ name: 'wall_shown', properties: { entry: 'banner', pages: 4 } }), null);
    assert.equal(parseProductEvent({ name: 'wall_left', properties: { entry: 'banner', outcome: 'unchanged', destination: 'back' } }), null);
  });

  test('live_session_finished carries counts and closed choices, and nothing else', () => {
    const ok = { kind: 'convo', voice: true, turns: 9, rescues: 2, unassistedPct: 44, replyLatencyMs: 2311 };
    assert.deepEqual(parseProductEvent({ name: 'live_session_finished', properties: ok }), { name: 'live_session_finished', properties: ok });
    assert.notEqual(parseProductEvent({ name: 'live_session_finished', properties: { ...ok, replyLatencyMs: null } }), null, 'an unmeasured wait is allowed');
    for (const bad of [
      { ...ok, kind: 'scene' },
      { ...ok, voice: 'yes' },
      { ...ok, turns: 2.5 },
      { ...ok, rescues: -1 },
      { ...ok, unassistedPct: 101 },
      { ...ok, replyLatencyMs: 45_000 },
      { ...ok, goal: 'moving' },
      { ...ok, transcript: 'Un café' },
    ]) assert.equal(parseProductEvent({ name: 'live_session_finished', properties: bad }), null, JSON.stringify(bad));
  });

  test('rejects arbitrary event names', () => {
    assert.equal(parseProductEvent({ name: 'anything_we_felt_like', properties: {} }), null);
  });
});
