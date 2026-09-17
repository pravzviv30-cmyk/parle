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
  type BrainJudgeRequest,
  type BrainTurnRequest,
  type LlmClient,
  type LlmUsage,
} from './client.ts';

/**
 * A mock bills nothing, so its usage names no model and reports no reasoning
 * breakout: ZERO_USAGE is four zeros and two absent fields, which is the honest
 * reading of "no vendor has spoken here". `addLlmUsage` treats an empty side as
 * unable to disagree, so a running total seeded from one keeps its real stamp.
 */

/** The honest empty answer: a mock learned nothing about anyone. */
const NO_MEMORY: MemoryExtraction = { facts: [], openerFr: null, openerEn: null };

/** The honest empty answer: a mock has no opinion on what was worth keeping. */
const NO_CURATION: Curation = { topics: [] };

/**
 * The scripted verdict.
 *
 * It says the meaning survived and offers no better line, because the offline
 * brain must never be the thing that tells a learner their French was poor.
 * The note is empty for the same reason a mock turn has no coach line: a fixed
 * sentence about somebody's French, repeated on every rep, is worse than
 * silence. It satisfies `OwnWordsVerdictSchema` exactly, so a test can send it
 * through `parseOwnWordsVerdict` untouched.
 */
const KIND_VERDICT = {
  meaningKept: true,
  comprehensible: true,
  natural: 'yes',
  betterLine: null,
  note: '',
} as const;

export class MockLlmClient implements LlmClient {
  readonly turnRequests: BrainTurnRequest[] = [];
  readonly frameRequests: BrainFrameRequest[] = [];
  readonly extractRequests: BrainExtractRequest[] = [];
  readonly drillsRequests: BrainDrillsRequest[] = [];
  readonly curateRequests: BrainCurateRequest[] = [];
  readonly judgeRequests: BrainJudgeRequest[] = [];
  private readonly turns: TutorTurn[];
  private readonly frames: ScenarioFrame[];
  private readonly extractions: MemoryExtraction[];
  private readonly drillBatches: DrillBatch[];
  private readonly curations: Curation[];
  private readonly verdicts: unknown[];

  constructor(
    script: {
      turns?: TutorTurn[];
      frames?: ScenarioFrame[];
      extractions?: MemoryExtraction[];
      drillBatches?: DrillBatch[];
      curations?: Curation[];
      verdicts?: unknown[];
    } = {},
  ) {
    this.turns = [...(script.turns ?? [])];
    this.frames = [...(script.frames ?? [])];
    this.extractions = [...(script.extractions ?? [])];
    this.drillBatches = [...(script.drillBatches ?? [])];
    this.curations = [...(script.curations ?? [])];
    this.verdicts = [...(script.verdicts ?? [])];
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

  async judge(request: BrainJudgeRequest): Promise<{ verdict: unknown; usage: LlmUsage }> {
    this.judgeRequests.push(request);
    const next = this.verdicts.length > 0 ? this.verdicts.shift() : KIND_VERDICT;
    return { verdict: next, usage: ZERO_USAGE };
  }
}
