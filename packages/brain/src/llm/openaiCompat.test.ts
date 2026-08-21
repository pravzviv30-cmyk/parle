import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { OpenAiCompatBrainClient } from './openaiCompat.ts';
import type { BrainTurnRequest } from './client.ts';
import { sampleTurn } from '../contract/samples.ts';

const REQUEST: BrainTurnRequest = {
  kind: 'turn',
  system: { persona: 'persona', pack: 'pack', contract: 'contract' },
  messages: [{ role: 'user', text: 'Un café, s’il vous plaît' }],
};

/** One fake HTTP response, headers included so Retry-After can be read. */
function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  };
}

/** A well-formed completion carrying a contract-shaped turn. */
function completion() {
  return {
    choices: [{ message: { content: JSON.stringify(sampleTurn()) } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 },
  };
}

/**
 * A client whose transport and whose waiting are both under the test's control,
 * so the rate-limit path can be exercised without anyone actually waiting.
 */
function clientOver(responses: ReturnType<typeof reply>[]) {
  const waited: number[] = [];
  let calls = 0;
  const fetchFn = async () => {
    const next = responses[Math.min(calls, responses.length - 1)]!;
    calls += 1;
    return next;
  };
  const sleep = async (ms: number) => {
    waited.push(ms);
  };
  const client = new OpenAiCompatBrainClient({ apiKey: 'test-key' }, fetchFn as never, sleep);
  return { client, waited, callCount: () => calls };
}

describe('a rate-limited turn waits and tries once more — the learner is standing in the silence', () => {
  test('a learner whose turn hits the free tier’s limit still gets an answer', async () => {
    const { client, callCount } = clientOver([
      reply(429, {}, { 'retry-after': '0.2' }),
      reply(200, completion()),
    ]);

    const { turn } = await client.turn(REQUEST);

    assert.equal(
      turn.sceneReply.speaker,
      'Karim',
      'a burst of 429s should cost a moment, not the turn: without the retry the tutor falls back to a canned line and the learner’s sentence goes unanswered',
    );
    assert.equal(callCount(), 2, 'exactly one more attempt was made, not a storm of them');
  });

  test('the wait is the one the vendor actually asked for', async () => {
    const { client, waited } = clientOver([
      reply(429, {}, { 'retry-after': '1.5' }),
      reply(200, completion()),
    ]);

    await client.turn(REQUEST);

    assert.deepEqual(
      waited,
      [1500],
      'Retry-After is the vendor telling us when it will answer; retrying sooner earns a second 429 and burns the learner’s turn for nothing',
    );
  });

  test('a long wait is capped, because nobody stares at a silent tutor for thirty seconds', async () => {
    const { client, waited, callCount } = clientOver([
      reply(429, {}, { 'retry-after': '30' }),
      reply(200, completion()),
    ]);

    await client.turn(REQUEST);

    assert.deepEqual(
      waited,
      [2000],
      'this is the realtime path: past a couple of seconds the silence is worse than the fallback line, so we try once at the cap and take the answer we get',
    );
    assert.equal(callCount(), 2, 'the cap shortens the wait; it does not cancel the retry');
  });

  test('a vendor that names no wait, or names nonsense, still gets one short pause', async () => {
    for (const header of [null, '', 'Wed, 21 Oct 2015 07:28:00 GMT', '-3', 'soon']) {
      const { client, waited } = clientOver([
        reply(429, {}, header === null ? {} : { 'retry-after': header }),
        reply(200, completion()),
      ]);

      await client.turn(REQUEST);

      assert.deepEqual(
        waited,
        [500],
        `a Retry-After of ${JSON.stringify(header)} tells us nothing usable, so we pause briefly rather than hammering the endpoint that just refused us`,
      );
    }
  });

  test('a second refusal ends the turn exactly as it did before', async () => {
    const { client, callCount } = clientOver([reply(429, {}, { 'retry-after': '0' })]);

    await assert.rejects(
      () => client.turn(REQUEST),
      /Chat completion failed with status 429/,
      'the failure the caller sees is unchanged, so the tutor’s existing fallback still catches it — this buys back the recoverable turns and nothing more',
    );
    assert.equal(callCount(), 2, 'one retry, then the truth: a second 429 is a real answer, not something to keep asking about');
  });

  test('only the rate limit earns a second try; a broken gateway fails at once', async () => {
    const { client, waited, callCount } = clientOver([reply(502, {})]);

    await assert.rejects(
      () => client.turn(REQUEST),
      /Chat completion failed with status 502/,
      'a 502 is not a queueing signal, and retrying it spends the learner’s silence on a guess',
    );
    assert.equal(callCount(), 1, 'this is one narrow accommodation for a known free-tier behaviour, not a general retry policy');
    assert.deepEqual(waited, [], 'nothing was waited for');
  });
});
