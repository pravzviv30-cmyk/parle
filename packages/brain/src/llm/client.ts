/**
 * The seam between the brain and any model provider.
 *
 * The engine builds provider-neutral requests; an adapter turns them into real
 * API calls. Everything above this interface is pure and runs in tests with the
 * mock; everything below it is one file per provider. The quality/cost trade
 * stays a config change, exactly like the tutor-agent's TUTOR_LLM switch.
 */

import type { MemoryExtraction, ScenarioFrame, TutorTurn } from '../contract/types.ts';
import type { DrillBatch } from '../drill/generate.ts';
import type { SystemBlocks } from '../prompt/system.ts';

/**
 * A provider-neutral transcript entry. `system` entries are app context, not
 * learner speech — adapters map them to the strongest channel the provider
 * has (a system-role message on Claude, folded context on Groq).
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export interface BrainTurnRequest {
  kind: 'turn';
  system: SystemBlocks;
  /** Scene plan first, then the transcript, learner turn, trailing app context. */
  messages: ChatMessage[];
}

export interface BrainFrameRequest {
  kind: 'frame';
  system: SystemBlocks;
  /** The scenario-builder briefing plus the learner's freeform ask. */
  request: string;
}

export interface BrainExtractRequest {
  kind: 'extract';
  system: SystemBlocks;
  /** The post-session question over the transcript: what did we learn about them? */
  request: string;
}

export interface BrainDrillsRequest {
  kind: 'drills';
  system: SystemBlocks;
  /** The drill-authoring briefing over the session's phrases and errors. */
  request: string;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const ZERO_USAGE: LlmUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export interface LlmClient {
  turn(request: BrainTurnRequest): Promise<{ turn: TutorTurn; usage: LlmUsage }>;
  frame(request: BrainFrameRequest): Promise<{ frame: ScenarioFrame; usage: LlmUsage }>;
  extract(request: BrainExtractRequest): Promise<{ extraction: MemoryExtraction; usage: LlmUsage }>;
  drills(request: BrainDrillsRequest): Promise<{ batch: DrillBatch; usage: LlmUsage }>;
}

/** The model answered, but not with a contract-shaped object, even after a retry. */
export class BrainParseError extends Error {
  readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = 'BrainParseError';
    this.raw = raw;
  }
}

/** The provider's safety layer declined the request. Vanishingly rare here, still handled. */
export class BrainRefusalError extends Error {
  constructor(message = 'The model declined this request.') {
    super(message);
    this.name = 'BrainRefusalError';
  }
}
