/**
 * The conversation engine — where the scene, the ladder and the coach meet.
 *
 * Same architecture as core's scripted session engine: pure functions bracket
 * the one async step. `prepareTurn` builds the model request from state;
 * `integrateTurn` folds the model's answer back in and decides everything —
 * ladder movement, what surfaces now, when the scene ends. The model observes
 * and generates language; this file decides. That split is what makes stuck-
 * learner behaviour testable without a network.
 *
 * The ladder is core's, unmodified. What replaces "did they say the scripted
 * line" as the promotion signal is the graded assessment (engine/grading.ts);
 * silence and aide-moi run through core's own events, so the four-seconds-is-
 * stuck rule, the rescue, and the promotion streak have exactly one
 * implementation across scripted lessons and free conversation.
 */

import {
  STUCK_SILENCE_MS,
  applyTurn,
  directiveFor,
  initialState as initialLadder,
  openingRung,
  type LadderDirective,
  type LadderState,
  type Rung,
  type SupportLevel,
} from '@parle/core';

import type {
  CoachItem,
  NewPhrase,
  ScenarioFrame,
  SpeakerLine,
  SupportMaterial,
  SupportView,
  TutorTurn,
} from '../contract/types.ts';
import type { CefrBand, Strictness } from '../types.ts';
import { coachFallbackLine, copyViolations, sanitizeLearnerText } from '../copy.ts';
import { buildSystemBlocks } from '../prompt/system.ts';
import { buildTurnContext, type TurnInputKind } from '../prompt/turnContext.ts';
import { historyViewOfTurn } from '../prompt/historyView.ts';
import type { BrainTurnRequest, ChatMessage } from '../llm/client.ts';
import { assessmentToQuality, splitCoach } from './grading.ts';

export type LearnerTurnInput =
  | { type: 'spoke'; text: string }
  | { type: 'silence'; durationMs: number }
  | { type: 'help' };

/**
 * How many times one beat is re-attempted before the scene moves on
 * regardless — the conversational analog of core's MAX_ATTEMPTS_PER_TURN.
 * A human tutor does not drill someone into the ground; after a couple of
 * goes the character resolves it naturally (the barista just brings the
 * coffee) and the conversation continues. Nobody gets stranded on a beat.
 */
export const MAX_ATTEMPTS_PER_BEAT = 2;

/** What the engine needs to know about the learner. The profile owns the rest. */
export interface LearnerSnapshot {
  cefr: CefrBand;
  confidence: 'low' | 'medium' | 'high';
  /** Top recurring error tags, most frequent first. */
  watchFor: string[];
  lastRung: Rung | null;
  sessions: number;
}

export interface ConversationState {
  frame: ScenarioFrame;
  strictness: Strictness;
  maxTurns: number;
  learner: LearnerSnapshot;
  ladder: LadderState;
  /** Governs the NEXT learner turn: how much support the tutor offers. */
  directive: LadderDirective;
  history: ChatMessage[];
  beatStatus: Record<string, 'pending' | 'done'>;
  currentBeat: string;
  /** Completed non-good attempts on the current beat. */
  attemptsOnBeat: number;
  /** Set when the beat cap fires; consumed by the next prepared turn. */
  forceAdvance: boolean;
  /** Support material from the last turn, for instant rescue rendering. */
  lastSupport: SupportMaterial;
  /**
   * Sticky once the learner asks for slower. A tutor that speeds back up two
   * turns later is the competition's most-cited failure; this never resets
   * mid-session.
   */
  pace: 'normal' | 'slow';
  /** The language of the last spoken turn, when it was not French. */
  lastLanguage: 'english' | 'mixed' | null;
  /** The recap queue: findings that did not surface inline. */
  deferred: CoachItem[];
  phrases: NewPhrase[];
  usedWell: string[];
  /** Session-local recurring-error counts, for the recap's one next focus. */
  errorTags: Record<string, number>;
  turnCount: number;
  finished: boolean;
  startedAt: number;
}

/** What the UI renders after a learner turn. */
export interface TurnView {
  sceneReply: SpeakerLine;
  coachLine: string | null;
  coachNow: CoachItem[];
  /** Narrator scene-setting for this turn, or null — most turns have none. */
  narration: SpeakerLine | null;
  newPhrases: NewPhrase[];
  supportView: SupportView;
  rung: Rung;
  recapDue: boolean;
  beat: { id: string; goalEn: string; position: number; total: number };
  advancedBeat: boolean;
  /**
   * The learner reached for English this turn. The ladder already dropped to
   * hand them the French; this flag exists so nothing downstream ever phrases
   * that reach as a failure.
   */
  reachedForEnglish: boolean;
}

/** What the UI renders immediately after silence or aide-moi, before any model call. */
export interface RescueView {
  rescued: boolean;
  rung: Rung;
  supportView: SupportView;
}

const BASE_RUNG_BY_CEFR: Record<CefrBand, Rung> = { A0: 1, A1: 2, A2: 3, B1: 3, B2: 4, C1: 4, C2: 4 };

/**
 * Where a conversation opens.
 *
 * The rule itself is core's `openingRung`, shared with scripted lessons, so the
 * two cannot drift apart again. This function only supplies the piece core
 * cannot know: which rung a self-reported CEFR band starts a first-ever session
 * on. Everything after that first session is decided by what the learner did.
 */
export function openingRungFor(learner: LearnerSnapshot): Rung {
  return openingRung({ cefrBase: BASE_RUNG_BY_CEFR[learner.cefr], lastRung: learner.lastRung });
}

/** The scene plan as the model sees it — message zero of every session. */
export function frameMessage(frame: ScenarioFrame): string {
  const lines: string[] = [
    '[SCENE PLAN FROM THE APP]',
    `Title: ${frame.title} (${frame.titleEn})`,
    `Setting: ${frame.setting}`,
    `The learner plays: ${frame.learnerRole}`,
    'Characters:',
    ...frame.characters.map((c) => `- ${c.name}, ${c.role}. Speaks ${c.register}.`),
    `Register: ${frame.registerGuidance}`,
    'Beats, in order:',
    ...frame.beats.map((b, i) => `${i + 1}. ${b.id}: ${b.goal} (${b.goalEn})`),
    'Lines a local would use here:',
    ...frame.goalPhrases.map((g) => `- "${g.fr}" = ${g.en} [${g.register}]`),
  ];
  if (frame.cultureNotes.length > 0) {
    lines.push('Culture:', ...frame.cultureNotes.map((n) => `- ${n}`));
  }
  return lines.join('\n');
}

export function createConversation(
  frame: ScenarioFrame,
  learner: LearnerSnapshot,
  config: { strictness: Strictness; maxTurns: number },
  now = Date.now(),
): ConversationState {
  const ladder = initialLadder(openingRungFor(learner));
  const beatStatus: Record<string, 'pending' | 'done'> = {};
  for (const beat of frame.beats) beatStatus[beat.id] = 'pending';

  return {
    frame,
    strictness: config.strictness,
    maxTurns: config.maxTurns,
    learner,
    ladder,
    directive: directiveFor(ladder.rung),
    history: [{ role: 'assistant', text: `${frame.openingLine.speaker}: ${frame.openingLine.fr}` }],
    beatStatus,
    currentBeat: frame.beats[0]!.id,
    attemptsOnBeat: 0,
    forceAdvance: false,
    lastSupport: frame.openingSupport,
    pace: 'normal',
    lastLanguage: null,
    deferred: [],
    phrases: [],
    usedWell: [],
    errorTags: {},
    turnCount: 0,
    finished: false,
    startedAt: now,
  };
}

function learnerMessageFor(input: LearnerTurnInput): string {
  switch (input.type) {
    case 'spoke':
      return input.text;
    case 'silence':
      return '[silence]';
    case 'help':
      return '[aide-moi]';
  }
}

function inputKindOf(input: LearnerTurnInput): TurnInputKind {
  return input.type === 'spoke' ? 'spoke' : input.type;
}

function beatOf(state: ConversationState): { id: string; goal: string; goalEn: string } {
  const beat = state.frame.beats.find((b) => b.id === state.currentBeat);
  return beat ?? state.frame.beats[state.frame.beats.length - 1]!;
}

export function supportViewFor(level: SupportLevel, material: SupportMaterial): SupportView {
  switch (level) {
    case 'full-line':
      return {
        kind: 'full-line',
        line: material.fullLine.fr,
        written: material.fullLine.frWritten,
        gloss: material.fullLine.en,
      };
    case 'options':
      // Never more than three — a learner reading four French sentences under
      // time pressure is doing homework, not talking. Same cap as core.
      return { kind: 'options', options: material.options.slice(0, 3).map((o) => ({ text: o.fr, en: o.en })) };
    case 'hint':
      return { kind: 'hint', hint: material.hintEn };
    case 'none':
      return { kind: 'none' };
  }
}

/**
 * Handle silence or aide-moi BEFORE any model call. Both run through core's
 * ladder events, so the drop, the rescue flag and the rescues count have one
 * implementation. Returns the instantly-renderable support (from the material
 * the last turn already carried) — a stuck learner never waits on a network
 * round-trip to be handed the line.
 */
export function applyNonSpokenInput(
  state: ConversationState,
  input: Extract<LearnerTurnInput, { type: 'silence' | 'help' }>,
): { state: ConversationState; view: RescueView } {
  // A short pause is thinking, not being stuck. Nothing happens at all.
  if (input.type === 'silence' && input.durationMs < STUCK_SILENCE_MS) {
    return {
      state,
      view: { rescued: false, rung: state.ladder.rung, supportView: supportViewFor(state.directive.support, state.lastSupport) },
    };
  }

  const event =
    input.type === 'silence'
      ? ({ type: 'silence', durationMs: input.durationMs } as const)
      : ({ type: 'help-requested' } as const);

  const { state: ladder, directive } = applyTurn(state.ladder, event);
  const attempts = state.attemptsOnBeat + 1;

  const next: ConversationState = {
    ...state,
    ladder,
    directive,
    attemptsOnBeat: attempts,
    forceAdvance: state.forceAdvance || attempts >= MAX_ATTEMPTS_PER_BEAT,
  };

  return {
    state: next,
    view: { rescued: directive.rescued, rung: ladder.rung, supportView: supportViewFor(directive.support, state.lastSupport) },
  };
}

/**
 * Build the model request for this input. Pure and byte-stable for identical
 * states — the multi-turn prompt cache depends on it.
 */
export function prepareTurn(state: ConversationState, input: LearnerTurnInput): BrainTurnRequest {
  const beat = beatOf(state);
  const context = buildTurnContext({
    directive: state.directive,
    beat: {
      id: beat.id,
      goal: beat.goal,
      attempt: state.attemptsOnBeat + 1,
      maxAttempts: MAX_ATTEMPTS_PER_BEAT,
      forceAdvance: state.forceAdvance,
    },
    strictness: state.strictness,
    learner: { cefr: state.learner.cefr, confidence: state.learner.confidence, watchFor: state.learner.watchFor },
    inputKind: inputKindOf(input),
    pace: state.pace,
    lastLanguage: state.lastLanguage,
  });

  return {
    kind: 'turn',
    system: buildSystemBlocks(),
    messages: [
      { role: 'user', text: frameMessage(state.frame) },
      ...state.history,
      { role: 'user', text: learnerMessageFor(input) },
      { role: 'system', text: context },
    ],
  };
}

/** Clean model text the learner will read; scene speech may carry digits. */
function sanitizeTurn(raw: TutorTurn): TutorTurn {
  const clean = (text: string): string => sanitizeLearnerText(text);
  return {
    ...raw,
    coachLine: raw.coachLine === null ? null : clean(raw.coachLine),
    sceneReply: { ...raw.sceneReply, fr: clean(raw.sceneReply.fr), en: clean(raw.sceneReply.en) },
    narration:
      raw.narration === null ? null : { ...raw.narration, fr: clean(raw.narration.fr), en: clean(raw.narration.en) },
    coach: raw.coach.map((c) => {
      const why = clean(c.why);
      // A why that scolds or grades is worse than no why at all.
      return { ...c, why: copyViolations(why).length === 0 ? why : '' };
    }),
    newPhrases: raw.newPhrases.slice(0, 3).map((p) => ({ ...p, en: clean(p.en) })),
  };
}

/** Normalize a model-proposed error tag into a stable kebab key. */
export function normalizeErrorTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Fold the model's answer into the state and decide everything: ladder
 * movement (spoke turns only — silence and help moved it before the call),
 * inline-vs-recap coaching, beat progress, and whether the recap is due.
 */
export function integrateTurn(
  state: ConversationState,
  input: LearnerTurnInput,
  rawTurn: TutorTurn,
): { state: ConversationState; view: TurnView } {
  const turn = sanitizeTurn(rawTurn);
  const { inline, deferred } = splitCoach(turn.coach, state.strictness);

  // The coach line survives only when something actually surfaces inline, and
  // only when it passes the copy rules; otherwise the tested template speaks.
  let coachLine: string | null = null;
  const lead = inline[0];
  if (lead !== undefined) {
    coachLine =
      turn.coachLine !== null && copyViolations(turn.coachLine).length === 0
        ? turn.coachLine
        : coachFallbackLine(lead.kind, lead.better);
  }

  // Ladder: spoke turns are graded; silence and help already moved it.
  let ladder = state.ladder;
  let directive = state.directive;
  let quality: ReturnType<typeof assessmentToQuality> | null = null;
  if (input.type === 'spoke') {
    quality = assessmentToQuality(turn.assessment, turn.coach);
    const applied = applyTurn(ladder, { type: 'spoke', quality });
    ladder = applied.state;
    directive = applied.directive;
  }

  // Beats. Code owns the spine: the model reports beatDone, the engine decides
  // where the conversation is. The cap guarantees motion.
  const beats = state.frame.beats;
  const beatStatus = { ...state.beatStatus };
  let attemptsOnBeat = state.attemptsOnBeat;
  let forceAdvance = state.forceAdvance;
  let advancedBeat = false;

  // A turn that reached for English never completes a beat, whatever the
  // model reported: the tutor hands back the French and the beat is invited
  // again. Bounded like every retry by the attempt cap, so nobody loops.
  const reachedForEnglish = input.type === 'spoke' && turn.assessment.language === 'english';

  // Nor does a rescue. The model has just modelled the line, so it has every
  // reason to report the beat done — but the learner has not said it yet, and
  // the one thing they needed was another go at the thing they froze on. Same
  // shape as the English guard, and bounded by the same cap: forceAdvance is
  // already set for them by applyNonSpokenInput once the attempts run out, so
  // the scene still moves whatever happens.
  const wasRescued = input.type === 'silence' || input.type === 'help' || state.directive.rescued;
  const shouldAdvance = (turn.scene.beatDone && !reachedForEnglish && !wasRescued) || forceAdvance;
  if (shouldAdvance) {
    beatStatus[state.currentBeat] = 'done';
    advancedBeat = true;
    attemptsOnBeat = 0;
    forceAdvance = false;
  } else if (quality !== null && quality !== 'good') {
    attemptsOnBeat += 1;
    if (attemptsOnBeat >= MAX_ATTEMPTS_PER_BEAT) forceAdvance = true;
  }
  const currentBeat = beats.find((b) => beatStatus[b.id] !== 'done')?.id ?? beats[beats.length - 1]!.id;

  const allBeatsDone = beats.every((b) => beatStatus[b.id] === 'done');
  const turnCount = state.turnCount + 1;
  const recapDue = turn.scene.sceneDone || allBeatsDone || turnCount >= state.maxTurns;

  // Session memory: phrases (deduped), credit, recurring-error counts.
  const phrases = [...state.phrases];
  for (const p of turn.newPhrases) {
    if (!phrases.some((existing) => existing.fr === p.fr)) phrases.push(p);
  }
  const errorTags = { ...state.errorTags };
  for (const pattern of turn.profileSignals.errorPatterns) {
    const tag = normalizeErrorTag(pattern.tag);
    if (tag.length === 0) continue;
    errorTags[tag] = (errorTags[tag] ?? 0) + 1;
  }

  const next: ConversationState = {
    ...state,
    ladder,
    directive,
    history: [
      ...state.history,
      { role: 'user', text: learnerMessageFor(input) },
      { role: 'assistant', text: historyViewOfTurn(turn) },
    ],
    beatStatus,
    currentBeat,
    attemptsOnBeat,
    forceAdvance,
    lastSupport: turn.support,
    lastLanguage:
      input.type === 'spoke' && (turn.assessment.language === 'english' || turn.assessment.language === 'mixed')
        ? turn.assessment.language
        : null,
    deferred: [...state.deferred, ...deferred],
    phrases,
    usedWell: [...state.usedWell, ...turn.profileSignals.usedWell],
    errorTags,
    turnCount,
    finished: state.finished,
  };

  const beat = beatOf(next);
  const position = beats.findIndex((b) => b.id === beat.id) + 1;

  return {
    state: next,
    view: {
      sceneReply: turn.sceneReply,
      coachLine,
      coachNow: inline,
      narration: turn.narration,
      newPhrases: turn.newPhrases,
      supportView: supportViewFor(directive.support, turn.support),
      rung: ladder.rung,
      recapDue,
      beat: { id: beat.id, goalEn: beat.goalEn, position, total: beats.length },
      advancedBeat,
      reachedForEnglish,
    },
  };
}
