/**
 * The words Luvani's copy is not allowed to say.
 *
 * "No streak guilt" is the promise PRODUCT.md makes hardest (:90-93, and
 * principle 4 at :138), and it used to be kept by three suites carrying three
 * different lists: eleven phrases on Home, four words on the mix offer, and a
 * source scan on the review screen. Three lists means the shortest one is the
 * real rule, and the gate cannot see any of them getting shorter. This is the
 * union, imported by every guilt-sensitive copy test, so removing a word to let
 * one nice sentence through fails several suites at once.
 *
 * There is no store, no state, and no learner data here. It is a list and a
 * matcher, and it is imported by tests rather than by screens: nothing at
 * runtime filters copy through it. Copy is written by people who read the list,
 * and the list is enforced at the gate.
 *
 * The review screen's own scan is not part of this. cardView.test.ts reads
 * ReviewScreen.tsx for `ProgressBar` and `percent`, which is a check on what
 * the component is made of, not on what it says. Do not merge the two.
 */

/**
 * Every word and phrase banned from learner-facing copy, oldest first.
 *
 * Grows, never shrinks. copy/guilt.test.ts holds the historical record of what
 * each surface banned before there was one list, so a deletion here fails
 * there by name.
 */
export const BANNED_IN_COPY: readonly string[] = [
  // Home's daily count (progress/today.ts), which PRODUCT.md has now refused to
  // turn into a streak twice. These eleven are the vocabulary of a chain you
  // can break: the threat, the scold, and the ask to protect something.
  'streak',
  'missed',
  'lost',
  'lose',
  'break',
  'keep it up',
  "don't",
  'do not',
  'again tomorrow or',
  'failed',
  'behind',
  // The mix offer (practice/mix.ts). Its list was streak, behind, missed and
  // owe; the first three were already above, so owe is what it adds.
  'owe',
];

/**
 * Lowercase, and a curly apostrophe read as a straight one.
 *
 * The second half matters more than it looks. Copy arrives from documents and
 * design tools that turn ' into U+2019, and "don’t" does not contain "don't" as
 * far as includes() is concerned. Folding them here means the list carries each
 * word once instead of twice, and a word can never be smuggled past by the
 * keyboard it was typed on.
 */
function normalise(line: string): string {
  return line.toLowerCase().replace(/[‘’]/g, "'");
}

/**
 * The first banned phrase present in `line`, or undefined if it is clean.
 *
 * ## Why substring and not a word boundary
 *
 * The two suites this replaced disagreed: Home used `includes`, the mix offer
 * used `\b(...)\b`. Substring wins, because the two failure modes are not
 * symmetric. A false positive costs one sentence a rewrite, and the writer sees
 * exactly which word did it. A false negative ships guilt to a learner and
 * nothing ever says so. "You broke your run", "streaks", "you owed yourself
 * one" all pass a word-boundary check on the singular stems, and all of them
 * are the thing we promised not to do.
 *
 * The cost is real and worth naming, because Phase 6a's new surfaces will meet
 * it. `break` catches breakfast and breakthrough. `lose` catches close and
 * closer. `owe` catches power, lower, however and flower, and it is the word
 * that becomes newly aggressive for Home, which never had it before. If one of
 * these blocks a sentence that is genuinely warm, the answer is a different
 * word, not a shorter list.
 */
export function guiltIn(line: string): string | undefined {
  const copy = normalise(line);
  return BANNED_IN_COPY.find((word) => copy.includes(word));
}
