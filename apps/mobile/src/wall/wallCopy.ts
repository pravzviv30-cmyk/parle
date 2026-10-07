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

/**
 * The same page, once the whole path is walked.
 *
 * Problem first, which is the second video's argument, and it applies here only
 * because by now there genuinely is one: the situations held back are the only
 * rooms left. Both lines name situations and never the learner. "Still ahead of
 * you" is where the rooms are, not a verdict on somebody for not being there,
 * and nothing below counts them, because a count of the situations goes stale
 * the day the path changes size.
 */
export const MAP_CLOSED_TITLE = 'The situations still ahead of you';
export const MAP_CLOSED_SUB = 'You have handled everything below. These are the ones waiting.';

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

/**
 * What the phrase bank actually holds (2026-09-27, report change 23).
 *
 * It used to say "every line you have said", which was not true. The bank is
 * the review deck: the phrases each lesson's recap and each conversation's pack
 * picked out (`review/store.ts`, `addFromSummary` and `addPhrases`). No
 * transcript is kept, and a Conversation Pack is curated learning data, never a
 * readable transcript (`docs/STATE_AND_STORAGE.md`).
 */
export const YOURS_BANK = 'Your phrase bank, with the phrases picked out of your conversations';
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
 * The visible way out on page one, when there is a plan to go on to (come
 * alive, README Part 5.G). Only then: without a store the pill already says
 * WALL_DONE, and two ways to say the same thing is one too many.
 */
export const YOURS_DECLINE = 'Keep practising free';
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
export const PLANS_RENEWAL = 'Plans renew every month or every year until you cancel. You can cancel any time in the store.';

/**
 * The two ways to pay for a plan, as the choice under its name (founder
 * decision D16). The store says how often a product bills (`period`), and the
 * row says it in these words; nothing here assumes a period from an id.
 */
export const PLAN_YEARLY = 'Yearly';
export const PLAN_MONTHLY = 'Monthly';

/**
 * The one trust line, and both halves of it are already true.
 *
 * The third video's second technique is trust signals, and its example used
 * "Join 2M+ busy people". Luvani has nobody to count, and the founder ruled out
 * a claim that is not real yet, so this says the two things that are: there is
 * no advertising identifier and no third-party analytics kit anywhere in the app
 * (`docs/PRIVACY_AND_SAFETY.md`, held by `policy.test.ts`), and stopping costs a
 * learner none of what they made. This is the first time the purchase surface
 * says either out loud.
 */
export const PLANS_TRUST = 'No adverts, and nothing you made goes away if you stop.';

// ── speaking time, in units a learner can picture ──────────────────────────────
//
// 2026-09-27, notebook Phase 6-E. Minutes a month is a number nobody can feel,
// and a conversation is one anybody can. These are the only sentences on the
// wall with a number in them, so each is a function of the number rather than a
// string holding one: every digit printed is one it was handed, from the
// catalogue, from the server's own answer, or from the one stated conversation
// length in `wallPlans.ts`. `wallCopy.test.ts` calls every function exported
// here and holds that to be true.

const count = (n: number, one: string): string => `${n} ${n === 1 ? one : `${one}s`}`;

/** The headline of a plan row: its minutes as conversations a week, rounded down. */
export function perWeekLine(conversations: number): string {
  return `For example, about ${count(conversations, 'conversation')} a week`;
}

/** The allowance underneath, in the server's own minutes. */
export function minutesAMonth(minutes: number): string {
  return `${count(minutes, 'live minute')} a month`;
}

/** The unit, stated once, so "a conversation" is a length and not a feeling. */
export function conversationLength(minutes: number): string {
  return `The examples assume ${count(minutes, 'minute')} per conversation. Actual lengths vary. Connected typing also uses live minutes.`;
}

/**
 * The free minutes every account starts with, said in minutes and in
 * conversations. "Free minutes" and never "free trial" (come alive, README
 * Part 5.G): a free trial is now the store's own offer, and the two are
 * different things a learner should never have to tell apart from one word.
 */
export function trialAllowance(minutes: number, conversations: number): string {
  return conversations >= 1
    ? `You start with ${count(minutes, 'free minute')}, about ${count(conversations, 'conversation')}.`
    : `You start with ${count(minutes, 'free minute')}.`;
}

/** What is left on the account, rounded down, with what that is in conversations. */
export function minutesLeft(minutes: number, conversations: number): string {
  return conversations >= 1
    ? `${count(minutes, 'minute')} left, about ${count(conversations, 'conversation')}.`
    : `${count(minutes, 'minute')} left.`;
}

/** When a paid plan's minutes start fresh, as a day and a month. */
export function startsFresh(date: string): string {
  return `They start fresh on ${date}.`;
}

// ── yearly and monthly, in the store's own prices (D16) ────────────────────────
//
// Every price here is the store's localised string, passed in whole. The
// monthly figure beside a yearly price is the store's own `pricePerMonthString`
// for that product, never a division done on the phone: a price is a formatted
// string in the store's currency, and arithmetic on it is a price nobody set.
// Nothing here says how much cheaper one is than another.

/** A yearly price, with the store's own monthly figure when it gave one. */
export function yearlyPrice(price: string, perMonth: string | null): string {
  return perMonth === null ? `${price} a year` : `${price} a year, about ${perMonth} a month`;
}

/** A monthly price. */
export function monthlyPrice(price: string): string {
  return `${price} a month`;
}

/**
 * The pill once a way to pay is chosen: the plan's name and what it costs per
 * period, so the button says the same thing as the row it was chosen from.
 */
export function buyLabel(name: string, price: string, period: 'month' | 'year'): string {
  return period === 'year' ? `${name}, ${price} a year` : `${name}, ${price} a month`;
}

/**
 * Whether a plan's speaking time covers the learner's own daily goal.
 *
 * Both numbers are handed in: the goal the learner chose, and the plan's
 * minutes a day as `wallPlans.ts` divides the server's catalogue, rounded down.
 * When the plan covers less, the line says what it does cover and what does the
 * rest, rather than what it lacks.
 */
export function goalFitLine(goal: number, daily: number): string {
  return daily >= goal
    ? `Fits your ${goal}-minute daily goal.`
    : `About ${count(daily, 'minute')} of conversation a day. Free practice covers the rest of your ${goal}-minute goal.`;
}

// ── the store's free trial (D16), only ever with a real eligible offer ─────────
//
// Every number is handed in: the trial's length in days is the store's own
// introductory period, the minutes are the server's (a week of the plan, from
// the catalogue it sent), and the day a reminder would come is worked out by
// the caller and passed as its own number, so no line here does arithmetic.

/** A day on the trial's timeline. */
export function trialDay(day: number): string {
  return `Day ${day}`;
}

/** The first line of the timeline: what happens today. */
export function trialToday(plan: string): string {
  return `${plan} starts free. Nothing is charged today.`;
}

/** What the trial holds, in the server's minutes. Never a month. */
export function trialMinutes(minutes: number): string {
  return `During the trial: up to ${count(minutes, 'minute')} with your AI tutor.`;
}

/**
 * The reminder line, for a learner who will really be reminded: notifications
 * allowed, and the reminder scheduled once the server has confirmed the trial.
 * Otherwise the timeline says `trialCancelBy` instead, which is always true.
 */
export const TRIAL_REMIND = 'We will remind you two days before your trial ends.';

/** How to pay nothing, said plainly. The day is the store's last trial day. */
export function trialCancelBy(day: number): string {
  return `Cancel in your App Store settings before day ${day} and you pay nothing.`;
}

/** What the trial becomes, at the store's own price for its period. */
export function trialThen(plan: string, price: string, period: 'month' | 'year'): string {
  return period === 'year' ? `${plan} continues at ${price} a year.` : `${plan} continues at ${price} a month.`;
}

/** The pill for a plan with an eligible free trial. */
export function startTrialLabel(days: number): string {
  return `Start ${days}-day free trial`;
}

/** The trial's terms, right at the button (Apple Guideline 3.1.2). */
export function trialTerms(days: number, price: string, period: 'month' | 'year'): string {
  return period === 'year'
    ? `Free for ${count(days, 'day')}, then ${price} a year until you cancel.`
    : `Free for ${count(days, 'day')}, then ${price} a month until you cancel.`;
}

/** Above the timeline. */
export const TRIAL_TITLE = 'How your free trial works';
/** The first node's title. */
export const TRIAL_NOW = 'Today';

// ── the purchase, once the server has confirmed it ─────────────────────────────

/** Under a monthly or yearly plan's minutes: the catalogue's allowance per window. */
export const SUCCESS_MONTH = 'Your speaking time each month.';
/**
 * Under a store trial's minutes (F742): the server's own week of the plan,
 * never the catalogue's month, because a trial is granted a week.
 */
export const SUCCESS_TRIAL = 'Your speaking time during the free trial.';

/** Above the account's own lines on the plans page. */
export const ACCOUNT_LABEL = 'Your speaking time';
/** Under a minute is still some, so it is not said as none. */
export const ACCOUNT_UNDER_A_MINUTE = 'Less than a minute left.';
/** `purchases/planStatus.ts` says the same, in the same words, on the Settings card. */
export const ACCOUNT_NONE_LEFT = 'No speaking time left for now.';
/** A period whose end has already passed renews on the server's next read. */
export const ACCOUNT_FRESH_NOW = 'They start fresh about now.';

// ── every ending, in the words each surface needs ──────────────────────────────

/** The wall's own way out. Not a refusal of anything, so it apologises for nothing. */
export const WALL_LEAVE = 'Not now';
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
 * The pill once the store has said yes and the server is confirming the plan.
 * The check comes only after the server confirms (README Part 5.G).
 */
export const WALL_CONFIRMING = 'Checking your plan…';

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
  MAP_CLOSED_TITLE,
  MAP_CLOSED_SUB,
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
  YOURS_DECLINE,
  YOURS_ONLY,
  PLANS_TITLE,
  PLANS_SUB,
  PLANS_BOTH,
  PLANS_CHOOSE,
  PLANS_RESTORE,
  PLANS_PRIVACY,
  PLANS_TERMS,
  PLANS_RENEWAL,
  PLAN_YEARLY,
  PLAN_MONTHLY,
  PLANS_TRUST,
  TRIAL_REMIND,
  TRIAL_TITLE,
  TRIAL_NOW,
  SUCCESS_MONTH,
  SUCCESS_TRIAL,
  ACCOUNT_LABEL,
  ACCOUNT_UNDER_A_MINUTE,
  ACCOUNT_NONE_LEFT,
  ACCOUNT_FRESH_NOW,
  WALL_LEAVE,
  WALL_NEXT,
  WALL_DONE,
  WALL_READY,
  WALL_BUSY,
  WALL_CONFIRMING,
];
