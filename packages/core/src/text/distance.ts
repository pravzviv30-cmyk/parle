/**
 * Edit distance, and the window inside which a slip is forgiven.
 *
 * Lifted out of drill grading so the spoken path can hold itself to exactly the
 * same standard as the typed one. Two implementations of "how wrong is close
 * enough" is how a product ends up forgiving a typed answer and failing the
 * identical spoken one.
 */

/** Below this many letters, one edit is too large a share of the word to forgive. */
export const TYPO_MIN_LENGTH = 5;
/** The edit budget a slip gets. One; two edits is a different word. */
export const TYPO_MAX_DISTANCE = 1;

/**
 * Damerau-Levenshtein distance, optimal-string-alignment variant: insertions,
 * deletions, substitutions, and adjacent transpositions all cost one. The
 * transposition case is the whole point — "cafeé" and "caef" are finger slips,
 * and plain Levenshtein bills a swap as two errors.
 */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i]![0] = i;
  for (let j = 0; j < cols; j++) d[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        d[i - 1]![j]! + 1, // deletion
        d[i]![j - 1]! + 1, // insertion
        d[i - 1]![j - 1]! + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2]![j - 2]! + 1); // transposition
      }
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * Is `said` the same word as `target`, allowing one slip?
 *
 * Short words get no grace: in a four-letter word one edit is a quarter of the
 * word, and "vous" against "nous" is a different answer, not a stumble.
 */
export function sameWord(said: string, target: string): boolean {
  if (said === target) return true;
  if (said.length < TYPO_MIN_LENGTH || target.length < TYPO_MIN_LENGTH) return false;
  return damerauLevenshtein(said, target) <= TYPO_MAX_DISTANCE;
}
