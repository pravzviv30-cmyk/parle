/**
 * The scaffolding ladder.
 *
 * This exists because of one sentence in Issen's Launch HN thread:
 *
 *   "Being absolute noob I cannot reply to it, nor even repeat it...
 *    The AI just sits there waiting for me to make a sound."
 *
 * and the reply describing what a human would have done instead:
 *
 *   "A human tutor would repeat part of the sentence with a translation.
 *    The AI just sits there."
 *
 * A free-form AI tutor puts the entire cognitive load on the learner: they must
 * decide what to say, retrieve the French for it, and pronounce it, all under
 * time pressure. A beginner cannot do the first step, so they freeze, and the
 * silence is interpreted by the app as "still thinking". The session dies.
 *
 * The ladder inverts that. Support is always present and is *withdrawn* as the
 * learner improves, rather than being absent and granted on request. Four rungs:
 *
 *   1 Echo     tutor says the line, learner repeats it        (nothing to invent)
 *   2 Cued     learner picks from spoken options              (choose, don't compose)
 *   3 Prompted English hint only, learner composes French     (compose with a goal)
 *   4 Free     no support                                     (full conversation)
 *
 * The rule that matters most is the one that fires on silence. Four seconds of
 * nothing is not thinking — it is being stuck — and the tutor drops a rung and
 * simply offers the line, without ever remarking on it. There is no failure
 * state and no way to get stranded. That is the entire point.
 */

export type Rung = 1 | 2 | 3 | 4;

export const RUNGS = {
  ECHO: 1,
  CUED: 2,
  PROMPTED: 3,
  FREE: 4,
} as const satisfies Record<string, Rung>;

/** Silence beyond this is treated as stuck, not thinking. */
export const STUCK_SILENCE_MS = 4_000;
/** Consecutive good turns needed before we withdraw a level of support. */
export const PROMOTION_STREAK = 2;

export type TurnQuality = 'good' | 'partial' | 'poor';

export type TurnEvent =
  | { type: 'spoke'; quality: TurnQuality }
  /** Learner said nothing for this long. */
  | { type: 'silence'; durationMs: number }
  /** Learner tapped "aide-moi" or said they don't know. */
  | { type: 'help-requested' }
  /** Learner explicitly skipped the turn. */
  | { type: 'skipped' };

export interface LadderState {
  rung: Rung;
  /** Consecutive good turns at the current rung. */
  streak: number;
  /** Times we stepped in uninvited this session. Never shown to the learner. */
  rescues: number;
  /** Turns completed at rung 3+ without a rescue — the real progress signal. */
  unassistedTurns: number;
  totalTurns: number;
}

/** What the UI renders as on-screen support. */
export type SupportLevel =
  /** French line + English gloss, read aloud first. */
  | 'full-line'
  /** Two or three spoken options with meanings. */
  | 'options'
  /** English description of what to say. No French. */
  | 'hint'
  /** Nothing. */
  | 'none';

export interface LadderDirective {
  rung: Rung;
  support: SupportLevel;
  /**
   * True when this turn follows an automatic drop. The tutor must rephrase and
   * offer, warmly and without commenting on the struggle.
   */
  rescued: boolean;
  /** Injected into the tutor LLM's prompt for this turn. */
  tutorInstruction: string;
}

export function initialState(rung: Rung = RUNGS.ECHO): LadderState {
  return { rung, streak: 0, rescues: 0, unassistedTurns: 0, totalTurns: 0 };
}

function clamp(rung: number): Rung {
  return Math.min(4, Math.max(1, rung)) as Rung;
}

/**
 * Advance the ladder by one turn.
 *
 * Pure: returns a new state and the directive for the *next* turn. Keeping this
 * free of I/O is what makes the stuck-learner behaviour testable without a
 * microphone, an API key, or a beginner.
 */
export function applyTurn(state: LadderState, event: TurnEvent): { state: LadderState; directive: LadderDirective } {
  const next: LadderState = { ...state, totalTurns: state.totalTurns + 1 };
  let rescued = false;

  switch (event.type) {
    case 'spoke': {
      if (event.quality === 'good') {
        next.streak = state.streak + 1;
        // Credit only counts where the learner actually composed something.
        if (state.rung >= RUNGS.PROMPTED) next.unassistedTurns = state.unassistedTurns + 1;
        if (next.streak >= PROMOTION_STREAK && state.rung < RUNGS.FREE) {
          next.rung = clamp(state.rung + 1);
          next.streak = 0;
        }
      } else if (event.quality === 'partial') {
        // Understood but shaky. Hold position — dropping here would feel punitive
        // for what is normal beginner performance.
        next.streak = 0;
      } else {
        next.streak = 0;
        next.rung = clamp(state.rung - 1);
      }
      break;
    }

    case 'silence': {
      if (event.durationMs >= STUCK_SILENCE_MS) {
        next.streak = 0;
        next.rung = clamp(state.rung - 1);
        next.rescues = state.rescues + 1;
        rescued = true;
      } else {
        // A short pause is thinking. Do nothing at all.
        next.totalTurns = state.totalTurns;
      }
      break;
    }

    case 'help-requested': {
      // Asking for help is a healthy act, not a failure. Same mechanical response
      // as silence, but it must never be scored against the learner.
      next.streak = 0;
      next.rung = clamp(state.rung - 1);
      next.rescues = state.rescues + 1;
      rescued = true;
      break;
    }

    case 'skipped': {
      next.streak = 0;
      next.rung = clamp(state.rung - 1);
      break;
    }
  }

  return { state: next, directive: directiveFor(next.rung, rescued) };
}

const SUPPORT_BY_RUNG: Record<Rung, SupportLevel> = {
  1: 'full-line',
  2: 'options',
  3: 'hint',
  4: 'none',
};

const INSTRUCTION_BY_RUNG: Record<Rung, string> = {
  1:
    'Say the target line in French, slowly and clearly, then invite the learner to repeat it. ' +
    'Show the French text with its English meaning. Do not ask them to produce anything new.',
  2:
    'Ask your question in French, then offer two or three short French replies they could give, each with its English meaning. ' +
    'They must say their choice out loud — never let them tap it silently.',
  3:
    'Ask your question in French. Tell them in English what to communicate, but do not give them the French words. ' +
    'Let them compose it themselves.',
  4:
    'Converse naturally in French at their level. Offer no scaffolding unless they ask for it.',
};

const RESCUE_PREFIX =
  'The learner is stuck. Step in immediately and warmly. Rephrase your last turn more simply, ' +
  'give them the French line with its English meaning, and invite them to say it after you. ' +
  'Do NOT mention that they hesitated, do not apologise, and do not ask whether they are finding it hard — ' +
  'just carry the conversation forward as a good human tutor would. ';

export function directiveFor(rung: Rung, rescued = false): LadderDirective {
  return {
    rung,
    support: SUPPORT_BY_RUNG[rung],
    rescued,
    tutorInstruction: rescued ? RESCUE_PREFIX + INSTRUCTION_BY_RUNG[rung] : INSTRUCTION_BY_RUNG[rung],
  };
}

/**
 * Share of turns the learner handled while composing French themselves.
 * This is the headline number on the weekly fingerprint — it is a measure of
 * independence, which is what "getting better" actually means here.
 */
export function unassistedRate(state: LadderState): number {
  if (state.totalTurns === 0) return 0;
  return state.unassistedTurns / state.totalTurns;
}

/**
 * The rung to open the learner's next session on.
 *
 * Deliberately one below where they finished. Starting at the edge of your
 * ability while cold is how a session dies in its first thirty seconds, and the
 * ladder climbs back within two good turns anyway.
 */
export function nextSessionRung(state: LadderState): Rung {
  return clamp(state.rung - 1);
}
