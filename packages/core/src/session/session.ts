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
  /**
   * Lesson turns since the tutor last stopped to correct a miss out loud.
   * Starts long ago, so the first miss of a session is always answered.
   */
  turnsSinceCorrection: number;
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
    turnsSinceCorrection: Number.POSITIVE_INFINITY,
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

/**
 * How many lesson turns must pass between two corrections the learner did not
 * ask for.
 *
 * This is K1's answer, carried across from the conversation. There the tutor
 * corrected on every single turn on its loosest setting, because a budget of one
 * correction per turn, spent every turn, is still a correction every turn: the
 * missing dimension was time. The scripted lesson had the identical shape and
 * never received the fix, so six missed turns earned six corrections, and a
 * beginner corrected on everything stops talking.
 *
 * This declaration is the number. The conversation reads it too:
 * `packages/brain/src/engine/grading.ts` re-exports it as
 * `INLINE_COACH_COOLDOWN_TURNS`, which is the name K1 gave it, and brain
 * already depends on core so the dependency runs the right way round. It used
 * to be a second literal there with a comment and a test holding the two copies
 * equal, which worked but was a test standing in for a type system: change it
 * here and both modes move, or neither does.
 *
 * Nothing becomes ineligible. A miss held back still costs the rung, still
 * re-attempts the turn, and still joins `struggledTurnIds` — the review deck that
 * already brings the line back tomorrow as a quiet re-ask. Only the interruption
 * waits.
 */
export const CORRECTION_COOLDOWN_TURNS = 2;

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

  // The correction is the only thing said here that breaks the scene, so it is
  // the only thing on a clock. A rescue is never a correction, and neither is
  // handing over the line on the way past it: both answer the learner instead of
  // interrupting them, so neither is held back and neither spends the budget.
  const missed = !directive.rescued && input.type === 'spoke' && quality === 'poor';
  const correcting = missed && !advanced && state.turnsSinceCorrection >= CORRECTION_COOLDOWN_TURNS;
  next.turnsSinceCorrection = correcting ? 0 : state.turnsSinceCorrection + (advanced ? 1 : 0);

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
      message: feedbackMessage({
        kind: input.type,
        quality,
        rescued: directive.rescued,
        pronunciation,
        turn: next.turnIndex,
        advanced,
        line: turn.target,
        correcting,
      }),
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
 *
 * Each outcome is a small family rotated on the turn index, never a random
 * draw, so a twelve-turn lesson does not say the identical three words twelve
 * times. That repetition is most of what a learner hears as a machine, and it
 * is loudest exactly where it hurts most: the line after a rescue, which by
 * definition arrives when they are already struggling.
 *
 * The first entry of each family is the line this shipped with, so nothing that
 * was already right has been thrown away to make room for variety. The two
 * praise families are the exception: they were French interface praise, and
 * founder decision D14 (F717) made every win warm, plain English. The lesson's
 * French is in the tutor's lines; this line is the voice around them.
 */
const FEEDBACK = {
  rescued: [
    "Let's take that one together.",
    "Here, I'll start you off.",
    'This one we do together.',
  ],
  skipped: ['No problem. On we go.', 'Fine, next one.', 'We can leave that one.'],
  excellent: ['Exactly right.', 'Spot on.', 'That was it, exactly.'],
  good: ['Well said.', "Yes, that's it.", 'Nicely put.'],
  partial: [
    'Good. That got the message across.',
    'That lands. The meaning is there.',
    'Understood, that works.',
  ],
  missed: [
    'Not quite. Listen and try it this way.',
    'Almost. Listen once more.',
    'Not quite that. Have a listen.',
  ],
  /**
   * A miss inside the cooldown, where the same line is coming round again.
   *
   * The turn still repeats and the ladder still hands over more support, so the
   * learner is not left wondering what happened; what they do not get is a
   * second "Not quite" in a row. Silence would have been the closer copy of
   * K1 — there the held-back finding simply waits for the recap — but on screen
   * silence reads as nothing having happened at all, and a learner mid-scene
   * needs the way forward said out loud.
   */
  again: [
    "Let's have another go at that one.",
    'One more time on this one.',
    'We can take that one again.',
  ],
} as const satisfies Record<string, readonly string[]>;

/**
 * What the tutor says when the lesson moves past a line the learner did not
 * manage.
 *
 * The attempts for this turn are spent, so the engine has already moved on and
 * the next thing the learner hears is the tutor's next question. Copy that asks
 * them to listen once more and have another go is asking for a retry that will
 * never come, and it leaves them answering a turn that is no longer there.
 *
 * So this family does what a human tutor does on the way past: says the line
 * once, and carries on. The line is the whole point, which is why these are
 * written with it rather than around it, in the shape brain's copy families
 * already use.
 */
type ModelledLine = (line: string) => string;

const MOVED_ON: readonly ModelledLine[] = [
  (line) => `It goes "${line}". On to the next one.`,
  (line) => `The line here is "${line}". Let's carry on.`,
  (line) => `Here it is: "${line}". We keep going.`,
];

/** Every variant, so a test can walk all of them with a real line. */
export const MOVED_ON_LINES: readonly ModelledLine[] = MOVED_ON;

/**
 * Which family answers which outcome, so a test can walk every line of every
 * one. Exported with its literal keys rather than as a Record, so a test naming
 * a family that does not exist fails at the compiler rather than at runtime.
 */
export const FEEDBACK_FAMILIES: { [K in keyof typeof FEEDBACK]: readonly string[] } = FEEDBACK;

/** Pick a variant of any family, safe for any integer including a negative one. */
function rotate<T>(family: readonly T[], turn: number): T {
  return family[Math.abs(Math.trunc(turn)) % family.length]!;
}

/** Excellent pronunciation earns the warmer word. Kept out of the branch for readability. */
const EXCELLENT = 90;

function feedbackMessage(outcome: {
  kind: LearnerInput['type'];
  quality: TurnQuality;
  rescued: boolean;
  pronunciation: number | null;
  /** Which variant of the family to use, and the turn the learner is now on. */
  turn: number;
  /** Did the lesson move on, or is this same line coming round again? */
  advanced: boolean;
  /** The line this turn was aiming for, said back on the way past it. */
  line: string;
  /** Whether a correction is due, or the tutor is still inside the cooldown. */
  correcting: boolean;
}): string {
  const { kind, quality, rescued, pronunciation, turn, advanced, line, correcting } = outcome;

  // The lesson has gone past a line they did not manage. Nothing said here may
  // ask for another attempt, because there will not be one. A skip is left out:
  // they chose to leave that line, and being read it back would answer a
  // question they did not ask.
  if (advanced && kind !== 'skip' && (rescued || quality === 'poor')) return rotate(MOVED_ON, turn)(line);

  if (rescued) return rotate(FEEDBACK.rescued, turn);
  if (kind === 'skip') return rotate(FEEDBACK.skipped, turn);
  if (quality === 'good') {
    return rotate(pronunciation !== null && pronunciation >= EXCELLENT ? FEEDBACK.excellent : FEEDBACK.good, turn);
  }
  if (quality === 'partial') return rotate(FEEDBACK.partial, turn);
  // The same line is coming round again, so this is the one place a correction
  // belongs — and the one place it is on a clock. See CORRECTION_COOLDOWN_TURNS.
  return correcting ? rotate(FEEDBACK.missed, turn) : rotate(FEEDBACK.again, turn);
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
