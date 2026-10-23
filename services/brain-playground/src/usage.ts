/**
 * Cost visibility per session, in the repo's metering spirit: know what a
 * session costs in week one, not month three.
 *
 * The price table and the arithmetic moved to `@luvani/brain`'s pricing.ts, next
 * to the adapters that produce the tokens, because the playground stopped being
 * the only thing counting. What is left here is presentation: how a turn and a
 * session read in a terminal.
 *
 * Two behaviours changed with the move and both are visible in this file:
 *
 *   - There is no default model any more. A usage now carries the model that
 *     answered it, and a total merged across two models honestly carries none —
 *     so a cost that could not be priced properly says so instead of quietly
 *     charging the talker route's rate.
 *   - The adder is gone. `addLlmUsage` in the brain's client.ts already did
 *     exactly this job, and two adders are two places for the next column to be
 *     forgotten. `addUsage` is that function under its old name.
 */

import { addLlmUsage, costUsd, priceUsage, USD_PER_MTOK, ZERO_USAGE, type LlmUsage } from '@luvani/brain';

export { addLlmUsage, addLlmUsage as addUsage, costUsd, USD_PER_MTOK, ZERO_USAGE };

function k(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/**
 * The marker for a number that is a guess. Short on purpose — it sits inside a
 * one-line meter, and its job is to stop a wrong figure being read as a right
 * one, not to explain itself there.
 */
function pricedNote(usage: LlmUsage, model?: string): string {
  const priced = priceUsage(usage, model);
  if (priced.exact) return '';
  return ` (unpriced ${priced.unknownModel ?? 'model'}, shown at ${priced.pricedAs} rates)`;
}

/**
 * The cost an eval prints for a whole run. The model the client stamped on the
 * usage is what answered, so it prices the run; `costModel` (what the harness
 * expected) is only for usage that carries no stamp, such as a total merged
 * across two models or a mock client, or a stamp with no row in the price table.
 */
export function evalCostUsd(usage: LlmUsage, costModel: string): number {
  const stamped = usage.model !== undefined && USD_PER_MTOK[usage.model] !== undefined;
  return stamped ? costUsd(usage) : costUsd(usage, costModel);
}

export function formatTurnUsage(usage: LlmUsage, elapsedMs: number, model?: string): string {
  // The three buckets are disjoint on every provider — the adapters normalise
  // that — so this sum is the input the vendor actually charged for.
  const input = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const cached = usage.cacheReadTokens;
  const thought = usage.reasoningTokens === undefined ? '' : ` (${k(usage.reasoningTokens)} thinking)`;
  return (
    `${k(input)} in (${k(cached)} cached) · ${k(usage.outputTokens)} out${thought} · ` +
    `~$${costUsd(usage, model).toFixed(3)}${pricedNote(usage, model)} · ${(elapsedMs / 1000).toFixed(1)}s`
  );
}

export function formatSessionUsage(total: LlmUsage, turns: number, model?: string): string {
  return `${turns} model calls · ~$${costUsd(total, model).toFixed(3)}${pricedNote(total, model)} this session`;
}
