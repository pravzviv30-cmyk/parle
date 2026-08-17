/**
 * Cost visibility per session, in the repo's metering spirit: know what a
 * session costs in week one, not month three. Sticker prices per model;
 * cache reads at a tenth, cache writes at 1.25x. The default is the talker
 * route's model, because every call the playground meters today is a turn or
 * a frame — pass the model explicitly if that ever stops being true.
 */

import { DEFAULT_ROUTING, ZERO_USAGE, type LlmUsage } from '@parle/brain';

interface MtokPrices {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const USD_PER_MTOK: Record<string, MtokPrices> = {
  'claude-sonnet-5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};

const DEFAULT_MODEL = DEFAULT_ROUTING.turn.model;

export function addUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

export { ZERO_USAGE };

export function costUsd(usage: LlmUsage, model: string = DEFAULT_MODEL): number {
  // An unknown model prices at the dearest tier — overstating a cost is a
  // nudge to add the row; understating one is a bill.
  const prices = USD_PER_MTOK[model] ?? USD_PER_MTOK['claude-opus-5']!;
  return (
    (usage.inputTokens * prices.input +
      usage.outputTokens * prices.output +
      usage.cacheReadTokens * prices.cacheRead +
      usage.cacheWriteTokens * prices.cacheWrite) /
    1_000_000
  );
}

function k(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function formatTurnUsage(usage: LlmUsage, elapsedMs: number): string {
  const input = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const cached = usage.cacheReadTokens;
  return `${k(input)} in (${k(cached)} cached) · ${k(usage.outputTokens)} out · ~$${costUsd(usage).toFixed(3)} · ${(elapsedMs / 1000).toFixed(1)}s`;
}

export function formatSessionUsage(total: LlmUsage, turns: number): string {
  return `${turns} model calls · ~$${costUsd(total).toFixed(3)} this session`;
}
