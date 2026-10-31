/**
 * Which letters to light when a typed answer was nearly right (drill B v2,
 * UI-016; drill-b.md "Sheet", Nearly: "The missing letter is lit in the answer
 * field").
 *
 * The field shows the right spelling, with the letters the learner missed or
 * got wrong lit, so "voudrai" for "voudrais" reads as "voudrai[s]". An accent
 * is a letter here: "cafe" for "café" lights the "é". When the only slip is an
 * extra letter there is nothing missing to light in the right spelling, so the
 * learner's own attempt is shown with the extra letter lit instead.
 *
 * Case is not a slip. Anything bigger than a small typo lights nothing: the
 * sheet's own words already say the spelling, and a field of lit letters would
 * read as a list of mistakes.
 *
 * Pure, so `litLetters.test.ts` holds it.
 */

/** A run of lit characters, `[start, end)` in `text`. */
export type LitSpan = readonly [number, number];

export interface LitAnswer {
  /** What the field shows. */
  readonly text: string;
  /** The lit runs in `text`, in order, never empty. */
  readonly lit: readonly LitSpan[];
}

/** The most slips that still count as a small typo. */
export const LIT_MAX_EDITS = 2;

type Op = 'same' | 'swap' | 'missing' | 'extra';

/** Edit script from attempt to expected, compared without case. Returns ops in order, with indexes. */
function align(attempt: string, expected: string): { op: Op; a: number; e: number }[] {
  // Fold case one character at a time, so the indexes stay those of the original strings.
  const fold = (s: string) => [...s].map((ch) => (ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch));
  const a = fold(attempt);
  const e = fold(expected);
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: e.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= e.length; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === e[j - 1] ? 0 : 1));
    }
  }
  const ops: { op: Op; a: number; e: number }[] = [];
  let i = a.length;
  let j = e.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i]![j] === d[i - 1]![j - 1]! + (a[i - 1] === e[j - 1] ? 0 : 1)) {
      ops.push({ op: a[i - 1] === e[j - 1] ? 'same' : 'swap', a: i - 1, e: j - 1 });
      i--;
      j--;
    } else if (j > 0 && d[i]![j] === d[i]![j - 1]! + 1) {
      ops.push({ op: 'missing', a: i, e: j - 1 });
      j--;
    } else {
      ops.push({ op: 'extra', a: i - 1, e: j });
      i--;
    }
  }
  return ops.reverse();
}

function runs(indexes: number[]): LitSpan[] {
  const out: [number, number][] = [];
  for (const at of indexes) {
    const last = out[out.length - 1];
    if (last && last[1] === at) last[1] = at + 1;
    else out.push([at, at + 1]);
  }
  return out;
}

/** The field's lit letters for a nearly-right attempt, or null to light nothing. */
export function litLetters(attempt: string, expected: string): LitAnswer | null {
  const typed = attempt.trim();
  const right = expected.trim();
  if (typed === '' || right === '') return null;
  const ops = align(typed, right);
  const slips = ops.filter((o) => o.op !== 'same');
  if (slips.length === 0 || slips.length > LIT_MAX_EDITS || slips.length * 3 > [...right].length) return null;
  // Positions are in code points; the field's text is the same string, so map back to UTF-16 offsets.
  const offsets = (s: string) => {
    const at: number[] = [];
    let u = 0;
    for (const ch of s) {
      at.push(u);
      u += ch.length;
    }
    at.push(u);
    return at;
  };
  const inRight = slips.filter((o) => o.op !== 'extra').map((o) => o.e);
  if (inRight.length > 0) {
    const off = offsets(right);
    return { text: right, lit: runs(inRight).map(([s, e]) => [off[s]!, off[e]!] as const) };
  }
  const off = offsets(typed);
  return { text: typed, lit: runs(slips.map((o) => o.a)).map(([s, e]) => [off[s]!, off[e]!] as const) };
}
