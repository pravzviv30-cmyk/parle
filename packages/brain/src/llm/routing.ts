/**
 * Which model answers which kind of call — the fast-talker / careful-analyst
 * split in one table.
 *
 * A realtime voice turn lives on a latency budget (the learner is standing in
 * the silence it leaves), so it goes to the fastest model that holds the
 * contract. The background calls — scenario design, post-session extraction,
 * drill authoring — happen while nobody is waiting, and what they produce is
 * load-bearing pedagogy, so they go to the strongest model at full effort.
 * Cost follows the same line: turns run ~2/minute for a whole session, the
 * background calls run once.
 *
 * The table is the single source of truth: the tutor-agent and the playground
 * both construct their clients from it, so "which model is speaking?" is
 * always answered here and never by a call site.
 */

export type BrainEffort = 'low' | 'medium' | 'high';

export type BrainActivity = 'turn' | 'frame' | 'extract' | 'drills' | 'curate' | 'judge';

export interface ModelRoute {
  model: string;
  /** undefined leaves the API's own default (high) in place. */
  effort: BrainEffort | undefined;
  /** Covers thinking plus response on this model family — sized with headroom. */
  maxTokens: number;
  /**
   * Whether the model accepts a system-role message after conversation
   * history. Sonnet-tier models reject it (400), so the trailing app context
   * must ride as a tagged user message there instead.
   */
  midConversationSystem: boolean;
}

export type BrainRouting = Record<BrainActivity, ModelRoute>;

export const DEFAULT_ROUTING: BrainRouting = {
  // The talker. Low effort keeps thinking short and first audio close; the
  // turn object itself is well under 1k tokens.
  //
  // Deliberately NOT streamed, and the question will come up: streaming the
  // turn to start TTS on a partial sceneReply would bypass the code-decides
  // gates — sanitizeTurn, copyViolations and the speak order (narration →
  // coach → sceneReply) all need the complete object, and the parts that
  // stream first are spoken last. Revisit only if measured turn latency
  // (see tutor-agent's [luvani:latency] lines) holds a p50 above ~1.5s after
  // the TTS streaming work.
  turn: { model: 'claude-sonnet-5', effort: 'low', maxTokens: 3_000, midConversationSystem: false },
  // The learner waits for this object before the scene can open. The contract
  // and strict schema carry the structure, so low effort is the right latency
  // trade-off here; 4k covers both reasoning and the roughly 1k-token frame.
  frame: { model: 'claude-sonnet-5', effort: 'low', maxTokens: 4_000, midConversationSystem: false },
  // Post-session, nobody waiting. What these two write shapes every future
  // session (openers, memory) and every offline rep (accepted answers), so
  // they get the analyst model at full effort.
  extract: { model: 'claude-opus-5', effort: 'high', maxTokens: 4_000, midConversationSystem: true },
  // 10k, not 16k, and the saving is exactly zero: max_output_tokens is a
  // ceiling, not a charge, and the measured checkpoint (F101) never came within
  // a third of the old number — 4,934 output tokens on a full twelve-turn scene
  // and 3,666 on a short one, both at this effort. What the lower number buys is
  // a bound on the worst call in the product: this is the dearest activity on
  // the dearest model, so an unbounded-looking cap here is the one place a
  // runaway would actually hurt. Twice the measured p95 leaves the honest work
  // untouched. Effort stays HIGH deliberately: at medium the same call cost 45%
  // less and the deterministic linter rejected five of ten exercises, which is
  // the quality bar this cut was explicitly not allowed to spend.
  drills: { model: 'claude-opus-5', effort: 'high', maxTokens: 10_000, midConversationSystem: true },
  // The practice editor: pick-and-group over material already in hand. Runs
  // BEFORE drills so the drill author works from the curated keep-list; the
  // analyst model at high effort would add seconds ahead of that call for
  // marginal gain on a ranking task.
  curate: { model: 'claude-sonnet-5', effort: 'medium', maxTokens: 3_000, midConversationSystem: true },
  // The paraphrase judge, and the second place in the product where a learner
  // is standing still waiting for an answer: they have typed their own French
  // and pressed Check. So it sits on the talker tier at low effort, sized at
  // 600 tokens because the whole verdict is five short fields and one sentence
  // of note. A bigger budget would buy nothing here except a longer wait.
  //
  // It sends no transcript and no history, so there is no mid-conversation
  // system message to place: the grader's brief IS the system block, and the
  // one thing after it is the attempt. `midConversationSystem` is therefore
  // false in the only sense that can matter to this route.
  //
  // The model observes, code decides: the verdict is an observation of what the
  // learner wrote, and whether that means good, retry or reveal is core's call.
  judge: { model: 'claude-sonnet-5', effort: 'low', maxTokens: 600, midConversationSystem: false },
};

/**
 * The careful tier, named once so a second table cannot disagree with this one.
 *
 * The table sorts calls between two tiers, and until F104 the OpenAI adapter
 * kept its own copy of that sorting keyed on "is a learner waiting?". The two
 * questions look identical and are not: curate has nobody waiting AND belongs
 * on the cheap tier, which is exactly the case the duplicate got wrong, at
 * measured analyst prices for a ranking task.
 */
export const ANALYST_TIER_MODEL = 'claude-opus-5';

/**
 * Whether this activity was routed to the careful tier.
 *
 * Adapters that serve a different vendor's two models ask this rather than
 * re-deciding it: the tier is a routing question and routing.ts already
 * answered it. Which PROVIDER serves the call stays a wiring decision (split.ts).
 */
export function isAnalystActivity(activity: BrainActivity, routing: BrainRouting = DEFAULT_ROUTING): boolean {
  return routing[activity].model === ANALYST_TIER_MODEL;
}

const EFFORTS: readonly BrainEffort[] = ['low', 'medium', 'high'];

/**
 * The routing table with environment overrides applied. BRAIN_EFFORT remains
 * the one blunt dev knob it has always been: it moves every activity at once,
 * because it exists for playground experiments, not per-route tuning.
 */
export function resolveRouting(env: Record<string, string | undefined> = process.env): BrainRouting {
  const effort = env.BRAIN_EFFORT;
  if (effort === undefined || !EFFORTS.includes(effort as BrainEffort)) return DEFAULT_ROUTING;
  const routed = {} as Record<BrainActivity, ModelRoute>;
  for (const activity of Object.keys(DEFAULT_ROUTING) as BrainActivity[]) {
    routed[activity] = { ...DEFAULT_ROUTING[activity], effort: effort as BrainEffort };
  }
  return routed;
}
