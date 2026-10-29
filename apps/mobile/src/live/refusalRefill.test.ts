import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { refillWhen } from '@luvani/core';

import { refusalRefill, refusalWords } from './refusalRefill.ts';

const TABLE = { label: 'Out of minutes', message: 'The table sentence.' };

describe('the refill a 402 names', () => {
  it('says a valid refillsAt as a day and a time on this phone', () => {
    const at = '2026-10-29T16:10:00.000Z';
    assert.equal(refusalRefill({ error: 'exhausted', refillsAt: at }), refillWhen(new Date(at)));
    assert.match(refusalRefill({ refillsAt: at }) ?? '', /^on \w+day at \d{1,2}:\d{2} [ap]m$/);
  });

  it('says nothing about time without a usable instant', () => {
    for (const body of [null, undefined, {}, { refillsAt: '' }, { refillsAt: 'soon' }, { refillsAt: 1761754200000 }, 'x']) {
      assert.equal(refusalRefill(body), null);
    }
  });

  it('keeps the table sentence when the time is unknown, and never the server prose', () => {
    assert.deepEqual(refusalWords(TABLE, 'exhausted', {}), TABLE);
    assert.deepEqual(refusalWords(TABLE, 'exhausted', { refillsAt: 'soon' }), TABLE);
    const at = '2026-10-29T16:10:00.000Z';
    assert.deepEqual(refusalWords(TABLE, 'subscription-lapsed', { refillsAt: at }), TABLE, 'a lapse kept its own sentence');
    // A fixed clock an hour before the refill, so the test never depends on today's date.
    const words = refusalWords(TABLE, 'exhausted', { refillsAt: at }, Date.parse(at) - 3_600_000);
    assert.equal(words.label, "You've used your free conversation");
    assert.equal(words.message, `Your next free conversation is ready ${refillWhen(new Date(at))}. Until then, practise offline.`);
    assert.doesNotMatch(`${words.label} ${words.message}`, /—|week|take your time|sorry/i);
  });
});
