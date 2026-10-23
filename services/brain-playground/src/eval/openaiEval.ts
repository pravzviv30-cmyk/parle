/**
 * Which OpenAI model an eval run is labelled and priced with.
 *
 * The evals used to price OpenAI runs from DEFAULT_OPENAI_TURN_MODEL, a constant,
 * while the client sends live turns and frames to the live model
 * (gpt-6-luna by default, OPENAI_LIVE_MODEL / OPENAI_TURN_MODEL to override) and
 * drills to their own model (gpt-6-luna, OPENAI_DRILLS_MODEL; VOICE-008). The reported cost was about double what the run spent,
 * and an override changed the bill without changing the label.
 *
 * The answer comes from `openAiModelFor` in @luvani/brain, the same function the
 * client routes through, so this file holds no env logic of its own.
 */

import { OpenAiResponsesBrainClient, openAiModelFor, type BrainActivity } from '@luvani/brain';

/** The activities an eval drives. */
export type OpenAiEvalActivity = Extract<BrainActivity, 'turn' | 'frame' | 'drills' | 'curate'>;

/** The model the real client sends this activity to, from the environment. */
export function openAiEvalModel(activity: OpenAiEvalActivity, env: Record<string, string | undefined> = process.env): string {
  return openAiModelFor(activity, env);
}

/** A real OpenAI client plus the model it will answer with, for the label and the price. */
export function openAiEvalClient(activity: OpenAiEvalActivity, apiKey: string): { client: OpenAiResponsesBrainClient; costModel: string } {
  return { client: new OpenAiResponsesBrainClient({ apiKey }), costModel: openAiEvalModel(activity) };
}
