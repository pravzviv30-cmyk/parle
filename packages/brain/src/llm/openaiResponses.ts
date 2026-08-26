/**
 * OpenAI's Responses API behind the provider-neutral brain contract.
 *
 * The live tutor still uses the proven cascaded audio path (STT -> brain ->
 * TTS), because the app needs a transcript, corrections, practice material and
 * account memory from every turn. This client replaces only the intelligence
 * layer and uses strict JSON schemas so changing providers cannot change the
 * engine's decisions.
 */

import { createHash } from 'node:crypto';

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { MemoryExtractionSchema, ScenarioFrameSchema, TurnSchema } from '../contract/schemas.ts';
import type { MemoryExtraction, ScenarioFrame, TutorTurn } from '../contract/types.ts';
import { CurationSchema, type Curation } from '../curate/curate.ts';
import { DrillBatchSchema, type DrillBatch } from '../drill/generate.ts';
import {
  BrainParseError,
  BrainRefusalError,
  type BrainCurateRequest,
  type BrainDrillsRequest,
  type BrainExtractRequest,
  type BrainFrameRequest,
  type BrainTurnRequest,
  type ChatMessage,
  type LlmClient,
  type LlmUsage,
} from './client.ts';
import { realSleep, retryAfterMs, type FetchLike, type SleepLike } from './http.ts';
import { resolveRouting, type BrainActivity, type BrainEffort, type BrainRouting } from './routing.ts';

/** What `complete` needs from any of the five requests: the prefix, and the abort. */
type PromptRequest = { system: { persona: string; pack: string; contract: string }; signal?: AbortSignal };

type ContractSchema =
  | typeof TurnSchema
  | typeof ScenarioFrameSchema
  | typeof MemoryExtractionSchema
  | typeof DrillBatchSchema
  | typeof CurationSchema;

export interface OpenAiResponsesConfig {
  apiKey?: string;
  baseUrl?: string;
  /** Fast, inexpensive model used for the calls a learner waits through. */
  turnModel?: string;
  /** Stronger model used for the calls that run once the room has closed. */
  analystModel?: string;
  /** Per-activity effort and size. Defaults to the shared table, env applied. */
  routing?: BrainRouting;
}

/** The wiring half of the config: the two names, and where to send them. */
type Wiring = Required<Pick<OpenAiResponsesConfig, 'apiKey' | 'baseUrl' | 'turnModel' | 'analystModel'>>;

type FetchResponse = Awaited<ReturnType<FetchLike>>;

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_TURN_MODEL = 'gpt-5.6-luna';
export const DEFAULT_OPENAI_ANALYST_MODEL = 'gpt-5.6-terra';

/**
 * Which of the two models answers, decided by who is waiting.
 *
 * routing.ts owns effort and size for all five activities and is the single
 * source of truth for both. It cannot own this one: the model names it carries
 * are Claude's, and which provider serves a call is a wiring decision, not a
 * routing one (see split.ts).
 *
 * The line drawn here is not a new one. It is exactly SplitBrainClient's: the
 * turn is silence the learner stands in, and the frame is silence behind the
 * bridge line, so both go to the fast model. extract, drills and curate run
 * once the room has closed with nobody waiting, and what they write shapes
 * every later session, so they go to the analyst.
 */
const WAITING: Record<BrainActivity, boolean> = {
  turn: true,
  frame: true,
  extract: false,
  drills: false,
  curate: false,
};

const FORMAT_NAME: Record<BrainActivity, string> = {
  turn: 'parle_tutor_turn',
  frame: 'parle_scenario',
  extract: 'parle_memory',
  drills: 'parle_drills',
  curate: 'parle_practice',
};

interface ResponsesPayload {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string } | null;
  output?: {
    type?: string;
    content?: { type?: string; text?: string; refusal?: string }[];
  }[];
  usage?: {
    /**
     * Includes BOTH cache columns below — this API's documented identity is
     * `input_tokens = uncached + cached_tokens + cache_write_tokens`. Anthropic
     * says the opposite, so this is where the two are reconciled.
     */
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
    /** Thinking, billed inside output_tokens. Anthropic's key is thinking_tokens. */
    output_tokens_details?: { reasoning_tokens?: number };
  };
}

function schemaJson(schema: ContractSchema): unknown {
  const format = zodOutputFormat(schema) as { schema?: unknown };
  return format.schema ?? format;
}

function instructionsFor(request: { system: { persona: string; pack: string; contract: string } }, includeContract: boolean): string {
  return [request.system.persona, request.system.pack, includeContract ? request.system.contract : null]
    .filter((part): part is string => part !== null)
    .join('\n\n');
}

function inputMessages(messages: readonly ChatMessage[]): { role: 'user' | 'assistant' | 'developer'; content: string }[] {
  return messages.map((message) => ({
    role: message.role === 'system' ? 'developer' : message.role,
    content: message.text,
  }));
}

/**
 * The key that pins one activity's frozen prefix to one cache entry.
 *
 * Every call carries roughly 4.3k tokens of persona, authenticity pack and
 * contract that are identical for every learner and every session. That is
 * exactly what a shared cache is for, and without a key the vendor's routing
 * decides on its own whether two requests land where the prefix already is.
 *
 * Two properties, and both matter:
 *
 *   - Stable across sessions and users. Nothing learner-specific goes in — no
 *     account id, no session id — because sharing the prefix IS the saving.
 *   - Changes when the prompt changes. The hash covers all three system blocks,
 *     so editing the persona rotates the key rather than leaving it pointing at
 *     a prefix that no longer exists. A key naming a stale prefix is worse than
 *     no key: it pins traffic to a guaranteed miss.
 *
 * All three blocks are hashed even for the calls that send only two, so one
 * build of the system blocks has one identity. The activity segment already
 * keeps the two prompt shapes apart, and over-rotating on a prompt edit costs a
 * single cold call at deploy time.
 */
function cacheKeyFor(activity: BrainActivity, system: { persona: string; pack: string; contract: string }): string {
  const digest = createHash('sha256').update(`${system.persona}${system.pack}${system.contract}`).digest('hex').slice(0, 8);
  return `parle-${activity}-${digest}`;
}

/**
 * Why the answer did not parse, when the payload already knows.
 *
 * Reasoning tokens count against max_output_tokens on this API, so a call that
 * thinks hard under a tight cap comes back `incomplete` with nothing in it.
 * That is a size limit, not a model that cannot write JSON, and saying which
 * one it was is the difference between raising a number in the routing table
 * and rewriting a prompt that was never the problem.
 */
function parseFailure(payload: ResponsesPayload): string {
  if (payload.status === 'incomplete') {
    return `OpenAI stopped early and returned an incomplete answer (${payload.incomplete_details?.reason ?? 'reason not given'}).`;
  }
  return 'OpenAI did not return a contract-shaped object.';
}

async function unwrap(response: FetchResponse): Promise<ResponsesPayload> {
  const payload = (await response.json()) as ResponsesPayload;
  if (!response.ok) throw new Error(payload.error?.message ?? `OpenAI response failed with status ${response.status}`);
  return payload;
}

export class OpenAiResponsesBrainClient implements LlmClient {
  private readonly fetchFn: FetchLike;
  private readonly sleep: SleepLike;
  private readonly config: Wiring;
  private readonly routing: BrainRouting;

  constructor(
    config: OpenAiResponsesConfig = {},
    fetchFn: FetchLike = globalThis.fetch as unknown as FetchLike,
    sleep: SleepLike = realSleep,
  ) {
    this.fetchFn = fetchFn;
    this.sleep = sleep;
    this.config = {
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY ?? '',
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      turnModel: config.turnModel ?? (process.env.OPENAI_TURN_MODEL?.trim() || DEFAULT_OPENAI_TURN_MODEL),
      analystModel: config.analystModel ?? (process.env.OPENAI_ANALYST_MODEL?.trim() || DEFAULT_OPENAI_ANALYST_MODEL),
    };
    this.routing = config.routing ?? resolveRouting();
  }

  async turn(request: BrainTurnRequest): Promise<{ turn: TutorTurn; usage: LlmUsage }> {
    const result = await this.complete('turn', request, instructionsFor(request, true), request.messages, TurnSchema);
    return { turn: result.value as TutorTurn, usage: result.usage };
  }

  async frame(request: BrainFrameRequest): Promise<{ frame: ScenarioFrame; usage: LlmUsage }> {
    const result = await this.complete(
      'frame',
      request,
      instructionsFor(request, false),
      [{ role: 'user', text: request.request }],
      ScenarioFrameSchema,
    );
    return { frame: result.value as ScenarioFrame, usage: result.usage };
  }

  async extract(request: BrainExtractRequest): Promise<{ extraction: MemoryExtraction; usage: LlmUsage }> {
    const result = await this.complete(
      'extract',
      request,
      instructionsFor(request, false),
      [{ role: 'user', text: request.request }],
      MemoryExtractionSchema,
    );
    return { extraction: result.value as MemoryExtraction, usage: result.usage };
  }

  async drills(request: BrainDrillsRequest): Promise<{ batch: DrillBatch; usage: LlmUsage }> {
    const result = await this.complete(
      'drills',
      request,
      instructionsFor(request, false),
      [{ role: 'user', text: request.request }],
      DrillBatchSchema,
    );
    return { batch: result.value as DrillBatch, usage: result.usage };
  }

  async curate(request: BrainCurateRequest): Promise<{ curation: Curation; usage: LlmUsage }> {
    const result = await this.complete(
      'curate',
      request,
      instructionsFor(request, false),
      [{ role: 'user', text: request.request }],
      CurationSchema,
    );
    return { curation: result.value as Curation, usage: result.usage };
  }

  /** One activity's model, effort and size. Two tables, one question each. */
  private routeFor(activity: BrainActivity): { model: string; effort: BrainEffort | undefined; maxTokens: number } {
    const route = this.routing[activity];
    return {
      model: WAITING[activity] ? this.config.turnModel : this.config.analystModel,
      effort: route.effort,
      maxTokens: route.maxTokens,
    };
  }

  private async complete(
    activity: BrainActivity,
    request: PromptRequest,
    instructions: string,
    messages: readonly ChatMessage[],
    schema: ContractSchema,
  ): Promise<{ value: unknown; usage: LlmUsage }> {
    const route = this.routeFor(activity);
    const body = JSON.stringify({
      model: route.model,
      instructions,
      input: inputMessages(messages),
      // An undefined effort means "leave the vendor's own default in place"
      // (routing.ts). On this API the only way to say that is to omit the key
      // entirely — an empty reasoning object is a different sentence.
      ...(route.effort === undefined ? {} : { reasoning: { effort: route.effort } }),
      max_output_tokens: route.maxTokens,
      store: false,
      // Cache addressing only. Nothing here changes what the model is asked to
      // do, which is the whole reason it is safe on the realtime path.
      prompt_cache_key: cacheKeyFor(activity, request.system),
      text: {
        format: {
          type: 'json_schema',
          name: FORMAT_NAME[activity],
          strict: true,
          schema: schemaJson(schema),
        },
      },
    });

    const payload = await this.post(body, request.signal);

    const content = (payload.output ?? []).flatMap((item) => item.content ?? []);
    const refusal = content.find((part) => part.type === 'refusal')?.refusal;
    // Billed like any other answer. A declined call the meter never sees is the
    // same leak as a malformed one, so it leaves by the same door.
    if (refusal !== undefined) throw new BrainRefusalError(refusal, usageOf(payload, route.model));
    const raw = content
      .filter((part) => part.type === 'output_text')
      .map((part) => part.text ?? '')
      .join('');

    let value: unknown;
    try {
      value = schema.parse(JSON.parse(raw));
    } catch {
      // Billed all the same, so the usage rides on the error: the call the
      // meter must not miss is the one that produced nothing.
      throw new BrainParseError(parseFailure(payload), raw, usageOf(payload, route.model));
    }

    return { value, usage: usageOf(payload, route.model) };
  }

  /**
   * One request, plus the single retry a rate limit earns. See http.ts.
   *
   * Keyed on 429 and nothing else. A rejected request will be rejected again,
   * and a refusal is a 200 that never reaches here — waiting on either would
   * only spend the learner's silence.
   */
  private async post(body: string, signal: AbortSignal | undefined): Promise<ResponsesPayload> {
    const first = await this.send(body, signal);
    if (first.status !== 429) return unwrap(first);
    await this.sleep(retryAfterMs(first.headers?.get('retry-after')));
    return unwrap(await this.send(body, signal));
  }

  private send(body: string, signal: AbortSignal | undefined): Promise<FetchResponse> {
    return this.fetchFn(`${this.config.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body,
      // The caller owns the lifetime: a learner who leaves the room, or barges
      // in, makes this answer worthless before it lands.
      ...(signal === undefined ? {} : { signal }),
    });
  }
}

/**
 * The neutral bill, with this API's arithmetic undone.
 *
 * `input_tokens` here already contains both cache columns, so the uncached
 * remainder is what is left after subtracting them — that is what keeps the
 * three buckets disjoint and keeps a consumer that adds all three honest. The
 * clamp is defensive: a vendor that ever changed its mind should cost us a
 * wrong number, not a negative one.
 */
function usageOf(payload: ResponsesPayload, model: string): LlmUsage {
  const total = payload.usage?.input_tokens ?? 0;
  const cacheRead = payload.usage?.input_tokens_details?.cached_tokens ?? 0;
  const cacheWrite = payload.usage?.input_tokens_details?.cache_write_tokens ?? 0;
  const reasoning = payload.usage?.output_tokens_details?.reasoning_tokens;
  return {
    inputTokens: Math.max(0, total - cacheRead - cacheWrite),
    outputTokens: payload.usage?.output_tokens ?? 0,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    // Part of outputTokens, never added to it. Absent when unreported.
    ...(reasoning === undefined ? {} : { reasoningTokens: reasoning }),
    model,
  };
}
