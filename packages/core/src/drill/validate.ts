/**
 * The gate machine-built exercises must pass.
 *
 * The fixtures are hand-written today, but the plan is for a model to author
 * exercises from a learner's own conversations, and a model will eventually
 * emit two accepted answers that collapse to one normalised string, a correct
 * index pointing past the end, or an English gloss that is quietly French.
 * None of that may reach a learner, and none of it should need a human to
 * catch. So: a deterministic linter that returns reasons, making a rejected
 * exercise a debuggable artefact rather than a silent drop.
 *
 * The rules mirror what the rest of the drill engine assumes. Accepted answers
 * must be distinct after `normalise`, because grading treats "equals another
 * accepted answer" as meaningful. Every repeat-this must carry a usable silent
 * twin, because `suppressMic` is a data lookup that must never come up empty.
 * Copy rules apply to every learner-visible string, because these reach the
 * screen with no further review — and accepted answers count as visible, since
 * the miss line quotes them back.
 *
 * The English-gloss check is a heuristic with known limits: it rejects a
 * French-accented character outside the ordinary English loanword café, and it
 * cannot catch French that happens to carry no accents ("bon", "table"). It is
 * a tripwire, not a proof of English. Character names are exempt — Chloé is
 * Chloé in any language.
 */

import { normalise } from '../lessons/types.ts';
import type { DrillDifficulty, DrillExercise } from './types.ts';

export type ValidationResult = { ok: true } | { ok: false; reasons: string[] };

const EM_DASH = /—/;
const SCOLD = /\b(wrong|incorrect|bad|failed)\b/i;
const DIGIT = /[0-9]/;
const FRENCH_ACCENT = /[àâäæçéèêëìîïòôöœùûüÿ]/i;
// JavaScript's \b is ASCII-based, so it sees é as non-word and cannot mark the
// end of café. Use an explicit trailing boundary instead.
const ENGLISH_LOANWORD = /\bcafés?(?=\s|[.,!?;:]|$)/giu;

interface LabelledString {
  label: string;
  text: string;
}

/**
 * Every string of an exercise a learner can end up reading, labelled for
 * error messages. Accepted answers are included because the miss feedback
 * quotes them; IPA and speaker names are excluded because notation and proper
 * names are not copy. Does not descend into a repeat-this twin — the twin is
 * validated as its own exercise.
 */
export function learnerVisibleStrings(exercise: DrillExercise): LabelledString[] {
  switch (exercise.kind) {
    case 'fill-blank':
      return [
        { label: 'sentence', text: exercise.sentence },
        { label: 'en', text: exercise.en },
        ...(exercise.options ?? []).map((text, i) => ({ label: `option ${i}`, text })),
        ...exercise.accepted.map((text, i) => ({ label: `accepted ${i}`, text })),
      ];
    case 'best-sentence':
      return [
        { label: 'prompt', text: exercise.prompt },
        ...exercise.candidates.flatMap((c, i) => [
          { label: `candidate ${i} fr`, text: c.fr },
          { label: `candidate ${i} en`, text: c.en },
        ]),
      ];
    case 'appropriate-reply':
      return [
        { label: 'line fr', text: exercise.line.fr },
        { label: 'line en', text: exercise.line.en },
        ...exercise.options.flatMap((o, i) => [
          { label: `option ${i} fr`, text: o.fr },
          { label: `option ${i} en`, text: o.en },
        ]),
      ];
    case 'repeat-this':
      return [
        { label: 'reference', text: exercise.reference },
        { label: 'referenceEn', text: exercise.referenceEn },
      ];
    case 'tap-translate':
      return [
        { label: 'en', text: exercise.en },
        ...exercise.tokens.map((text, i) => ({ label: `token ${i}`, text })),
        ...exercise.accepted.map((text, i) => ({ label: `accepted ${i}`, text })),
      ];
    case 'listen-type':
      return [
        { label: 'fr', text: exercise.fr },
        ...exercise.accepted.map((text, i) => ({ label: `accepted ${i}`, text })),
      ];
    case 'translate':
      return [
        { label: 'fr', text: exercise.fr },
        { label: 'en', text: exercise.en },
        ...exercise.accepted.map((text, i) => ({ label: `accepted ${i}`, text })),
      ];
    case 'own-words':
      // fr is the reveal, so it reaches the screen too; mustKeep is shown as
      // the meaning to hold on to, which makes it copy like any other prompt.
      return [
        { label: 'fr', text: exercise.fr },
        { label: 'en', text: exercise.en },
        { label: 'situation', text: exercise.situation },
        ...exercise.mustKeep.map((text, i) => ({ label: `mustKeep ${i}`, text })),
      ];
  }
}

/** The fields that claim to be English, held to the accent tripwire. */
function englishGlosses(exercise: DrillExercise): LabelledString[] {
  switch (exercise.kind) {
    case 'fill-blank':
      return [{ label: 'en', text: exercise.en }];
    case 'best-sentence':
      return [
        { label: 'prompt', text: exercise.prompt },
        ...exercise.candidates.map((c, i) => ({ label: `candidate ${i} en`, text: c.en })),
      ];
    case 'appropriate-reply':
      return [
        { label: 'line en', text: exercise.line.en },
        ...exercise.options.map((o, i) => ({ label: `option ${i} en`, text: o.en })),
      ];
    case 'repeat-this':
      return [{ label: 'referenceEn', text: exercise.referenceEn }];
    case 'tap-translate':
      return [{ label: 'en', text: exercise.en }];
    case 'listen-type':
      return [];
    case 'translate':
      return [{ label: 'en', text: exercise.en }];
    case 'own-words':
      return [
        { label: 'en', text: exercise.en },
        { label: 'situation', text: exercise.situation },
      ];
  }
}

/** What the format itself demands, whatever the author labelled it. */
function expectedDifficulty(exercise: DrillExercise): DrillDifficulty {
  switch (exercise.kind) {
    case 'fill-blank':
      return exercise.options ? 'recognition' : 'production';
    case 'best-sentence':
    case 'appropriate-reply':
    // The tiles hand the learner every word, so tapping is recognition with
    // the scaffolding loosened — the last rung before real production.
    case 'tap-translate':
      return 'recognition';
    case 'listen-type':
    case 'repeat-this':
    case 'translate':
    // Nothing is offered and nothing is dictated: the learner builds the whole
    // utterance. Production is the only honest label, even though it is the one
    // production format with no right answer to produce.
    case 'own-words':
      return 'production';
  }
}

/** Words of a phrase after normalisation, for the token-coverage check. */
function wordsOf(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((w) => w.length > 0);
}

function checkAccepted(accepted: readonly string[], reasons: string[]): void {
  if (accepted.length === 0) {
    reasons.push('accepted is empty');
    return;
  }
  const seen = new Map<string, string>();
  for (const answer of accepted) {
    const n = normalise(answer);
    if (n === '') reasons.push(`accepted answer "${answer}" normalises to nothing`);
    else if (seen.has(n)) reasons.push(`accepted answers "${seen.get(n)}" and "${answer}" collapse to the same normalised form`);
    else seen.set(n, answer);
  }
}

/** Distinctness for an on-screen choice set, where two look-alikes make the tap a coin flip. */
function checkDistinct(items: readonly string[], what: string, reasons: string[]): void {
  const seen = new Map<string, string>();
  for (const item of items) {
    const n = normalise(item);
    if (n === '') reasons.push(`${what} "${item}" normalises to nothing`);
    else if (seen.has(n)) reasons.push(`${what}s "${seen.get(n)}" and "${item}" collapse to the same normalised form`);
    else seen.set(n, item);
  }
}

function inRange(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

export function validateExercise(exercise: DrillExercise): ValidationResult {
  const reasons: string[] = [];

  if (!exercise.id || exercise.id.trim() === '') reasons.push('id is empty');
  if (!/^(phrase|vocab):.+/.test(exercise.phraseKey)) {
    reasons.push(`phraseKey "${exercise.phraseKey}" does not follow the phrase:<fr> / vocab:<word> scheme`);
  } else if (exercise.phraseKey !== exercise.phraseKey.toLowerCase()) {
    reasons.push(`phraseKey "${exercise.phraseKey}" is not lowercased`);
  }
  if (exercise.difficulty !== expectedDifficulty(exercise)) {
    reasons.push(`difficulty "${exercise.difficulty}" does not match what a ${exercise.kind} exercise asks of the learner`);
  }

  switch (exercise.kind) {
    case 'fill-blank': {
      if (!exercise.sentence.includes('___')) reasons.push('sentence has no ___ blank');
      checkAccepted(exercise.accepted, reasons);
      if (exercise.options) {
        if (exercise.options.length < 2) reasons.push('options offers no real choice');
        checkDistinct(exercise.options, 'option', reasons);
        const acceptedSet = new Set(exercise.accepted.map(normalise));
        if (!exercise.options.some((o) => acceptedSet.has(normalise(o)))) {
          reasons.push('no option is an accepted answer');
        }
      }
      break;
    }

    case 'best-sentence': {
      if (exercise.candidates.length < 2) reasons.push('candidates offers no real choice');
      checkDistinct(exercise.candidates.map((c) => c.fr), 'candidate', reasons);
      if (!inRange(exercise.correctIndex, exercise.candidates.length)) {
        reasons.push(`correctIndex ${exercise.correctIndex} is out of range`);
      }
      break;
    }

    case 'appropriate-reply': {
      if (exercise.options.length < 2) reasons.push('options offers no real choice');
      checkDistinct(exercise.options.map((o) => o.fr), 'option', reasons);
      if (exercise.acceptableIndexes.length === 0) reasons.push('acceptableIndexes is empty');
      for (const i of exercise.acceptableIndexes) {
        if (!inRange(i, exercise.options.length)) reasons.push(`acceptable index ${i} is out of range`);
      }
      if (new Set(exercise.acceptableIndexes).size !== exercise.acceptableIndexes.length) {
        reasons.push('acceptableIndexes repeats an index');
      }
      break;
    }

    case 'repeat-this': {
      if (normalise(exercise.reference) === '') reasons.push('reference normalises to nothing');
      // Runtime data may be missing the twin however the types protest, and a
      // repeat-this without one would strand `suppressMic` mid-session.
      const twin = exercise.noMicTwin as DrillExercise | undefined;
      if (!twin) {
        reasons.push('repeat-this has no noMicTwin');
      } else {
        if (twin.kind === 'repeat-this') reasons.push('noMicTwin is itself a repeat-this, so it does not remove the mic');
        if (twin.phraseKey !== exercise.phraseKey) reasons.push('noMicTwin drills a different phraseKey');
        if (twin.id === exercise.id) reasons.push('noMicTwin shares its id with its parent');
        if (twin.kind !== 'repeat-this') {
          const result = validateExercise(twin);
          if (!result.ok) reasons.push(...result.reasons.map((r) => `noMicTwin: ${r}`));
        }
      }
      break;
    }

    case 'tap-translate': {
      if (exercise.tokens.length < 2) reasons.push('tokens offers no real assembly');
      for (const token of exercise.tokens) {
        if (normalise(token) === '') reasons.push(`token "${token}" normalises to nothing`);
      }
      checkAccepted(exercise.accepted, reasons);
      // At least one accepted answer must be buildable from the tiles, or the
      // exercise is unwinnable. Checked as a word multiset rather than tile
      // order — deterministic and cheap, at the cost of trusting multi-word
      // tiles to be used whole.
      const pool = new Map<string, number>();
      for (const word of exercise.tokens.flatMap(wordsOf)) pool.set(word, (pool.get(word) ?? 0) + 1);
      const assemblable = exercise.accepted.some((answer) => {
        const need = new Map<string, number>();
        for (const word of wordsOf(answer)) need.set(word, (need.get(word) ?? 0) + 1);
        return [...need].every(([word, count]) => (pool.get(word) ?? 0) >= count);
      });
      if (exercise.accepted.length > 0 && !assemblable) reasons.push('no accepted answer can be assembled from the tokens');
      break;
    }

    case 'listen-type': {
      if (normalise(exercise.fr) === '') reasons.push('fr normalises to nothing');
      checkAccepted(exercise.accepted, reasons);
      // Typing exactly what was played must always be right.
      if (!exercise.accepted.some((a) => normalise(a) === normalise(exercise.fr))) {
        reasons.push('the played line itself is not an accepted answer');
      }
      break;
    }

    case 'own-words': {
      if (normalise(exercise.fr) === '') reasons.push('fr normalises to nothing');
      if (normalise(exercise.en) === '') reasons.push('en normalises to nothing');
      if (exercise.situation.trim() === '') reasons.push('situation is empty, so the learner is asked to speak nowhere');
      if (exercise.mustKeep.length === 0) reasons.push('mustKeep is empty, so no judgement can be checked against what was asked');
      // NOT checkAccepted: an own-words exercise has no right string, and an
      // accepted answer here would quietly turn it back into a recall drill.
      if (exercise.accepted.length > 0) reasons.push('own-words carries accepted answers, which it must not have');
      break;
    }

    case 'translate': {
      if (normalise(exercise.fr) === '') reasons.push('fr normalises to nothing');
      if (normalise(exercise.en) === '') reasons.push('en normalises to nothing');
      checkAccepted(exercise.accepted, reasons);
      if (exercise.direction !== 'fr-en' && exercise.direction !== 'en-fr') {
        reasons.push('direction must be fr-en or en-fr');
      } else {
        const expected = exercise.direction === 'fr-en' ? exercise.en : exercise.fr;
        if (!exercise.accepted.some((answer) => normalise(answer) === normalise(expected))) {
          reasons.push('the direct translation is not an accepted answer');
        }
      }
      break;
    }
  }

  for (const { label, text } of learnerVisibleStrings(exercise)) {
    if (EM_DASH.test(text)) reasons.push(`${label} contains an em dash: "${text}"`);
    if (SCOLD.test(text)) reasons.push(`${label} contains a scold word: "${text}"`);
    if (DIGIT.test(text)) reasons.push(`${label} contains a digit: "${text}"`);
  }
  for (const { label, text } of englishGlosses(exercise)) {
    if (FRENCH_ACCENT.test(text.replace(ENGLISH_LOANWORD, ''))) {
      reasons.push(`${label} looks French, not English: "${text}"`);
    }
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

/**
 * Validate a whole batch, with each reason prefixed by the offending
 * exercise's id, plus the one check that only makes sense across exercises:
 * ids must be unique, twins included, because the session tracks attempts by
 * id and a collision would let one exercise spend another's misses.
 */
export function validateBatch(list: readonly DrillExercise[]): ValidationResult {
  const reasons: string[] = [];

  const seen = new Set<string>();
  const ids = list.flatMap((e) => (e.kind === 'repeat-this' && e.noMicTwin ? [e.id, e.noMicTwin.id] : [e.id]));
  for (const id of ids) {
    if (seen.has(id)) reasons.push(`duplicate exercise id "${id}"`);
    seen.add(id);
  }

  list.forEach((exercise, index) => {
    const result = validateExercise(exercise);
    if (!result.ok) reasons.push(...result.reasons.map((r) => `${exercise.id || `exercise ${index}`}: ${r}`));
  });

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

/**
 * Word cap for the French answer of a generated exercise, by CEFR band.
 *
 * A gross-outlier bound, not a style rule: it exists to drop the model's
 * clear misfits (a paragraph handed to an A1 learner as one line), so every
 * cap sits well above the longest answer in the hand-written fixture bank.
 * The longest fixture answer is 11 words, so A0 sits at 12 rather than 10:
 * no fixture is rejected even if the whole bank were served to a beginner.
 * B2 and above share the top cap. An unknown or missing band skips the bound.
 */
export const DRILL_ANSWER_WORD_CAP = { A0: 12, A1: 14, A2: 20, B1: 28, B2: 40, C1: 40, C2: 40 } as const;
export type DrillBand = keyof typeof DRILL_ANSWER_WORD_CAP;

/** Most generated exercises one batch may keep, and the batch size past which it is refused whole. */
export const GENERATED_DRILL_CAP = 24;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * The French the learner must produce, pick or understand as the answer, per
 * kind. A repeat-this twin is measured on its own through the parent call.
 */
export function expectedFrenchAnswers(exercise: DrillExercise): string[] {
  switch (exercise.kind) {
    case 'fill-blank':
    case 'tap-translate':
      return [...exercise.accepted];
    case 'best-sentence':
      return exercise.candidates[exercise.correctIndex] ? [exercise.candidates[exercise.correctIndex]!.fr] : [];
    case 'appropriate-reply':
      return exercise.acceptableIndexes.flatMap((i) => (exercise.options[i] ? [exercise.options[i]!.fr] : []));
    case 'repeat-this':
      return [exercise.reference, ...(exercise.noMicTwin ? expectedFrenchAnswers(exercise.noMicTwin) : [])];
    case 'listen-type':
      return [exercise.fr, ...exercise.accepted];
    case 'translate':
      // fr-en: the French sentence is what must be understood; its accepted
      // answers are English and are not measured.
      return exercise.direction === 'en-fr' ? [exercise.fr, ...exercise.accepted] : [exercise.fr];
    case 'own-words':
      return [exercise.fr];
  }
}

/** True when the band is known and some expected French answer runs past its cap. */
export function exceedsAnswerCap(exercise: DrillExercise, band: string | null | undefined): boolean {
  const key = typeof band === 'string' ? band.trim().toUpperCase() : '';
  if (!Object.hasOwn(DRILL_ANSWER_WORD_CAP, key)) return false;
  const cap = DRILL_ANSWER_WORD_CAP[key as DrillBand];
  return expectedFrenchAnswers(exercise).some((text) => wordCount(text) > cap);
}

function utf8Length(text: string): number {
  let bytes = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Collect every string of an untrusted object, refusing oversized shapes:
 * more than 256 fields, an array over 64 items, or over 16 KiB of text.
 * Returns null when a bound trips.
 */
function boundedTexts(value: unknown): string[] | null {
  const texts: string[] = [];
  let fields = 0;
  let bytes = 0;
  const collect = (item: unknown): boolean => {
    if (++fields > 256) return false;
    if (typeof item === 'string') {
      bytes += utf8Length(item) + 1;
      if (bytes > 16_384) return false;
      texts.push(item);
    } else if (Array.isArray(item)) {
      if (item.length > 64) return false;
      return item.every(collect);
    } else if (item && typeof item === 'object') return Object.values(item).every(collect);
    return true;
  };
  return collect(value) ? texts : null;
}

export interface GroundedDrillOptions {
  /** The safety screen; truthy means the text is unsafe. Injected because it lives in the services. */
  screen: (text: string) => unknown;
  /** The learner's CEFR band for the answer-length bound; unknown or absent skips it. */
  band?: string | null;
}

/**
 * The one filter every model-generated drill batch passes before it reaches a
 * learner, on the live tutor path and the durable worker alike. Keeps an
 * exercise only when it drills a phrase the request was built from, its id is
 * new in the batch, it passes `validateExercise`, its shape is within bounds,
 * its text passes the safety screen, and its French answer fits the band. A
 * batch larger than the cap is refused whole. Pure: never throws.
 */
export function groundedDrills(
  candidates: readonly DrillExercise[],
  allowedPhraseKeys: ReadonlySet<string>,
  options: GroundedDrillOptions,
): DrillExercise[] {
  if (!Array.isArray(candidates) || candidates.length > GENERATED_DRILL_CAP) return [];
  const seen = new Set<string>();
  return candidates
    .filter((ex) => {
      try {
        if (!allowedPhraseKeys.has(ex.phraseKey) || seen.has(ex.id) || !validateExercise(ex).ok) return false;
        const texts = boundedTexts(ex);
        if (texts === null || options.screen(texts.join('\n'))) return false;
        if (exceedsAnswerCap(ex, options.band)) return false;
        seen.add(ex.id);
        return true;
      } catch {
        return false;
      }
    })
    .slice(0, GENERATED_DRILL_CAP);
}
