/**
 * What a session costs, and the two ways that number quietly goes wrong.
 *
 * One: reasoning tokens are billed inside output on both vendors, so adding
 * them to a cost is charging for the same tokens twice.
 *
 * Two: a model with no row in the table used to fall through to the dearest
 * tier without saying so. That is defensible as a nudge and indefensible as a
 * silence — an unstamped OpenAI turn priced at Sonnet's $2/$10 instead of
 * Luna's $0.2/$1.2 is a tenfold error in the exact measurement that decides
 * what the brain runs on next.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { LlmUsage } from './client.ts';
import { costUsd, priceUsage, USD_PER_MTOK } from './pricing.ts';

const MTOK = 1_000_000;

function usage(over: Partial<LlmUsage> = {}): LlmUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, ...over };
}

describe('the price table', () => {
  test('a cache write costs 1.25x uncached input on every model in the table', () => {
    for (const [model, prices] of Object.entries(USD_PER_MTOK)) {
      assert.equal(
        Number((prices.cacheWrite / prices.input).toFixed(4)),
        1.25,
        `${model}: a cache write is a discount, not a free lunch and not full price`,
      );
    }
  });

  test('a cache read costs a tenth of uncached input on every model in the table', () => {
    for (const [model, prices] of Object.entries(USD_PER_MTOK)) {
      assert.equal(Number((prices.cacheRead / prices.input).toFixed(4)), 0.1, `${model}: cache reads are the whole reason for the prefix`);
    }
  });
});

describe('reasoning tokens', () => {
  test('reasoning tokens are priced inside output, never beside it', () => {
    const base = usage({ inputTokens: 1_000, outputTokens: 2_000, model: 'gpt-5.6-luna' });

    const absent = costUsd(base);
    const zero = costUsd({ ...base, reasoningTokens: 0 });
    const large = costUsd({ ...base, reasoningTokens: 1_900 });

    assert.equal(zero, absent, 'a reported zero is the same bill as no report at all');
    assert.equal(large, absent, 'the thinking was already inside the 2,000 output tokens that were charged');
  });
});

describe('a model with no row', () => {
  test('an unpriced model is named, never silently priced at the dearest tier', () => {
    const priced = priceUsage(usage({ inputTokens: 1_000, outputTokens: 1_000 }), 'groq');

    assert.ok(priced.usd > 0, 'a cost still comes back — a missing row is not a reason to report $0');
    assert.equal(priced.exact, false);
    assert.equal(priced.unknownModel, 'groq', 'the caller has to be able to print the name that needs a row');
    assert.match(priced.note ?? '', /groq/, 'and a line it can print without composing one');
  });

  test('a usage that names no model at all says so rather than guessing the talker route', () => {
    const priced = priceUsage(usage({ inputTokens: 1_000, outputTokens: 1_000 }));

    assert.equal(priced.exact, false);
    assert.equal(priced.unknownModel, null, 'there is no name to name');
    assert.ok(priced.note, 'but there is still something to say');
  });

  test('a stamped usage prices itself, so an OpenAI turn is never billed at Claude rates', () => {
    const luna = usage({ inputTokens: MTOK, model: 'gpt-5.6-luna' });

    assert.equal(costUsd(luna), USD_PER_MTOK['gpt-5.6-luna']!.input);
    assert.equal(priceUsage(luna).exact, true);
    assert.notEqual(costUsd(luna), USD_PER_MTOK['claude-sonnet-5']!.input);
  });

  test('an explicit model still wins, because a caller may know better than the stamp', () => {
    const stamped = usage({ inputTokens: MTOK, model: 'gpt-5.6-luna' });

    assert.equal(costUsd(stamped, 'claude-opus-5'), USD_PER_MTOK['claude-opus-5']!.input);
  });
});

describe('the arithmetic', () => {
  test('each bucket is charged at its own rate and nothing is charged twice', () => {
    const prices = USD_PER_MTOK['claude-sonnet-5']!;
    const u = usage({
      inputTokens: MTOK,
      outputTokens: MTOK,
      cacheReadTokens: MTOK,
      cacheWriteTokens: MTOK,
      reasoningTokens: MTOK,
      model: 'claude-sonnet-5',
    });

    assert.equal(costUsd(u), prices.input + prices.output + prices.cacheRead + prices.cacheWrite);
  });
});
