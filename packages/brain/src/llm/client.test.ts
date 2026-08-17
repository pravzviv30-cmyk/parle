import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AnthropicBrainClient, type ParseCapableSdk } from './anthropic.ts';
import { OpenAiCompatBrainClient } from './openaiCompat.ts';
import { MockLlmClient } from './mock.ts';
import { DEFAULT_ROUTING, resolveRouting, type BrainRouting } from './routing.ts';
import { BrainParseError, BrainRefusalError, type BrainTurnRequest } from './client.ts';
import { createConversation, prepareTurn } from '../engine/conversation.ts';
import { CAFE_FRAME, APERO_FRAME } from '../fixtures.ts';
import { sampleTurn } from '../contract/samples.ts';
import { buildSystemBlocks } from '../prompt/system.ts';

function turnRequest(): BrainTurnRequest {
  const state = createConversation(
    CAFE_FRAME,
    { cefr: 'A2', confidence: 'low', watchFor: [], lastRung: null, sessions: 0 },
    { strictness: 'balanced', maxTurns: 24 },
    1_000,
  );
  return prepareTurn(state, { type: 'spoke', text: 'Bonjour !' });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;

function fakeSdk(responses: unknown[]): { sdk: ParseCapableSdk; calls: AnyRecord[] } {
  const calls: AnyRecord[] = [];
  const queue = [...responses];
  return {
    calls,
    sdk: {
      messages: {
        parse: async (params: never) => {
          calls.push(params as AnyRecord);
          return queue.shift();
        },
      },
    },
  };
}

function okResponse(parsed: unknown = sampleTurn()): AnyRecord {
  return {
    parsed_output: parsed,
    stop_reason: 'end_turn',
    content: [],
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 80, cache_creation_input_tokens: 10 },
  };
}

function nullResponse(): AnyRecord {
  return { parsed_output: null, stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }], usage: {} };
}

describe('AnthropicBrainClient — request shape', () => {
  test('a turn call rides the talker route: fast model, low effort, no sampling params, no thinking config', async () => {
    const { sdk, calls } = fakeSdk([okResponse()]);
    await new AnthropicBrainClient({}, sdk).turn(turnRequest());

    const params = calls[0]!;
    assert.equal(params.model, DEFAULT_ROUTING.turn.model);
    assert.equal(params.max_tokens, DEFAULT_ROUTING.turn.maxTokens);
    assert.equal(params.output_config.effort, 'low');
    assert.ok(!('temperature' in params), 'temperature is rejected by this model family');
    assert.ok(!('top_p' in params), 'top_p is rejected by this model family');
    assert.ok(!('thinking' in params), 'thinking is on by default; the param stays home');
    assert.ok(params.output_config.format, 'structured outputs must be requested');
  });

  test('cache breakpoints sit on the pack, the contract, and the newest learner message', async () => {
    const { sdk, calls } = fakeSdk([okResponse()]);
    await new AnthropicBrainClient({}, sdk).turn(turnRequest());

    const params = calls[0]!;
    assert.equal(params.system.length, 3);
    assert.equal(params.system[0].cache_control, undefined, 'persona needs no breakpoint of its own');
    assert.deepEqual(params.system[1].cache_control, { type: 'ephemeral' });
    assert.deepEqual(params.system[2].cache_control, { type: 'ephemeral' });

    const messages: AnyRecord[] = params.messages;
    const cached = messages.filter((m) => m.content.some((c: AnyRecord) => c.cache_control));
    assert.equal(cached.length, 1, 'exactly one message-side breakpoint');
    // The newest LEARNER message carries it — never the trailing app context,
    // which must stay past the breakpoint so its churn cannot cost the prefix.
    const last = messages[messages.length - 1]!;
    assert.match(last.content[0].text, /^\[CONTEXT FROM THE APP/);
    assert.equal(last.content[0].cache_control, undefined);
    assert.ok(messages[messages.length - 2]!.content[0].cache_control, 'the breakpoint rides the newest learner message');
  });

  test('on the talker route the app context is folded to a tagged user message — Sonnet rejects the system role', async () => {
    const { sdk, calls } = fakeSdk([okResponse()]);
    await new AnthropicBrainClient({}, sdk).turn(turnRequest());

    const messages: AnyRecord[] = calls[0]!.messages;
    assert.ok(messages.every((m) => m.role !== 'system'), 'no mid-conversation system role may reach this model');
    const last = messages[messages.length - 1]!;
    assert.equal(last.role, 'user');
    assert.match(last.content[0].text, /^\[CONTEXT FROM THE APP/);
    assert.equal(last.content[0].cache_control, undefined, 'the volatile context must stay after the breakpoint');
  });

  test('a route that supports it keeps the system role — the non-spoofable channel', async () => {
    const routing: BrainRouting = {
      ...DEFAULT_ROUTING,
      turn: { ...DEFAULT_ROUTING.turn, model: 'claude-opus-5', midConversationSystem: true },
    };
    const { sdk, calls } = fakeSdk([okResponse()]);
    await new AnthropicBrainClient({ routing }, sdk).turn(turnRequest());

    const messages: AnyRecord[] = calls[0]!.messages;
    const last = messages[messages.length - 1]!;
    assert.equal(last.role, 'system');
    assert.match(last.content[0].text, /^\[CONTEXT FROM THE APP/);
  });

  test('blunt config overrides move every route; a route may also decline effort entirely', async () => {
    const withEffort = fakeSdk([okResponse()]);
    await new AnthropicBrainClient({ effort: 'medium' }, withEffort.sdk).turn(turnRequest());
    assert.equal(withEffort.calls[0]!.output_config.effort, 'medium');

    const routing: BrainRouting = { ...DEFAULT_ROUTING, turn: { ...DEFAULT_ROUTING.turn, effort: undefined } };
    const without = fakeSdk([okResponse()]);
    await new AnthropicBrainClient({ routing }, without.sdk).turn(turnRequest());
    assert.ok(!('effort' in without.calls[0]!.output_config));
  });

  test('a frame call reuses persona + pack only, so the prefix cache still hits', async () => {
    const { sdk, calls } = fakeSdk([okResponse(APERO_FRAME)]);
    const result = await new AnthropicBrainClient({}, sdk).frame({
      kind: 'frame',
      system: buildSystemBlocks(),
      request: 'Design a scene: drinks with friends.',
    });

    const params = calls[0]!;
    assert.equal(params.model, DEFAULT_ROUTING.frame.model);
    assert.equal(params.output_config.effort, 'medium');
    assert.equal(params.system.length, 2);
    assert.deepEqual(params.system[1].cache_control, { type: 'ephemeral' });
    assert.equal(result.frame.title, APERO_FRAME.title);
  });
});

describe('routing', () => {
  test('the table splits talker from analyst', () => {
    assert.equal(DEFAULT_ROUTING.turn.model, 'claude-sonnet-5');
    assert.equal(DEFAULT_ROUTING.frame.model, 'claude-sonnet-5');
    assert.equal(DEFAULT_ROUTING.extract.model, 'claude-opus-5');
    assert.equal(DEFAULT_ROUTING.drills.model, 'claude-opus-5');
    // The one fact call sites must never re-derive from a model name.
    assert.equal(DEFAULT_ROUTING.turn.midConversationSystem, false);
    assert.equal(DEFAULT_ROUTING.extract.midConversationSystem, true);
  });

  test('BRAIN_EFFORT moves every activity at once; junk values change nothing', () => {
    const routed = resolveRouting({ BRAIN_EFFORT: 'high' });
    for (const activity of ['turn', 'frame', 'extract', 'drills'] as const) {
      assert.equal(routed[activity].effort, 'high');
      assert.equal(routed[activity].model, DEFAULT_ROUTING[activity].model);
    }
    assert.deepEqual(resolveRouting({ BRAIN_EFFORT: 'turbo' }), DEFAULT_ROUTING);
    assert.deepEqual(resolveRouting({}), DEFAULT_ROUTING);
  });
});

describe('AnthropicBrainClient — failure honesty', () => {
  test('a refusal surfaces as its own error, never as a parse failure', async () => {
    const { sdk } = fakeSdk([{ stop_reason: 'refusal', content: [], usage: {} }]);
    await assert.rejects(new AnthropicBrainClient({}, sdk).turn(turnRequest()), BrainRefusalError);
  });

  test('one malformed answer gets one retry', async () => {
    const { sdk, calls } = fakeSdk([nullResponse(), okResponse()]);
    const { turn } = await new AnthropicBrainClient({}, sdk).turn(turnRequest());
    assert.equal(calls.length, 2);
    assert.equal(turn.sceneReply.speaker, 'Karim');
  });

  test('two malformed answers throw a parse error carrying the raw text', async () => {
    const { sdk } = fakeSdk([nullResponse(), nullResponse()]);
    await assert.rejects(new AnthropicBrainClient({}, sdk).turn(turnRequest()), (error: unknown) => {
      assert.ok(error instanceof BrainParseError);
      assert.equal(error.raw, 'not json');
      return true;
    });
  });

  test('usage maps through, cache columns included', async () => {
    const { sdk } = fakeSdk([okResponse()]);
    const { usage } = await new AnthropicBrainClient({}, sdk).turn(turnRequest());
    assert.deepEqual(usage, { inputTokens: 100, outputTokens: 50, cacheReadTokens: 80, cacheWriteTokens: 10 });
  });
});

describe('OpenAiCompatBrainClient — the $0 fallback', () => {
  function fakeFetch(contents: string[]): { fetchFn: any; bodies: AnyRecord[] } {
    const bodies: AnyRecord[] = [];
    const queue = [...contents];
    return {
      bodies,
      fetchFn: async (_url: string, init: { body: string }) => {
        bodies.push(JSON.parse(init.body));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: queue.shift() ?? '' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        };
      },
    };
  }

  test('the schema travels in the prompt and roles pass through', async () => {
    const { fetchFn, bodies } = fakeFetch([JSON.stringify(sampleTurn())]);
    const client = new OpenAiCompatBrainClient({ apiKey: 'k' }, fetchFn);
    const { turn } = await client.turn(turnRequest());

    assert.equal(turn.sceneReply.speaker, 'Karim');
    const body = bodies[0]!;
    assert.equal(body.response_format.type, 'json_object');
    assert.match(body.messages[0].content, /JSON schema/);
    assert.ok(body.messages[0].content.includes('HOW FRENCH IS ACTUALLY SPOKEN'), 'pack must reach the fallback too');
    assert.equal(body.messages.at(-1).role, 'system', 'app context keeps its role');
  });

  test('an invalid answer gets one repair round-trip with the error attached', async () => {
    const { fetchFn, bodies } = fakeFetch(['this is not json', JSON.stringify(sampleTurn())]);
    const client = new OpenAiCompatBrainClient({ apiKey: 'k' }, fetchFn);
    const { usage } = await client.turn(turnRequest());

    assert.equal(bodies.length, 2);
    assert.match(bodies[1]!.messages.at(-1).content, /not a valid object/);
    assert.equal(usage.inputTokens, 20, 'usage sums across the retry');
  });

  test('two invalid answers throw a parse error', async () => {
    const { fetchFn } = fakeFetch(['nope', 'still nope']);
    const client = new OpenAiCompatBrainClient({ apiKey: 'k' }, fetchFn);
    await assert.rejects(client.turn(turnRequest()), BrainParseError);
  });
});

describe('MockLlmClient', () => {
  test('plays its script in order, then falls back to the sample turn', async () => {
    const scripted = sampleTurn({ coachLine: 'scripted' });
    const mock = new MockLlmClient({ turns: [scripted] });
    const first = await mock.turn(turnRequest());
    const second = await mock.turn(turnRequest());
    assert.equal(first.turn.coachLine, 'scripted');
    assert.equal(second.turn.coachLine, null);
    assert.equal(mock.turnRequests.length, 2, 'requests are recorded for prompt assertions');
  });
});
