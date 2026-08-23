/**
 * Where model observations become decisions.
 *
 * The model reports what it saw (assessment, coach findings); this module owns
 * the two judgments that must never drift with a model's mood:
 *
 *   1. What the turn was worth — mapped onto core's TurnQuality so the same
 *      tested ladder that runs scripted lessons runs conversation. Coaching
 *      kinds never block promotion: a learner who said something correct but
 *      textbook still climbs. That mirrors core's principle that words-right
 *      and sounds-right are separate questions.
 *
 *   2. What surfaces now versus at the recap. Strictness moves *when* feedback
 *      lands, never *whether*. The one hard rule, pinned by test: correct-but-
 *      textbook phrasing surfaces inline at every strictness, because telling
 *      people what locals actually say is the product.
 */

import type { TurnQuality } from '@parle/core';
import type { Assessment, CoachItem, CoachKind } from '../contract/types.ts';
import type { Strictness } from '../types.ts';

export function assessmentToQuality(assessment: Assessment, coach: readonly CoachItem[]): TurnQuality {
  const blocked = coach.some((c) => c.kind === 'blocking-error');
  if (!assessment.understood) return 'poor';
  if (assessment.comprehensibility === 'breakdown') return 'poor';
  if (assessment.language === 'none') return 'poor';
  // G5. Reaching for English holds position; it never drops. Half-English
  // already held at `partial`, so English-only dropping was an inconsistency
  // inside this one function, and PEDAGOGY is explicit that asking for help is
  // never scored against the learner. It costs more than one turn, too: the
  // drop writes stats.lastRung down, and openingRung reads that to decide
  // where TOMORROW starts. Two polite questions today opened tomorrow lower.
  //
  // Deliberately before taskAchieved: asking how to say something never does
  // the scene's job, so grading it on that would punish the asking itself. The
  // beat is re-invited in French either way by the hand-back loop, which is
  // where the pedagogy actually lives.
  if (assessment.language === 'english') return 'partial';
  if (blocked || !assessment.taskAchieved) return 'poor';
  if (assessment.comprehensibility === 'strained' || assessment.language === 'mixed') return 'partial';
  return 'good';
}

/** Most important first — orders inline coaching and the recap's fix list. */
export const KIND_PRIORITY: readonly CoachKind[] = [
  'blocking-error',
  'english-to-french',
  'textbook-phrasing',
  'register-mismatch',
  'anglicism',
  'grammar-slip',
];

const SURFACE: Record<Strictness, Record<CoachKind, 'inline' | 'recap'>> = {
  flow: {
    'blocking-error': 'inline',
    'english-to-french': 'inline',
    'textbook-phrasing': 'inline',
    'register-mismatch': 'recap',
    anglicism: 'recap',
    'grammar-slip': 'recap',
  },
  balanced: {
    'blocking-error': 'inline',
    'english-to-french': 'inline',
    'textbook-phrasing': 'inline',
    'register-mismatch': 'inline',
    anglicism: 'inline',
    'grammar-slip': 'recap',
  },
  strict: {
    'blocking-error': 'inline',
    'english-to-french': 'inline',
    'textbook-phrasing': 'inline',
    'register-mismatch': 'inline',
    anglicism: 'inline',
    'grammar-slip': 'inline',
  },
};

/**
 * How many findings may interrupt the scene per turn. Overflow is not lost —
 * it joins the recap queue. A conversation is not a homework hand-back.
 */
export const INLINE_CAP: Record<Strictness, number> = { flow: 1, balanced: 2, strict: 3 };

/**
 * How many turns must pass between two coaching interruptions the learner did
 * not ask for.
 *
 * The cap above is a budget PER TURN, which means a budget of one, spent every
 * turn, is still an interruption every turn. That is what it was: at A0 every
 * single thing a learner says is textbook French, `textbook-phrasing` surfaces
 * inline at every strictness because it is the finding this product exists for,
 * so the model found one every turn and the tutor corrected on every turn. On
 * the loosest setting. The founder's words for the result were that it "never
 * just reacts", and no prompt rewrite could have fixed it, because this is code
 * deciding, not the model.
 *
 * So the budget gains its missing second dimension. Nothing becomes ineligible:
 * `surfacePolicy` is untouched and textbook phrasing still surfaces inline at
 * every strictness. It simply does not get the slot on consecutive turns, and
 * what misses the slot is not lost — it joins the recap queue, which already
 * dedupes and already groups by topic.
 *
 * Two is one correction roughly every third turn, which is about the rate a
 * person corrects someone they are enjoying talking to.
 */
export const INLINE_COACH_COOLDOWN_TURNS = 2;

/**
 * Findings that answer the learner rather than interrupt them, and so are never
 * held back by the cooldown.
 *
 * `english-to-french` is the reply to a question they just asked, and it is
 * already exempt from the per-turn cap for that reason (G7). `blocking-error`
 * means the scene did not understand them: withholding it to keep the rhythm
 * pleasant would strand the learner inside the conversation, which costs more
 * than the interruption saves. It still spends the per-turn budget.
 */
const ANSWERS_RATHER_THAN_INTERRUPTS: ReadonlySet<CoachKind> = new Set<CoachKind>([
  'english-to-french',
  'blocking-error',
]);

export function surfacePolicy(kind: CoachKind, strictness: Strictness): 'inline' | 'recap' {
  return SURFACE[strictness][kind];
}

/**
 * Split findings into what interrupts now and what waits for the end card.
 *
 * `turnsSinceInterruption` is how many turns ago the tutor last broke the scene
 * to coach something the learner did not ask about. The default is "long ago",
 * so a caller that does not track it behaves exactly as this did before.
 *
 * `interrupted` reports back whether this turn spent that budget, so the caller
 * can restart the clock without re-deriving the rule.
 */
export function splitCoach(
  coach: readonly CoachItem[],
  strictness: Strictness,
  turnsSinceInterruption: number = Number.POSITIVE_INFINITY,
): { inline: CoachItem[]; deferred: CoachItem[]; interrupted: boolean } {
  const ordered = [...coach].sort((a, b) => {
    const byKind = KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind);
    if (byKind !== 0) return byKind;
    if (a.weight === b.weight) return 0;
    return a.weight === 'matters-now' ? -1 : 1;
  });

  const inline: CoachItem[] = [];
  const deferred: CoachItem[] = [];
  // G7. The cap is a budget for interruptions, and the hand-back is not one:
  // it is the answer to a question the learner just asked. It used to lose the
  // single `flow` slot to a co-occurring blocking error, so someone who asked
  // how to say something heard "Not quite. Try …" and never got told. It now
  // neither spends the budget nor waits for it.
  let spent = 0;
  let interrupted = false;
  const coolingDown = turnsSinceInterruption < INLINE_COACH_COOLDOWN_TURNS;

  for (const item of ordered) {
    if (surfacePolicy(item.kind, strictness) !== 'inline') {
      deferred.push(item);
    } else if (item.kind === 'english-to-french') {
      inline.push(item);
    } else if (spent >= INLINE_CAP[strictness]) {
      deferred.push(item);
    } else if (coolingDown && !ANSWERS_RATHER_THAN_INTERRUPTS.has(item.kind)) {
      deferred.push(item);
    } else {
      inline.push(item);
      spent += 1;
      if (!ANSWERS_RATHER_THAN_INTERRUPTS.has(item.kind)) interrupted = true;
    }
  }
  return { inline, deferred, interrupted };
}
