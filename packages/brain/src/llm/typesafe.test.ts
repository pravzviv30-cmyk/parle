/**
 * The TypeSafe client, held to the wire contract on docs.typesafe.ai/api and to
 * the one promise that matters to its callers: an answer it cannot vouch for is
 * an error, never a default.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { FetchLike } from './http.ts';
import { priceUsage } from './pricing.ts';
import { DEFAULT_JEV_MODEL, TypeSafeClient, TypeSafeError, typeSafeFromEnv, type JevQuestion } from './typesafe.ts';

const QUESTIONS: Record<string, JevQuestion> = {
  urgent: { type: 'noul', instructions: 'Does this convey urgency?' },
  team: { type: 'choice', instructions: 'Which team?', criteria: { billing: null, technical: null } },
};

const OK_BODY = {
  model: 'jev-1.13.0',
  answers: {
    urgent: { type: 'noul', noul: 0.95 },
    team: { type: 'choice', choice: 'billing', probabilities: { billing: 0.88, technical: 0.12 }, confidence: 0.81 },
  },
  usage: { input_tokens: 318, output_tokens: 34 },
};

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  signal: AbortSignal | undefined;
}

/** A fetch that answers from a script, one response per call, and records what it was sent. */
function scripted(responses: { status: number; body?: unknown; retryAfter?: string }[]) {
  const sent: Sent[] = [];
  const fetchFn: FetchLike = async (url, init) => {
    sent.push({ url, headers: init.headers, body: JSON.parse(init.body) as Record<string, unknown>, signal: init.signal });
    const next = responses.shift();
    if (next === undefined) throw new Error('no scripted response left');
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      headers: { get: (name: string) => (name === 'retry-after' ? (next.retryAfter ?? null) : null) },
      json: async () => next.body,
    };
  };
  return { fetchFn, sent };
}

const noSleep = async () => undefined;

describe('TypeSafeClient — one System One request', () => {
  test('sends state, a pinned model and the questions to /systemone with the key as a bearer token', async () => {
    const { fetchFn, sent } = scripted([{ status: 200, body: OK_BODY }]);
    const client = new TypeSafeClient({ apiKey: 'ts-key' }, fetchFn, noSleep);

    await client.systemOne({ ticket: 'payouts failing' }, QUESTIONS);

    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(sent[0]!.headers.authorization, 'Bearer ts-key');
    assert.deepEqual(sent[0]!.body, { state: { ticket: 'payouts failing' }, model: DEFAULT_JEV_MODEL, questions: QUESTIONS });
  });

  test('returns typed answers and usage stamped with the versioned model that answered', async () => {
    const { fetchFn } = scripted([{ status: 200, body: OK_BODY }]);
    const result = await new TypeSafeClient({ apiKey: 'k' }, fetchFn, noSleep).systemOne('s', QUESTIONS);

    assert.equal(result.model, 'jev-1.13.0');
    assert.deepEqual(result.answers.urgent, { type: 'noul', noul: 0.95 });
    assert.deepEqual(result.usage, { inputTokens: 318, outputTokens: 34, cacheReadTokens: 0, cacheWriteTokens: 0, model: 'jev-1.13.0' });
  });

  test('a Jev usage prices exactly, input only, output free', async () => {
    const priced = priceUsage({ inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0, model: 'jev-1.13.0' });
    assert.equal(priced.exact, true);
    assert.equal(priced.usd, 0.042);
  });

  test('a question left unanswered is an error, never a default', async () => {
    const { answers, ...rest } = OK_BODY;
    const { fetchFn } = scripted([{ status: 200, body: { ...rest, answers: { urgent: answers.urgent } } }]);
    await assert.rejects(new TypeSafeClient({ apiKey: 'k' }, fetchFn, noSleep).systemOne('s', QUESTIONS), /did not answer "team"/);
  });

  test('an answer of the wrong type is an error', async () => {
    const { fetchFn } = scripted([
      { status: 200, body: { ...OK_BODY, answers: { ...OK_BODY.answers, urgent: OK_BODY.answers.team } } },
    ]);
    await assert.rejects(new TypeSafeClient({ apiKey: 'k' }, fetchFn, noSleep).systemOne('s', QUESTIONS), /"urgent" as a noul/);
  });

  test('a body that is not a System One response is an error', async () => {
    const { fetchFn } = scripted([{ status: 200, body: { answers: 'yes' } }]);
    await assert.rejects(new TypeSafeClient({ apiKey: 'k' }, fetchFn, noSleep).systemOne('s', QUESTIONS));
  });

  test('a failed status throws the status and nothing from the body', async () => {
    const { fetchFn } = scripted([{ status: 422, body: { detail: 'learner_attempt: Je voudrais un café' } }]);
    await assert.rejects(new TypeSafeClient({ apiKey: 'k' }, fetchFn, noSleep).systemOne('s', QUESTIONS), (error: unknown) => {
      assert.ok(error instanceof TypeSafeError);
      assert.equal(error.status, 422);
      assert.doesNotMatch(error.message, /café/);
      return true;
    });
  });

  for (const status of [429, 529]) {
    test(`${status} earns exactly one capped retry`, async () => {
      const waits: number[] = [];
      const { fetchFn, sent } = scripted([{ status, retryAfter: '30' }, { status: 200, body: OK_BODY }]);
      const client = new TypeSafeClient({ apiKey: 'k' }, fetchFn, async (ms) => {
        waits.push(ms);
      });

      const result = await client.systemOne('s', QUESTIONS);
      assert.equal(result.model, 'jev-1.13.0');
      assert.equal(sent.length, 2);
      assert.deepEqual(waits, [2_000], 'the realtime cap from http.ts, not the thirty seconds asked for');
    });
  }

  test('a second rate limit is a real answer and fails', async () => {
    const { fetchFn, sent } = scripted([{ status: 429 }, { status: 429 }]);
    await assert.rejects(new TypeSafeClient({ apiKey: 'k' }, fetchFn, noSleep).systemOne('s', QUESTIONS), TypeSafeError);
    assert.equal(sent.length, 2);
  });

  test('the abort signal reaches the wire', async () => {
    const { fetchFn, sent } = scripted([{ status: 200, body: OK_BODY }]);
    const controller = new AbortController();
    await new TypeSafeClient({ apiKey: 'k' }, fetchFn, noSleep).systemOne('s', QUESTIONS, controller.signal);
    assert.equal(sent[0]!.signal, controller.signal);
  });
});

describe('typeSafeFromEnv — off unless the key is really there', () => {
  test('no key, no client', () => {
    assert.equal(typeSafeFromEnv({}), null);
  });

  test('the empty line a copied .env.example leaves is read as unset', () => {
    assert.equal(typeSafeFromEnv({ TYPESAFE_API_KEY: '   ' }), null);
  });

  test('a key builds a client on the pinned model, and TYPESAFE_MODEL moves it', () => {
    assert.equal(typeSafeFromEnv({ TYPESAFE_API_KEY: 'k' })?.model, DEFAULT_JEV_MODEL);
    assert.equal(typeSafeFromEnv({ TYPESAFE_API_KEY: 'k', TYPESAFE_MODEL: '' })?.model, DEFAULT_JEV_MODEL);
    assert.equal(typeSafeFromEnv({ TYPESAFE_API_KEY: 'k', TYPESAFE_MODEL: 'jev-latest' })?.model, 'jev-latest');
  });
});

test('an aborted TypeSafe retry wait sends no second request', async () => {
  const controller = new AbortController();
  const {fetchFn,sent} = scripted([{status:429},{status:200,body:OK_BODY}]);
  const client = new TypeSafeClient({apiKey:'invented-not-sent'},fetchFn,async()=>{controller.abort();});
  await assert.rejects(client.systemOne('s',QUESTIONS,controller.signal));assert.equal(sent.length,1);
  const before = scripted([{status:200,body:OK_BODY}]);
  await assert.rejects(new TypeSafeClient({apiKey:'invented-not-sent'},before.fetchFn,noSleep).systemOne('s',QUESTIONS,controller.signal));
  assert.equal(before.sent.length,0);
});
