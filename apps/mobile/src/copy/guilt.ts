/**
 * The words Luvani's copy is not allowed to say.
 *
 * "No streak guilt" is the promise PRODUCT.md makes hardest (Brand
 * Commitments, and principle 4), and it used to be kept by three suites carrying three
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
 * Grows, never shrinks, except by a dated founder decision written into
 * RETIRED_FROM_BAN below. copy/guilt.test.ts holds the historical record of
 * what each surface banned before there was one list, so a deletion here that
 * is not recorded there fails by name.
 */
export const BANNED_IN_COPY: readonly string[] = [
  // Home's daily count (progress/today.ts), which PRODUCT.md refused to turn
  // into a streak twice. These were eleven words, the vocabulary of a chain you
  // can break: the threat, the scold, and the ask to protect something. The
  // word "streak" itself was retired on 2026-10-04 (RETIRED_FROM_BAN); the
  // threat and the scold stay.
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
 * The words that have left BANNED_IN_COPY, and the decision that let each go.
 *
 * One entry, and copy/guilt.test.ts holds it to exactly one: a second word
 * leaving needs its own dated founder decision. "streak" left because the
 * founder chose a full daily streak (D2 in docs/come-alive/README.md). Every
 * shaming word it travelled with is still above, and streak copy answers to
 * BANNED_IN_STREAK_COPY as well.
 */
export const RETIRED_FROM_BAN: readonly { readonly word: string; readonly by: string }[] = [
  { word: 'streak', by: 'founder decision 2026-10-04: a full daily streak' },
];

/**
 * The stricter list for streak, goal, quest and reminder copy: everything no
 * surface may say, plus the countdown, the plea and the sad face in words.
 *
 * Kept apart from BANNED_IN_COPY on purpose. These are the words a streak
 * reaches for when it starts threatening, and most of them are harmless
 * elsewhere: "protect" in privacy copy, a "midnight" train in a scene, "going
 * out" in a daily scene. Putting them on the shared list would push good
 * sentences on other surfaces into worse ones; leaving them off this one is how
 * a streak learns to nag.
 *
 * Substring, like the shared list. `ignor` catches ignore and ignored, `sad`
 * catches sadly, `protect` catches protection, and `miss you` stays even though
 * `missed` is already above. Substring also means a plural does not cover its
 * singular: "hours left" never matches "1 hour left", so each countdown unit is
 * listed in both forms.
 */
export const BANNED_IN_STREAK_COPY: readonly string[] = [
  ...BANNED_IN_COPY,
  'at risk',
  'last chance',
  'hurry',
  'ends tonight',
  'midnight',
  'before it ends',
  'save your streak',
  'disappear',
  'miss you',
  'ignor',
  'disappoint',
  'shame',
  'sad',
  'hours left',
  'minutes left',
  // Added in review (2026-10-05): the singular countdown, the past tense of
  // `break` that the shared list cannot see, and the threat that names no loss
  // but pictures one.
  'hour left',
  'minute left',
  'broke',
  'protect',
  'in danger',
  'going out',
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
 * nothing ever says so. "Your run breaks tonight" and "you owed yourself one"
 * both pass a word-boundary check on the stems, and both are the thing we
 * promised not to do. (Substring is not a stemmer either: "broke" contains no
 * "break", so a new threat still needs its own word on a list, which is why
 * BANNED_IN_STREAK_COPY carries it.)
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

/** The first phrase from BANNED_IN_STREAK_COPY present in `line`, matched as guiltIn matches. */
export function streakGuiltIn(line: string): string | undefined {
  const copy = normalise(line);
  return BANNED_IN_STREAK_COPY.find((word) => copy.includes(word));
}
