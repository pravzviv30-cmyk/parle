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
  normalise,
  openingRung,
  readMissionTasks,
  type MissionTasks,
  type LadderDirective,
  type LadderState,
  type Rung,
  type SupportLevel,
} from '@luvani/core';

import type {
  CoachItem,
  NewPhrase,
  ScenarioFrame,
  SpeakerLine,
  SupportMaterial,
  SupportView,
  TutorTurn,
} from '../contract/types.ts';
import type { LearnerGoal } from '@luvani/core';
import type { CefrBand, Pace, Strictness } from '../types.ts';
import {
  NOTHING_WAS_WRONG,
  coachFallbackLine,
  copyViolations,
  landsAsCorrection,
  sanitizeLearnerText,
} from '../copy.ts';
import { carriesFrench } from '../frenchLeak.ts';
import { buildSystemBlocks } from '../prompt/system.ts';
import { buildTurnContext, type TurnInputKind } from '../prompt/turnContext.ts';
import { historyViewOfTurn } from '../prompt/historyView.ts';
import type { BrainTurnRequest, ChatMessage } from '../llm/client.ts';
import { assessmentToQuality, splitCoach } from './grading.ts';
import { normalizeErrorTag } from '../profile/errorTag.ts';
import { askedQuestions } from './askedQuestions.ts';
import { sharesSadNews } from './sadNews.ts';

export { normalizeErrorTag } from '../profile/errorTag.ts';

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
export const MAX_ATTEMPTS_PER_BEAT = 3;

/**
 * Assistance is earned inside one exchange. Ordinary turns start hidden; one
 * genuine rescue reveals only an English hint, and a second rescue may reveal
 * the learner's line. Speaking resets it immediately.
 */
export type AssistanceDepth = 0 | 1 | 2;

/**
 * What the app says, out loud and in English, the first time a beginner is
 * stuck twice on one exchange (VOICE-013).
 *
 * The prompt has always accepted an English reply and recast it, but nobody
 * ever told the learner so. A frozen A0 learner on their second rescue is
 * looking at a French line on a card and a tutor rephrasing more French, and
 * has no idea that saying it in English is a perfectly good way back in. One
 * authored sentence fixes that. Authored rather than generated because it is
 * the one line whose words matter more than its freshness: it must never
 * scold, never remark on the pause, and never read the card's French back.
 *
 * They live here rather than in the agent because the engine is what decides
 * the turn's coach line, and text sessions read the same line on screen that
 * voice sessions hear. The agent's warm-cache list imports them from here.
 * Rotated per exchange within a session, so a learner stuck twice on two
 * different exchanges does not hear the same sentence twice.
 */
export const WAY_BACK_LINES: readonly string[] = Object.freeze([
  "You can say it in English. I'll give you the French.",
  "English is fine too. Say it your way, and I'll help with the French.",
  "Try it in English if you like. We'll find the French together.",
]);

/** Learners low enough that English is the obvious way back in. */
const WAY_BACK_BANDS: ReadonlySet<CefrBand> = new Set<CefrBand>(['A0', 'A1']);

/** What the engine needs to know about the learner. The profile owns the rest. */
export interface LearnerSnapshot {
  cefr: CefrBand;
  confidence: 'low' | 'medium' | 'high';
  /** Top recurring error tags, most frequent first. */
  watchFor: string[];
  lastRung: Rung | null;
  sessions: number;
  /** What they asked to be called, or null. Validated before it gets here. */
  name: string | null;
  /** Their onboarding goal, or null. Validated before it gets here. */
  goal?: LearnerGoal | null;
}

export interface ConversationState {
  frame: ScenarioFrame;
  strictness: Strictness;
  maxTurns: number;
  /**
   * This scene was authored as a mission rather than built from a request.
   *
   * It changes exactly one thing: finishing every beat raises a win instead of
   * ending the session. A learner who has just got through their first real
   * French exchange should be told so and left standing in the scene, not shown
   * the door the same second. A generated scene has no win to raise and no
   * authored line to raise it with, so its behaviour is untouched.
   */
  mission: boolean;
  /**
   * Sticky once a mission's beats are all done, and never falls back.
   *
   * Sticky because the beat pointer keeps moving after the last beat completes,
   * so a flag recomputed each turn would flicker off and take the win with it.
   */
  missionDone: boolean;
  missionId: string | null;
  /** Exact goal observations, separate from movement/forced beat completion. */
  evidencedBeatIds: string[];
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
  /** How much of lastSupport the learner has explicitly earned this exchange. */
  assistanceDepth: AssistanceDepth;
  /**
   * A rescue on this exchange has put the French in front of the learner: the
   * full-line card, or a tutor turn that answered a silence or a help request.
   * An English hint alone does not set it. While it is set, a correct reply is
   * a copy of what was just modelled and is not evidence (F928). Clears with
   * assistanceDepth. Optional so a checkpoint written before it existed reads
   * as set, which is the old, stricter rule.
   */
  frenchGiven?: boolean;
  /**
   * The exchange's way back has been said, or the learner already reached for
   * English on it. Either way there is nothing left to offer: a third rescue
   * does not say it again, and someone already speaking English does not need
   * telling that they may. Clears with assistanceDepth, when a real reply lands.
   */
  wayBackSpent: boolean;
  /** How many way-back lines this session has said, which picks the next one. */
  wayBacksSaid: number;
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
  /**
   * Every fragment this session's coaching has quoted back at the learner,
   * normalised once on the way in.
   *
   * Kept for the whole session rather than the turn, because it answers a
   * question about the whole session: did the tutor ever hand this phrase back
   * as the thing that did not work? The end card must not celebrate one that it
   * did, whichever turn it happened on. Inline findings are not kept anywhere
   * else — `deferred` holds only what waited for the recap — so without this
   * the record of what was corrected out loud is gone by the time the card is
   * built.
   */
  correctedForms: string[];
  /** Session-local recurring-error counts, for the recap's one next focus. */
  errorTags: Record<string, number>;
  /**
   * What the conversation has actually been about, in order: the frame's own
   * topic first, then everywhere the learner steered. Appended when the model
   * reports a topicShift; capped, deduped, and never a reason to move a beat.
   */
  topics: { en: string; fr: string; turn: number }[];
  turnCount: number;
  /**
   * The turn on which the tutor last broke the scene to coach something the
   * learner did not ask about, or null if it has not yet. Feeds the cooldown in
   * splitCoach, which is what stops an A0 learner being corrected on every
   * single turn.
   */
  lastInterruptedTurn: number | null;
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
  /**
   * A mission's beats are all done. The learner gets their win and chooses
   * whether to carry on; nothing here ends the session on its own.
   */
  missionDone: boolean;
  missionTasks?: MissionTasks | null;
  beat: { id: string; goalEn: string; position: number; total: number };
  advancedBeat: boolean;
  /**
   * The learner reached for English this turn. The ladder already dropped to
   * hand them the French; this flag exists so nothing downstream ever phrases
   * that reach as a failure.
   */
  reachedForEnglish: boolean;
  /**
   * The coach line is the authored English way back (VOICE-013), and the voice
   * layer speaks it in the turn's one English slot, like a reach for English.
   * Engine-side only: it never goes on the wire, because the app shows the
   * coach line it already shows and has nothing else to do with it.
   */
  wayBack: boolean;
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

/**
 * The four rungs as a total table, so a value that arrived over a wire is
 * checked against the ladder itself rather than against a range written down a
 * second time. Same shape as `RAISED_BY_RUNG` in core's missions: the compiler
 * checks the keys against `Rung`, and there is no cast to be wrong about.
 */
const REQUESTABLE_RUNG: Record<Rung, Rung> = { 1: 1, 2: 2, 3: 3, 4: 4 };

/**
 * Where THIS scene opens, which is not the question `openingRungFor` answers.
 *
 * That one is the cold open and stays exactly as it is: one rung BELOW where
 * the learner last finished, because arriving rusty at the very edge of your
 * ability is how a session dies in its first minute. Walking back into a scene
 * you have already finished is the opposite question — the point of the replay
 * is less help than last time — and core's `replayRung` answers it by going one
 * rung UP.
 *
 * So a request REPLACES the cold-open rule rather than feeding it. Feeding it
 * is the silent failure this hop exists to avoid: `openingRung` would spend the
 * replay's +1 undoing its own -1, the learner would replay at exactly the rung
 * they already finished on, and every wire from the tap to the scene would
 * still look connected.
 *
 * Anything that is not one of the four rungs is refused rather than snapped
 * into range. The token server validates this value and the agent clamps it, so
 * this is the last line rather than the first, and at the last line the honest
 * answer to a number nobody recognises is the rung this learner would have got
 * anyway. A guess would land at the top of the range and hand a beginner no
 * support at all on the strength of a bug somewhere upstream.
 */
function sceneOpensAt(learner: LearnerSnapshot, requested: Rung | undefined): Rung {
  if (requested === undefined) return openingRungFor(learner);
  return REQUESTABLE_RUNG[requested] ?? openingRungFor(learner);
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

/**
 * The shortest English setup that still puts someone inside a scene. Below
 * this a "narration" is a label, not a picture, and the scene effectively
 * opens on the French line with no preparation at all.
 */
const MIN_NARRATION_CHARS = 40;

/**
 * The opening narration is the only English the learner gets before the scene
 * starts speaking French at them, and the schema puts no floor under it: a
 * bare speaker line accepts two words, or English written in French.
 *
 * The eval has checked exactly this from the start, offline. Runtime had no
 * guard at all, so a thin or leaked narration reached a real learner as a
 * scene that jumped straight into French. Same check, moved to where somebody
 * is actually listening; the recovery picture is built from the frame's own
 * English so it still belongs to the scene they asked for.
 */
export function repairOpeningNarration(frame: ScenarioFrame, request = ''): ScenarioFrame {
  const narration = frame.openingNarration;
  const en = narration.en.trim();
  const allowed = `${request} ${frame.titleEn}`;
  const thin = en.length < MIN_NARRATION_CHARS;
  if (!thin && !carriesFrench(en, allowed)) return frame;

  const who = frame.characters[0]?.name;
  // The title leads as its own sentence rather than being threaded through a
  // preposition, because titleEn is a noun phrase that may already start with
  // one ("At the corner café"). No stock opener: this is the line that stands in
  // when the model's own failed, and a learner who hears the same words whenever
  // something goes wrong learns to recognise the failure.
  const composed = [
    `${frame.titleEn}.`,
    who ? `You are there, and ${who} is about to speak to you.` : 'You are there, and the conversation begins.',
  ].join(' ');

  return {
    ...frame,
    openingNarration: {
      ...narration,
      speaker: 'narration',
      // Only the spoken half is replaced. The French rides along on screen for
      // exposure and a leak there is not a leak at all.
      en: composed,
      fr: narration.fr.trim().length > 0 ? narration.fr : 'Vous y êtes, et la conversation commence.',
    },
  };
}

export function createConversation(
  rawFrame: ScenarioFrame,
  learner: LearnerSnapshot,
  config: {
    strictness: Strictness;
    maxTurns: number;
    request?: string;
    mission?: boolean;
    missionId?: string;
    /**
     * Open this scene on a named rung instead of the cold-open rule's answer.
     *
     * Absent for every caller that does not ask, which is all of them today,
     * and absent is exactly today's behaviour. Present when the app is replaying
     * a mission the learner has already finished and wants it to offer less
     * help than last time. See `sceneOpensAt`: a request replaces the rule, it
     * never feeds it.
     */
    startRung?: Rung;
    /**
     * Open at the learner's stored pace. Absent is 'normal', which is what
     * every scene opened on before a learner could ask ahead of time; the
     * Slower control still sets it mid-session and it stays sticky either way.
     */
    pace?: Pace;
  },
  now = Date.now(),
): ConversationState {
  const frame = repairOpeningNarration(rawFrame, config.request ?? '');
  const ladder = initialLadder(sceneOpensAt(learner, config.startRung));
  const beatStatus: Record<string, 'pending' | 'done'> = {};
  for (const beat of frame.beats) beatStatus[beat.id] = 'pending';

  return {
    frame,
    strictness: config.strictness,
    maxTurns: config.maxTurns,
    // Defaulting to false is what keeps every existing caller, and the whole
    // generated-frame path, behaving exactly as it did.
    mission: config.mission ?? false,
    missionDone: false,
    missionId: config.mission === true ? config.missionId ?? null : null,
    evidencedBeatIds: [],
    learner,
    ladder,
    directive: directiveFor(ladder.rung),
    history: [{ role: 'assistant', text: `${frame.openingLine.speaker}: ${frame.openingLine.fr}` }],
    beatStatus,
    currentBeat: frame.beats[0]!.id,
    attemptsOnBeat: 0,
    forceAdvance: false,
    // The scenario builder is a model call too, and can collapse the same two
    // lines that a turn call can. Turn zero goes through the same guard.
    lastSupport: learnerSideSupport(frame.openingSupport, frame.openingLine.fr),
    assistanceDepth: 0,
    frenchGiven: false,
    wayBackSpent: false,
    wayBacksSaid: 0,
    pace: config.pace ?? 'normal',
    lastLanguage: null,
    deferred: [],
    phrases: [],
    usedWell: [],
    correctedForms: [],
    errorTags: {},
    topics: [{ en: frame.titleEn, fr: frame.title, turn: 0 }],
    turnCount: 0,
    lastInterruptedTurn: null,
    finished: false,
    startedAt: now,
  };
}

/**
 * A session visits only so many topics. Six is generous for twelve turns; the
 * cap exists so a chatty model reporting a shift every turn cannot flood the
 * recap and the practice built from it.
 */
export const MAX_SESSION_TOPICS = 6;

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

/**
 * Keep the learner's own line out of the character's mouth.
 *
 * A scripted lesson cannot get this wrong: `LessonTurn` holds `tutor` and
 * `target` as two separate fields, and core's `supportView` only ever reads
 * `target`. Free conversation has no such separation. One model call authors
 * both the in-character `sceneReply` and the `support` the learner is handed,
 * and rung 1 asks it to "say the target line, then invite the learner to repeat
 * it" — which, to a model that is also playing the barista, reads as permission
 * to let one line do both jobs. Observed live at Echo: the barista asks
 * "Bonjour, vous désirez ?" and the card tells the learner to say
 * "Bonjour, vous désirez ?". Repeating a question back is not a turn in a
 * conversation; it is the learner being handed the wrong half of the scene.
 *
 * So code decides, the way it decides everything else here. Support material
 * that is only the line just spoken is not the learner's line, whatever the
 * model called it. The repair spends nothing and invents nothing: it promotes
 * an option from the same turn, which the contract already defines as a reply
 * *they* could give, and when no option survives it empties the full line so
 * the view falls back to the hint.
 *
 * The cost of being wrong is deliberately lopsided. Repairing a line that was
 * genuinely echoable ("Bonne journée !" answered with "Bonne journée !") swaps
 * one valid reply for another valid reply out of the same turn's material.
 * Letting the collapse through strands a beginner reading the shopkeeper's
 * question off a card. Only the second one ends a session.
 */
export function learnerSideSupport(support: SupportMaterial, sceneLine: string): SupportMaterial {
  const scene = normalise(sceneLine);
  if (scene.length === 0) return support;

  const isSceneLine = (text: string): boolean => normalise(text) === scene;
  const options = support.options.filter((o) => !isSceneLine(o.fr));
  if (!isSceneLine(support.fullLine.fr)) return { ...support, options };

  const reply = options[0];
  const fullLine = reply
    ? { fr: reply.fr, frWritten: null, en: reply.en }
    : { fr: '', frWritten: null, en: '' };
  return { ...support, fullLine, options };
}

export function supportViewFor(level: SupportLevel, material: SupportMaterial): SupportView {
  switch (level) {
    case 'full-line':
      // No line left to hand over means `learnerSideSupport` found nothing in
      // this turn's material it could vouch for as the learner's own. The hint
      // is the honest floor: English, always their side of the scene, and it
      // names the goal instead of handing over somebody else's line with
      // confidence. Guessing here is how the defect got shipped in the first place.
      if (material.fullLine.fr.trim().length === 0) return { kind: 'hint', hint: material.hintEn };
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

/** The free tutor's disclosure rule. No ladder rung can reveal help early. */
export function supportViewForAssistance(depth: AssistanceDepth, material: SupportMaterial): SupportView {
  if (depth === 0) return { kind: 'none' };
  if (depth === 1) return { kind: 'hint', hint: material.hintEn };
  if (material.fullLine.fr.trim().length === 0) return { kind: 'hint', hint: material.hintEn };
  return {
    kind: 'full-line',
    line: material.fullLine.fr,
    written: material.fullLine.frWritten,
    gloss: material.fullLine.en,
  };
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
      view: { rescued: false, rung: state.ladder.rung, supportView: { kind: 'none' } },
    };
  }

  const event =
    input.type === 'silence'
      ? ({ type: 'silence', durationMs: input.durationMs } as const)
      : ({ type: 'help-requested' } as const);

  const { state: ladder, directive } = applyTurn(state.ladder, event);
  const attempts = state.attemptsOnBeat + 1;
  const assistanceDepth: AssistanceDepth = state.assistanceDepth === 0 ? 1 : 2;

  const supportView = supportViewForAssistance(assistanceDepth, state.lastSupport);
  const next: ConversationState = {
    ...state,
    ladder,
    directive,
    assistanceDepth,
    frenchGiven: state.frenchGiven !== false || supportView.kind === 'full-line',
    attemptsOnBeat: attempts,
    forceAdvance: state.forceAdvance || attempts >= MAX_ATTEMPTS_PER_BEAT,
  };

  return {
    state: next,
    view: { rescued: directive.rescued, rung: ladder.rung, supportView },
  };
}

/**
 * Is this turn the beginner's way back in (VOICE-013)?
 *
 * Code decides, from state the ladder already keeps. It fires on the first
 * rescue that reaches assistance depth 2 on an exchange, which is the second
 * rescue and the one that already asks the tutor to step in. The first rescue
 * stays exactly what PEDAGOGY says it is: a quiet English hint with no model
 * call and nothing spoken. Only A0 and A1, where English is the natural way
 * back, and only on rungs 1 and 2, which is where two rescues leave a
 * beginner anyway; a learner the ladder has carried higher is not frozen in
 * the same way. Never twice on one exchange, and never once they have already
 * reached for English on it.
 *
 * Called on the state AFTER applyNonSpokenInput, by both prepareTurn and
 * integrateTurn, so the prompt and the coach line always agree.
 */
export function wayBackDue(state: ConversationState, input: LearnerTurnInput): boolean {
  return (input.type === 'silence' || input.type === 'help')
    && state.assistanceDepth === 2
    && !state.wayBackSpent
    && WAY_BACK_BANDS.has(state.learner.cefr)
    && state.directive.rung <= 2;
}

/** The authored way-back line for this session's nth way back. */
export function wayBackLine(index: number): string {
  return WAY_BACK_LINES[((index % WAY_BACK_LINES.length) + WAY_BACK_LINES.length) % WAY_BACK_LINES.length]!;
}

/** Spoken or typed words only: a silence marker is never sad news. */
function sadNewsInput(input: LearnerTurnInput): boolean {
  return input.type === 'spoke' && sharesSadNews(input.text);
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
    learner: {
      cefr: state.learner.cefr,
      confidence: state.learner.confidence,
      watchFor: state.learner.watchFor,
      name: state.learner.name,
      goal: state.learner.goal ?? null,
    },
    inputKind: inputKindOf(input),
    missionDone: state.missionDone,
    assistance: state.assistanceDepth === 0 ? 'hidden' : state.assistanceDepth === 1 ? 'hint' : 'full-line',
    pace: state.pace,
    lastLanguage: state.lastLanguage,
    // Only a steer is worth a line: the first entry is the frame's own topic.
    activeTopic: state.topics.length > 1 ? state.topics[state.topics.length - 1]!.en : null,
    wayBack: wayBackDue(state, input),
    askedAlready: askedQuestions(state.history),
    sadNews: sadNewsInput(input),
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
  const sceneReply = { ...raw.sceneReply, fr: clean(raw.sceneReply.fr), en: clean(raw.sceneReply.en) };
  return {
    ...raw,
    coachLine: raw.coachLine === null ? null : clean(raw.coachLine),
    sceneReply,
    // Checked against the cleaned reply, so a stray dash cannot hide the collapse.
    support: learnerSideSupport(raw.support, sceneReply.fr),
    narration:
      raw.narration === null ? null : { ...raw.narration, fr: clean(raw.narration.fr), en: clean(raw.narration.en) },
    coach: raw.coach.map((c) => {
      const why = clean(c.why);
      // A why that scolds or grades is worse than no why at all.
      return { ...c, why: copyViolations(why).length === 0 ? why : '' };
    }),
    newPhrases: raw.newPhrases.slice(0, 3).map((p) => ({ ...p, en: clean(p.en) })),
    topicShift:
      raw.topicShift === null ? null : { en: clean(raw.topicShift.en), fr: clean(raw.topicShift.fr) },
  };
}

/** Keep the model's later context aligned with the actual guarded dialogue. */
export function historyForPublishedTurn(raw: TutorTurn, view: TurnView): string {
  return historyViewOfTurn({ ...sanitizeTurn(raw), sceneReply: view.sceneReply, coachLine: view.coachLine, narration: view.narration });
}

/**
 * What this turn's coaching named, normalised once.
 *
 * `quoted` is what the model says the learner got wrong — the verbatim fragment
 * handed back to them. `named` is that plus the form offered instead, which the
 * *tutor* produced, not the learner. Two lists because the two exclusions they
 * feed have different lifetimes: a quote is wrong for the rest of the session,
 * while an offered form is only "not the learner's own words" in the same
 * breath it was modelled in.
 *
 * `applyTurnToProfile` in profile/profile.ts holds a private copy of this pair
 * and of `namedInCoaching`, because that file was closed to edits when these
 * moved here. The two must not drift: one turn gets one verdict, and the record
 * and the end card have to be reading the same one. Exported so that copy can
 * become an import.
 */
export function coachedForms(turn: TutorTurn): { quoted: string[]; named: string[] } {
  const quoted: string[] = [];
  const named: string[] = [];
  for (const item of turn.coach) {
    const quote = normalise(item.quote);
    if (quote.length > 0) {
      quoted.push(quote);
      named.push(quote);
    }
    for (const offered of [item.better, item.betterWritten]) {
      if (offered === null) continue;
      const key = normalise(offered);
      if (key.length > 0) named.push(key);
    }
  }
  return { quoted, named };
}

/**
 * Was any of these forms named in that coaching?
 *
 * Matched on whole normalised words rather than equality, because a coach item
 * quotes a *fragment* of what the learner said: an exact comparison would miss
 * the phrase sitting inside a quote of the whole sentence, which is the common
 * case. Padding both sides with a space keeps "on" from matching inside
 * "bonjour" — normalise() has already reduced everything to space-separated
 * words, so a word boundary is a space.
 *
 * Over-matching costs one line off an end card; under-matching congratulates
 * somebody on the phrase they were just corrected for. The doubt goes this way
 * on purpose, the same way it does where credit is minted.
 */
export function namedInCoaching(coached: readonly string[], ...forms: readonly (string | null)[]): boolean {
  for (const form of forms) {
    if (form === null) continue;
    const needle = normalise(form);
    if (needle.length === 0) continue;
    if (coached.some((text) => ` ${text} `.includes(` ${needle} `))) return true;
  }
  return false;
}

/**
 * Does the model's own coach line describe the finding the code surfaced?
 *
 * The engine already picks one verdict per turn — `lead`, below — and the line
 * the learner hears is supposed to be that verdict said out loud. It was not
 * checked against it: any line that read cleanly shipped, so a turn whose lead
 * finding was a textbook phrasing could be spoken as "Not quite", and a turn
 * that surfaced one correction could be spoken as a different one.
 *
 * Two questions, both about agreement rather than taste. Does it land as a
 * correction on a kind where nothing was wrong? And does it actually hand over
 * the form this finding offers? A line that says neither the offered spoken
 * form nor its written twin is coaching something else, whatever it is coaching.
 *
 * A finding with no offered form at all is exempt from the second question:
 * there is nothing for the line to name, and demanding it would force the
 * fallback to quote an empty string at the learner.
 */
function coachLineFits(line: string, lead: CoachItem): boolean {
  if (copyViolations(line).length > 0) return false;
  if (NOTHING_WAS_WRONG.has(lead.kind) && landsAsCorrection(line)) return false;
  const offered = [lead.better, lead.betterWritten].filter((form) => normalise(form ?? '').length > 0);
  if (offered.length === 0) return true;
  return namedInCoaching([normalise(line)], ...offered);
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
  // How long since the tutor last interrupted the scene to coach. Infinity on
  // the first one, so the very first finding of a session is never held back.
  const turnsSinceInterruption =
    state.lastInterruptedTurn === null ? Number.POSITIVE_INFINITY : state.turnCount - state.lastInterruptedTurn;
  const { inline, deferred, interrupted } = splitCoach(turn.coach, state.strictness, turnsSinceInterruption);

  // The coach line survives only when something actually surfaces inline, and
  // only when it agrees with that finding; otherwise the tested template speaks.
  //
  // F180: agreement, not just clean copy. Passing the copy rules was the whole
  // test, so the one sentence the learner actually hears was the one part of the
  // turn the model still decided on its own — it could correct a finding the
  // code did not surface, or tell a learner who said something correct that it
  // was not quite right. The verdict is picked once, here, and every mouth
  // repeats it. Nothing is lost when the line is refused: the finding is still
  // in `inline`, still reaches the card, and `coachFallbackLine` is four written
  // variants per kind rather than one stock sentence.
  //
  // G7: the hand-back leads whenever it is present. blocking-error outranks it
  // for the inline slot, which is right for a correction and wrong here — a
  // learner who asked how to say something was hearing "Not quite. Try …"
  // instead of an answer. The correction is not lost; it is still in `inline`
  // and still reaches the card.
  let coachLine: string | null = null;
  const lead = inline.find((c) => c.kind === 'english-to-french') ?? inline[0];
  if (lead !== undefined) {
    coachLine =
      turn.coachLine !== null && coachLineFits(turn.coachLine, lead)
        ? turn.coachLine
        : coachFallbackLine(lead.kind, lead.better, { name: state.learner.name, variant: state.turnCount });
  }

  // The way back outranks everything above. It is the one thing this turn has
  // to say, it is authored, and it rides the coach line so a text session reads
  // exactly what a voice session hears. The model was told it had been said
  // and to add no English of its own, so its own coach line has nothing to add.
  const wayBack = wayBackDue(state, input);
  if (wayBack) coachLine = wayBackLine(state.wayBacksSaid);

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
  //
  // "Modelled" is literal (F928). A rescue that only revealed the English
  // intent hint, which is all a typed scene's silence clock does on a fresh
  // exchange, gave no French: the reply after it is the learner's own. Once
  // the full line was shown or the tutor answered the rescue, it is a copy.
  const wasRescued = input.type === 'silence' || input.type === 'help' ||
    (state.directive.rescued && state.frenchGiven !== false);
  const evidencedBeatIds = [...state.evidencedBeatIds];
  if (state.mission && state.missionId !== null && input.type === 'spoke' && input.text.trim().length > 0 &&
      (turn.assessment.language === 'french' || turn.assessment.language === 'mixed') &&
      turn.assessment.understood && turn.assessment.taskAchieved && turn.scene.goalMet === true &&
      turn.scene.beat === state.currentBeat && turn.scene.beatDone && turn.topicShift === null &&
      !wasRescued && !state.forceAdvance && !evidencedBeatIds.includes(state.currentBeat)) {
    evidencedBeatIds.push(state.currentBeat);
  }
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

  // Finishing a mission is a win, not a closing time.
  //
  // For a generated scene, every beat done IS the end: nothing was promised
  // beyond the beats and there is no authored line to mark the moment. For a
  // mission there is, and ending the session on the exact turn a beginner first
  // got through a real French exchange would take the achievement away in the
  // same breath as giving it. So the flag rises and the learner decides.
  //
  // The other two exits are untouched deliberately. `sceneDone` is the model
  // saying the scene itself is over, and the turn ceiling is what keeps metered
  // minutes bounded; a mission that could never end would be its own trap.
  const missionDone = state.missionDone || (state.mission && allBeatsDone);
  // VOICE-015: sad news is never the turn the session ends. Someone who has
  // just said their mother died must not be shown a recap card, whatever the
  // model reported, so sceneDone and every beat done wait for a turn that is
  // not this one. The ceiling stretches by one turn at most: metered minutes
  // stay bounded, and a learner who keeps talking about it is answered the
  // turn after by the ordinary exits, with the conduct section still in force.
  const sadNews = sadNewsInput(input);
  const recapDue = sadNews
    ? turnCount >= state.maxTurns + 1
    : turn.scene.sceneDone || (allBeatsDone && !state.mission) || turnCount >= state.maxTurns;

  // Session memory: phrases (deduped), credit, recurring-error counts.
  const phrases = [...state.phrases];
  for (const p of turn.newPhrases) {
    if (!phrases.some((existing) => existing.fr === p.fr)) phrases.push(p);
  }
  // F204, and the same one-turn-one-verdict rule as the coach line above, said
  // to the third mouth. `usedWell` is what the end card celebrates, and it was
  // accumulated raw — so a single model call could hand back a correction and
  // claim the same phrase was used well, and the card would print the praise
  // under the fix. The evidence side of this is already closed where credit is
  // minted; this is display, so it inflates nothing, but it is the contradiction
  // the learner can actually see.
  //
  // Two exclusions with two lifetimes, exactly as the two lists mean. `named`
  // covers this turn: the quote is what the model just said was wrong, and the
  // offered form is what the tutor said, not the learner, so repeating a line
  // modelled a second ago is not the unprompted production a win claims.
  // `correctedForms` covers the session: a fragment the tutor ever handed back
  // is not a win on the card later either.
  //
  // A phrase the learner ADOPTS after a correction is deliberately still a win.
  // Only the quoted form is remembered for the session, never the offered one,
  // so saying the better line under their own steam on a later turn counts —
  // which is the product working, and the last thing to hide from them.
  const { quoted, named } = coachedForms(turn);
  const correctedForms = [...state.correctedForms];
  for (const form of quoted) {
    if (!correctedForms.includes(form)) correctedForms.push(form);
  }
  // LEARN-001: a line said while the hint or the full line was showing is help,
  // not a win. The profile records it as `timesAssisted`; the end card and the
  // transfer asks built from these wins leave it out.
  const usedWell = state.assistanceDepth > 0 ? [] : turn.profileSignals.usedWell.filter(
    (used) => !namedInCoaching(named, used) && !namedInCoaching(state.correctedForms, used),
  );

  const errorTags = { ...state.errorTags };
  for (const pattern of turn.profileSignals.errorPatterns) {
    const tag = normalizeErrorTag(pattern.tag);
    if (tag.length === 0) continue;
    errorTags[tag] = (errorTags[tag] ?? 0) + 1;
  }

  // Topics: the learner steering somewhere new is recorded, never resisted.
  // The model observes the steer; code appends, dedupes and caps. Beats do
  // not move because of it — the spine above already decided the scene.
  let topics = state.topics;
  if (turn.topicShift !== null) {
    const en = turn.topicShift.en.trim();
    const key = en.toLowerCase();
    const known = topics.some((t) => t.en.trim().toLowerCase() === key);
    if (en.length > 0 && !known && topics.length < MAX_SESSION_TOPICS) {
      topics = [...topics, { en, fr: turn.topicShift.fr.trim(), turn: turnCount }];
    }
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
    evidencedBeatIds,
    attemptsOnBeat,
    forceAdvance,
    lastSupport: turn.support,
    // G6: speaking a real reply resets the earned help. Asking "how do I say
    // this?" in English is not a real reply — which is exactly why the beat
    // below does not complete — so binning the card there took the help away
    // at the moment the learner had just asked for it.
    assistanceDepth:
      input.type === 'spoke' && turn.assessment.language !== 'english' ? 0 : state.assistanceDepth,
    // A tutor turn answering a rescue models the line; a real reply clears it.
    frenchGiven: input.type !== 'spoke' ? true
      : turn.assessment.language !== 'english' ? false : state.frenchGiven !== false,
    // Same lifetime as the earned help: a real reply opens a new exchange with
    // a way back still to offer. Reaching for English spends it, because they
    // have already found the way back on their own.
    wayBackSpent:
      input.type === 'spoke' && turn.assessment.language !== 'english' ? false : state.wayBackSpent || wayBack || reachedForEnglish,
    wayBacksSaid: state.wayBacksSaid + (wayBack ? 1 : 0),
    lastLanguage:
      input.type === 'spoke' && (turn.assessment.language === 'english' || turn.assessment.language === 'mixed')
        ? turn.assessment.language
        : null,
    deferred: [...state.deferred, ...deferred],
    phrases,
    topics,
    usedWell: [...state.usedWell, ...usedWell],
    correctedForms,
    errorTags,
    turnCount,
    // Restart the clock only when the scene was actually interrupted. A turn
    // whose only inline finding answered a question the learner asked does not
    // spend this budget, so asking for help never buys the tutor's silence on
    // the next thing worth saying.
    lastInterruptedTurn: interrupted ? turnCount : state.lastInterruptedTurn,
    missionDone,
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
      supportView: supportViewForAssistance(input.type === 'spoke' ? 0 : state.assistanceDepth, turn.support),
      rung: ladder.rung,
      recapDue,
      missionDone,
      ...(next.missionId === null ? {} : { missionTasks: missionTasksFor(next) }),
      beat: { id: beat.id, goalEn: beat.goalEn, position, total: beats.length },
      advancedBeat,
      reachedForEnglish,
      wayBack,
    },
  };
}

/** Authored whole-list projection, including unticked goals before the first turn. */
export function missionTasksFor(state: ConversationState): MissionTasks | null {
  if (!state.mission || state.missionId === null) return null;
  return readMissionTasks({ missionId: state.missionId, items: state.frame.beats.map(beat => ({
    id: beat.id, goalEn: beat.goalEn, achieved: state.evidencedBeatIds.includes(beat.id),
  })) });
}
