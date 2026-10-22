/**
 * What a call costs, in one table next to the adapters that produce the tokens.
 *
 * This lived in the playground, which was fine while the playground was the
 * only thing counting. It is not: the tutor-agent meters every live session,
 * and a price table a service cannot import is a price table that gets a second
 * copy. So it sits beside client.ts, with the usage shape it prices.
 *
 * Sticker prices per million tokens. Cache reads cost a tenth of uncached
 * input and cache writes cost 1.25x it — on both vendors, which is why
 * pricing.test.ts asserts those two ratios over the whole table rather than
 * spot-checking rows: a mistyped row is caught by the shape, not by memory.
 *
 * These are standard-tier list prices. A call sent with
 * `OPENAI_LIVE_SERVICE_TIER=priority` costs more than the estimate here.
 *
 * Reasoning tokens are not a column here on purpose. Both vendors bill thinking
 * inside `output_tokens`, so `usage.reasoningTokens` is a subset of a number
 * already charged. See the invariant in client.ts.
 */

import type { LlmUsage } from './client.ts';

export interface MtokPrices {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const USD_PER_MTOK: Record<string, MtokPrices> = {
  // Standard short-context rates, official model page checked 2026-10-02.
  'gpt-6-luna': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  'gpt-5.6-luna': { input: 0.2, output: 1.2, cacheRead: 0.02, cacheWrite: 0.25 },
  'gpt-5.6-terra': { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  // TypeSafe bills input only, $0.042 per Mtok (docs.typesafe.ai/models,
  // checked 2026-09-28). Jev reports no cache buckets, so the two cache columns
  // always multiply zero; they follow the table's ratios only so the shape
  // test keeps holding every row to them.
  'jev-1.13.0': { input: 0.042, output: 0, cacheRead: 0.0042, cacheWrite: 0.0525 },
};

/**
 * The row used when the real one is missing.
 *
 * Overstating a cost is a nudge to add a row; understating one is a bill you
 * find out about later. But the old version of this rule was silent, and a
 * silent guess is worse than either: it defaulted to the talker route's model,
 * so an OpenAI turn that named no model priced at Claude Sonnet's $2/$10
 * instead of Luna's $0.2/$1.2 — a tenfold error, in the exact measurement that
 * decides which brain the product ships on. Hence `priceUsage`, which returns
 * the number and the fact that it is a guess in the same breath.
 */
export const FALLBACK_PRICE_MODEL = 'claude-opus-5';

export interface PricedUsage {
  /** The cost in dollars. Always a real number, even when the row was a guess. */
  usd: number;
  /** Which row the number came from. */
  pricedAs: string;
  /** True when that row is the model that actually answered. */
  exact: boolean;
  /** The named model that has no row, or null when nothing named a model. */
  unknownModel: string | null;
  /** A line a caller can print as-is. Null when the price is exact. */
  note: string | null;
}

/**
 * Price one call's usage, saying out loud when it could not be priced properly.
 *
 * An explicit `model` wins over the stamp on the usage: an eval harness knows
 * which client it built, and a total merged across calls may honestly carry no
 * stamp at all (see `addLlmUsage`).
 */
export function priceUsage(usage: LlmUsage, model?: string): PricedUsage {
  const asked = model ?? usage.model ?? null;
  const row = asked === null ? undefined : USD_PER_MTOK[asked];
  const prices = row ?? USD_PER_MTOK[FALLBACK_PRICE_MODEL]!;
  const usd =
    (usage.inputTokens * prices.input +
      usage.outputTokens * prices.output +
      usage.cacheReadTokens * prices.cacheRead +
      usage.cacheWriteTokens * prices.cacheWrite) /
    1_000_000;

  if (row !== undefined) return { usd, pricedAs: asked as string, exact: true, unknownModel: null, note: null };

  return {
    usd,
    pricedAs: FALLBACK_PRICE_MODEL,
    exact: false,
    unknownModel: asked,
    note:
      asked === null
        ? `no model was stamped on this usage, so it is priced at ${FALLBACK_PRICE_MODEL} rates and is probably wrong`
        : `${asked} has no row in the price table, so it is priced at ${FALLBACK_PRICE_MODEL} rates and is probably wrong`,
  };
}

/**
 * Just the number, for the callers that only want to print a total.
 *
 * Note what is missing: no default model. A caller that knows which model
 * answered says so; one that does not gets a loud answer from `priceUsage`
 * rather than a quiet one from a constant.
 */
export function costUsd(usage: LlmUsage, model?: string): number {
  return priceUsage(usage, model).usd;
}
