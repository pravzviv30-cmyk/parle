/**
 * The production brain: Claude through structured outputs, routed per call.
 *
 * Which model answers is the routing table's decision (routing.ts): realtime
 * turns go to the fast talker, background calls to the analyst. Request shape
 * follows the current API rules for this model family:
 *   - no temperature/top_p/top_k (rejected), no thinking config (on by
 *     default; max_tokens covers thinking plus response, hence the headroom)
 *   - structured outputs via messages.parse + zodOutputFormat, so the turn
 *     contract is enforced server-side and arrives parsed
 *   - prompt caching: persona | pack ⛃ | contract ⛃ as system blocks. The
 *     scenario-builder call sends only persona + pack, which is why the pack
 *     carries its own breakpoint — both call shapes read the same prefix.
 *     A third breakpoint rides the newest learner message so multi-turn
 *     history reads incrementally from cache.
 *   - the trailing app-context message goes out as role "system" where the
 *     model accepts one mid-conversation (Opus), the channel a learner's text
 *     cannot forge; the SDK's param type lags the API there, hence the cast.
 *     Sonnet-tier models reject that role after history, so on those routes
 *     the same context rides as a trailing user message instead — after the
 *     cache breakpoint either way, so the prefix bytes never change shape.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { MemoryExtractionSchema, ScenarioFrameSchema, TurnSchema } from '../contract/schemas.ts';
import type { MemoryExtraction, ScenarioFrame, TutorTurn } from '../contract/types.ts';
import { CurationSchema, type Curation } from '../curate/curate.ts';
import { DrillBatchSchema, type DrillBatch } from '../drill/generate.ts';
import { OwnWordsVerdictSchema } from './judge.ts';
import {
  addLlmUsage,
  BrainParseError,
  BrainRefusalError,
  type BrainCurateRequest,
  type BrainDrillsRequest,
  type BrainExtractRequest,
  type BrainFrameRequest,
  type BrainJudgeRequest,
  type BrainTurnRequest,
  type ChatMessage,
  type LlmClient,
  type LlmUsage,
} from './client.ts';
import { resolveRouting, type BrainActivity, type BrainEffort, type BrainRouting, type ModelRoute } from './routing.ts';

export type { BrainEffort };

export interface AnthropicBrainConfig {
  apiKey?: string;
  /** Per-activity routes. Default: the shared table with env overrides. */
  routing?: BrainRouting;
  /** Blunt overrides across every activity — playground knobs, not routing. */
  model?: string;
  effort?: BrainEffort;
  maxTokens?: number;
}

/**
 * The narrow slice of the SDK the adapter touches — injectable for tests.
 *
 * The second argument is request OPTIONS, not the request body. An AbortSignal
 * spread into `params` would be serialised into the JSON the vendor parses,
 * which is a 400 rather than a cancellation.
 */
export interface ParseCapableSdk {
  messages: { parse(params: never, options?: { signal?: AbortSignal }): Promise<unknown> };
}

interface ParsedResponse {
  parsed_output?: unknown;
  stop_reason?: string;
  content?: { type: string; text?: string }[];
  usage?: {
    /** EXCLUDES both cache columns below, unlike OpenAI's. See client.ts. */
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
    /**
     * Thinking, billed inside output_tokens. Same parent as OpenAI's, different
     * child key: `thinking_tokens` here, `reasoning_tokens` there. Read
     * defensively — an older SDK build does not declare it, and a missing
     * breakout must read as unreported rather than as a measured zero.
     */
    output_tokens_details?: { thinking_tokens?: number } | null;
  };
}

export class AnthropicBrainClient implements LlmClient {
  private readonly sdk: ParseCapableSdk;
  private readonly routing: BrainRouting;
  private readonly overrides: Pick<AnthropicBrainConfig, 'model' | 'effort' | 'maxTokens'>;

  constructor(config: AnthropicBrainConfig = {}, sdk?: ParseCapableSdk) {
    // A bare constructor resolves credentials from the environment.
    this.sdk = sdk ?? new Anthropic(config.apiKey ? { apiKey: config.apiKey } : {});
    this.routing = config.routing ?? resolveRouting();
    this.overrides = { model: config.model, effort: config.effort, maxTokens: config.maxTokens };
  }

  /** The route for one call, blunt config overrides applied on top. */
  private routeFor(activity: BrainActivity): ModelRoute {
    const route = this.routing[activity];
    return {
      ...route,
      model: this.overrides.model ?? route.model,
      effort: this.overrides.effort ?? route.effort,
      maxTokens: this.overrides.maxTokens ?? route.maxTokens,
    };
  }

  async turn(request: BrainTurnRequest): Promise<{ turn: TutorTurn; usage: LlmUsage }> {
    const route = this.routeFor('turn');
    const params = {
      model: route.model,
      max_tokens: route.maxTokens,
      system: [
        { type: 'text', text: request.system.persona },
        { type: 'text', text: request.system.pack, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: request.system.contract, cache_control: { type: 'ephemeral' } },
      ],
      messages: toProviderMessages(request.messages, route.midConversationSystem),
      output_config: outputConfig(TurnSchema, route.effort),
    };
    const { parsed, usage } = await this.parseWithRetry(params, request.signal);
    return { turn: parsed as TutorTurn, usage };
  }

  async frame(request: BrainFrameRequest): Promise<{ frame: ScenarioFrame; usage: LlmUsage }> {
    const route = this.routeFor('frame');
    const params = {
      model: route.model,
      max_tokens: route.maxTokens,
      system: [
        { type: 'text', text: request.system.persona },
        { type: 'text', text: request.system.pack, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: [{ type: 'text', text: request.request }] }],
      output_config: outputConfig(ScenarioFrameSchema, route.effort),
    };
    const { parsed, usage } = await this.parseWithRetry(params, request.signal);
    return { frame: parsed as ScenarioFrame, usage };
  }

  async extract(request: BrainExtractRequest): Promise<{ extraction: MemoryExtraction; usage: LlmUsage }> {
    const route = this.routeFor('extract');
    const params = {
      model: route.model,
      max_tokens: route.maxTokens,
      // Same two-block prefix as the frame call, so the analyst reads the
      // persona + pack straight from cache even on a different model tier's
      // first call of the day.
      system: [
        { type: 'text', text: request.system.persona },
        { type: 'text', text: request.system.pack, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: [{ type: 'text', text: request.request }] }],
      output_config: outputConfig(MemoryExtractionSchema, route.effort),
    };
    const { parsed, usage } = await this.parseWithRetry(params, request.signal);
    return { extraction: parsed as MemoryExtraction, usage };
  }

  async drills(request: BrainDrillsRequest): Promise<{ batch: DrillBatch; usage: LlmUsage }> {
    const route = this.routeFor('drills');
    const params = {
      model: route.model,
      max_tokens: route.maxTokens,
      system: [
        { type: 'text', text: request.system.persona },
        { type: 'text', text: request.system.pack, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: [{ type: 'text', text: request.request }] }],
      output_config: outputConfig(DrillBatchSchema, route.effort),
    };
    const { parsed, usage } = await this.parseWithRetry(params, request.signal);
    return { batch: parsed as DrillBatch, usage };
  }

  async curate(request: BrainCurateRequest): Promise<{ curation: Curation; usage: LlmUsage }> {
    const route = this.routeFor('curate');
    const params = {
      model: route.model,
      max_tokens: route.maxTokens,
      system: [
        { type: 'text', text: request.system.persona },
        { type: 'text', text: request.system.pack, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: [{ type: 'text', text: request.request }] }],
      output_config: outputConfig(CurationSchema, route.effort),
    };
    const { parsed, usage } = await this.parseWithRetry(params, request.signal);
    return { curation: parsed as Curation, usage };
  }

  /**
   * One paraphrase, judged. No persona, no pack, no contract: the grader's
   * brief is the whole system block, which is also why there is no cache
   * breakpoint on it. A few hundred tokens is under this vendor's caching
   * minimum anyway, so a breakpoint here would be a cost with no saving.
   *
   * The verdict leaves as `unknown`. The schema has already been enforced
   * server-side, and it is enforced again by `parseOwnWordsVerdict` at the
   * caller, because "the API promised" is not the same as "we checked".
   */
  async judge(request: BrainJudgeRequest): Promise<{ verdict: unknown; usage: LlmUsage }> {
    const route = this.routeFor('judge');
    const params = {
      model: route.model,
      max_tokens: route.maxTokens,
      system: [{ type: 'text', text: request.system }],
      messages: [{ role: 'user', content: [{ type: 'text', text: request.request }] }],
      output_config: outputConfig(OwnWordsVerdictSchema, route.effort),
    };
    const { parsed, usage } = await this.parseWithRetry(params, request.signal);
    return { verdict: parsed, usage };
  }

  /**
   * One retry over the whole prompt, and a bill that counts both of them.
   *
   * The retry is not a cheap correction: it re-sends every system block and the
   * entire transcript. Reporting only the last attempt's usage hid a full
   * prompt's worth of input every time the model fumbled the shape once, and
   * hid two of them when it fumbled twice — the failure path threw an error
   * carrying no usage at all, so the most expensive outcome was the one the
   * session meter never saw. Both attempts are accumulated, and the total rides
   * out on the error when there is nothing else to hand back.
   *
   * The signal goes in the SDK's request OPTIONS. Spreading it into `params`
   * would put it in the JSON body the vendor parses.
   */
  private async parseWithRetry(
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
  ): Promise<{ parsed: unknown; usage: LlmUsage }> {
    const model = typeof params.model === 'string' ? params.model : undefined;
    const options = signal === undefined ? undefined : { signal };
    let billed: LlmUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      ...(model === undefined ? {} : { model }),
    };
    let lastRaw = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = (await this.sdk.messages.parse(params as never, options)) as ParsedResponse;
      // Counted BEFORE the refusal is raised, not after. A refusal is the model
      // declining, which is not a billing question — but it is still a billed
      // call, and on a retry it is a billed call standing on top of another one.
      billed = addLlmUsage(billed, usageOf(response, model));
      if (response.stop_reason === 'refusal') throw new BrainRefusalError(undefined, billed);
      if (response.parsed_output !== null && response.parsed_output !== undefined) {
        return { parsed: response.parsed_output, usage: billed };
      }
      lastRaw = (response.content ?? [])
        .map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
        .join('');
    }
    throw new BrainParseError('The model did not return a contract-shaped turn.', lastRaw, billed);
  }
}

function outputConfig(
  schema:
    | typeof TurnSchema
    | typeof ScenarioFrameSchema
    | typeof MemoryExtractionSchema
    | typeof DrillBatchSchema
    | typeof CurationSchema
    | typeof OwnWordsVerdictSchema,
  effort: BrainEffort | undefined,
): Record<string, unknown> {
  const config: Record<string, unknown> = { format: zodOutputFormat(schema) };
  if (effort !== undefined) config.effort = effort;
  return config;
}

/**
 * The neutral bill. No arithmetic to undo here: this vendor already reports
 * `input_tokens` as the uncached remainder, so the three buckets are disjoint
 * on the wire. OpenAI's are not — see openaiResponses.ts.
 */
function usageOf(response: ParsedResponse, model: string | undefined): LlmUsage {
  const thinking = response.usage?.output_tokens_details?.thinking_tokens;
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    cacheReadTokens: response.usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage?.cache_creation_input_tokens ?? 0,
    // Part of outputTokens, never added to it. Absent when unreported.
    ...(typeof thinking === 'number' ? { reasoningTokens: thinking } : {}),
    ...(model === undefined ? {} : { model }),
  };
}

/**
 * Map the provider-neutral transcript to wire messages. The newest learner
 * message carries the incremental cache breakpoint; the trailing app context
 * follows it — so the context can change every turn without touching the
 * cached prefix, and the learner message's bytes match what history will
 * resend next turn.
 *
 * On models that accept it, the context keeps its system role (native
 * mid-conversation system message, SDK typings notwithstanding). On models
 * that reject that role after history, the context is demoted to a user
 * message: its text already opens with the [CONTEXT FROM THE APP…] tag, which
 * is the same defense the $0 fallback has always relied on.
 */
function toProviderMessages(messages: readonly ChatMessage[], midConversationSystem: boolean): Record<string, unknown>[] {
  const lastUserIndex = messages.reduce((found, m, i) => (m.role === 'user' ? i : found), -1);
  return messages.map((message, index) => ({
    role: message.role === 'system' && !midConversationSystem ? 'user' : message.role,
    content: [
      index === lastUserIndex
        ? { type: 'text', text: message.text, cache_control: { type: 'ephemeral' } }
        : { type: 'text', text: message.text },
    ],
  }));
}
