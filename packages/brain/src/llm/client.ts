/**
 * The seam between the brain and any model provider.
 *
 * The engine builds provider-neutral requests; an adapter turns them into real
 * API calls. Everything above this interface is pure and runs in tests with the
 * mock; everything below it is one file per provider. The quality/cost trade
 * stays a config change, exactly like the tutor-agent's TUTOR_LLM switch.
 */

import type { MemoryExtraction, ScenarioFrame, TutorTurn } from '../contract/types.ts';
import type { Curation } from '../curate/curate.ts';
import type { DrillBatch } from '../drill/generate.ts';
import type { SystemBlocks } from '../prompt/system.ts';
import type { OwnWordsJudgeInput } from './judge.ts';

/**
 * A provider-neutral transcript entry. `system` entries are app context, not
 * learner speech — adapters map them to the strongest channel the provider
 * has (a system-role message on Claude, folded context on Groq).
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

/**
 * What every request may carry: a way to stop caring about the answer.
 *
 * A learner who leaves the room, or barges in over the tutor, makes the call in
 * flight worthless before it lands. Nothing here creates the signal — the
 * caller owns the lifetime — but every adapter that speaks over a wire must be
 * able to be told.
 */
interface Abortable {
  signal?: AbortSignal;
}

export interface BrainTurnRequest extends Abortable {
  kind: 'turn';
  system: SystemBlocks;
  /** Scene plan first, then the transcript, learner turn, trailing app context. */
  messages: ChatMessage[];
}

export interface BrainFrameRequest extends Abortable {
  kind: 'frame';
  system: SystemBlocks;
  /** The scenario-builder briefing plus the learner's freeform ask. */
  request: string;
}

export interface BrainExtractRequest extends Abortable {
  kind: 'extract';
  system: SystemBlocks;
  /** The post-session question over the transcript: what did we learn about them? */
  request: string;
}

export interface BrainDrillsRequest extends Abortable {
  kind: 'drills';
  system: SystemBlocks;
  /** The drill-authoring briefing over the session's phrases and errors. */
  request: string;
}

export interface BrainCurateRequest extends Abortable {
  kind: 'curate';
  system: SystemBlocks;
  /** The practice-editor briefing: the session's topics and candidate phrases. */
  request: string;
}

/**
 * One learner paraphrase, to be judged.
 *
 * The only request here whose `system` is a plain string rather than the three
 * cached blocks, and that is the honest shape rather than an omission: the
 * judge is not the tutor. Nobody is being spoken to, so the persona and the
 * authenticity pack would be 4.3k tokens bought on every Check to change
 * nothing about a five-field verdict. The grader's brief IS the system block.
 *
 * What comes back is `unknown` on purpose. An adapter may not hand a caller
 * something it calls a verdict without `parseOwnWordsVerdict` having seen it,
 * because the one answer this drill must never invent is "that was fine".
 */
export interface BrainJudgeRequest extends Abortable {
  kind: 'judge';
  /** Absent preserves the existing own-words schema and Jev route verbatim. */
  judgeType?: 'fix-line';
  /** The grader's whole brief. See llm/judge.ts. */
  system: string;
  /** The line, its meaning, the situation, and the learner's attempt as data. */
  request: string;
  /**
   * The same facts `request` was written from, unrendered. The brain adapters
   * never read it; JevFirstBrainClient does, because Jev takes named fields
   * rather than a brief. Absent means nobody built this with
   * `buildOwnWordsJudgeRequest`, and the brain answers as it always has.
   */
  input?: OwnWordsJudgeInput;
}

/**
 * One call's bill, in a shape no consumer has to translate.
 *
 * The invariant, because the two vendors state it differently on the wire and
 * getting it wrong is a silent double-count:
 *
 *   - `inputTokens` is UNCACHED input, from every vendor. `cacheReadTokens` and
 *     `cacheWriteTokens` are the other two buckets. The three are disjoint and
 *     they sum to exactly what the vendor charges as input.
 *
 *     Anthropic reports it this way already: its `input_tokens` excludes both
 *     cache columns. OpenAI's Responses API does not: its `input_tokens`
 *     INCLUDES both `cached_tokens` and `cache_write_tokens`, so that adapter
 *     subtracts before it hands the numbers over. Normalising at the adapter
 *     boundary is what lets tutor-agent add all three and be right either way.
 *
 *   - `reasoningTokens` is a SUBSET of `outputTokens` on both vendors — the
 *     thinking is billed inside the output it produced. It is observability,
 *     never a term in a cost sum. Adding it charges for the same tokens twice.
 *
 *     It is optional on purpose. The Groq fallback and the `claude` command
 *     line report no breakout at all, and a hard 0 there would read as "the
 *     model thought about nothing" rather than "nobody said".
 *
 *   - `model` is whichever model actually served the call, so a meter can price
 *     it without guessing. See pricing.ts for what an unstamped usage costs.
 */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Part of `outputTokens`, not an addition to it. Absent means unreported. */
  reasoningTokens?: number;
  /** The model that answered. Absent means nobody said, not "the default". */
  model?: string;
}

/**
 * No call was made. Deliberately carries neither `reasoningTokens` nor `model`:
 * absent is the honest reading of "no vendor has spoken here yet".
 */
export const ZERO_USAGE: LlmUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

/** True when nothing at all was billed — a seed, not a call. */
function billedNothing(usage: LlmUsage): boolean {
  return usage.inputTokens === 0 && usage.outputTokens === 0 && usage.cacheReadTokens === 0 && usage.cacheWriteTokens === 0;
}

/**
 * Which model a merged total may still claim.
 *
 * Two calls on one model keep it. Two calls on different models keep neither —
 * a mixed total priced at either side's rate is a wrong number, and pricing.ts
 * is loud about a total with no model rather than guessing one. A side that
 * billed nothing (ZERO_USAGE seeding a running total) cannot disagree with
 * anybody, so it does not erase the other side's stamp.
 */
function mergedModel(a: LlmUsage, b: LlmUsage): string | undefined {
  if (a.model === b.model) return a.model;
  if (a.model === undefined && billedNothing(a)) return b.model;
  if (b.model === undefined && billedNothing(b)) return a.model;
  return undefined;
}

/** Provider-neutral accumulation for per-session cost and cache observability. */
export function addLlmUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  const reasoning =
    a.reasoningTokens === undefined && b.reasoningTokens === undefined
      ? undefined
      : (a.reasoningTokens ?? 0) + (b.reasoningTokens ?? 0);
  const model = mergedModel(a, b);
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    // Absent stays absent: an unreported breakout is not a measured zero.
    ...(reasoning === undefined ? {} : { reasoningTokens: reasoning }),
    ...(model === undefined ? {} : { model }),
  };
}

export interface LlmClient {
  turn(request: BrainTurnRequest): Promise<{ turn: TutorTurn; usage: LlmUsage }>;
  frame(request: BrainFrameRequest): Promise<{ frame: ScenarioFrame; usage: LlmUsage }>;
  extract(request: BrainExtractRequest): Promise<{ extraction: MemoryExtraction; usage: LlmUsage }>;
  drills(request: BrainDrillsRequest): Promise<{ batch: DrillBatch; usage: LlmUsage }>;
  curate(request: BrainCurateRequest): Promise<{ curation: Curation; usage: LlmUsage }>;
  judge(request: BrainJudgeRequest): Promise<{ verdict: unknown; usage: LlmUsage }>;
}

/**
 * The model answered, but not with a contract-shaped object, even after a retry.
 *
 * `usage` rides along because a failed call is still a billed call, and a
 * retried one is two of them. Throwing without it means the most expensive
 * outcome — two full prompts and nothing to show — is the one outcome the
 * session meter never sees.
 */
export class BrainParseError extends Error {
  readonly raw: string;
  readonly usage: LlmUsage | undefined;
  constructor(message: string, raw: string, usage?: LlmUsage) {
    super(message);
    this.name = 'BrainParseError';
    this.raw = raw;
    this.usage = usage;
  }
}

/**
 * The provider's safety layer declined the request. Vanishingly rare here, still
 * handled — and still billed, which is why it carries usage for the same reason
 * BrainParseError does. A refusal on a retried call has already paid for the
 * attempt before it, and a declined answer the meter never sees is the same leak
 * by a different name.
 */
export class BrainRefusalError extends Error {
  readonly usage: LlmUsage | undefined;
  constructor(message = 'The model declined this request.', usage?: LlmUsage) {
    super(message);
    this.name = 'BrainRefusalError';
    this.usage = usage;
  }
}
