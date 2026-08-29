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

/**
 * What to render, and what to tell the tutor, for a given rung.
 *
 * A rescue overrides the rung's usual support with the whole line, every time.
 * Dropping one rung is right for what comes *next* — but the turn the learner
 * just froze on has to be answered with the answer. A freeze at Free that lands
 * on Prompted hands back an English hint, which asks the person who could not
 * compose French a moment ago to compose French again; that is the exact failure
 * this ladder exists to prevent, and RESCUE_PREFIX already promises the model it
 * will hand over the line. This makes the rendered support say the same thing as
 * the instruction instead of contradicting it.
 *
 * The rung still drops. Support returns to the rung's own level on the next turn.
 */
export function directiveFor(rung: Rung, rescued = false): LadderDirective {
  return {
    rung,
    support: rescued ? 'full-line' : SUPPORT_BY_RUNG[rung],
    rescued,
    tutorInstruction: rescued ? RESCUE_PREFIX + INSTRUCTION_BY_RUNG[rung] : INSTRUCTION_BY_RUNG[rung],
  };
}

/**
 * Share of turns the learner handled while composing French themselves — a
 * measure of independence, which is what "getting better" actually means here.
 *
 * Three consumers read this number, and each reads it differently:
 *
 *   - **The end-of-session cards print it.** `summarise` puts it on
 *     `SessionSummary` (`session/session.ts`) and `assembleRecap` on the
 *     recap's `stats` (`brain/src/engine/recap.ts`); SummaryScreen and
 *     RecapScreen each round it to a percentage. Those two cards are the only
 *     learner-facing surfaces that show the rate as a figure, and they can,
 *     because a report on one sitting is a report on something the learner can
 *     still remember doing.
 *   - **XP reads it as a threshold, not a quantity.** `lessonXp` and
 *     `conversationXp` (`levels/levels.ts`) add a flat bonus at `>= 0.5` and
 *     are otherwise indifferent to it. Nothing scales with the rate, so there
 *     is no gradient here for anyone to farm.
 *   - **The weekly story says it in words.** `storyFrom`
 *     (`apps/mobile/src/progress/story.ts`) leads with an independence sentence
 *     when the week's sessions were mostly unaided, and never prints the rate.
 *     A week is not a sitting: a percentage spanning seven days is the rendered
 *     fraction `progress/passport.ts` and `progress/today.ts` both already
 *     refuse to draw, because a figure the learner can hold against last week's
 *     is a figure they can be down on.
 *
 * This comment used to call the rate "the headline number on the weekly
 * fingerprint". No weekly fingerprint was ever built. That is written down
 * rather than quietly deleted because a forward reference to an unbuilt screen
 * reads exactly like a description of a real one, and the next reader has no
 * way to tell the two apart.
 */
export function unassistedRate(state: LadderState): number {
  if (state.totalTurns === 0) return 0;
  return state.unassistedTurns / state.totalTurns;
}

/**
 * The rung a session opens on — the one rule, for scripted lessons and free
 * conversation alike.
 *
 * Deliberately one below where the learner finished. Starting at the edge of
 * your ability while cold is how a session dies in its first thirty seconds, and
 * the ladder climbs back within two good turns anyway.
 *
 * Once there is a `lastRung`, it decides on its own and the CEFR base steps
 * aside. What someone actually did last session is better evidence than what
 * they told an onboarding screen about themselves — an A1 who worked their way
 * up to free conversation should not be handed the Echo rung next time because
 * a dropdown once said A1. The base is for the first session, when there is
 * nothing else to go on.
 */
export function openingRung(previous: { cefrBase: Rung; lastRung: Rung | null }): Rung {
  if (previous.lastRung === null) return clamp(previous.cefrBase);
  return clamp(previous.lastRung - 1);
}

/** Where this session's ladder leaves the next one. */
export function nextSessionRung(state: LadderState): Rung {
  return openingRung({ cefrBase: RUNGS.FREE, lastRung: state.rung });
}
