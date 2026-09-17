/**
 * One brain, built from the environment, for every process that needs one.
 *
 * This used to live inside the tutor agent, which was right while the agent
 * was the only process that ever spoke to a model. The own-words judge made
 * that false: the token server has to reach a brain too, and the agent is not
 * importable from it — so the choice would have been copied, and a second copy
 * of "which brain does TUTOR_LLM mean" is how two processes come to disagree
 * about what a learner is talking to.
 *
 * It is a lift, not a redesign: same flag, same four values, same clients, same
 * defaults. The tutor agent's `brainClient()` now calls straight through here
 * and its tests still hold the promise this was built for — that moving from a
 * subscription to an API key is one line of .env and no code at all.
 *
 * Note what does NOT move: preflight's boot checks stay in the agent, because
 * refusing to start is the agent's decision. The token server must never refuse
 * to start over a missing brain key; a judge with no brain answers 503, and the
 * learner is shown the line rather than being stranded.
 */

import { AnthropicBrainClient } from './anthropic.ts';
import { ClaudeCliBrainClient } from './claudeCli.ts';
import type { LlmClient } from './client.ts';
import { OpenAiCompatBrainClient } from './openaiCompat.ts';
import { OpenAiResponsesBrainClient } from './openaiResponses.ts';
import { SplitBrainClient } from './split.ts';

/** The four brains TUTOR_LLM can ask for. */
export type BrainChoice = 'anthropic' | 'groq' | 'openai' | 'claude-cli' | 'claude-cli-all';

/**
 * Which brain the .env asks for.
 *
 * The subtle part is the empty string: `TUTOR_LLM=` is a line people leave in
 * a copied .env, and `??` would read it as a request rather than as silence.
 * Trim, then treat empty as absent — the same reading `defaultModel()` gives
 * GROQ_MODEL and the agent's preflight gives this flag.
 */
export function brainChoice(env: Record<string, string | undefined> = process.env): BrainChoice {
  const raw = (env.TUTOR_LLM ?? '').trim().toLowerCase();
  if (raw === 'groq') return 'groq';
  if (raw === 'openai') return 'openai';
  if (raw === 'claude-cli') return 'claude-cli';
  if (raw === 'claude-cli-all') return 'claude-cli-all';
  return 'anthropic';
}

/**
 * The brain this environment describes.
 *
 * `anthropic` is the default and the shape this is built for: coaching quality
 *          is the product, and routing.ts already keeps realtime turns on the
 *          fast tier. Needs ANTHROPIC_API_KEY.
 * `groq` — the documented $0 fallback for key-less setups.
 * `claude-cli` — a Claude subscription through the command line, so the
 *          coaching can be judged before an API key is bought. Split, because
 *          a CLI call costs about eight seconds: the post-session calls get
 *          Claude, the learner's turn stays on Groq.
 * `claude-cli-all` — the same subscription behind everything, the learner's
 *          turn included, for development only. It buys coaching quality with
 *          eight to twelve seconds of dead air per turn, which is why it is not
 *          the default and why preflight says so out loud. It exists because
 *          Groq's free tier rate-limits a real session, and a fourth value on
 *          the one enum beats a second flag that could disagree with it.
 */
export function brainClientFromEnv(env: Record<string, string | undefined> = process.env): LlmClient {
  const brain = brainChoice(env);
  if (brain === 'groq') return new OpenAiCompatBrainClient({ apiKey: env.GROQ_API_KEY ?? '' });
  if (brain === 'openai') {
    return new OpenAiResponsesBrainClient({
      apiKey: env.OPENAI_API_KEY,
      turnModel: env.OPENAI_TURN_MODEL,
      analystModel: env.OPENAI_ANALYST_MODEL,
    });
  }
  // No split, and no key: the subscription answers everything through the
  // `claude` binary, and Groq drops out of the session entirely.
  if (brain === 'claude-cli-all') return new ClaudeCliBrainClient();
  if (brain === 'claude-cli') {
    // The subscription answers well and slowly. Give it the three calls that
    // run once the room has closed, and leave the learner's turn on the fast
    // one. See SplitBrainClient for why this is wiring and not routing.
    return new SplitBrainClient({
      realtime: new OpenAiCompatBrainClient({ apiKey: env.GROQ_API_KEY ?? '' }),
      considered: new ClaudeCliBrainClient(),
    });
  }
  return new AnthropicBrainClient(); // reads ANTHROPIC_API_KEY
}
