import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPLY_LATENCY_CEILING_MS, REPLY_LATENCY_SAMPLES, createReplyLatencyClock, medianMs } from './replyLatency.ts';

test('the wait runs from the confirmed learner turn to the tutor starting to speak', () => {
  const clock = createReplyLatencyClock();
  clock.learnerTurnConfirmed(1_000);
  assert.equal(clock.tutorStartedSpeaking(2_400), 1_400);
  assert.deepEqual(clock.samples, [1_400]);
});

test('the tutor speaking with no learner turn before it is not a reply', () => {
  const clock = createReplyLatencyClock();
  assert.equal(clock.tutorStartedSpeaking(500), null, 'the opening line and a rescue measure nothing');
  clock.learnerTurnConfirmed(1_000);
  clock.tutorStartedSpeaking(1_500);
  assert.equal(clock.tutorStartedSpeaking(1_900), null, 'a second sentence of the same reply is not a second wait');
  assert.deepEqual(clock.samples, [500]);
});

test('a stall, a clock skew or a reset is never recorded as a reply', () => {
  const clock = createReplyLatencyClock();
  clock.learnerTurnConfirmed(1_000);
  assert.equal(clock.tutorStartedSpeaking(1_000 + REPLY_LATENCY_CEILING_MS + 1), null);
  clock.learnerTurnConfirmed(5_000);
  assert.equal(clock.tutorStartedSpeaking(4_000), null);
  clock.learnerTurnConfirmed(6_000);
  clock.reset();
  assert.equal(clock.tutorStartedSpeaking(7_000), null);
  assert.deepEqual(clock.samples, []);
});

test('only the most recent turns are kept', () => {
  const clock = createReplyLatencyClock();
  for (let i = 0; i < REPLY_LATENCY_SAMPLES + 5; i += 1) {
    clock.learnerTurnConfirmed(i * 10_000);
    clock.tutorStartedSpeaking(i * 10_000 + i);
  }
  assert.equal(clock.samples.length, REPLY_LATENCY_SAMPLES);
  assert.equal(clock.samples[0], 5);
});

test('the median is the middle wait', () => {
  assert.equal(medianMs([]), null);
  assert.equal(medianMs([900]), 900);
  assert.equal(medianMs([5_000, 800, 1_200]), 1_200, 'one slow turn does not drag it');
  assert.equal(medianMs([800, 1_000, 1_200, 9_000]), 1_100);
});
