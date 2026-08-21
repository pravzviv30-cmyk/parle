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
 * The safe coach line for each kind of finding, used when the model's own
 * coachLine breaks a copy rule. Warm, short, and honest about the distinction
 * that matters: a blocking error gets "Not quite"; correct-but-textbook phrasing
 * explicitly does not, because the learner was not wrong.
 */
export function coachFallbackLine(kind: CoachKind, better: string): string {
  switch (kind) {
    case 'blocking-error':
      return `Not quite. Try "${better}".`;
    case 'english-to-french':
      return `In French, you can say "${better}".`;
    case 'textbook-phrasing':
      return `That works, but a local would say "${better}".`;
    case 'register-mismatch':
      return `Watch the register here. Try "${better}".`;
    case 'anglicism':
      return `In French that comes out as "${better}".`;
    case 'grammar-slip':
      return `Small fix: "${better}".`;
  }
}

/** Said when the tutor steps in after silence. Same line the scripted product uses. */
export const RESCUE_LINE = "Let's take that one together.";

/** Shown when a model turn fails entirely. The learner must never see a stack trace. */
export const RECOVERY_LINE = 'Say that once more for me.';
