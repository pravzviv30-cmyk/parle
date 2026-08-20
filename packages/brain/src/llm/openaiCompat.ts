/**
 * The $0 fallback: any OpenAI-compatible chat endpoint, Groq by default.
 *
 * JSON mode has no server-side schema enforcement, so the schema travels in
 * the prompt and validation happens here with the same zod contract, plus one
 * repair round-trip. Coaching quality is visibly weaker than the real brain;
 * that is the accepted trade of the free tier, exactly like the tutor-agent's
 * groq default.
 */

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { MemoryExtractionSchema, ScenarioFrameSchema, TurnSchema } from '../contract/schemas.ts';
import type { MemoryExtraction, ScenarioFrame, TutorTurn } from '../contract/types.ts';
import { CurationSchema, type Curation } from '../curate/curate.ts';
import { DrillBatchSchema, type DrillBatch } from '../drill/generate.ts';
import {
  BrainParseError,
  type BrainCurateRequest,
  type BrainDrillsRequest,
  type BrainExtractRequest,
  type BrainFrameRequest,
  type BrainTurnRequest,
  type ChatMessage,
  type LlmClient,
  type LlmUsage,
} from './client.ts';

export interface OpenAiCompatConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * The free-tier talker.
 *
 * Groq retires models on its own schedule and answers a request for a retired
 * one with a bare 404 — no hint that the name is the problem. `llama-3.3-70b-versatile`
 * was the default here until Groq dropped it, and the failure surfaced as a
 * tutor that joined the room and never spoke, because every turn threw before
 * a single word reached the voice.
 *
 * So this is a name with a shelf life, not a constant. GROQ_MODEL overrides it,
 * which makes the next retirement a line in .env rather than a code change and
 * a release.
 */
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

/**
 * The model this client will use absent an explicit one. Empty is treated as
 * absent, exactly as the tutor-agent's TUTOR_LLM is — a `GROQ_MODEL=` line
 * left in a copied .env should read as "unset", not as a request for a model
 * with no name.
 */
export function defaultModel(env: Record<string, string | undefined> = process.env): string {
  const raw = (env.GROQ_MODEL ?? '').trim();
  return raw === '' ? DEFAULT_MODEL : raw;
}

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

type ContractSchema =
  | typeof TurnSchema
  | typeof ScenarioFrameSchema
  | typeof MemoryExtractionSchema
  | typeof DrillBatchSchema
  | typeof CurationSchema;

function jsonSchemaText(schema: ContractSchema): string {
  const format = zodOutputFormat(schema) as { schema?: unknown };
  return JSON.stringify(format.schema ?? format);
}

export class OpenAiCompatBrainClient implements LlmClient {
  private readonly config: Required<OpenAiCompatConfig>;
  private readonly fetchFn: FetchLike;

  constructor(config: OpenAiCompatConfig, fetchFn: FetchLike = globalThis.fetch as unknown as FetchLike) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      model: config.model ?? defaultModel(),
    };
    this.fetchFn = fetchFn;
  }

  async turn(request: BrainTurnRequest): Promise<{ turn: TutorTurn; usage: LlmUsage }> {
    const system = [request.system.persona, request.system.pack, request.system.contract].join('\n\n');
    const { value, usage } = await this.completeJson(system, request.messages, TurnSchema, jsonSchemaText(TurnSchema));
    return { turn: value as TutorTurn, usage };
  }

  async frame(request: BrainFrameRequest): Promise<{ frame: ScenarioFrame; usage: LlmUsage }> {
    const system = [request.system.persona, request.system.pack].join('\n\n');
    const { value, usage } = await this.completeJson(
      system,
      [{ role: 'user', text: request.request }],
      ScenarioFrameSchema,
      jsonSchemaText(ScenarioFrameSchema),
    );
    return { frame: value as ScenarioFrame, usage };
  }

  async extract(request: BrainExtractRequest): Promise<{ extraction: MemoryExtraction; usage: LlmUsage }> {
    const system = [request.system.persona, request.system.pack].join('\n\n');
    const { value, usage } = await this.completeJson(
      system,
      [{ role: 'user', text: request.request }],
      MemoryExtractionSchema,
      jsonSchemaText(MemoryExtractionSchema),
    );
    return { extraction: value as MemoryExtraction, usage };
  }

  async drills(request: BrainDrillsRequest): Promise<{ batch: DrillBatch; usage: LlmUsage }> {
    const system = [request.system.persona, request.system.pack].join('\n\n');
    const { value, usage } = await this.completeJson(
      system,
      [{ role: 'user', text: request.request }],
      DrillBatchSchema,
      jsonSchemaText(DrillBatchSchema),
    );
    return { batch: value as DrillBatch, usage };
  }

  async curate(request: BrainCurateRequest): Promise<{ curation: Curation; usage: LlmUsage }> {
    const system = [request.system.persona, request.system.pack].join('\n\n');
    const { value, usage } = await this.completeJson(
      system,
      [{ role: 'user', text: request.request }],
      CurationSchema,
      jsonSchemaText(CurationSchema),
    );
    return { curation: value as Curation, usage };
  }

  private async completeJson(
    system: string,
    messages: readonly ChatMessage[],
    schema: ContractSchema,
    schemaText: string,
  ): Promise<{ value: unknown; usage: LlmUsage }> {
    const wire = [
      { role: 'system', content: `${system}\n\nReturn ONLY one JSON object matching this JSON schema, no prose:\n${schemaText}` },
      ...messages.map((m) => ({ role: m.role, content: m.text })),
    ];

    const usage: LlmUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    let lastRaw = '';
    let lastError = '';

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const body = attempt === 0 ? wire : [
        ...wire,
        { role: 'assistant', content: lastRaw },
        { role: 'user', content: `That was not a valid object (${lastError}). Return ONLY the corrected JSON object.` },
      ];
      const completion = await this.post(body);
      usage.inputTokens += completion.usage?.prompt_tokens ?? 0;
      usage.outputTokens += completion.usage?.completion_tokens ?? 0;

      lastRaw = completion.choices?.[0]?.message?.content ?? '';
      try {
        return { value: schema.parse(JSON.parse(lastRaw)), usage };
      } catch (error) {
        lastError = error instanceof Error ? error.message.slice(0, 400) : 'unknown parse failure';
      }
    }
    throw new BrainParseError('The fallback model did not produce a contract-shaped object.', lastRaw);
  }

  private async post(messages: { role: string; content: string }[]): Promise<ChatCompletion> {
    const response = await this.fetchFn(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        response_format: { type: 'json_object' },
        messages,
      }),
    });
    if (!response.ok) {
      throw new Error(`Chat completion failed with status ${response.status}`);
    }
    return (await response.json()) as ChatCompletion;
  }
}
