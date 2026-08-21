/**
 * OpenAI's Responses API behind the provider-neutral brain contract.
 *
 * The live tutor still uses the proven cascaded audio path (STT -> brain ->
 * TTS), because the app needs a transcript, corrections, practice material and
 * account memory from every turn. This client replaces only the intelligence
 * layer and uses strict JSON schemas so changing providers cannot change the
 * engine's decisions.
 */

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
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
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
    const result = await this.complete('turn', instructionsFor(request, true), request.messages, TurnSchema);
    return { turn: result.value as TutorTurn, usage: result.usage };
  }

  async frame(request: BrainFrameRequest): Promise<{ frame: ScenarioFrame; usage: LlmUsage }> {
    const result = await this.complete('frame', instructionsFor(request, false), [{ role: 'user', text: request.request }], ScenarioFrameSchema);
    return { frame: result.value as ScenarioFrame, usage: result.usage };
  }

  async extract(request: BrainExtractRequest): Promise<{ extraction: MemoryExtraction; usage: LlmUsage }> {
    const result = await this.complete('extract', instructionsFor(request, false), [{ role: 'user', text: request.request }], MemoryExtractionSchema);
    return { extraction: result.value as MemoryExtraction, usage: result.usage };
  }

  async drills(request: BrainDrillsRequest): Promise<{ batch: DrillBatch; usage: LlmUsage }> {
    const result = await this.complete('drills', instructionsFor(request, false), [{ role: 'user', text: request.request }], DrillBatchSchema);
    return { batch: result.value as DrillBatch, usage: result.usage };
  }

  async curate(request: BrainCurateRequest): Promise<{ curation: Curation; usage: LlmUsage }> {
    const result = await this.complete('curate', instructionsFor(request, false), [{ role: 'user', text: request.request }], CurationSchema);
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
      text: {
        format: {
          type: 'json_schema',
          name: FORMAT_NAME[activity],
          strict: true,
          schema: schemaJson(schema),
        },
      },
    });

    const payload = await this.post(body);

    const content = (payload.output ?? []).flatMap((item) => item.content ?? []);
    const refusal = content.find((part) => part.type === 'refusal')?.refusal;
    if (refusal !== undefined) throw new BrainRefusalError(refusal);
    const raw = content
      .filter((part) => part.type === 'output_text')
      .map((part) => part.text ?? '')
      .join('');

    let value: unknown;
    try {
      value = schema.parse(JSON.parse(raw));
    } catch {
      throw new BrainParseError(parseFailure(payload), raw);
    }

    return {
      value,
      usage: {
        inputTokens: payload.usage?.input_tokens ?? 0,
        outputTokens: payload.usage?.output_tokens ?? 0,
        cacheReadTokens: payload.usage?.input_tokens_details?.cached_tokens ?? 0,
        cacheWriteTokens: payload.usage?.input_tokens_details?.cache_write_tokens ?? 0,
      },
    };
  }

  /**
   * One request, plus the single retry a rate limit earns. See http.ts.
   *
   * Keyed on 429 and nothing else. A rejected request will be rejected again,
   * and a refusal is a 200 that never reaches here — waiting on either would
   * only spend the learner's silence.
   */
  private async post(body: string): Promise<ResponsesPayload> {
    const first = await this.send(body);
    if (first.status !== 429) return unwrap(first);
    await this.sleep(retryAfterMs(first.headers?.get('retry-after')));
    return unwrap(await this.send(body));
  }

  private send(body: string): Promise<FetchResponse> {
    return this.fetchFn(`${this.config.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body,
    });
  }
}
