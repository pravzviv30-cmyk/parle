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
import { DrillBatchSchema, type DrillBatch } from '../drill/generate.ts';
import {
  BrainParseError,
  BrainRefusalError,
  type BrainDrillsRequest,
  type BrainExtractRequest,
  type BrainFrameRequest,
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

/** The narrow slice of the SDK the adapter touches — injectable for tests. */
export interface ParseCapableSdk {
  messages: { parse(params: never): Promise<unknown> };
}

interface ParsedResponse {
  parsed_output?: unknown;
  stop_reason?: string;
  content?: { type: string; text?: string }[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
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
    const { parsed, usage } = await this.parseWithRetry(params);
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
    const { parsed, usage } = await this.parseWithRetry(params);
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
    const { parsed, usage } = await this.parseWithRetry(params);
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
    const { parsed, usage } = await this.parseWithRetry(params);
    return { batch: parsed as DrillBatch, usage };
  }

  private async parseWithRetry(params: Record<string, unknown>): Promise<{ parsed: unknown; usage: LlmUsage }> {
    let lastRaw = '';
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = (await this.sdk.messages.parse(params as never)) as ParsedResponse;
      if (response.stop_reason === 'refusal') throw new BrainRefusalError();
      const usage = usageOf(response);
      if (response.parsed_output !== null && response.parsed_output !== undefined) {
        return { parsed: response.parsed_output, usage };
      }
      lastRaw = (response.content ?? [])
        .map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
        .join('');
    }
    throw new BrainParseError('The model did not return a contract-shaped turn.', lastRaw);
  }
}

function outputConfig(
  schema: typeof TurnSchema | typeof ScenarioFrameSchema | typeof MemoryExtractionSchema | typeof DrillBatchSchema,
  effort: BrainEffort | undefined,
): Record<string, unknown> {
  const config: Record<string, unknown> = { format: zodOutputFormat(schema) };
  if (effort !== undefined) config.effort = effort;
  return config;
}

function usageOf(response: ParsedResponse): LlmUsage {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    cacheReadTokens: response.usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage?.cache_creation_input_tokens ?? 0,
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
