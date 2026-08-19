/**
 * The session engine — where the ladder, the lesson and the scorer meet.
 *
 * Two ideas do most of the work here.
 *
 * First, *saying the right words* and *saying them well* are separate questions
 * with separate answers. A learner can produce exactly the right sentence with a
 * mangled /ʁ/, or perfect pronunciation of the wrong reply. Collapsing those into
 * one "correct" boolean is what makes existing apps feel either too forgiving or
 * arbitrarily harsh. We resolve them independently and combine at the end.
 *
 * Second, a rescue re-attempts *the same turn* with more support. It never skips
 * ahead. Advancing past something the learner could not say would leave a hole in
 * the lesson and, worse, teach them that being stuck makes things disappear.
 */

import {
  applyTurn,
  directiveFor,
  initialState as initialLadder,
  nextSessionRung,
  unassistedRate,
  STUCK_SILENCE_MS,
  type LadderDirective,
  type LadderState,
  type Rung,
  type TurnEvent,
  type TurnQuality,
} from '../ladder/ladder.ts';
import { buildReport, type PhonemeObservation, type SessionPhonemeReport } from '../phonemes/scoring.ts';
import { matchAcceptable, normalise, type Lesson, type LessonTurn } from '../lessons/types.ts';

/**
 * The point below which an utterance probably was not *understood*.
 *
 * Note what this is not: it is not the bar for good pronunciation. Withholding
 * ladder promotion until someone's accent is good would trap every learner with a
 * strong English accent at the Echo rung permanently — which is the precise
 * failure this product exists to prevent.
 *
 * Climbing the ladder measures whether they can compose French for themselves.
 * How French it *sounds* is a separate axis, handled after the session by the
 * drill system, where it can be worked on without blocking the conversation.
 */
export const INTELLIGIBLE = 50;

export interface TranscriptEntry {
  speaker: 'tutor' | 'learner';
  text: string;
  /** Present on learner entries once scored. */
  pronunciationScore?: number;
  rescued?: boolean;
}

export interface SessionState {
  lessonId: string;
  turnIndex: number;
  /** Attempts spent on the current turn. Reset whenever the lesson advances. */
  attemptsOnTurn: number;
  ladder: LadderState;
  directive: LadderDirective;
  observations: PhonemeObservation[];
  transcript: TranscriptEntry[];
  /** Distinct French words the learner actually said aloud. */
  wordsProduced: Set<string>;
  /**
   * Turns that needed a rescue or a retry, in lesson order, deduped.
   * Never surfaced mid-session — this feeds the review deck, where the line
   * comes back tomorrow as a quiet re-ask instead of a red mark today.
   */
  struggledTurnIds: string[];
  learnerSpeakingSec: number;
  longestTurnSec: number;
  utterancesScored: number;
  startedAt: number;
  endedAt?: number;
  finished: boolean;
}

/** What the UI renders as on-screen support this turn. */
export type SupportView =
  | { kind: 'full-line'; line: string; gloss: string; ipa: string }
  | { kind: 'options'; options: { text: string; en: string }[] }
  | { kind: 'hint'; hint: string }
  | { kind: 'none' };

export interface SessionPrompt {
  turn: LessonTurn;
  directive: LadderDirective;
  support: SupportView;
  /** 1-based, for "3 of 12". */
  position: number;
  total: number;
  finished: boolean;
}

export type LearnerInput =
  | { type: 'spoke'; transcript: string; phonemes: PhonemeObservation[]; durationSec: number }
  | { type: 'silence'; durationMs: number }
  | { type: 'help' }
  | { type: 'skip' };

export interface TurnFeedback {
  quality: TurnQuality;
  /** Did they produce an acceptable reply, regardless of how it sounded? */
  wordsCorrect: boolean;
  /** Mean pronunciation across this utterance, or null when nothing was scored. */
  pronunciationScore: number | null;
  rescued: boolean;
  /** Whether the lesson moved on. False when a rescue is re-attempting this turn. */
  advanced: boolean;
  /** One short line for the UI. Deliberately never scolds. */
  message: string;
}

export function createSession(lesson: Lesson, startRung: Rung = lesson.openingRung, now = Date.now()): SessionState {
  const ladder = initialLadder(startRung);
  return {
    lessonId: lesson.id,
    turnIndex: 0,
    attemptsOnTurn: 0,
    ladder,
    directive: directiveFor(ladder.rung),
    observations: [],
    transcript: [],
    wordsProduced: new Set(),
    struggledTurnIds: [],
    learnerSpeakingSec: 0,
    longestTurnSec: 0,
    utterancesScored: 0,
    startedAt: now,
    finished: false,
  };
}

function supportView(turn: LessonTurn, directive: LadderDirective): SupportView {
  switch (directive.support) {
    case 'full-line':
      return { kind: 'full-line', line: turn.target, gloss: turn.targetEn, ipa: turn.targetIpa };
    case 'options':
      // Wrong options are shown too — choosing between plausible replies is the
      // skill being practised. But we never show more than three; a beginner
      // reading four French sentences under time pressure is doing homework.
      return { kind: 'options', options: turn.options.slice(0, 3).map((o) => ({ text: o.text, en: o.en })) };
    case 'hint':
      return { kind: 'hint', hint: turn.hint };
    case 'none':
      return { kind: 'none' };
  }
}

export function currentPrompt(lesson: Lesson, state: SessionState): SessionPrompt {
  const idx = Math.min(state.turnIndex, lesson.turns.length - 1);
  const turn = lesson.turns[idx]!;
  return {
    turn,
    directive: state.directive,
    support: supportView(turn, state.directive),
    position: idx + 1,
    total: lesson.turns.length,
    finished: state.finished,
  };
}

function meanScore(obs: readonly PhonemeObservation[]): number | null {
  if (obs.length === 0) return null;
  return obs.reduce((a, o) => a + o.score, 0) / obs.length;
}

/**
 * Grade an utterance on its two independent axes.
 *
 * Wrong words is `poor` — no amount of beautiful pronunciation makes an
 * unrelated answer right. Nearly-right words are `partial`, which holds the rung:
 * see `matchAcceptable` for where the line between the two is drawn. Right words
 * spoken intelligibly is `good`, accent and all. Speech so unclear a listener
 * would not have caught it also holds at `partial`, and neither kind of partial
 * ever drops the learner down a rung.
 */
export function grade(wordsCorrect: boolean, pronunciation: number | null, nearMiss = false): TurnQuality {
  // Half the line is not the line, but it is not a different answer either. A
  // learner who produced most of it and lost the rest to nerves has earned
  // "that got the message across", not a rung.
  if (!wordsCorrect) return nearMiss ? 'partial' : 'poor';
  if (pronunciation === null) return 'good'; // nothing scored; do not invent a penalty
  return pronunciation >= INTELLIGIBLE ? 'good' : 'partial';
}

/**
 * Words as the learner should *see* them, not as we match them.
 *
 * `normalise` strips accents and apostrophes so a transcriber that drops an acute
 * cannot fail a correct answer — but showing that stripped form back to a French
 * learner would teach them "cafe" and "sil". Display keeps the real spelling;
 * matching keeps the forgiving form.
 */
function wordsFrom(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, ''))
    .filter((w) => w.length > 0);
}

/**
 * How many times a single turn may be re-attempted before the conversation moves
 * on regardless.
 *
 * Without a bound, a learner who cannot manage turn one never sees turn two. A
 * human tutor does not drill someone into the ground either — after a couple of
 * goes they carry the conversation forward and quietly come back to it later.
 */
export const MAX_ATTEMPTS_PER_TURN = 2;

export function submitTurn(lesson: Lesson, state: SessionState, given: LearnerInput): { state: SessionState; feedback: TurnFeedback } {
  const turn = lesson.turns[Math.min(state.turnIndex, lesson.turns.length - 1)]!;

  /**
   * A turn that arrived through the speech path carrying no words is silence
   * that happened to trip the recogniser — a cough, a passing bus, the tutor's
   * own voice in a speakerphone. Grading it as a wrong answer scolds a learner
   * who never said anything, so it becomes what it actually is.
   */
  const input: LearnerInput =
    given.type === 'spoke' && normalise(given.transcript).length === 0
      ? { type: 'silence', durationMs: STUCK_SILENCE_MS }
      : given;

  // A short pause is thinking, not being stuck. Nothing happened at all.
  if (input.type === 'silence' && input.durationMs < STUCK_SILENCE_MS) {
    return {
      state,
      feedback: { quality: 'partial', wordsCorrect: false, pronunciationScore: null, rescued: false, advanced: false, message: '' },
    };
  }

  let event: TurnEvent;
  let wordsCorrect = false;
  let nearMiss = false;
  let pronunciation: number | null = null;
  const next: SessionState = {
    ...state,
    observations: [...state.observations],
    transcript: [...state.transcript],
    wordsProduced: new Set(state.wordsProduced),
    struggledTurnIds: [...state.struggledTurnIds],
  };

  switch (input.type) {
    case 'spoke': {
      const match = matchAcceptable(turn, input.transcript);
      wordsCorrect = match.accepted;
      nearMiss = match.via === 'near';
      pronunciation = meanScore(input.phonemes);
      const quality = grade(wordsCorrect, pronunciation, nearMiss);
      event = { type: 'spoke', quality };

      next.observations.push(...input.phonemes);
      next.learnerSpeakingSec += input.durationSec;
      next.longestTurnSec = Math.max(state.longestTurnSec, input.durationSec);
      if (input.phonemes.length > 0) next.utterancesScored += 1;
      // Only credit words they got right — otherwise a garbled transcript inflates
      // the vocabulary count and the progress card starts lying.
      if (wordsCorrect) for (const w of wordsFrom(input.transcript)) next.wordsProduced.add(w);
      next.transcript.push({ speaker: 'learner', text: input.transcript, pronunciationScore: pronunciation ?? undefined });
      break;
    }
    case 'silence':
      event = { type: 'silence', durationMs: input.durationMs };
      break;
    case 'help':
      event = { type: 'help-requested' };
      break;
    case 'skip':
      event = { type: 'skipped' };
      break;
  }

  const { state: ladder, directive } = applyTurn(state.ladder, event);
  next.ladder = ladder;
  next.directive = directive;

  const quality: TurnQuality = input.type === 'spoke' ? grade(wordsCorrect, pronunciation, nearMiss) : 'poor';

  // A rescue, or a wrong answer, re-attempts this same turn with more support —
  // never skips past something the learner could not say. Bounded so nobody can
  // get stuck in a loop on turn one.
  const wantsRetry = directive.rescued || (input.type === 'spoke' && quality === 'poor');
  const attempts = state.attemptsOnTurn + 1;
  const advanced = !wantsRetry || attempts >= MAX_ATTEMPTS_PER_TURN;

  // Any turn that needed help is remembered for the review deck. Deduped so a
  // double miss on one line does not queue the same card twice.
  if (wantsRetry && !next.struggledTurnIds.includes(turn.id)) next.struggledTurnIds.push(turn.id);

  next.attemptsOnTurn = advanced ? 0 : attempts;
  if (advanced) next.turnIndex = state.turnIndex + 1;

  if (next.turnIndex >= lesson.turns.length) {
    next.finished = true;
    next.endedAt = Date.now();
  }

  return {
    state: next,
    feedback: {
      quality,
      wordsCorrect,
      pronunciationScore: pronunciation,
      rescued: directive.rescued,
      advanced,
      message: feedbackMessage(input.type, quality, directive.rescued, pronunciation),
    },
  };
}

/**
 * The one line shown after a turn.
 *
 * Never scolds, never says "wrong", and never mentions a score during the
 * session. Numbers belong on the end card where they can be given context;
 * mid-conversation they just make the learner self-conscious about speaking,
 * which is the exact opposite of what this app is for.
 */
function feedbackMessage(kind: LearnerInput['type'], quality: TurnQuality, rescued: boolean, pronunciation: number | null): string {
  if (rescued) return "Let's take that one together.";
  if (kind === 'skip') return 'No problem. On we go.';
  if (quality === 'good') return pronunciation !== null && pronunciation >= 90 ? 'Parfait.' : 'Très bien.';
  if (quality === 'partial') return 'Good. That got the message across.';
  return 'Not quite. Listen and try it this way.';
}

/**
 * Whether this session could say anything about pronunciation at all.
 *
 * The distinction the end card has to make and could not: `clean` means we
 * listened and there was nothing worth working on; `unavailable` means we never
 * heard them — no audio reached the scorer, or the learner answered by tapping
 * and typing. Collapsing the two into an empty focus card shows a learner who
 * was never assessed the same screen as a learner who did well, which is a claim
 * this product does not get to make.
 */
export type PronunciationStatus = 'scored' | 'clean' | 'unavailable';

export interface SessionSummary {
  lessonId: string;
  durationSec: number;
  pronunciation: SessionPhonemeReport;
  pronunciationStatus: PronunciationStatus;
  /** Share of turns the learner composed French for themselves. */
  unassistedRate: number;
  /** Distinct words they actually said aloud, correctly. */
  wordsProduced: string[];
  /** Longest unbroken stretch of French, in seconds. */
  longestTurnSec: number;
  /** Share of the session the learner was the one talking. */
  speakingShare: number;
  turnsCompleted: number;
  rescues: number;
  utterancesScored: number;
  /** Turns that needed a rescue or a retry — the review deck's mistakes queue. */
  struggledTurnIds: string[];
  /**
   * Where the next session should open. Deliberately one rung below where they
   * finished (see `nextSessionRung`): starting cold at the edge of your ability
   * is how a session dies in its first thirty seconds.
   */
  nextStartRung: Rung;
}

export function summarise(state: SessionState, now = Date.now()): SessionSummary {
  const durationSec = Math.max(0, ((state.endedAt ?? now) - state.startedAt) / 1000);
  const pronunciation = buildReport(state.observations);
  return {
    lessonId: state.lessonId,
    durationSec,
    pronunciation,
    pronunciationStatus: state.utterancesScored === 0 ? 'unavailable' : pronunciation.focus ? 'scored' : 'clean',
    unassistedRate: unassistedRate(state.ladder),
    wordsProduced: [...state.wordsProduced].sort(),
    longestTurnSec: state.longestTurnSec,
    speakingShare: durationSec === 0 ? 0 : Math.min(1, state.learnerSpeakingSec / durationSec),
    turnsCompleted: state.turnIndex,
    rescues: state.ladder.rescues,
    utterancesScored: state.utterancesScored,
    struggledTurnIds: [...state.struggledTurnIds],
    nextStartRung: nextSessionRung(state.ladder),
  };
}
