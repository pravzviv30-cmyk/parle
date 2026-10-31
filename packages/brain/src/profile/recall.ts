/**
 * Scene-relevant recall: which remembered facts, error patterns and target
 * phrases the tutor should bring into a scene. Today's choices are recency
 * (last five facts), frequency (top three patterns) and weakness (phrases);
 * these functions keep those as the exact fallback and only reorder by how
 * many words an item shares with the scene the learner is in.
 *
 * Pure and deterministic: no I/O, no model calls. The scene text is
 * learner-typed and model-planned text. It is only used for matching here and
 * is never returned or put into a prompt by these functions.
 */
import { patternStatus, type LearnerProfile, type RememberedFact } from './profile.ts';

/** Words too common in either language to say two texts are about the same thing. */
const STOPWORDS = new Set([
  // English
  'the', 'and', 'with', 'for', 'you', 'your', 'are', 'was', 'have', 'has', 'this', 'that', 'from', 'but', 'not',
  'they', 'their', 'there', 'his', 'her', 'she', 'him', 'its', 'our', 'can', 'will', 'what', 'who', 'all', 'any',
  // French
  'les', 'des', 'une', 'est', 'pour', 'avec', 'dans', 'mon', 'ton', 'son', 'mes', 'tes', 'ses', 'nous', 'vous',
  'qui', 'que', 'pas', 'sur', 'par', 'aux', 'elle', 'ils', 'elles', 'mais', 'ou', 'leur', 'leurs', 'cette', 'ces',
]);

/**
 * A light suffix trim, the same for every token, so `croissants`/`croissant`
 * and `appartements`/`appartement` meet. Deliberately not a stemmer: a wrong
 * merge only reorders recall, a library would be a dependency for little gain.
 */
function trimSuffix(token: string): string {
  let t = token;
  if (t.length > 3 && (t.endsWith('s') || t.endsWith('x'))) t = t.slice(0, -1);
  if (t.length > 4 && t.endsWith('e')) t = t.slice(0, -1);
  return t;
}

/**
 * The matchable terms of some French or English texts: lowercased, accents
 * stripped (café meets cafe), split on anything not a letter (so elisions
 * like `l'appartement` and hyphenated tags split), short words and stopwords
 * dropped, then suffix-trimmed.
 */
export function recallTerms(texts: readonly string[]): Set<string> {
  const terms = new Set<string>();
  for (const text of texts) {
    const folded = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    for (const token of folded.split(/[^\p{L}]+/u)) {
      if (token.length < 3 || STOPWORDS.has(token)) continue;
      terms.add(trimSuffix(token));
    }
  }
  return terms;
}

/** Distinct terms shared with the scene. */
function overlap(terms: Set<string>, scene: Set<string>): number {
  let n = 0;
  for (const t of terms) if (scene.has(t)) n++;
  return n;
}

/**
 * Up to `max` facts for the scene. With nothing relevant this is exactly
 * `facts.slice(-max)`, today's recency choice. Otherwise relevant facts go in
 * first (higher score first, the later fact on ties), the most recent others
 * fill what is left, and the result keeps the facts' original order so the
 * brief still reads chronologically.
 */
export function recallFacts(facts: readonly RememberedFact[], scene: readonly string[], max = 5): RememberedFact[] {
  // `slice(-0)` is the whole array, so a zero cap is answered here, not by the fallback.
  if (max <= 0) return [];
  const sceneTerms = recallTerms(scene);
  const scores = facts.map((f) => (sceneTerms.size ? overlap(recallTerms([f.en, f.fr ?? '']), sceneTerms) : 0));
  if (!scores.some((s) => s > 0)) return facts.slice(-max);
  const indexes = facts.map((_, i) => i);
  const scored = indexes.filter((i) => scores[i]! > 0).sort((a, b) => scores[b]! - scores[a]! || b - a);
  const recent = indexes.filter((i) => scores[i] === 0).reverse();
  const chosen = [...scored, ...recent].slice(0, Math.max(0, max));
  return chosen.sort((a, b) => a - b).map((i) => facts[i]!);
}

/**
 * Up to `max` error patterns for the scene. The fallback is exactly
 * `learnerSnapshotFrom(...).watchFor`: recurring first, then suspected, each
 * by count with ties in insertion order. Relevance only reorders inside a
 * status group, so a one-off slip never pushes out a habit.
 */
export function recallPatterns(
  errorPatterns: LearnerProfile['errorPatterns'],
  scene: readonly string[],
  max = 3,
): Array<{ tag: string; example: string }> {
  const byCount = Object.entries(errorPatterns).sort((a, b) => b[1].count - a[1].count);
  const fallback = [
    ...byCount.filter(([, p]) => patternStatus(p) === 'recurring'),
    ...byCount.filter(([, p]) => patternStatus(p) === 'suspected'),
  ];
  const sceneTerms = recallTerms(scene);
  const ranked = fallback.map(([tag, p], order) => ({
    tag,
    example: p.example,
    recurring: patternStatus(p) === 'recurring',
    count: p.count,
    score: sceneTerms.size ? overlap(recallTerms([tag, p.example]), sceneTerms) : 0,
    order,
  }));
  ranked.sort(
    (a, b) =>
      Number(b.recurring) - Number(a.recurring) || b.score - a.score || b.count - a.count || a.order - b.order,
  );
  return ranked.slice(0, Math.max(0, max)).map(({ tag, example }) => ({ tag, example }));
}

/**
 * Phrases ordered for the scene: relevant first, then today's `frameTargets`
 * weakness order (helped-only first, then fewest unaided uses), stable for
 * the rest. With no relevant phrase the order is exactly today's. No cap; the
 * caller caps.
 */
export function rankPhrasesForScene<
  P extends { fr: string; en: string; frWritten: string | null; timesAssisted: number; timesUsedWell: number },
>(phrases: readonly P[], scene: readonly string[]): P[] {
  const sceneTerms = recallTerms(scene);
  const helpedOnly = (p: P) => p.timesAssisted > 0 && p.timesUsedWell === 0;
  const scored = phrases.map((p) => ({
    p,
    score: sceneTerms.size ? overlap(recallTerms([p.fr, p.frWritten ?? '', p.en]), sceneTerms) : 0,
  }));
  // Array.sort is stable, so remaining ties keep input order.
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(helpedOnly(b.p)) - Number(helpedOnly(a.p)) ||
      a.p.timesUsedWell - b.p.timesUsedWell,
  );
  return scored.map(({ p }) => p);
}
