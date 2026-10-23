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

import { MemoryExtractionSchema, ScenarioFrameSchema, TurnSchema, withMissingGoalObservation } from '../contract/schemas.ts';
import type { EarlySpokenTurn, MemoryExtraction, ScenarioFrame, TutorTurn } from '../contract/types.ts';
import { CurationSchema, type Curation } from '../curate/curate.ts';
import { DrillBatchSchema, type DrillBatch } from '../drill/generate.ts';
import { OwnWordsVerdictSchema } from './judge.ts';
import { FixLineVerdictSchema } from './fixLineJudge.ts';
import {
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
import { realSleep, retryAfterMs, type FetchLike, type SleepLike } from './http.ts';
import { isAnalystActivity, openAiEffortFor, resolveRouting, type BrainActivity, type BrainEffort, type BrainRouting } from './routing.ts';
import { SpokenFieldsWatcher } from './spokenFields.ts';

/**
 * What `complete` needs from any request: the bytes its cache key is cut from,
 * and the abort. The judge has no three-block prefix — its whole system block
 * is the grader's brief — so this is a string rather than the blocks, and the
 * callers that do have blocks join them before handing them over.
 */
type PromptRequest = { cacheSeed: string; signal?: AbortSignal; onSpokenFields?: (early: EarlySpokenTurn) => void };

type ContractSchema =
  | typeof TurnSchema
  | typeof ScenarioFrameSchema
  | typeof MemoryExtractionSchema
  | typeof DrillBatchSchema
  | typeof CurationSchema
  | typeof OwnWordsVerdictSchema
  | typeof FixLineVerdictSchema;

export interface OpenAiResponsesConfig {
  apiKey?: string;
  baseUrl?: string;
  /** Fast, inexpensive model used for the calls a learner waits through. */
  turnModel?: string;
  /** Live turn/frame override; leaves curated practice and written judgments on turnModel. */
  liveModel?: string;
  /** Stronger model used for the calls that run once the room has closed. */
  analystModel?: string;
  /**
   * OpenAI `service_tier` for the live calls only (turn and frame). Opt-in,
   * default off: `priority` is billed at a higher rate. Falls back to
   * `OPENAI_LIVE_SERVICE_TIER`; anything unrecognised means the field is omitted.
   */
  liveServiceTier?: string;
  /** Per-activity effort and size. Defaults to the shared table, env applied. */
  routing?: BrainRouting;
}

/** The wiring half of the config: the two names, and where to send them. */
type Wiring = Required<Pick<OpenAiResponsesConfig, 'apiKey' | 'baseUrl' | 'turnModel' | 'liveModel' | 'analystModel'>>;

type FetchResponse = Awaited<ReturnType<FetchLike>>;

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_TURN_MODEL = 'gpt-5.6-luna';
export const DEFAULT_OPENAI_LIVE_MODEL = 'gpt-6-luna';
export const DEFAULT_OPENAI_ANALYST_MODEL = 'gpt-5.6-terra';

const SERVICE_TIERS = ['priority', 'default', 'auto', 'flex'] as const;
export type OpenAiServiceTier = (typeof SERVICE_TIERS)[number];
let warnedServiceTier = false;

/**
 * The live calls' service tier, from config then `OPENAI_LIVE_SERVICE_TIER`.
 * Unset or unrecognised means null: the request carries no `service_tier`.
 */
export function openAiLiveServiceTier(env: Record<string, string | undefined> = process.env,
  config: Pick<OpenAiResponsesConfig, 'liveServiceTier'> = {}): OpenAiServiceTier | null {
  const raw = (config.liveServiceTier?.trim() || env.OPENAI_LIVE_SERVICE_TIER?.trim() || '').toLowerCase();
  if (raw === '') return null;
  if ((SERVICE_TIERS as readonly string[]).includes(raw)) return raw as OpenAiServiceTier;
  if (!warnedServiceTier) {
    warnedServiceTier = true;
    console.warn(`[luvani] OPENAI_LIVE_SERVICE_TIER is not one of ${SERVICE_TIERS.join(', ')}; using the standard tier.`);
  }
  return null;
}

/** One resolver for the brain, scripted SDK and startup probe; legacy overrides remain valid. */
export function openAiLiveModel(env: Record<string, string | undefined> = process.env,
  config: Pick<OpenAiResponsesConfig, 'liveModel' | 'turnModel'> = {}): string {
  return config.liveModel?.trim() || env.OPENAI_LIVE_MODEL?.trim() || config.turnModel?.trim() ||
    env.OPENAI_TURN_MODEL?.trim() || DEFAULT_OPENAI_LIVE_MODEL;
}

type ModelConfig = Pick<OpenAiResponsesConfig, 'turnModel' | 'liveModel' | 'analystModel'>;

/** The three model names the client sends, from config then env then the defaults. */
export function openAiModels(env: Record<string, string | undefined> = process.env,
  config: ModelConfig = {}): Pick<Wiring, 'turnModel' | 'liveModel' | 'analystModel'> {
  return {
    turnModel: config.turnModel?.trim() || env.OPENAI_TURN_MODEL?.trim() || DEFAULT_OPENAI_TURN_MODEL,
    liveModel: openAiLiveModel(env, config),
    analystModel: config.analystModel?.trim() || env.OPENAI_ANALYST_MODEL?.trim() || DEFAULT_OPENAI_ANALYST_MODEL,
  };
}

/**
 * The model OpenAiResponsesBrainClient sends one activity to. The client routes
 * through this, and a harness that has to label or price a run before any usage
 * exists asks it too, so the two cannot disagree.
 */
export function openAiModelFor(activity: BrainActivity, env: Record<string, string | undefined> = process.env,
  config: ModelConfig & Pick<OpenAiResponsesConfig, 'routing'> = {}): string {
  return pickModel(activity, openAiModels(env, config), config.routing ?? resolveRouting(env));
}

function pickModel(activity: BrainActivity, models: Pick<Wiring, 'turnModel' | 'liveModel' | 'analystModel'>, routing: BrainRouting): string {
  return isAnalystActivity(activity, routing) ? models.analystModel
    : activity === 'turn' || activity === 'frame' ? models.liveModel : models.turnModel;
}

/**
 * Which of the two models answers is asked of routing.ts, not decided here.
 *
 * This used to be a local table keyed on "is a learner waiting?", which is a
 * different question from "which tier does this need" and agreed with routing.ts
 * on four activities out of five. The fifth was curate: nobody waits for it, so
 * the local table sent it to the analyst, while routing.ts had already put it on
 * the cheap tier on purpose and said why — a ranking task over material already
 * in hand gains little from the careful model. Measured, that disagreement cost
 * $0.0130 a session to produce 199 output tokens, about 11% of a whole session,
 * and it was invisible until the meter could see per-activity spend (F104).
 *
 * The tier is a routing question and routing.ts owns it. Which PROVIDER serves
 * a call remains a wiring decision, and that still lives here and in split.ts.
 */

const FORMAT_NAME: Record<BrainActivity, string> = {
  turn: 'luvani_tutor_turn',
  frame: 'luvani_scenario',
  extract: 'luvani_memory',
  drills: 'luvani_drills',
  curate: 'luvani_practice',
  judge: 'luvani_own_words_verdict',
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

/** Every block of one system prefix, in order, as the cache key hashes them. */
function cacheSeedOf(system: { persona: string; pack: string; contract: string }): string {
  return `${system.persona}${system.pack}${system.contract}`;
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
function cacheKeyFor(activity: BrainActivity, cacheSeed: string): string {
  const digest = createHash('sha256').update(cacheSeed).digest('hex').slice(0, 8);
  return `luvani-${activity}-${digest}`;
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

/** The cache seed and the abort, lifted off a request that carries blocks. */
function promptRequest(request: { system: { persona: string; pack: string; contract: string }; signal?: AbortSignal }): PromptRequest {
  return { cacheSeed: cacheSeedOf(request.system), ...(request.signal === undefined ? {} : { signal: request.signal }) };
}

export class OpenAiResponsesBrainClient implements LlmClient {
  private readonly fetchFn: FetchLike;
  private readonly sleep: SleepLike;
  private readonly config: Wiring;
  private readonly routing: BrainRouting;
  private readonly explicitEffort: boolean;
  private readonly liveServiceTier: OpenAiServiceTier | null;

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
      ...openAiModels(process.env, config),
    };
    this.routing = config.routing ?? resolveRouting();
    this.liveServiceTier = openAiLiveServiceTier(process.env, config);
    this.explicitEffort = config.routing !== undefined || ['low', 'medium', 'high'].includes(process.env.BRAIN_EFFORT ?? '');
  }

  async turn(request: BrainTurnRequest): Promise<{ turn: TutorTurn; usage: LlmUsage }> {
    const result = await this.complete('turn', {
      ...promptRequest(request),
      ...(request.onSpokenFields === undefined ? {} : { onSpokenFields: request.onSpokenFields }),
    }, instructionsFor(request, true), request.messages, TurnSchema);
    return { turn: result.value as TutorTurn, usage: result.usage };
  }

  async frame(request: BrainFrameRequest): Promise<{ frame: ScenarioFrame; usage: LlmUsage }> {
    const result = await this.complete(
      'frame',
      promptRequest(request),
      instructionsFor(request, false),
      [{ role: 'user', text: request.request }],
      ScenarioFrameSchema,
    );
    return { frame: result.value as ScenarioFrame, usage: result.usage };
  }

  async extract(request: BrainExtractRequest): Promise<{ extraction: MemoryExtraction; usage: LlmUsage }> {
    const result = await this.complete(
      'extract',
      promptRequest(request),
      instructionsFor(request, false),
      [{ role: 'user', text: request.request }],
      MemoryExtractionSchema,
    );
    return { extraction: result.value as MemoryExtraction, usage: result.usage };
  }

  async drills(request: BrainDrillsRequest): Promise<{ batch: DrillBatch; usage: LlmUsage }> {
    const result = await this.complete(
      'drills',
      promptRequest(request),
      instructionsFor(request, false),
      [{ role: 'user', text: request.request }],
      DrillBatchSchema,
    );
    return { batch: result.value as DrillBatch, usage: result.usage };
  }

  async curate(request: BrainCurateRequest): Promise<{ curation: Curation; usage: LlmUsage }> {
    const result = await this.complete(
      'curate',
      promptRequest(request),
      instructionsFor(request, false),
      [{ role: 'user', text: request.request }],
      CurationSchema,
    );
    return { curation: result.value as Curation, usage: result.usage };
  }

  /**
   * One paraphrase, judged. The prefix here is short and entirely its own, so
   * the cache key is cut from the grader's brief: it still rotates when that
   * brief is edited, which is the property that matters.
   */
  async judge(request: BrainJudgeRequest): Promise<{ verdict: unknown; usage: LlmUsage }> {
    const result = await this.complete(
      'judge',
      { cacheSeed: request.system, ...(request.signal === undefined ? {} : { signal: request.signal }) },
      request.system,
      [{ role: 'user', text: request.request }],
      request.judgeType === 'fix-line' ? FixLineVerdictSchema : OwnWordsVerdictSchema,
    );
    return { verdict: result.value, usage: result.usage };
  }

  /** One activity's model, effort and size. Two tables, one question each. */
  private routeFor(activity: BrainActivity): { model: string; effort: BrainEffort | 'none' | undefined; maxTokens: number } {
    const route = this.routing[activity];
    const model = pickModel(activity, this.config, this.routing);
    return {
      model,
      effort: openAiEffortFor(activity, model, route.effort, this.explicitEffort),
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
    // Only a live turn whose caller can use its spoken fields early streams.
    // Every other call, and a turn nobody is waiting to speak, stays one
    // request and one JSON body, exactly as before.
    const watcher = activity === 'turn' && request.onSpokenFields ? new SpokenFieldsWatcher() : null;
    // Priority processing is for the calls a learner waits through, never for
    // analyst work after the room has closed.
    const live = (activity === 'turn' || activity === 'frame') && !isAnalystActivity(activity, this.routing);
    const body = JSON.stringify({
      model: route.model,
      ...(live && this.liveServiceTier !== null ? { service_tier: this.liveServiceTier } : {}),
      instructions,
      input: inputMessages(messages),
      // An undefined effort means "leave the vendor's own default in place"
      // (routing.ts). On this API the only way to say that is to omit the key
      // entirely — an empty reasoning object is a different sentence.
      ...(route.effort === undefined ? {} : { reasoning: { effort: route.effort } }),
      max_output_tokens: route.maxTokens,
      store: false,
      ...(watcher ? { stream: true } : {}),
      // Cache addressing only. Nothing here changes what the model is asked to
      // do, which is the whole reason it is safe on the realtime path.
      prompt_cache_key: cacheKeyFor(activity, request.cacheSeed),
      text: {
        // Bounded room comparisons reduced live output and reply time at low
        // verbosity. Keep the complete schema and teaching instructions: this
        // sets a detail preference, never a token cap or a partial turn. Only
        // this exact measured model/activity opts in; custom routes and all
        // other activities retain their existing provider options.
        ...(activity === 'turn' && route.model === DEFAULT_OPENAI_LIVE_MODEL ? { verbosity: 'low' } : {}),
        format: {
          type: 'json_schema',
          name: FORMAT_NAME[activity],
          strict: true,
          schema: schemaJson(schema),
        },
      },
    });

    const payload = watcher
      ? await this.postStreaming(body, request.signal, (delta) => {
        const early = watcher.feed(delta);
        if (early === null) return;
        // The caller's business. A throw there must not cost the learner the turn.
        try { request.onSpokenFields?.(early); } catch { /* the full turn still lands */ }
      })
      : await this.post(body, request.signal);

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
      const decoded: unknown = JSON.parse(raw);
      value = schema.parse(schema === TurnSchema ? withMissingGoalObservation(decoded) : decoded);
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

  /**
   * The streaming twin of `post`: the same single rate-limit retry, then the
   * server-sent events read as they arrive. Text deltas go to `onText`, and
   * the terminal event's response object is returned in the same shape `post`
   * returns, so everything after it (refusal, parse, usage) is shared.
   *
   * A response with no readable body, which is how every non-streaming fake
   * and any proxy that buffers looks, is read as a plain JSON body instead.
   */
  private async postStreaming(body: string, signal: AbortSignal | undefined, onText: (delta: string) => void): Promise<ResponsesPayload> {
    let response = await this.send(body, signal);
    if (response.status === 429) {
      await this.sleep(retryAfterMs(response.headers?.get('retry-after')));
      response = await this.send(body, signal);
    }
    if (!response.ok || !response.body) return unwrap(response);
    return readResponseEvents(response.body, onText);
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

interface StreamEvent {
  type?: string;
  delta?: string;
  response?: ResponsesPayload;
  message?: string;
  error?: { message?: string } | null;
}

/**
 * Read a Responses API event stream to its terminal event.
 *
 * Only three kinds of event matter: a text delta, the terminal response
 * (completed, incomplete or failed, each carrying the whole response object),
 * and an error. Everything else (reasoning, refusal deltas, bookkeeping) is
 * ignored, because the terminal response carries the final word on all of it.
 */
export async function readResponseEvents(stream: ReadableStream<Uint8Array>, onText: (delta: string) => void): Promise<ResponsesPayload> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: ResponsesPayload | null = null;
  const handle = (block: string): void => {
    const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
    if (data.length === 0 || data === '[DONE]') return;
    let event: StreamEvent;
    try { event = JSON.parse(data) as StreamEvent; } catch { return; }
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') onText(event.delta);
    else if ((event.type === 'response.completed' || event.type === 'response.incomplete') && event.response) final = event.response;
    else if (event.type === 'response.failed') throw new Error(event.response?.error?.message ?? 'OpenAI response failed');
    else if (event.type === 'error') throw new Error(event.message ?? event.error?.message ?? 'OpenAI stream failed');
  };
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) { finished = true; break; }
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      for (let split = buffer.indexOf('\n\n'); split !== -1; split = buffer.indexOf('\n\n')) {
        handle(buffer.slice(0, split));
        buffer = buffer.slice(split + 2);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim().length > 0) handle(buffer);
  } finally {
    // A failed or error event ends the read early: close the connection rather
    // than leave the rest of the response streaming into nothing.
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (final === null) throw new Error('OpenAI stream ended without a response');
  return final;
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
