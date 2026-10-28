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

import { CORRECTION_COOLDOWN_TURNS, type TurnQuality } from '@luvani/core';
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
 *
 * The number itself lives in `packages/core/src/session/session.ts` as
 * `CORRECTION_COOLDOWN_TURNS`, because the scripted lesson takes the same
 * decision and one decision does not get two homes. It was a second literal
 * here, held level by a comment and a test asserting `2` in both files; that
 * caught drift but only after somebody wrote it. Brain already depends on core,
 * so the pin is mechanical now: one declaration, two readers. Re-exported under
 * this name so every existing importer keeps working, and because the
 * conversation calls it an interruption where the lesson calls it a correction.
 */
export const INLINE_COACH_COOLDOWN_TURNS = CORRECTION_COOLDOWN_TURNS;

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

/**
 * F906. The few grammar slips worth a mid-scene note at Balanced (founder,
 * 2026-10-28). At A2 these are the errors a French listener notices at once
 * and a learner can fix on the next line: the wrong auxiliary in the passé
 * composé, à/de + le/les left uncontracted, and the wrong gender shown by a
 * determiner. Every other slip still waits for the recap at Balanced.
 *
 * Code decides, from the model's own `quote` and `better`. Nothing new is asked
 * of the model. "de les voir" (les as an object pronoun) does not fire as long
 * as the better form keeps "de les"; if a model rewrote it to "des" it would.
 */
export type HighValueSlip = 'auxiliary' | 'contraction' | 'gender';

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’]/g, "'");
}

function words(text: string): string[] {
  return fold(text)
    .replace(/'/g, "' ")
    .split(/[^a-z']+/)
    .filter((w) => w.length > 0);
}

function rawWords(text: string): string[] {
  return text.toLowerCase().normalize('NFC').split(/[^a-zàâçéèêëîïôûùüÿœ]+/).filter((w) => w.length > 0);
}
function loosePairs(ws: string[]): number {
  let n = 0;
  for (let i = 0; i + 1 < ws.length; i++) {
    if ((ws[i] === 'à' || ws[i] === 'de') && (ws[i + 1] === 'le' || ws[i + 1] === 'les')) n++;
  }
  return n;
}
function contracted(ws: string[]): number {
  return ws.filter((w) => w === 'au' || w === 'aux' || w === 'du' || w === 'des').length;
}

const AVOIR = new Set(["ai", "as", "a", "avons", "avez", "ont"]);
const ETRE = new Set(["suis", "es", "est", "sommes", "etes", "sont"]);
// Participle stems of the verbs that take être, accents folded.
const ETRE_PARTICIPLES = [
  'alle', 'venu', 'parti', 'arrive', 'entre', 'sorti', 'reste', 'tombe', 'ne', 'mort',
  'monte', 'descendu', 'retourne', 'devenu', 'revenu', 'rentre',
];
function etreParticiple(word: string): string | null {
  for (const stem of ETRE_PARTICIPLES) {
    if (word === stem || word === `${stem}e` || word === `${stem}s` || word === `${stem}es`) return stem;
  }
  return null;
}

function auxiliaryStems(ws: string[], aux: Set<string>): Set<string> {
  const found = new Set<string>();
  for (let i = 0; i + 1 < ws.length; i++) {
    if (!aux.has(ws[i]!)) continue;
    const stem = etreParticiple(ws[i + 1]!);
    if (stem) found.add(stem);
  }
  return found;
}

// A reflexive verb takes être too: "je m'ai levé" is "je me suis levé".
const CLITIC: Record<string, string> = {
  me: 'me', "m'": 'me', te: 'te', "t'": 'te', se: 'se', "s'": 'se', nous: 'nous', vous: 'vous',
};
const PARTICIPLE = /^[a-z]+(e|i|u|is|it)(e|s|es)?$/;
function reflexiveAux(ws: string[], aux: Set<string>): Set<string> {
  const found = new Set<string>();
  for (let i = 0; i + 1 < ws.length; i++) {
    const clitic = CLITIC[ws[i]!];
    if (!clitic || !aux.has(ws[i + 1]!)) continue;
    const next = ws[i + 2];
    if (aux === ETRE || (next && PARTICIPLE.test(next))) found.add(clitic);
  }
  return found;
}

// Before these, le/la/l' is an object pronoun ("je le vois"), not a determiner.
const PRONOUN_CONTEXT = new Set([
  'je', "j'", 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'ne', "n'",
  'me', "m'", 'te', "t'", 'se', "s'", 'y', 'en',
]);

const DETERMINER_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['le', 'la'], ['un', 'une'], ['mon', 'ma'], ['ton', 'ta'], ['son', 'sa'], ['ce', 'cette'], ['cet', 'cette'],
];
function isDeterminerSwap(a: string, b: string): boolean {
  return DETERMINER_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

export function highValueSlip(item: Pick<CoachItem, 'quote' | 'better' | 'betterWritten'>): HighValueSlip | null {
  const quote = words(item.quote);
  const betters = [item.better, item.betterWritten].filter((b): b is string => !!b).map(words);
  if (quote.length === 0 || betters.length === 0) return null;

  const wrongAux = auxiliaryStems(quote, AVOIR);
  if (wrongAux.size > 0 && betters.some((b) => [...auxiliaryStems(b, ETRE)].some((s) => wrongAux.has(s)))) {
    return 'auxiliary';
  }

  const wrongReflexive = reflexiveAux(quote, AVOIR);
  if (wrongReflexive.size > 0 && betters.some((b) => [...reflexiveAux(b, ETRE)].some((c) => wrongReflexive.has(c)))) {
    return 'auxiliary';
  }

  // Contraction. Read before folding accents, because "a le" (avoir) is fine
  // French and only "à le" is the slip. The better must drop the loose pair
  // and gain a contracted form, so "de les voir" kept as it is never fires.
  const rawQuote = rawWords(item.quote);
  const loose = loosePairs(rawQuote);
  if (loose > 0) {
    const rawBetters = [item.better, item.betterWritten].filter((b): b is string => !!b).map(rawWords);
    if (rawBetters.some((b) => loosePairs(b) < loose && contracted(b) > contracted(rawQuote))) return 'contraction';
  }

  for (const b of betters) {
    if (b.length !== quote.length) continue;
    const diffs = quote.map((w, i) => [w, b[i]!, i] as const).filter(([x, y]) => x !== y);
    if (
      diffs.length >= 1 &&
      diffs.length <= 2 &&
      diffs.every(([x, y, i]) => isDeterminerSwap(x, y) && !(i > 0 && PRONOUN_CONTEXT.has(quote[i - 1]!)))
    ) {
      return 'gender';
    }
  }
  return null;
}

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
): { inline: CoachItem[]; deferred: CoachItem[]; interrupted: boolean; keptForRecap: CoachItem[] } {
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

  // F906. At balanced a grammar slip waits for the recap unless it is one of
  // the few high-value A2 errors, and then only one per turn.
  let slipShown = false;
  // A promoted slip is shown now AND kept for Your fixes: before F906 these
  // waited for the recap, and showing them early must not cost the learner
  // the fix to keep. Other inline kinds are not re-listed.
  const keptForRecap: CoachItem[] = [];

  for (const item of ordered) {
    const promoted =
      strictness === 'balanced' && item.kind === 'grammar-slip' && !slipShown && highValueSlip(item) !== null;
    if (!promoted && surfacePolicy(item.kind, strictness) !== 'inline') {
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
      if (promoted) {
        slipShown = true;
        keptForRecap.push(item);
      }
      if (!ANSWERS_RATHER_THAN_INTERRUPTS.has(item.kind)) interrupted = true;
    }
  }
  return { inline, deferred, interrupted, keptForRecap };
}
