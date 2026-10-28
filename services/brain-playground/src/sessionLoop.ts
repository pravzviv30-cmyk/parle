/**
 * One live session: the engine, a client, and the profile, wired together.
 *
 * The loop's job is sequencing, not deciding — every decision lives in
 * @luvani/brain where it is tested. Notably the rescue order: silence renders
 * support INSTANTLY from material already in hand, and only then does the
 * model get asked for its warm in-character step-in.
 */

import {
  DEFAULT_CONFIG,
  RECOVERY_LINE,
  applyNonSpokenInput,
  applyTurnToProfile,
  assembleRecap,
  buildScenarioRequest,
  buildSystemBlocks,
  createConversation,
  finishSession,
  integrateTurn,
  learnerSnapshotFrom,
  prepareTurn,
  supportViewForAssistance,
  BrainParseError,
  BrainRefusalError,
  type ConversationState,
  type LearnerProfile,
  type LearnerTurnInput,
  type LlmClient,
  type LlmUsage,
  type ScenarioFrame,
  type SessionRecap,
  type SupportView,
} from '@luvani/brain';
import { STUCK_SILENCE_MS } from '@luvani/core';
import { safetyDecision } from '@luvani/tutor-agent/src/safety.ts';

import { SILENT_TUTOR, isQuietRescue, modeFor, newRecorder, recordTurn, safetyTutor, sceneIdFor, tutorLinesFromView, type DevRecorder } from './eval/devRecord.ts';
import { addUsage, formatTurnUsage, ZERO_USAGE } from './usage.ts';
import { renderOpening, renderRescue, renderTurnView, meta, warm } from './render.ts';

export interface Session {
  state: ConversationState;
  profile: LearnerProfile;
  totals: LlmUsage;
  calls: number;
  /** Set when the session is being recorded (`--record`), else null. */
  recorder: DevRecorder | null;
}

export function beginSession(
  profile: LearnerProfile,
  frame: ScenarioFrame,
  options: { record?: { id: string } } = {},
): { session: Session; lines: string[] } {
  const state = createConversation(frame, learnerSnapshotFrom(profile), {
    strictness: profile.preferences.strictness,
    maxTurns: DEFAULT_CONFIG.maxTurns,
  });
  const recorder =
    options.record === undefined ? null : newRecorder({ id: options.record.id, scene: sceneIdFor(frame), mode: modeFor(frame), cefr: state.learner.cefr });
  const session: Session = { state, profile, totals: ZERO_USAGE, calls: 0, recorder };
  const lines = renderOpening(frame, state.ladder.rung, supportViewForAssistance(0, state.lastSupport));
  return { session, lines };
}

/**
 * Run one learner input through the brain. Returns the lines to print and
 * whether the session has earned its recap.
 *
 * Two inputs never reach the brain, exactly as in the live tutor
 * (services/tutor-agent/src/convo.ts):
 *
 *   - A spoken line that safetyDecision flags. The tutor says the fixed policy
 *     message and nothing else; a 'stop' ends the session (recapDue).
 *   - The first silence or aide-moi of an exchange that shows a hint: the quiet
 *     rescue. The hint renders and nothing is said over it.
 */
export async function runInput(
  session: Session,
  client: LlmClient,
  input: LearnerTurnInput,
  costModel?: string,
): Promise<{ lines: string[]; recapDue: boolean }> {
  const lines: string[] = [];
  // What the recorder needs from before the input moves anything.
  const beat = session.state.currentBeat;
  const targetFr = session.state.lastSupport.fullLine.fr;
  let rescued = false;
  let support: SupportView | null = null;

  if (input.type === 'spoke') {
    const decision = safetyDecision(input.text);
    if (decision !== null) {
      lines.push(warm(decision.message));
      if (session.recorder !== null) {
        session.recorder = recordTurn(session.recorder, {
          beat,
          input,
          rung: session.state.ladder.rung,
          support,
          targetFr,
          rescued,
          tutor: safetyTutor(decision.message),
          safetyStep: true,
        });
      }
      return { lines, recapDue: decision.action === 'stop' };
    }
  }
  const depthBefore = session.state.assistanceDepth;

  // Silence and aide-moi move the ladder and render support before any network.
  if (input.type !== 'spoke') {
    const { state, view } = applyNonSpokenInput(session.state, input);
    session.state = state;
    rescued = view.rescued;
    support = view.supportView;
    lines.push(...renderRescue(view));
  }
  const rung = session.state.ladder.rung;

  if (support !== null && isQuietRescue(depthBefore, support)) {
    if (session.recorder !== null) {
      session.recorder = recordTurn(session.recorder, { beat, input, rung, support, targetFr, rescued, tutor: SILENT_TUTOR });
    }
    return { lines, recapDue: false };
  }

  const request = prepareTurn(session.state, input);
  const started = Date.now();
  let elapsedMs = 0;
  let turn;
  let usageLine = '';
  try {
    const result = await client.turn(request);
    turn = result.turn;
    session.totals = addUsage(session.totals, result.usage);
    session.calls += 1;
    usageLine = meta(formatTurnUsage(result.usage, Date.now() - started, costModel));
    elapsedMs = Date.now() - started;
  } catch (error) {
    if (error instanceof BrainParseError || error instanceof BrainRefusalError) {
      // A failed model turn must never strand the learner mid-scene.
      lines.push(warm(RECOVERY_LINE), meta(`(${error.name}: the model turn failed; nothing was recorded)`));
      if (session.recorder !== null) {
        session.recorder = recordTurn(session.recorder, { beat, input, rung, support, targetFr, rescued, tutor: null });
      }
      return { lines, recapDue: false };
    }
    throw error;
  }

  const { state, view } = integrateTurn(session.state, input, turn);
  session.state = state;
  session.profile = applyTurnToProfile(session.profile, turn, new Date().toISOString());
  lines.push(...renderTurnView(view), usageLine);
  if (session.recorder !== null) {
    session.recorder = recordTurn(session.recorder, {
      beat,
      input,
      rung,
      support,
      targetFr,
      rescued,
      tutor: tutorLinesFromView(view),
      replyWaitMs: elapsedMs,
    });
  }

  return { lines, recapDue: view.recapDue };
}

/** Simulated silence long enough to trip the rescue. */
export function silenceInput(): LearnerTurnInput {
  return { type: 'silence', durationMs: STUCK_SILENCE_MS };
}

/** Wrap the session: recap assembled in code, profile folded and returned. */
export function endSession(session: Session): { recap: SessionRecap; profile: LearnerProfile } {
  const { recap, state } = assembleRecap(session.state, {
    estimate: session.profile.cefr.estimate,
    confidence: session.profile.cefr.confidence,
  });
  session.state = state;
  const profile = finishSession(session.profile, state);
  session.profile = profile;
  return { recap, profile };
}

/** Ask the model to design a scene from a freeform request. */
export async function buildScenario(
  client: LlmClient,
  profile: LearnerProfile,
  request: string,
): Promise<{ frame: ScenarioFrame; usage: LlmUsage }> {
  const snapshot = learnerSnapshotFrom(profile);
  const facts = profile.memory.facts.slice(-5).map((fact) => (fact.source === 'learner' ? '(learner wrote) ' : '(noted, unconfirmed) ') + fact.en);
  const unmasteredPhrases = Object.values(profile.phrases)
    .filter((phrase) => !phrase.mastered)
    .slice(0, 5)
    .map((phrase) => `${phrase.fr} (${phrase.en})`);
  const result = await client.frame({
    kind: 'frame',
    system: buildSystemBlocks(),
    request: buildScenarioRequest({
      request,
      learner: {
        cefr: snapshot.cefr,
        watchFor: snapshot.watchFor,
        facts,
        recentScenarios: profile.preferences.lastScenarios,
        unmasteredPhrases,
      },
    }),
  });
  return result;
}
