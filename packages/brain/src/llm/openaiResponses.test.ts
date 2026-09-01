import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { sampleTurn } from '../contract/samples.ts';
import { TurnSchema } from '../contract/schemas.ts';
import { CAFE_FRAME } from '../fixtures.ts';
import type { BrainTurnRequest } from './client.ts';
import {
  DEFAULT_OPENAI_ANALYST_MODEL,
  DEFAULT_OPENAI_TURN_MODEL,
  OpenAiResponsesBrainClient,
  type OpenAiResponsesConfig,
} from './openaiResponses.ts';
import { DEFAULT_ROUTING, isAnalystActivity, resolveRouting, type BrainActivity } from './routing.ts';

const REQUEST: BrainTurnRequest = {
  kind: 'turn',
  system: { persona: 'new persona', pack: 'french pack', contract: 'turn contract' },
  messages: [
    { role: 'user', text: 'scene' },
    { role: 'assistant', text: 'Bonjour !' },
    { role: 'user', text: 'Hello' },
    { role: 'system', text: 'private app context' },
  ],
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

/** A completed Responses answer carrying whatever the contract expects. */
function responseFor(value: unknown) {
  return reply(200, {
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      input_tokens_details: { cached_tokens: 20, cache_write_tokens: 5 },
    },
  });
}

/**
 * A client whose transport and whose waiting are both under the test's control,
 * so the rate-limit path can be exercised without anyone actually waiting and
 * every request body can be read back.
 */
function clientOver(responses: ReturnType<typeof reply>[], config: Partial<OpenAiResponsesConfig> = {}) {
  const bodies: Record<string, unknown>[] = [];
  const waited: number[] = [];
  let calls = 0;
  const fetchFn = async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body) as Record<string, unknown>);
    const next = responses[Math.min(calls, responses.length - 1)]!;
    calls += 1;
    return next;
  };
  const sleep = async (ms: number) => {
    waited.push(ms);
  };
  const client = new OpenAiResponsesBrainClient({ apiKey: 'test', ...config }, fetchFn as never, sleep);
  return { client, bodies, waited, callCount: () => calls };
}

/**
 * Ask one activity and hand back the request it sent.
 *
 * Only `turn` and `frame` have a fixture that satisfies their schema. The other
 * three are asked with a body that cannot parse, because what is under test is
 * the request, and the request is captured before the answer is read.
 */
async function bodyFor(activity: BrainActivity, config: Partial<OpenAiResponsesConfig> = {}) {
  const answer = activity === 'turn' ? sampleTurn() : activity === 'frame' ? CAFE_FRAME : {};
  const { client, bodies } = clientOver([responseFor(answer)], config);
  const ask = {
    turn: () => client.turn(REQUEST),
    frame: () => client.frame({ kind: 'frame', system: REQUEST.system, request: 'school teacher' }),
    extract: () => client.extract({ kind: 'extract', system: REQUEST.system, request: 'what was learned' }),
    drills: () => client.drills({ kind: 'drills', system: REQUEST.system, request: 'author practice' }),
    curate: () => client.curate({ kind: 'curate', system: REQUEST.system, request: 'group the phrases' }),
  }[activity];
  await ask().catch(() => undefined);
  return bodies[0]!;
}

describe('OpenAI Responses brain — the wire it speaks', () => {
  test('uses Luna for a live turn, strict structured output, and a developer channel for app context', async () => {
    const { client, bodies } = clientOver([responseFor(sampleTurn())]);

    const { turn, usage } = await client.turn(REQUEST);

    const body = bodies[0]!;
    assert.equal(turn.sceneReply.fr, 'Ça marche, un café !');
    assert.equal(body.model, DEFAULT_OPENAI_TURN_MODEL);
    assert.equal((body.reasoning as { effort: string }).effort, 'low');
    assert.equal((body.text as { format: { type: string; strict: boolean } }).format.type, 'json_schema');
    assert.equal((body.text as { format: { type: string; strict: boolean } }).format.strict, true);
    assert.equal((body.input as { role: string }[]).at(-1)!.role, 'developer');
    // 100 input_tokens on this API already contains the 20 read and the 5
    // written, so the uncached remainder is 75. See usageAccounting.test.ts.
    assert.deepEqual(usage, {
      inputTokens: 75,
      outputTokens: 50,
      cacheReadTokens: 20,
      cacheWriteTokens: 5,
      model: DEFAULT_OPENAI_TURN_MODEL,
    });
  });

  test('a refusal remains distinguishable from malformed JSON', async () => {
    const { client, callCount } = clientOver([reply(200, { output: [{ content: [{ type: 'refusal', refusal: 'No.' }] }] })]);

    await assert.rejects(() => client.turn(REQUEST), { name: 'BrainRefusalError' });

    // Also the proof the rate-limit retry cannot swallow a refusal: a refusal is
    // a 200, so it must never reach the second attempt.
    assert.equal(callCount(), 1, 'a refusal is an answer, not something to retry');
  });

  test("a truncated answer says it was truncated instead of blaming the model's JSON", async () => {
    const { client } = clientOver([
      reply(200, {
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
        output: [],
        usage: { input_tokens: 10, output_tokens: 4000 },
      }),
    ]);

    await assert.rejects(
      () => client.curate({ kind: 'curate', system: REQUEST.system, request: 'group the phrases' }),
      (error: Error) => {
        assert.equal(error.name, 'BrainParseError');
        assert.match(
          error.message,
          /max_output_tokens/,
          'reasoning tokens count against the cap, so a size limit must not read as bad JSON',
        );
        return true;
      },
    );
  });
});

describe('OpenAI Responses brain — which model answers, and how hard it thinks', () => {
  test('the scene a learner waits through is designed by the fast model, not the analyst', async () => {
    const body = await bodyFor('frame');

    assert.equal(
      body.model,
      DEFAULT_OPENAI_TURN_MODEL,
      'the learner hears the bridge line while the scene is built, so frame is a call somebody waits through',
    );
  });

  test('the two calls that write load-bearing pedagogy go to the analyst', async () => {
    for (const activity of ['extract', 'drills'] as const) {
      const body = await bodyFor(activity);
      assert.equal(body.model, DEFAULT_OPENAI_ANALYST_MODEL, `${activity} shapes every later session, so it gets the careful model`);
    }
  });

  test('curation is served by the tier routing.ts assigns it, not by who is waiting', async () => {
    // F104. "Nobody is waiting" and "this needs the careful model" are different
    // questions, and this adapter used to answer the second with the first. It
    // agreed for four activities and was wrong for curate, which routing.ts puts
    // on the cheap tier on purpose: a ranking task over material already in hand.
    // Measured, the disagreement cost $0.0130 a session for 199 output tokens.
    const body = await bodyFor('curate');

    assert.equal(isAnalystActivity('curate'), false, 'routing.ts is the source of truth for the tier');
    assert.equal(body.model, DEFAULT_OPENAI_TURN_MODEL, 'so curate must be served by the fast, cheap model');
  });

  test('every activity is served by the tier its route names, with no second table to disagree', async () => {
    // The invariant that stops F104 recurring: whatever routing.ts decides, the
    // wire follows. A future adapter-local shortcut fails here, not in a bill.
    for (const activity of Object.keys(DEFAULT_ROUTING) as BrainActivity[]) {
      const body = await bodyFor(activity);
      const expected = isAnalystActivity(activity) ? DEFAULT_OPENAI_ANALYST_MODEL : DEFAULT_OPENAI_TURN_MODEL;
      assert.equal(body.model, expected, `${activity} must be served by the tier routing.ts assigns it`);
    }
  });

  test('every activity thinks as hard as the routing table says, not as hard as this adapter guessed', async () => {
    for (const activity of Object.keys(DEFAULT_ROUTING) as BrainActivity[]) {
      const body = await bodyFor(activity);
      assert.equal(
        (body.reasoning as { effort: string } | undefined)?.effort,
        DEFAULT_ROUTING[activity].effort,
        `${activity} must think as hard on OpenAI as it does on Claude`,
      );
    }
  });

  test('BRAIN_EFFORT moves the OpenAI arm exactly as it moves the Claude arm', async () => {
    const body = await bodyFor('turn', { routing: resolveRouting({ BRAIN_EFFORT: 'high' }) });

    assert.equal(
      (body.reasoning as { effort: string }).effort,
      'high',
      'the one dev knob has to answer the same whichever provider is serving',
    );
  });

  test("a route with no effort of its own leaves the vendor's default alone", async () => {
    const routing = { ...DEFAULT_ROUTING, turn: { ...DEFAULT_ROUTING.turn, effort: undefined } };

    const body = await bodyFor('turn', { routing });

    assert.ok(
      !('reasoning' in body),
      'an undefined effort means say nothing about effort — an empty reasoning object is a different sentence',
    );
  });

  test('every call is sized by the routing table, so one table answers how much room a call gets', async () => {
    for (const activity of Object.keys(DEFAULT_ROUTING) as BrainActivity[]) {
      const body = await bodyFor(activity);
      assert.equal(
        body.max_output_tokens,
        DEFAULT_ROUTING[activity].maxTokens,
        `${activity} was sized by a private table that had already drifted from this one`,
      );
    }
  });
});

describe('a rate-limited OpenAI call waits and tries once more — the learner is standing in the silence', () => {
  test('a learner whose turn is rate limited still gets an answer', async () => {
    const { client, callCount } = clientOver([
      reply(429, { error: { message: 'Rate limit reached' } }, { 'retry-after': '0.2' }),
      responseFor(sampleTurn()),
    ]);

    const { turn } = await client.turn(REQUEST);

    assert.equal(turn.sceneReply.fr, 'Ça marche, un café !', 'the sentence the learner just said deserves the second try');
    assert.equal(callCount(), 2);
  });

  test('the wait is the one OpenAI actually asked for, and it is capped', async () => {
    const asked = clientOver([reply(429, {}, { 'retry-after': '1.5' }), responseFor(sampleTurn())]);
    await asked.client.turn(REQUEST);
    assert.deepEqual(asked.waited, [1500], 'a delay inside the budget is honoured as asked');

    const greedy = clientOver([reply(429, {}, { 'retry-after': '30' }), responseFor(sampleTurn())]);
    await greedy.client.turn(REQUEST);
    assert.deepEqual(greedy.waited, [2000], 'thirty seconds of silence is worse than the fallback line');
    assert.equal(greedy.callCount(), 2, 'we try once at the cap anyway rather than giving up');
  });

  test('a rate limit with no usable Retry-After still earns one short pause', async () => {
    for (const header of [null, '', 'Wed, 21 Oct 2015 07:28:00 GMT', '-3', 'soon']) {
      const headers: Record<string, string> = header === null ? {} : { 'retry-after': header };
      const { client, waited } = clientOver([reply(429, {}, headers), responseFor(sampleTurn())]);

      await client.turn(REQUEST);

      assert.deepEqual(waited, [500], `Retry-After ${JSON.stringify(header)} reads as nothing usable, not as a wrong number`);
    }
  });

  test('a second rate limit ends the call exactly as it did before', async () => {
    const { client, callCount, waited } = clientOver([reply(429, { error: { message: 'Rate limit reached' } })]);

    await assert.rejects(() => client.turn(REQUEST), /Rate limit reached/);

    assert.equal(callCount(), 2, 'exactly one retry — a second 429 is a real answer');
    assert.deepEqual(waited, [500]);
  });

  test('only the rate limit earns a second try; a bad request fails at once', async () => {
    const { client, callCount, waited } = clientOver([reply(400, { error: { message: 'Invalid schema' } })]);

    await assert.rejects(() => client.turn(REQUEST), /Invalid schema/);

    assert.equal(callCount(), 1, 'a rejected request will be rejected again; waiting only spends the learner’s silence');
    assert.deepEqual(waited, [], 'nothing to wait for');
  });
});

describe('the prompt cache is pinned, not left to the vendor to guess', () => {
  test('every responses call pins its cache with a stable per-activity prompt_cache_key', async () => {
    for (const activity of Object.keys(DEFAULT_ROUTING) as BrainActivity[]) {
      const first = await bodyFor(activity);
      const second = await bodyFor(activity);

      assert.equal(
        typeof first.prompt_cache_key,
        'string',
        `${activity} sends a ~4.3k frozen prefix every call; without a key the routing that shares it is a coin toss`,
      );
      assert.match(first.prompt_cache_key as string, new RegExp(`^luvani-${activity}-[0-9a-f]{6,}$`));
      assert.equal(
        first.prompt_cache_key,
        second.prompt_cache_key,
        'the point is that two sessions, and two learners, land on the same cached prefix',
      );
    }
  });

  test('two activities that share a prefix still get keys of their own', async () => {
    const turn = await bodyFor('turn');
    const frame = await bodyFor('frame');

    assert.notEqual(turn.prompt_cache_key, frame.prompt_cache_key, 'a turn and a frame are different prompt shapes');
  });

  test('the cache key changes when the frozen prompt changes', async () => {
    const before = await bodyFor('turn');

    const { client, bodies } = clientOver([responseFor(sampleTurn())]);
    await client.turn({ ...REQUEST, system: { ...REQUEST.system, persona: 'a different persona entirely' } });

    assert.notEqual(
      bodies[0]!.prompt_cache_key,
      before.prompt_cache_key,
      'a key naming a prefix that no longer exists is worse than no key: it pins traffic to a miss',
    );
  });

  test('the realtime turn request changes by exactly one field: prompt_cache_key', async () => {
    // The founder's constraint on this work was no latency regression, and the
    // wire is where that is either true or not. Anything else new in this body
    // — a stream flag, a previous_response_id, a store — is a change to what
    // the model does, not to how its cache is addressed.
    const body = await bodyFor('turn');
    const { prompt_cache_key: key, ...rest } = body;

    assert.deepEqual(rest, {
      model: DEFAULT_OPENAI_TURN_MODEL,
      instructions: [REQUEST.system.persona, REQUEST.system.pack, REQUEST.system.contract].join('\n\n'),
      input: [
        { role: 'user', content: 'scene' },
        { role: 'assistant', content: 'Bonjour !' },
        { role: 'user', content: 'Hello' },
        { role: 'developer', content: 'private app context' },
      ],
      reasoning: { effort: DEFAULT_ROUTING.turn.effort },
      max_output_tokens: DEFAULT_ROUTING.turn.maxTokens,
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'luvani_tutor_turn',
          strict: true,
          schema: (zodOutputFormat(TurnSchema) as { schema?: unknown }).schema,
        },
      },
    });
    assert.equal(typeof key, 'string');
  });
});
