/**
 * Every sentence the subscription wall says.
 *
 * It lives here rather than in the screens for the reason `subscription.ts`
 * gives: apps/mobile has no renderer, so a decision inside a `.tsx` is a
 * decision nothing can ask a question about. `WALL_COPY` at the bottom is the
 * flattened list, so a line added tomorrow is scanned the moment it exists
 * rather than the moment somebody remembers to add it to a test.
 *
 * ## What this copy is allowed to do
 *
 * The founder set the mechanism, and it is narrower than the one most paywalls
 * use. Conversion here comes from a learner thinking "I can actually speak
 * French now, I want to keep going" and never from "I will lose my progress" or
 * "this offer ends tonight". So there are no countdowns, no scarcity, no
 * invented social proof and no loss framing anywhere below, and the guilt list
 * in `copy/guilt.ts` refuses most of that vocabulary outright.
 *
 * What is left is the strongest material this product has: what the learner can
 * now do, said in the mission catalogue's own words; what they said themselves,
 * quoted back; what stays theirs for nothing; and what a plan adds. The video
 * the founder sent called this "sell the outcome", and Luvani can do it honestly
 * because the outcome is recorded rather than claimed.
 *
 * ## Two rules that are easy to break here
 *
 * No digits and no currency symbols in this file, held by a test. Every number
 * the wall shows comes off the wire: a price from the store's own localised
 * string, an allowance from the `PLANS` catalogue the server sends. A price
 * compiled into a binary is a price that goes stale in a country nobody checked.
 *
 * No count of the path either. "Four situations" would be a number that drifts
 * the day `WELCOME_PATH` changes, and it would drift silently, because prose
 * does not typecheck. The rows say how many there are by being there.
 */

// ── page one: the map ──────────────────────────────────────────────────────────

export const MAP_TITLE = 'What you can do in French';
export const MAP_SUB = 'Here is where you have been, and what is still waiting for you.';

/** Above a line the learner produced in a real conversation. */
export const MAP_YOURS = 'You said';
/**
 * Above a line the mission taught, when the deck has nothing of theirs yet.
 *
 * A different label because the two license different claims. A phrase with a
 * conversational use behind it can be called theirs; one they have only
 * practised cannot, and saying so is the difference between evidence and
 * flattery.
 */
export const MAP_TAUGHT = 'You practised';
/** Above the rung one step above the last, in the tutor's words. */
export const MAP_NEXT = 'Next time';

// ── page two: their French ─────────────────────────────────────────────────────

export const FRENCH_TITLE = 'Your French is adding up';
export const FRENCH_SUB = 'Every phrase here came out of your mouth in a real conversation.';
/**
 * The same page for a learner whose deck has nothing in it yet.
 *
 * Present rather than skipped. The page list drops a page with nothing true to
 * say, and this is what makes this one always have something: a learner at the
 * very start is told what will collect here, which is true and is an invitation.
 */
export const FRENCH_START = 'Phrases will collect here as you talk, in your own words.';
export const FRENCH_WEEK = 'This week';
export const FRENCH_DAYS = 'Days you spoke French';
/** The way out of the wall and into the free product, on the page that promises it. */
export const FRENCH_OPEN_BANK = 'Open my phrase bank';

// ── page three: what stays yours ───────────────────────────────────────────────

export const YOURS_TITLE = 'All of this stays yours';
/** The founder's free promise, in their words. */
export const YOURS_SUB = 'You can keep practising what you learned for free.';

export const YOURS_BANK = 'Your phrase bank, with every line you have said';
export const YOURS_REVIEW = 'Flashcards and review, for as long as you want them';
export const YOURS_RECAPS = 'Every lesson recap you have earned';
export const YOURS_DRILLS = 'Pronunciation drills and sound practice';
export const YOURS_PROGRESS = 'Your progress, and the situations you have handled';

/** The rows of page three, in the order they are drawn. */
export const YOURS_ROWS: readonly string[] = [
  YOURS_BANK,
  YOURS_REVIEW,
  YOURS_RECAPS,
  YOURS_DRILLS,
  YOURS_PROGRESS,
];

export const ADDS_TITLE = 'A plan adds new conversations';
export const ADDS_SITUATIONS = 'New situations to walk into';
export const ADDS_FREELY = 'Talk freely about anything you like';
export const ADDS_AGAIN = 'Go back into any situation again';
export const ADDS_TIME = 'Speaking time every month, and it starts fresh each month';

/** The rows of what a plan opens, in the order they are drawn. */
export const ADDS_ROWS: readonly string[] = [ADDS_SITUATIONS, ADDS_FREELY, ADDS_AGAIN, ADDS_TIME];

export const YOURS_NEXT = 'See the plans';
/**
 * Where a web learner stops.
 *
 * The web adapter answers `{ available: false }` unconditionally, so page four
 * cannot exist there and the page list ends here. Three pages of appetite and
 * then nothing would be worse than not opening the wall at all, so this page
 * closes on the free promise rather than on a door that is not there.
 */
export const YOURS_ONLY = 'That is all yours already. Nothing to do.';

// ── page four: the plans ───────────────────────────────────────────────────────

/** The founder's paid promise, in their words. */
export const PLANS_TITLE = 'Keep having new real conversations';
export const PLANS_SUB = 'The speaking time each month is the only difference between them.';

/** Above the minutes a plan buys. The number itself comes off the wire. */
export const PLANS_TIME = 'Speaking time a month';
/** What both plans include, said once above the two columns rather than twice inside them. */
export const PLANS_BOTH = 'Both open every situation, and both let you talk freely about anything.';

export const PLANS_CHOOSE = 'Choose this plan';
export const PLANS_RESTORE = 'Restore a previous purchase';
export const PLANS_PRIVACY = 'Privacy policy';
export const PLANS_TERMS = 'Terms of use';
/**
 * What a subscription is, in plain words, on the surface that sells it.
 *
 * Apple asks for the length and the renewal on the purchase screen itself, and
 * a learner is owed it whether Apple asks or not. It says nothing about
 * consequences of stopping, because page three already said the true thing:
 * everything they have made stays theirs.
 */
export const PLANS_RENEWAL = 'Plans renew every month until you cancel. You can cancel any time in the store.';

// ── every ending, in the words each surface needs ──────────────────────────────

/** The wall's own way out. Not a refusal of anything, so it apologises for nothing. */
export const WALL_LEAVE = 'Maybe later';
/** Forward, on any page that is not the last. */
export const WALL_NEXT = 'Next';
/**
 * The last page's action when there is no store to go on to.
 *
 * On web and on any keyless build the wall ends on page three, and the honest
 * last word points at the free product it just promised rather than at a plan
 * that cannot be bought from here.
 */
export const WALL_DONE = 'Keep practising';
export const WALL_READY = 'Your speaking time is ready.';
export const WALL_BUSY = 'Opening the store…';

/**
 * Every line above, flattened for the scan.
 *
 * The list exists so a sentence is covered the moment it is written. Adding a
 * line and not adding it here is the failure this shape is built to make loud,
 * and `wallCopy.test.ts` checks that nothing exported from this module is
 * missing from it.
 */
export const WALL_COPY: readonly string[] = [
  MAP_TITLE,
  MAP_SUB,
  MAP_YOURS,
  MAP_TAUGHT,
  MAP_NEXT,
  FRENCH_TITLE,
  FRENCH_SUB,
  FRENCH_START,
  FRENCH_WEEK,
  FRENCH_DAYS,
  FRENCH_OPEN_BANK,
  YOURS_TITLE,
  YOURS_SUB,
  ...YOURS_ROWS,
  ADDS_TITLE,
  ...ADDS_ROWS,
  YOURS_NEXT,
  YOURS_ONLY,
  PLANS_TITLE,
  PLANS_SUB,
  PLANS_TIME,
  PLANS_BOTH,
  PLANS_CHOOSE,
  PLANS_RESTORE,
  PLANS_PRIVACY,
  PLANS_TERMS,
  PLANS_RENEWAL,
  WALL_LEAVE,
  WALL_NEXT,
  WALL_DONE,
  WALL_READY,
  WALL_BUSY,
];
