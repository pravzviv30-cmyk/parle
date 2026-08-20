import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createTurnTiming, formatTiming, mark } from './timing.ts';

describe('turn timing', () => {
  test('a fully marked turn prints every segment in chronological order', () => {
    const t = createTurnTiming(3);
    mark(t, 'eou', 1000);
    mark(t, 'brainSent', 1120);
    mark(t, 'brainParsed', 2100);
    mark(t, 'sayCalled', 2110);
    mark(t, 'firstAudio', 2320);
    mark(t, 'speaking', 2350);
    t.cache = 'miss';

    assert.equal(
      formatTiming(t),
      '[parle:latency] turn=3 eou→brain=120ms brain=980ms brain→say=10ms say→audio=210ms audio→speaking=30ms cache=miss',
    );
  });

  test('segments with a missing endpoint are omitted, not printed as zero', () => {
    const t = createTurnTiming(1);
    mark(t, 'eou', 500);
    mark(t, 'brainSent', 650);
    // brainParsed never happens: the brain segment and brain→say must both vanish.
    mark(t, 'sayCalled', 700);
    mark(t, 'firstAudio', 900);
    t.cache = 'hit';

    assert.equal(formatTiming(t), '[parle:latency] turn=1 eou→brain=150ms say→audio=200ms cache=hit');
  });

  test('a turn with no marks and no cache still identifies itself', () => {
    assert.equal(formatTiming(createTurnTiming(7)), '[parle:latency] turn=7');
  });

  test('segments come from timestamps, not from the order marks were made', () => {
    const t = createTurnTiming(2);
    // Marked out of order, as racing callbacks may: the arithmetic must not care.
    mark(t, 'firstAudio', 2320);
    mark(t, 'eou', 1000);
    mark(t, 'sayCalled', 2110);
    mark(t, 'brainSent', 1120);

    assert.equal(formatTiming(t), '[parle:latency] turn=2 eou→brain=120ms say→audio=210ms');
  });

  test('the first mark for a stage wins; later ones are ignored', () => {
    const t = createTurnTiming(4);
    mark(t, 'sayCalled', 100);
    mark(t, 'firstAudio', 250);
    // A second sentence's first frame arrives later and must not move the mark.
    mark(t, 'firstAudio', 900);

    assert.equal(formatTiming(t), '[parle:latency] turn=4 say→audio=150ms');
  });

  test('cache is only printed once it is known', () => {
    const t = createTurnTiming(5);
    assert.ok(!formatTiming(t).includes('cache='));
    t.cache = 'hit';
    assert.ok(formatTiming(t).endsWith('cache=hit'));
  });
});
