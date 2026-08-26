/**
 * Two providers, one brain, split along the line routing.ts already draws.
 *
 * routing.ts sorts calls by who is waiting: a realtime turn goes to the fast
 * talker because the learner is standing in the silence it leaves, while
 * extraction, curation and drill authoring go to the analyst because nobody is
 * waiting and what they write is load-bearing pedagogy. That line turns out to
 * be a provider boundary too, not only a model one — a brain can be fast and
 * free on one side of it and slow and excellent on the other.
 *
 * The concrete case this exists for: a Claude subscription driven through the
 * `claude` command line answers in about eight seconds, which is unusable for a
 * turn and completely fine for the three calls that run once a session is over.
 * Rather than choose, this delegates.
 *
 * Note what this deliberately does NOT do: it does not add a provider column to
 * the routing table. Routing answers "which model, at what effort", and that
 * question has one honest answer whoever is serving it. Which provider is
 * serving is a wiring decision, so it lives in the wiring.
 *
 * Every method forwards the whole request object rather than picking fields out
 * of it, which is what makes an abort signal reach the delegate untouched — and
 * what makes the next field added to a request arrive there too, instead of
 * being silently dropped by the one client in the chain that had to be edited.
 */

import type { MemoryExtraction, ScenarioFrame, TutorTurn } from '../contract/types.ts';
import type { Curation } from '../curate/curate.ts';
import type { DrillBatch } from '../drill/generate.ts';
import type {
  BrainCurateRequest,
  BrainDrillsRequest,
  BrainExtractRequest,
  BrainFrameRequest,
  BrainTurnRequest,
  LlmClient,
  LlmUsage,
} from './client.ts';

export interface SplitBrainConfig {
  /** Answers the calls a learner waits through: the turn, and the scene. */
  realtime: LlmClient;
  /** Answers the calls that run once the room has closed. */
  considered: LlmClient;
}

export class SplitBrainClient implements LlmClient {
  private readonly realtime: LlmClient;
  private readonly considered: LlmClient;

  constructor(config: SplitBrainConfig) {
    this.realtime = config.realtime;
    this.considered = config.considered;
  }

  // ── the learner is waiting

  turn(request: BrainTurnRequest): Promise<{ turn: TutorTurn; usage: LlmUsage }> {
    return this.realtime.turn(request);
  }

  /**
   * The scene sits on the realtime side even though it takes seconds: the
   * learner is listening to the bridge line while it is built, so it is a
   * shorter silence rather than no silence.
   */
  frame(request: BrainFrameRequest): Promise<{ frame: ScenarioFrame; usage: LlmUsage }> {
    return this.realtime.frame(request);
  }

  // ── the room has closed

  extract(request: BrainExtractRequest): Promise<{ extraction: MemoryExtraction; usage: LlmUsage }> {
    return this.considered.extract(request);
  }

  drills(request: BrainDrillsRequest): Promise<{ batch: DrillBatch; usage: LlmUsage }> {
    return this.considered.drills(request);
  }

  curate(request: BrainCurateRequest): Promise<{ curation: Curation; usage: LlmUsage }> {
    return this.considered.curate(request);
  }
}
