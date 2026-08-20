/**
 * The offline brain: scripted answers, recorded requests.
 *
 * Every engine and playground test runs against this, and a learner with no
 * key still gets a working (if unremarkable) session. Recording the requests
 * is half its value — prompt-shape assertions read them back.
 */

import type { MemoryExtraction, ScenarioFrame, TutorTurn } from '../contract/types.ts';
import type { Curation } from '../curate/curate.ts';
import type { DrillBatch } from '../drill/generate.ts';
import { sampleTurn } from '../contract/samples.ts';
import { CAFE_FRAME } from '../fixtures.ts';
import {
  ZERO_USAGE,
  type BrainCurateRequest,
  type BrainDrillsRequest,
  type BrainExtractRequest,
  type BrainFrameRequest,
  type BrainTurnRequest,
  type LlmClient,
  type LlmUsage,
} from './client.ts';

/** The honest empty answer: a mock learned nothing about anyone. */
const NO_MEMORY: MemoryExtraction = { facts: [], openerFr: null, openerEn: null };

/** The honest empty answer: a mock has no opinion on what was worth keeping. */
const NO_CURATION: Curation = { topics: [] };

export class MockLlmClient implements LlmClient {
  readonly turnRequests: BrainTurnRequest[] = [];
  readonly frameRequests: BrainFrameRequest[] = [];
  readonly extractRequests: BrainExtractRequest[] = [];
  readonly drillsRequests: BrainDrillsRequest[] = [];
  readonly curateRequests: BrainCurateRequest[] = [];
  private readonly turns: TutorTurn[];
  private readonly frames: ScenarioFrame[];
  private readonly extractions: MemoryExtraction[];
  private readonly drillBatches: DrillBatch[];
  private readonly curations: Curation[];

  constructor(
    script: {
      turns?: TutorTurn[];
      frames?: ScenarioFrame[];
      extractions?: MemoryExtraction[];
      drillBatches?: DrillBatch[];
      curations?: Curation[];
    } = {},
  ) {
    this.turns = [...(script.turns ?? [])];
    this.frames = [...(script.frames ?? [])];
    this.extractions = [...(script.extractions ?? [])];
    this.drillBatches = [...(script.drillBatches ?? [])];
    this.curations = [...(script.curations ?? [])];
  }

  async turn(request: BrainTurnRequest): Promise<{ turn: TutorTurn; usage: LlmUsage }> {
    this.turnRequests.push(request);
    return { turn: this.turns.shift() ?? sampleTurn(), usage: ZERO_USAGE };
  }

  async frame(request: BrainFrameRequest): Promise<{ frame: ScenarioFrame; usage: LlmUsage }> {
    this.frameRequests.push(request);
    return { frame: this.frames.shift() ?? CAFE_FRAME, usage: ZERO_USAGE };
  }

  async extract(request: BrainExtractRequest): Promise<{ extraction: MemoryExtraction; usage: LlmUsage }> {
    this.extractRequests.push(request);
    return { extraction: this.extractions.shift() ?? NO_MEMORY, usage: ZERO_USAGE };
  }

  async drills(request: BrainDrillsRequest): Promise<{ batch: DrillBatch; usage: LlmUsage }> {
    this.drillsRequests.push(request);
    return { batch: this.drillBatches.shift() ?? { exercises: [] }, usage: ZERO_USAGE };
  }

  async curate(request: BrainCurateRequest): Promise<{ curation: Curation; usage: LlmUsage }> {
    this.curateRequests.push(request);
    return { curation: this.curations.shift() ?? NO_CURATION, usage: ZERO_USAGE };
  }
}
