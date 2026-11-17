/**
 * Which provider a playground tool talks to, from the environment alone (F1125).
 *
 * The tools disagree on precedence on purpose: changing it would change which
 * vendor a tool bills. So the rule is shared and each tool passes its order:
 * the providers to try for each BRAIN_LLM value ('' when unset, '*' for any
 * other value). The first one whose key is set wins; none means null.
 */

export type ProviderName = 'openai' | 'anthropic' | 'groq';
export type ProviderOrder = Readonly<Record<string, readonly ProviderName[]>>;

export const PROVIDER_KEYS: Readonly<Record<ProviderName, string>> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  groq: 'GROQ_API_KEY',
};

/** runEval, drillEval and frameEval: Anthropic first when unset; a named provider without its key runs nothing. */
export const EVAL_ORDER: ProviderOrder = {
  '': ['anthropic', 'openai', 'groq'],
  openai: ['openai'],
  anthropic: ['anthropic'],
  groq: ['groq'],
};

/** The chat: as the evals, except a missing Anthropic key falls back to Groq. */
export const CHAT_ORDER: ProviderOrder = { ...EVAL_ORDER, anthropic: ['anthropic', 'groq'] };

/** Curation and replay: OpenAI first; a named provider without its key falls through to the rest. */
export const CURATION_ORDER: ProviderOrder = {
  '*': ['openai', 'anthropic', 'groq'],
  openai: ['openai', 'anthropic', 'groq'],
  anthropic: ['anthropic', 'openai', 'groq'],
  groq: ['groq', 'openai', 'anthropic'],
};

export function pickProvider(env: Record<string, string | undefined>, order: ProviderOrder): ProviderName | null {
  const choice = (env.BRAIN_LLM ?? '').toLowerCase();
  const tried = (Object.hasOwn(order, choice) ? order[choice] : order['*']) ?? [];
  return tried.find((name) => (env[PROVIDER_KEYS[name]] ?? '').trim() !== '') ?? null;
}
