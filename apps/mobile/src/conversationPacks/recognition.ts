/** Grounded recognition warm-up. No generated translations, no mastery credit. */
import { MAX_MISSES, normalise, phraseKeyOf, type ConversationPack } from '@luvani/core';

export interface RecognitionAttempt { misses: number; outcome: 'waiting' | 'retry' | 'correct' | 'revealed' }
export const NEW_ATTEMPT: RecognitionAttempt = { misses: 0, outcome: 'waiting' };

/** A correct attempt completes immediately; only two failed checks reveal an answer. */
export function checkRecognition(attempt: RecognitionAttempt, correct: boolean): RecognitionAttempt {
  if (attempt.outcome === 'correct' || attempt.outcome === 'revealed') return attempt;
  if (correct) return { ...attempt, outcome: 'correct' };
  const misses = attempt.misses + 1;
  return { misses, outcome: misses >= MAX_MISSES ? 'revealed' : 'retry' };
}

export interface PracticePair { key: string; fr: string; en: string }
export interface ListeningChoice { phrase: PracticePair; options: string[]; correctIndex: number }

/** Exclude ambiguous pairs: two French forms sharing one meaning are not a fair matching test. */
export function pairsFor(pack: ConversationPack): PracticePair[] {
  const seenFr = new Set<string>();
  const seenEn = new Set<string>();
  return pack.keyPhrases.flatMap((phrase) => {
    const fr = phrase.fr.trim();
    const en = phrase.en.trim();
    const key = phraseKeyOf(fr);
    const meaning = normalise(en);
    if (!fr || !meaning || seenFr.has(key) || seenEn.has(meaning)) return [];
    seenFr.add(key);
    seenEn.add(meaning);
    return [{ key, fr, en }];
  }).slice(0, 4);
}

/** Stable per-pack shuffle, independent of render order and never mutates input. */
export function shuffled<T>(values: readonly T[], seed: string): T[] {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    const j = n % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function choicesFor(pack: ConversationPack): ListeningChoice[] {
  const pairs = pairsFor(pack);
  if (pairs.length < 2) return [];
  return pairs.slice(0, 2).map((phrase, i) => {
    const options = shuffled(pairs.map((p) => p.en), `${pack.id}:listen:${i}`);
    return { phrase, options, correctIndex: options.indexOf(phrase.en) };
  });
}

export function matchPair(pairs: readonly PracticePair[], left: string, right: string): boolean {
  return left === right && pairs.some((p) => p.key === left);
}

/** Never hand over the solution as two identically ordered columns. */
export function matchingOrder(pairs: readonly PracticePair[], seed: string): PracticePair[] {
  if (pairs.length < 2) return [...pairs];
  const order = shuffled(pairs, seed);
  return order.some((p, i) => p.key === pairs[i]?.key)
    ? [...pairs.slice(1), pairs[0]!]
    : order;
}
