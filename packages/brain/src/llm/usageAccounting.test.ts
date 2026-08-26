/**
 * What a call actually cost, told the same way whoever served it.
 *
 * Every adapter answers with the same four billable numbers, and the consumer
 * that meters a session (tutor-agent's recordBrainUsage) adds three of them to
 * get the charged input. That sum is only correct if the three buckets are
 * disjoint, and the two vendors disagree about whether they are:
 *
 *   - Anthropic's `input_tokens` EXCLUDES both cache columns.
 *   - OpenAI's `input_tokens` INCLUDES both of them.
 *
 * So the normalisation has to happen at the adapter boundary, not at the call
 * site — one consumer, two wire dialects, one neutral shape. These tests pin
 * that, and pin reasoning tokens as a subset of output rather than a fifth
 * bucket beside it.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { sampleTurn } from '../contract/samples.ts';
import { buildSystemBlocks } from '../prompt/system.ts';
import { AnthropicBrainClient, type ParseCapableSdk } from './anthropic.ts';
import { addLlmUsage, ZERO_USAGE, type BrainTurnRequest, type LlmUsage } from './client.ts';
import { OpenAiResponsesBrainClient } from './openaiResponses.ts';
import { DEFAULT_ROUTING } from './routing.ts';

const TURN: BrainTurnRequest = {
  kind: 'turn',
  system: buildSystemBlocks(),
  messages: [{ role: 'user', text: 'Bonjour !' }],
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;

/** An OpenAI Responses answer with whatever usage block the test wants to pin. */
function responsesReply(usage: unknown, value: unknown = sampleTurn()) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
      usage,
    }),
  };
}

function openAiClientOver(replies: ReturnType<typeof responsesReply>[]) {
  let calls = 0;
  const fetchFn = async () => {
    const next = replies[Math.min(calls, replies.length - 1)]!;
    calls += 1;
    return next;
  };
  return new OpenAiResponsesBrainClient({ apiKey: 'test' }, fetchFn as never, async () => {});
}

function anthropicSdkOver(responses: unknown[]): ParseCapableSdk {
  const queue = [...responses];
  return { messages: { parse: async () => queue.shift() } } as unknown as ParseCapableSdk;
}

describe('the three input buckets are disjoint whoever served the call', () => {
  test("openai input tokens split into three disjoint buckets that sum to the vendor's input_tokens", async () => {
    // OpenAI's documented identity: input_tokens already contains both the
    // cached read and the cache write. Passing it through untouched makes
    // tutor-agent's `inputTokens + cacheReadTokens + cacheWriteTokens` count
    // the same 25 tokens twice.
    const client = openAiClientOver([
      responsesReply({
        input_tokens: 100,
        output_tokens: 50,
        input_tokens_details: { cached_tokens: 20, cache_write_tokens: 5 },
      }),
    ]);

    const { usage } = await client.turn(TURN);

    assert.equal(usage.inputTokens, 75, 'uncached input is what is left after both cache columns are taken out');
    assert.equal(usage.cacheReadTokens, 20);
    assert.equal(usage.cacheWriteTokens, 5);
    assert.equal(
      usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens,
      100,
      'the three buckets must add up to exactly what OpenAI charged as input, no more',
    );
  });

  test('an anthropic call keeps its three buckets as the vendor already reports them', async () => {
    // The opposite dialect: here input_tokens is already the uncached
    // remainder, so subtracting would under-report. Same neutral shape out.
    const client = new AnthropicBrainClient(
      {},
      anthropicSdkOver([
        {
          parsed_output: sampleTurn(),
          stop_reason: 'end_turn',
          usage: { input_tokens: 75, output_tokens: 50, cache_read_input_tokens: 20, cache_creation_input_tokens: 5 },
        },
      ]),
    );

    const { usage } = await client.turn(TURN);

    assert.equal(usage.inputTokens, 75);
    assert.equal(usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens, 100);
  });

  test('a usage with no cache columns never goes negative', async () => {
    const client = openAiClientOver([responsesReply({ input_tokens: 12, output_tokens: 4 })]);

    const { usage } = await client.turn(TURN);

    assert.equal(usage.inputTokens, 12);
    assert.ok(usage.inputTokens >= 0);
  });
});

describe('reasoning tokens', () => {
  test('every adapter reports reasoning tokens under the name its vendor uses', async () => {
    // Same parent object, different child key: OpenAI says reasoning_tokens,
    // Anthropic says thinking_tokens. Both land in one neutral field so no
    // consumer has to know which vendor answered.
    const cases: { vendor: string; ask: () => Promise<LlmUsage> }[] = [
      {
        vendor: 'openai/reasoning_tokens',
        ask: async () => {
          const client = openAiClientOver([
            responsesReply({ input_tokens: 30, output_tokens: 200, output_tokens_details: { reasoning_tokens: 140 } }),
          ]);
          return (await client.turn(TURN)).usage;
        },
      },
      {
        vendor: 'anthropic/thinking_tokens',
        ask: async () => {
          const client = new AnthropicBrainClient(
            {},
            anthropicSdkOver([
              {
                parsed_output: sampleTurn(),
                stop_reason: 'end_turn',
                usage: { input_tokens: 30, output_tokens: 200, output_tokens_details: { thinking_tokens: 140 } },
              },
            ]),
          );
          return (await client.turn(TURN)).usage;
        },
      },
    ];

    for (const { vendor, ask } of cases) {
      const usage = await ask();
      assert.equal(usage.reasoningTokens, 140, `${vendor} must arrive in the neutral field`);
      assert.equal(usage.outputTokens, 200, `${vendor}: reasoning is billed inside output, so output stays whole`);
    }
  });

  test('a vendor with no reasoning breakout says nothing rather than reporting zero', async () => {
    const client = openAiClientOver([responsesReply({ input_tokens: 30, output_tokens: 200 })]);

    const { usage } = await client.turn(TURN);

    assert.equal(usage.reasoningTokens, undefined, 'a hard zero would read as "it thought about nothing", which is a different claim');
  });
});

describe('the model that actually answered is stamped on the usage', () => {
  test('an openai turn carries the model that served it, not the routing table default', async () => {
    const client = openAiClientOver([responsesReply({ input_tokens: 10, output_tokens: 4 })]);

    const { usage } = await client.turn(TURN);

    assert.equal(usage.model, 'gpt-5.6-luna', 'without this the meter prices an OpenAI turn at Claude Sonnet rates');
  });

  test('an anthropic turn carries its route model', async () => {
    const client = new AnthropicBrainClient(
      {},
      anthropicSdkOver([{ parsed_output: sampleTurn(), stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 4 } }]),
    );

    const { usage } = await client.turn(TURN);

    assert.equal(usage.model, DEFAULT_ROUTING.turn.model);
  });
});

describe('accumulating usage across calls', () => {
  test('reasoning sums when either side reports it, and stays absent when neither does', () => {
    assert.equal(addLlmUsage(ZERO_USAGE, ZERO_USAGE).reasoningTokens, undefined);

    const withReasoning = addLlmUsage(
      { inputTokens: 1, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 6 },
      { inputTokens: 1, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
    );
    assert.equal(withReasoning.reasoningTokens, 6, 'an absent breakout counts as nothing, not as a missing sum');
  });

  test('a total over two different models names neither, because a mixed total has no price', () => {
    const luna: LlmUsage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, model: 'gpt-5.6-luna' };
    const opus: LlmUsage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, model: 'claude-opus-5' };

    assert.equal(addLlmUsage(luna, luna).model, 'gpt-5.6-luna', 'two calls on one model still know their price');
    assert.equal(addLlmUsage(luna, opus).model, undefined, 'a mixed total priced at either rate is a wrong number');
  });

  test('seeding a running total from ZERO_USAGE keeps the model of the calls in it', () => {
    const luna: LlmUsage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, model: 'gpt-5.6-luna' };

    assert.equal(addLlmUsage(ZERO_USAGE, luna).model, 'gpt-5.6-luna', 'an empty seed contributed no tokens, so it cannot disagree');
  });
});

describe('a retried anthropic call is metered for every prompt it sent', () => {
  test("a repaired anthropic call reports both attempts' tokens, not just the last", async () => {
    // The retry re-sends the whole prompt. Reporting only the second attempt
    // hides a full prompt's worth of input every time the model fumbles the
    // shape once.
    const client = new AnthropicBrainClient(
      {},
      anthropicSdkOver([
        {
          parsed_output: null,
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'not json' }],
          usage: { input_tokens: 1000, output_tokens: 40, cache_read_input_tokens: 500, cache_creation_input_tokens: 20 },
        },
        {
          parsed_output: sampleTurn(),
          stop_reason: 'end_turn',
          usage: { input_tokens: 1000, output_tokens: 60, cache_read_input_tokens: 500, cache_creation_input_tokens: 0 },
        },
      ]),
    );

    const { usage } = await client.turn(TURN);

    assert.equal(usage.inputTokens, 2000, 'both prompts were billed, so both are metered');
    assert.equal(usage.outputTokens, 100);
    assert.equal(usage.cacheReadTokens, 1000);
    assert.equal(usage.cacheWriteTokens, 20);
  });

  test("an anthropic call that fails to parse twice still reports both attempts' tokens", async () => {
    // The worst case for a meter: two fully billed prompts and an exception.
    // The usage rides on the error so the caller can still record it.
    const failed: AnyRecord = {
      parsed_output: null,
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'still not json' }],
      usage: { input_tokens: 1000, output_tokens: 40, cache_read_input_tokens: 500, cache_creation_input_tokens: 20 },
    };
    const client = new AnthropicBrainClient({}, anthropicSdkOver([failed, failed]));

    await assert.rejects(
      () => client.turn(TURN),
      (error: Error & { usage?: LlmUsage }) => {
        assert.equal(error.name, 'BrainParseError');
        assert.deepEqual(
          { input: error.usage?.inputTokens, output: error.usage?.outputTokens, read: error.usage?.cacheReadTokens },
          { input: 2000, output: 80, read: 1000 },
          'two billed prompts metered nowhere is money that leaves no trace',
        );
        return true;
      },
    );
  });

  test('a refusal on the retry still reports the attempt it was standing on', async () => {
    // The last door out of parseWithRetry that money could leave by. A refusal
    // is the model declining, not a billing question — but the fumbled attempt
    // before it was billed in full, and the refusal itself is a billed call too.
    const client = new AnthropicBrainClient(
      {},
      anthropicSdkOver([
        {
          parsed_output: null,
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'not json' }],
          usage: { input_tokens: 1000, output_tokens: 40, cache_read_input_tokens: 500, cache_creation_input_tokens: 0 },
        },
        {
          parsed_output: null,
          stop_reason: 'refusal',
          usage: { input_tokens: 900, output_tokens: 10, cache_read_input_tokens: 400, cache_creation_input_tokens: 0 },
        },
      ]),
    );

    await assert.rejects(
      () => client.turn(TURN),
      (error: Error & { usage?: LlmUsage }) => {
        assert.equal(error.name, 'BrainRefusalError');
        assert.deepEqual(
          { input: error.usage?.inputTokens, output: error.usage?.outputTokens, read: error.usage?.cacheReadTokens },
          { input: 1900, output: 50, read: 900 },
          'a declined answer is still a paid one, and so was the attempt under it',
        );
        return true;
      },
    );
  });

  test('an openai refusal carries the usage the call was billed for', async () => {
    const refused = {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }],
        usage: { input_tokens: 700, output_tokens: 12, input_tokens_details: { cached_tokens: 200 } },
      }),
    };
    const client = new OpenAiResponsesBrainClient({ apiKey: 'test' }, (async () => refused) as never, async () => {});

    await assert.rejects(
      () => client.turn(TURN),
      (error: Error & { usage?: LlmUsage }) => {
        assert.equal(error.name, 'BrainRefusalError');
        assert.deepEqual(
          { input: error.usage?.inputTokens, read: error.usage?.cacheReadTokens, output: error.usage?.outputTokens },
          { input: 500, read: 200, output: 12 },
          'refused or not, the buckets stay disjoint and the call stays metered',
        );
        return true;
      },
    );
  });
});

describe('an abort reaches the wire', () => {
  test('a turn request carrying a signal hands it to the SDK options, not to the request body', async () => {
    const seen: { params?: AnyRecord; options?: AnyRecord }[] = [];
    const sdk = {
      messages: {
        parse: async (params: AnyRecord, options?: AnyRecord) => {
          seen.push({ params, options });
          return { parsed_output: sampleTurn(), stop_reason: 'end_turn', usage: {} };
        },
      },
    } as unknown as ParseCapableSdk;
    const controller = new AbortController();

    await new AnthropicBrainClient({}, sdk).turn({ ...TURN, signal: controller.signal });

    assert.equal(seen[0]!.options?.signal, controller.signal, 'the signal is a request option');
    assert.ok(!('signal' in seen[0]!.params!), 'the body is what the vendor parses; a signal there is a 400');
  });

  test('an openai request hands its signal to fetch', async () => {
    let init: AnyRecord | undefined;
    const controller = new AbortController();
    const fetchFn = async (_url: string, got: AnyRecord) => {
      init = got;
      return responsesReply({ input_tokens: 1, output_tokens: 1 });
    };
    const client = new OpenAiResponsesBrainClient({ apiKey: 'test' }, fetchFn as never, async () => {});

    await client.turn({ ...TURN, signal: controller.signal });

    assert.equal(init?.signal, controller.signal);
  });
});
