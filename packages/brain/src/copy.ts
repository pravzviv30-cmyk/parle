/**
 * Copy rules for anything a learner reads, applied to model output.
 *
 * The scripted product enforces its writing rules on hand-authored content with a
 * test (`packages/core/src/copy.test.ts`). The brain's learner-visible text comes
 * out of a model at runtime, so the same rules need a runtime edge as well:
 * sanitize what can be fixed mechanically, and detect what cannot so the caller
 * can fall back to a safe fixed line instead of showing a violation.
 *
 * The rules, and where they come from:
 *   - No em dashes, no filler. House style, same regexes as core's copy test.
 *   - No scolding. "Not quite" is as hard as the tutor ever lands; "wrong",
 *     "incorrect", "bad", "failed" never reach a learner mid-session.
 *   - No scores. Digits in coach commentary read as grades and make a beginner
 *     self-conscious about speaking. Digits *inside quoted French* are speech
 *     ("Ça fait 2 euros") and are always fine — the rule is about numbers said
 *     ABOUT the learner, not numbers said in the scene.
 */

import type { CoachKind } from './contract/types.ts';

export const EM_DASH_RE = /—/;
export const FILLER_RE = /\b(simply|note that|great question)\b/i;
export const SCOLD_RE = /\b(wrong|incorrect|bad|badly|failed|failure)\b/i;
const DIGIT_RE = /\d/;
const SCORE_WORD_RE = /%|\b(score|scores|percent|rating|rated|grade|graded)\b/i;

export type CopyRule = 'em-dash' | 'filler' | 'scold' | 'score';

/** Fix what a regex can fix: dashes become commas, whitespace settles. */
export function sanitizeLearnerText(text: string): string {
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Digits inside double quotes are quoted speech, not commentary. */
function outsideQuotes(text: string): string {
  return text.replace(/"[^"]*"/g, '""').replace(/«[^»]*»/g, '«»');
}

/**
 * Which rules a piece of learner-visible text breaks. Empty array means clean.
 * `allowDigits` is for scene dialogue, where prices and times are conversation.
 */
export function copyViolations(text: string, opts: { allowDigits?: boolean } = {}): CopyRule[] {
  const found: CopyRule[] = [];
  if (EM_DASH_RE.test(text)) found.push('em-dash');
  if (FILLER_RE.test(text)) found.push('filler');
  if (SCOLD_RE.test(text)) found.push('scold');
  if (SCORE_WORD_RE.test(text) || (!opts.allowDigits && DIGIT_RE.test(outsideQuotes(text)))) {
    found.push('score');
  }
  return found;
}

/**
 * How the tutor answers a learner who reached for English.
 *
 * Acknowledge first, then hand over the French. The founder's note was that
 * asking "how would I say this?" got bare French back, which reads as being
 * corrected rather than answered.
 *
 * Acknowledgement, deliberately, and NOT reassurance. The persona already bans
 * "don't worry" and "take your time" because telling a learner not to worry
 * tells them there was something to worry about, and that is the exact feeling
 * this is here to avoid. "Got it" and "Sure" answer the person; "no worries"
 * would answer a mistake they did not make.
 *
 * Four of them, and the name on half, because a warm line said the same way
 * every time stops being warm by the third turn and a name said every turn is
 * the thing that reads as a machine.
 */
type HandBack = (better: string, name: string | null) => string;

const ENGLISH_HAND_BACK: readonly HandBack[] = [
  (better, name) => `Got it${name ? `, ${name}` : ''}. In French: "${better}".`,
  (better) => `Ah, you want that one in French. You would say "${better}".`,
  (better, name) => `Sure${name ? `, ${name}` : ''}. In French that is "${better}".`,
  (better) => `That one goes "${better}".`,
];

/** How many distinct hand-backs exist, so a session can rotate without repeating. */
export const ENGLISH_HAND_BACK_VARIANTS = ENGLISH_HAND_BACK.length;

/**
 * The safe coach line for each kind of finding, used when the model's own
 * coachLine breaks a copy rule.
 *
 * Every kind is a family now, not a line. The English hand-back was already
 * four variants with the note that "a warm line said the same way every time
 * stops being warm by the third turn", and that was as true of the other five,
 * which were one string each. A learner who hears "Small fix:" every time a
 * verb slips is not being talked to by a person.
 *
 * Warm, short, and honest about the distinction that matters: a blocking error
 * gets "Not quite"; correct-but-textbook phrasing explicitly does not, in any
 * variant, because the learner was not wrong. Luc's praise and Luc's
 * corrections are both small.
 *
 * `variant` is the turn count, not a random draw: `prepareTurn` is byte-stable
 * for identical state and this stays testable only while it is a function of
 * the state too.
 */
type Fallback = (better: string) => string;

const BLOCKING_ERROR: readonly Fallback[] = [
  (better) => `Not quite. Try "${better}".`,
  (better) => `Ah, careful. Here you would say "${better}".`,
  (better) => `Not quite that one. "${better}" is what you want.`,
  (better) => `Close. What lands here is "${better}".`,
];

const TEXTBOOK_PHRASING: readonly Fallback[] = [
  (better) => `That works, but a local would say "${better}".`,
  (better) => `Correct. Though nobody really says it that way. "${better}".`,
  (better) => `You would be understood. What you would hear here is "${better}".`,
  (better) => `That is the book version. Out loud it goes "${better}".`,
];

const REGISTER_MISMATCH: readonly Fallback[] = [
  (better) => `Watch the register here. Try "${better}".`,
  (better) => `The words are fine, the level is not. "${better}".`,
  (better) => `With this person it goes "${better}".`,
  (better) => `Same meaning, different register: "${better}".`,
];

const ANGLICISM: readonly Fallback[] = [
  (better) => `In French that comes out as "${better}".`,
  (better) => `That one is English wearing a French coat. "${better}".`,
  (better) => `French does not go that way round. "${better}".`,
  (better) => `We would not build it like that. "${better}".`,
];

const GRAMMAR_SLIP: readonly Fallback[] = [
  (better) => `Small fix: "${better}".`,
  (better) => `Almost. "${better}".`,
  (better) => `One little thing: "${better}".`,
  (better) => `Nearly. It wants "${better}".`,
];

const BY_KIND: Record<Exclude<CoachKind, 'english-to-french'>, readonly Fallback[]> = {
  'blocking-error': BLOCKING_ERROR,
  'textbook-phrasing': TEXTBOOK_PHRASING,
  'register-mismatch': REGISTER_MISMATCH,
  anglicism: ANGLICISM,
  'grammar-slip': GRAMMAR_SLIP,
};

/** Pick a variant from any family, safe for any integer including a negative one. */
function rotate<T>(family: readonly T[], variant: number | undefined): T {
  return family[Math.abs(Math.trunc(variant ?? 0)) % family.length]!;
}

/** How many variants each kind has, so a test can walk every one of them. */
export function fallbackVariants(kind: CoachKind): number {
  return kind === 'english-to-french' ? ENGLISH_HAND_BACK.length : BY_KIND[kind].length;
}

export function coachFallbackLine(
  kind: CoachKind,
  better: string,
  opts: { name?: string | null; variant?: number } = {},
): string {
  if (kind === 'english-to-french') {
    return rotate(ENGLISH_HAND_BACK, opts.variant)(better, opts.name ?? null);
  }
  return rotate(BY_KIND[kind], opts.variant)(better);
}

/**
 * The two kinds where the learner's own French was not wrong.
 *
 * `textbook-phrasing` means they said something correct that a local would say
 * differently, and `english-to-french` means they asked a question. Neither is
 * a mistake, which is why neither fallback family above ever lands like one.
 *
 * The families are the tested half of that promise; this set is the half that
 * applies to a line the model wrote. Kept beside them so the rule has one home
 * rather than a copy in the engine that can drift from the copy here.
 */
export const NOTHING_WAS_WRONG: ReadonlySet<CoachKind> = new Set<CoachKind>([
  'textbook-phrasing',
  'english-to-french',
]);

/**
 * Ways of saying "your attempt failed" that `copyViolations` allows.
 *
 * These are not scolds and the rules above are right to let them through: "Not
 * quite" is the tutor's hardest landing and belongs on a blocking error. What
 * they are is a verdict, and a verdict is only ever the code's to give — so the
 * engine checks this against the kind of finding it actually surfaced, and no
 * caller should use it without one.
 *
 * "almost" and "nearly" are in here even though `grammar-slip` uses both, which
 * is exactly the point: the question is never whether a phrase is allowed, only
 * whether it agrees with this turn's verdict. A textbook line reading "that is
 * almost it" would be a false positive and would cost one warm model sentence,
 * replaced by a warm written one. Telling a correct learner they nearly got it
 * costs their willingness to speak. The doubt goes the cheaper way.
 */
const LANDS_AS_CORRECTION_RE =
  /\b(not quite|not right|not correct|not it|that is not|that['’]s not|almost|nearly|try again|a mistake|an error)\b/i;

/** Does this line tell the learner their attempt failed? */
export function landsAsCorrection(text: string): boolean {
  return LANDS_AS_CORRECTION_RE.test(text);
}

/** Said when the tutor steps in after silence. Same line the scripted product uses. */
export const RESCUE_LINE = "Let's take that one together.";

/**
 * Said when a model turn fails entirely. The learner must never see a stack
 * trace, and they must never be given to understand it was their fault.
 *
 * A family rather than a line, for the same reason as everything else here: the
 * one place a learner is most likely to hear the SAME failure twice is a failure
 * that repeats, and hearing the identical sentence back is the moment a tutor
 * stops being a person.
 *
 * Three of the four put it on Luc rather than on them, which is not a kindness,
 * it is what happened. The model failed. Nobody mumbled.
 */
const RECOVERY: readonly string[] = [
  'Say that once more for me.',
  'One more time, I missed that.',
  'Tell me that again, I lost it.',
  'Run that past me again.',
];

/** How many recovery lines exist, so a session can rotate without repeating. */
export const RECOVERY_VARIANTS = RECOVERY.length;

/**
 * The recovery line for this moment. `variant` is the turn count, never random,
 * for the same byte-stability reason as the coach fallbacks.
 */
export function recoveryLine(variant = 0): string {
  return RECOVERY[Math.abs(Math.trunc(variant)) % RECOVERY.length]!;
}

/**
 * The first recovery line, kept as a constant for callers with no turn to count
 * from. Prefer `recoveryLine(turn)` anywhere a turn is in hand.
 */
export const RECOVERY_LINE = RECOVERY[0]!;
