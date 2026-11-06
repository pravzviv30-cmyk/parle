/**
 * What a learner reads when something throws: Luvani's own sentence, never a
 * code, a URL or a library message.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LearnerError, errorCopy } from './errorCopy.ts';
import { GuestClaimRefused, claimRefusalCopy } from '../onboarding/guestScene.ts';

const CONNECTION = 'The connection dropped. Check your internet and try again.';
const FALLBACK = 'Something went wrong. Try again.';

function named(name: string, message: string): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

describe('errorCopy', () => {
  test('a foreign message never reaches the learner', () => {
    assert.equal(errorCopy(new Error('ECONNRESET at wss://example.livekit.cloud'), FALLBACK), FALLBACK);
    assert.equal(errorCopy(new Error('expired'), FALLBACK), FALLBACK);
  });

  test('a dropped connection gets the connection line', () => {
    assert.equal(errorCopy(new TypeError('Network request failed'), FALLBACK), CONNECTION);
    assert.equal(errorCopy(new Error('Failed to fetch'), FALLBACK), CONNECTION);
    assert.equal(errorCopy(new Error('Load failed'), FALLBACK), CONNECTION);
    assert.equal(errorCopy(new Error('Network request failed'), FALLBACK), CONNECTION);
    assert.equal(errorCopy(new Error('network down'), FALLBACK), CONNECTION);
  });

  test('a code bug is not called a dropped connection', () => {
    assert.equal(errorCopy(new TypeError("Cannot read properties of undefined (reading 'pack')"), FALLBACK), FALLBACK);
  });

  test('a timeout or an abort gets the connection line', () => {
    assert.equal(errorCopy(named('TimeoutError', 'The operation timed out'), FALLBACK), CONNECTION);
    assert.equal(errorCopy(named('AbortError', 'The operation was aborted'), FALLBACK), CONNECTION);
  });

  test('a LearnerError keeps its own sentence', () => {
    assert.equal(errorCopy(new LearnerError('x'), FALLBACK), 'x');
    assert.equal(new LearnerError('x').name, 'LearnerError');
  });

  test('a refused guest claim keeps its copy', () => {
    assert.equal(errorCopy(new GuestClaimRefused('guest-expired'), FALLBACK), claimRefusalCopy('guest-expired'));
  });

  test('a thrown non-Error gets the fallback', () => {
    assert.equal(errorCopy('boom', FALLBACK), FALLBACK);
    assert.equal(errorCopy(undefined, FALLBACK), FALLBACK);
  });
});
