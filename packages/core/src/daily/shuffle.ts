/**
 * A pool, dealt in an order of its own.
 *
 * `dailyPick` answers "which one is today", and that is the right rule for a
 * card the whole app agrees about. The suggestion card asks a different
 * question: give me another, and another, and do not show me one I have already
 * seen. Walking the pool in authored order answered it badly, because the
 * authored order is grouped by theme, so a learner tapping through met eleven
 * cafés and then twelve hotels.
 *
 * So this deals a permutation. The contract is the one `drill/session.ts`'s
 * `mixQueue` already states and is worth repeating: **it never adds, drops or
 * re-picks.** Every index appears exactly once, so a learner who taps their way
 * round meets every situation before meeting any of them twice, and the walk is
 * a reordering of the pool rather than a sampling of it.
 *
 * Pure, and seeded rather than random. Two devices given the same seed deal the
 * same order, a test can assert on it, and the learner's place in the walk is
 * one small integer rather than a set of everything they have seen.
 */

/**
 * mulberry32.
 *
 * Chosen because it is nine lines, has no state beyond the seed, and passes
 * well enough for dealing cards to one person. `Math.random` is deliberately
 * not used: nothing in this package reads a clock or a global, which is what
 * lets every rule here be tested by handing it its inputs.
 */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The indices `0 .. size - 1`, dealt.
 *
 * Fisher-Yates, walked from the back, which is the version that gives every
 * permutation equal probability. A size of nought or less deals an empty hand
 * rather than throwing: the callers below already have to answer "the pool is
 * empty" and there is no second thing for this to say.
 */
export function shuffledOrder(size: number, seed: number): number[] {
  if (!Number.isFinite(size) || size <= 0) return [];
  const order = Array.from({ length: Math.floor(size) }, (_, i) => i);
  const random = prng(Number.isFinite(seed) ? Math.trunc(seed) : 0);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const here = order[i]!;
    order[i] = order[j]!;
    order[j] = here;
  }
  return order;
}

/**
 * The item at a position in the dealt order.
 *
 * A position past the end wraps, so a learner who has been round once starts
 * the same order again rather than meeting a blank card. A corrupt position is
 * folded to a whole step rather than throwing, because it can only arrive from
 * a stored value somebody edited or a partial write, and a card that refuses to
 * draw is worse than a card showing the first situation.
 */
export function shuffledPick<T>(pool: readonly T[], seed: number, position: number): T | null {
  if (pool.length === 0) return null;
  const order = shuffledOrder(pool.length, seed);
  const step = Number.isFinite(position) ? Math.abs(Math.trunc(position)) : 0;
  return pool[order[step % order.length]!] ?? null;
}

/** One step along, kept inside the pool so a stored number cannot run away. */
export function nextPosition(position: number, size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  const step = Number.isFinite(position) ? Math.abs(Math.trunc(position)) : 0;
  return (step + 1) % Math.floor(size);
}
