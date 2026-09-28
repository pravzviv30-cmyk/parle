/**
 * TypeSafe's System One endpoint, spoken to directly: Jev.
 *
 * Jev is not a brain. It writes no sentences. It reads a `state` and answers
 * typed questions about it — a yes/no probability (Noul), one option out of a
 * set (Choice), or a position on ordered levels (Score) — and it bills input
 * only, at roughly a fiftieth of the talker tier's input price with output
 * free. That makes it the right tool for exactly one kind of call in this
 * repo: an LLM prompt whose whole answer is a judgment, where the prose around
 * the judgment was only ever parsed away.
 *
 * So this is a client, not an `LlmClient`. It cannot answer a turn, a frame or
 * a drill batch, and pretending otherwise would be a second brain that fails
 * every call it was not built for. What uses it is `jevJudge.ts`, which puts
 * Jev in front of the own-words judge and hands everything it cannot settle to
 * the real brain.
 *
 * Plain fetch against the documented HTTP API rather than `@typesafe-ai/sdk`,
 * deliberately. The SDK is one small POST, and adding a dependency here means
 * regenerating package-lock.json, which CLAUDE.md records as moving ninety-odd
 * packages and the Anthropic SDK split. The wire contract is the one on
 * https://docs.typesafe.ai/api, and the retry reuses http.ts so there is still
 * one answer to "how long may a learner stand in silence".
 */

import { z } from 'zod/v4';

import type { LlmUsage } from './client.ts';
import { realSleep, retryAfterMs, type FetchLike, type SleepLike } from './http.ts';

export const TYPESAFE_BASE_URL = 'https://api.typesafe.ai/v1';

/**
 * Pinned to a version, not `jev-latest`, on purpose. The alias moves when a
 * release ships and answers can move with it, while the pass thresholds in
 * jevJudge.ts are tuned against one model. TYPESAFE_MODEL moves it on purpose.
 */
export const DEFAULT_JEV_MODEL = 'jev-1.13.0';

/** Anything JSON can carry. Instructions and criteria accept structure. */
export type JevJson = string | number | boolean | null | JevJson[] | { [key: string]: JevJson };

export interface JevNoul {
  type: 'noul';
  instructions: JevJson;
  criteria?: { true?: JevJson; false?: JevJson };
}

export interface JevChoice {
  type: 'choice';
  instructions: JevJson;
  /** Option name to rubric. Null when the name says it all. */
  criteria: Record<string, JevJson>;
}

export interface JevScore {
  type: 'score';
  instructions: JevJson;
  /** Ordered levels, lowest first. Between two and ten. */
  criteria: JevJson[];
}

export type JevQuestion = JevNoul | JevChoice | JevScore;

/**
 * What an answer may look like. Not `.strict()`, unlike the brain's own
 * contracts: those schemas describe what a model is allowed to say to a
 * learner, and this one describes a vendor response that may grow fields.
 */
const NoulAnswerZ = z.object({ type: z.literal('noul'), noul: z.number().min(0).max(1) });
const ChoiceAnswerZ = z.object({
  type: z.literal('choice'),
  choice: z.string(),
  probabilities: z.record(z.string(), z.number()),
  confidence: z.number(),
});
const ScoreAnswerZ = z.object({
  type: z.literal('score'),
  score: z.number(),
  legend: z.record(z.string(), z.string()),
  probabilities: z.record(z.string(), z.number()),
  confidence: z.number(),
});
const JevAnswerZ = z.discriminatedUnion('type', [NoulAnswerZ, ChoiceAnswerZ, ScoreAnswerZ]);

const SystemOneResponseZ = z.object({
  model: z.string(),
  answers: z.record(z.string(), JevAnswerZ),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
});

export type JevAnswer = z.infer<typeof JevAnswerZ>;
export type JevNoulAnswer = z.infer<typeof NoulAnswerZ>;
export type JevChoiceAnswer = z.infer<typeof ChoiceAnswerZ>;

export interface JevResult {
  /** The versioned model that answered, e.g. jev-1.13.0, never the alias. */
  model: string;
  answers: Record<string, JevAnswer>;
  usage: LlmUsage;
}

/**
 * Jev answered with a status that is not a result.
 *
 * The status only, never the body: a 422 describes the offending field, and
 * the field may be a learner's sentence. Nothing downstream needs more than
 * the number to decide that the brain should answer instead.
 */
export class TypeSafeError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`TypeSafe System One request failed with status ${status}`);
    this.name = 'TypeSafeError';
    this.status = status;
  }
}

export interface TypeSafeConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/** 429 is the rate limit and 529 is TypeSafe overloaded. Both ask us to wait. */
const RETRYABLE = new Set([429, 529]);

export class TypeSafeClient {
  private readonly config: Required<TypeSafeConfig>;
  private readonly fetchFn: FetchLike;
  private readonly sleep: SleepLike;

  constructor(
    config: TypeSafeConfig,
    fetchFn: FetchLike = globalThis.fetch as unknown as FetchLike,
    sleep: SleepLike = realSleep,
  ) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? DEFAULT_JEV_MODEL,
      baseUrl: config.baseUrl ?? TYPESAFE_BASE_URL,
    };
    this.fetchFn = fetchFn;
    this.sleep = sleep;
  }

  /** The model requests are sent to, so a caller can say which one it asked. */
  get model(): string {
    return this.config.model;
  }

  /**
   * Every question is asked against the same state in one request. Jev reads
   * the state once and answers the questions in parallel, which is why several
   * small questions cost barely more than one.
   *
   * Throws when a question comes back unanswered or answered as the wrong type.
   * A missing answer read as a default is how a "no" becomes a silent "yes".
   */
  async systemOne(
    state: JevJson,
    questions: Record<string, JevQuestion>,
    signal?: AbortSignal,
  ): Promise<JevResult> {
    const body = JSON.stringify({ state, model: this.config.model, questions });
    let response = await this.send(body, signal);
    if (RETRYABLE.has(response.status)) {
      // The same single capped wait every REST adapter here takes, see http.ts.
      await this.sleep(retryAfterMs(response.headers?.get('retry-after')));
      response = await this.send(body, signal);
    }
    if (!response.ok) throw new TypeSafeError(response.status);

    const parsed = SystemOneResponseZ.parse(await response.json());
    for (const [id, question] of Object.entries(questions)) {
      const answer = parsed.answers[id];
      if (answer === undefined || answer.type !== question.type) {
        throw new Error(`TypeSafe did not answer "${id}" as a ${question.type}`);
      }
    }
    return {
      model: parsed.model,
      answers: parsed.answers,
      // Jev reports no cache buckets. Output is free on Jev, but the count is
      // still passed through so pricing.ts is the one place that knows that.
      usage: {
        inputTokens: parsed.usage.input_tokens,
        outputTokens: parsed.usage.output_tokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        model: parsed.model,
      },
    };
  }

  private send(body: string, signal?: AbortSignal) {
    return this.fetchFn(`${this.config.baseUrl}/systemone`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body,
      ...(signal === undefined ? {} : { signal }),
    });
  }
}

/**
 * The Jev client this environment asks for, or null when it asks for none.
 *
 * Off unless TYPESAFE_API_KEY holds something. Empty is absent, the same
 * reading TUTOR_LLM and GROQ_MODEL get, because `TYPESAFE_API_KEY=` is the
 * line a copied .env.example leaves behind.
 */
export function typeSafeFromEnv(env: Record<string, string | undefined> = process.env): TypeSafeClient | null {
  const apiKey = (env.TYPESAFE_API_KEY ?? '').trim();
  if (apiKey === '') return null;
  const model = (env.TYPESAFE_MODEL ?? '').trim();
  return new TypeSafeClient({ apiKey, ...(model === '' ? {} : { model }) });
}
