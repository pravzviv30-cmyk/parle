/**
 * The playground tools used to hand-copy their provider choice (F1125). The
 * shared picker must change no tool's vendor, so each reference below is that
 * tool's old conditional, transcribed as it read before the extraction.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CHAT_ORDER, CURATION_ORDER, EVAL_ORDER, pickProvider, type ProviderName } from './provider.ts';

type Env = Record<string, string | undefined>;

/** runEval, drillEval and frameEval, before F1125 (mock handled by the caller). */
function evalBefore(env: Env): ProviderName | null {
  const choice = (env.BRAIN_LLM ?? '').toLowerCase();
  if ((choice === 'openai' || (choice === '' && !env.ANTHROPIC_API_KEY)) && env.OPENAI_API_KEY) return 'openai';
  if ((choice === 'anthropic' || choice === '') && env.ANTHROPIC_API_KEY) return 'anthropic';
  if ((choice === 'groq' || choice === '') && env.GROQ_API_KEY) return 'groq';
  return null;
}

/** chat.ts, before F1125 (mock handled by the caller; null was the offline mock). */
function chatBefore(env: Env): ProviderName | null {
  const choice = (env.BRAIN_LLM ?? '').toLowerCase();
  if ((choice === 'openai' || (choice === '' && !env.ANTHROPIC_API_KEY)) && env.OPENAI_API_KEY) return 'openai';
  if ((choice === 'anthropic' || choice === '') && env.ANTHROPIC_API_KEY) return 'anthropic';
  if ((choice === 'groq' || choice === '' || choice === 'anthropic') && env.GROQ_API_KEY) return 'groq';
  return null;
}

/** curationEval.ts (and replay, which borrows it), before F1125. */
function curationBefore(env: Env): ProviderName | null {
  const order = [
    { name: 'openai', key: 'OPENAI_API_KEY' },
    { name: 'anthropic', key: 'ANTHROPIC_API_KEY' },
    { name: 'groq', key: 'GROQ_API_KEY' },
  ] as const;
  const withKey = order.filter((p) => typeof env[p.key] === 'string' && env[p.key]!.trim() !== '');
  const choice = (env.BRAIN_LLM ?? '').toLowerCase();
  return (withKey.find((p) => p.name === choice) ?? withKey[0])?.name ?? null;
}

/** Every combination of the three keys, set or unset, under every BRAIN_LLM a tool reads. */
function everyEnvironment(): Env[] {
  const out: Env[] = [];
  for (const choice of [undefined, '', 'openai', 'OpenAI', 'anthropic', 'groq', 'mock', 'nonsense']) {
    for (let mask = 0; mask < 8; mask += 1) {
      out.push({
        ...(choice === undefined ? {} : { BRAIN_LLM: choice }),
        ...(mask & 1 ? { OPENAI_API_KEY: 'sk-o' } : {}),
        ...(mask & 2 ? { ANTHROPIC_API_KEY: 'sk-a' } : {}),
        ...(mask & 4 ? { GROQ_API_KEY: 'gsk' } : {}),
      });
    }
  }
  return out;
}

describe('provider choice — one picker, no tool changes vendor', () => {
  test('each playground tool picks the same provider as before for every key combination', () => {
    const tools = [
      { name: 'the evals', order: EVAL_ORDER, before: evalBefore },
      { name: 'the chat', order: CHAT_ORDER, before: chatBefore },
      { name: 'curation and replay', order: CURATION_ORDER, before: curationBefore },
    ];
    for (const tool of tools) {
      for (const env of everyEnvironment()) {
        assert.equal(
          pickProvider(env, tool.order),
          tool.before(env),
          `${tool.name} must bill the same vendor as before for ${JSON.stringify(env)}`,
        );
      }
    }
  });
});
