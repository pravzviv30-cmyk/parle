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

export const YOURS_TITLE = 'Keep your French moving.';
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
export const YOURS_BANK = 'Phrase bank: phrases picked from conversations';
export const YOURS_REVIEW = 'Review and pronunciation practice';
export const YOURS_RECAPS = 'Your earned lesson recaps';
export const YOURS_DRILLS = 'Pronunciation and sound practice';
export const YOURS_PROGRESS = 'Your recaps and progress';

/** The rows of page three, in the order they are drawn. */
export const YOURS_ROWS: readonly string[] = [
  YOURS_BANK,
  YOURS_REVIEW,
  YOURS_PROGRESS,
];

export const ADDS_TITLE = 'With a plan';
export const YOURS_FREE_TITLE = 'Always yours, free';
export const ADDS_SITUATIONS = 'Every scene, again and again';
export const ADDS_FREELY = 'Open conversation with your tutor';
export const ADDS_AGAIN = 'Return to any scene';
export const ADDS_TIME = 'Fresh live minutes each month';

/** The rows of what a plan opens, in the order they are drawn. */
export const ADDS_ROWS: readonly string[] = [ADDS_SITUATIONS, ADDS_FREELY, ADDS_TIME];

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
export const PLANS_TITLE = 'Speak your way.';
export const PLANS_SUB = 'Choose your live time and the features that fit you.';

/** What both plans include, said once above the two columns rather than twice inside them. */
export const PLANS_BOTH = 'Every scene + free AI conversation';
export const PLANS_COMPARE = 'Compare plans';

export const PLANS_CHOOSE = 'Choose this plan';
export const PLANS_RESTORE = 'Restore';
export const PLANS_PRIVACY = 'Privacy';
export const PLANS_TERMS = 'Terms';
/**
 * What a subscription is, in plain words, on the surface that sells it.
 *
 * Apple asks for the length and the renewal on the purchase screen itself, and
 * a learner is owed it whether Apple asks or not. It says nothing about
 * consequences of stopping, because page three already said the true thing:
 * everything they have made stays theirs.
 */
export const PLANS_RENEWAL = 'Renews automatically.';

/**
 * The two ways to pay for a plan, as the choice under its name (founder
 * decision D16). The store says how often a product bills (`period`), and the
 * row says it in these words; nothing here assumes a period from an id.
 */
export const PLAN_YEARLY = 'Yearly';
export const PLAN_MONTHLY = 'Monthly';
export const PLAN_WEEKLY = 'Weekly';

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
export const PLANS_TRUST = 'No Commitment, Cancel Anytime';

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
// monthly figure beside a yearly price is RevenueCat's `pricePerMonthString`
// for that product: the yearly price over twelve, formatted in the store's
// currency by the SDK, and an approximation, which is why it is "about". This
// app does no arithmetic on a price: a price is a formatted string in the
// store's currency, and a sum done on it here is a price nobody set. Nothing
// here says how much cheaper one is than another.

/** A yearly price, with the store's monthly figure when it gave one. What a screen reader hears. */
export function yearlyPrice(price: string, perMonth: string | null): string {
  return perMonth === null ? `${price} a year` : `${price} a year, about ${perMonth} a month`;
}

/** A monthly price. */
export function monthlyPrice(price: string): string {
  return `${price} a month`;
}

/**
 * The billed amount, exactly what the store will charge for one period: the
 * title of each way to pay, and the largest price on its row (Apple Guideline
 * 3.1.2: the billed amount is the most prominent price on the page).
 */
export function billedPrice(price: string, period: 'week' | 'month' | 'year'): string {
  return period === 'week' ? `${price} every 7 days` : period === 'year' ? `${price} a year` : `${price} a month`;
}

/**
 * Under the billed amount, smaller: how often, and for a yearly product the
 * store's monthly figure beside it.
 */
export function payDetail(period: 'week' | 'month' | 'year', perMonth: string | null): string {
  if (period === 'week') return PLAN_WEEKLY;
  if (period !== 'year') return PLAN_MONTHLY;
  return perMonth === null ? PLAN_YEARLY : `${PLAN_YEARLY}, about ${perMonth} a month`;
}

/**
 * The pill once a way to pay is chosen: the plan's name and what it costs per
 * period, so the button says the same thing as the row it was chosen from.
 */
export function buyLabel(name: string, price: string, period: 'week' | 'month' | 'year'): string {
  return period === 'week' ? 'Subscribe weekly' : period === 'year' ? 'Subscribe yearly' : 'Subscribe monthly';
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

/** The cancel step's title when no reminder is promised: the last day to cancel by. */
export function trialBeforeDay(day: number): string {
  return `Before day ${day}`;
}

/** The first line of the timeline: what happens today. */
export function trialToday(plan: string): string {
  return `${plan} starts free. Nothing is charged today.`;
}

/** What the trial holds, in the server's minutes. Never a month. */
export function trialMinutes(minutes: number): string {
  return `During the trial: up to ${count(minutes, 'minute')} with your tutor.`;
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
export function trialThen(plan: string, price: string, period: 'week' | 'month' | 'year'): string {
  return period === 'year' ? `${plan} continues at ${price} a year.` : `${plan} continues at ${price} a month.`;
}

/** The pill for a plan with an eligible free trial. */
export function startTrialLabel(days: number): string {
  return `Start ${days}-day free trial`;
}

/** The trial's terms, right at the button (Apple Guideline 3.1.2). */
export function trialTerms(days: number, price: string, period: 'week' | 'month' | 'year'): string {
  return period === 'year'
    ? `Free for ${count(days, 'day')}, then ${price} a year until you cancel.`
    : `Free for ${count(days, 'day')}, then ${price} a month until you cancel.`;
}

/** Above the timeline. */
export const TRIAL_TITLE = 'How your trial works';
/** Short overview above the period switch; complete renewal terms stay at the action. */
export function trialIntroLine(days: number, price: string, period: 'week' | 'month' | 'year'): string {
  return `${count(days, 'day')} free, then ${billedPrice(price, period)}.`;
}
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
/**
 * Under minutes the client cannot tell a trial's week from a month's last week
 * (a restore, or a purchase confirmed after the wall was reopened): what the
 * server holds and the day it runs to, naming no period, which is true of both.
 * The date is handed in, spelled, so this line prints no digit of its own.
 */
export function heldUntil(date: string): string {
  return `Your speaking time until ${date}.`;
}

/** Above the account's own lines on the plans page. */
export const ACCOUNT_LABEL = 'Your speaking time';
/** Under a minute is still some, so it is not said as none. */
export const ACCOUNT_UNDER_A_MINUTE = 'Less than a minute left.';
/** `purchases/planStatus.ts` says the same, in the same words, on the Settings card. */
export const ACCOUNT_NONE_LEFT = 'No speaking time left for now.';
/** A period whose end has already passed renews on the server's next read. */
export const ACCOUNT_FRESH_NOW = 'They start fresh about now.';

// ── the trial paywall, "P2 · Luvani" (2026-10-19, user-approved) ──────────────
//
// One shell for every state: the wordmark and a close mark, a headline, the
// billed amount, the period switch, then a timeline (trial) or three benefits
// (standard), and a pinned footer with one button, the disclosure and the
// links. Every number is handed in; the sentences around them live here.

/** The headline for a learner the store has not offered a free trial, or did not say. */
export const PAYWALL_STANDARD_TITLE = 'Keep speaking with Luvani';
/** The three benefits a standard (no trial) paywall lists. No trial wording, ever. */
export const PAYWALL_BENEFITS: readonly string[] = [
  'Speak with your tutor about real situations, at your pace.',
  'Revisit past conversations and practise the French you used.',
  'Explore situations matched to what you want to say next.',
];
export const PAYWALL_SUBSCRIBE = 'Subscribe';
export const PAYWALL_RESTORE = 'Restore purchases';
/** A monthly product's detail line, with and without a trial before it. */
export const PAYWALL_BILLED_MONTHLY_AFTER_TRIAL = 'Billed monthly after your trial';
export const PAYWALL_BILLED_MONTHLY = 'Billed monthly';
export const PAYWALL_BILLED_YEARLY = 'Billed yearly';
export const PAYWALL_BILLED_WEEKLY = 'Billed weekly';
/** Said after the billed amount in the footer disclosure, both kinds. */
export const PAYWALL_RENEWS = 'Renews automatically until you cancel in Apple Subscriptions.';
export const COMPARE_INTRO = 'Both plans include every conversation, your notes and practice. They differ in live tutor time.';

/** The states the shell draws, in the shell's own words. */
export const PAYWALL_LOADING = 'Checking your offer…';
export const PAYWALL_UNAVAILABLE_TITLE = 'We couldn’t load plans';
export const PAYWALL_UNAVAILABLE_BODY = 'Check your connection and try again. Your saved learning and free practice are still here.';
export const PAYWALL_TRY_AGAIN = 'Try again';
export const PAYWALL_PURCHASING = 'Confirming with Apple…';
export const PAYWALL_FAILED_TITLE = 'The purchase didn’t go through';
export const PAYWALL_FAILED_BODY = 'You haven’t been charged.';
export const PAYWALL_RESTORE_NONE_TITLE = 'No subscription found';
/**
 * Said after a restore the server confirmed nothing for. The restore path
 * reports "nothing granted" and "the server has not caught up" in one message
 * (`restoreTrouble`), so this says what is true of both.
 */
export const PAYWALL_RESTORE_NONE_BODY = 'Nothing to restore for this Apple ID yet. If you just subscribed, try again in a moment.';
export const PAYWALL_PENDING_TITLE = 'Waiting for confirmation';
/** Ask to Buy (F845): the store deferred the purchase until it is approved. */
export const PAYWALL_APPROVAL_TITLE = 'Waiting for approval';
export const PAYWALL_CHECK_AGAIN = 'Check my purchase again';
/** The approval card's body, read from the saved checkout so it survives a reopen. */
export const PAYWALL_APPROVAL_BODY = 'Someone who manages purchases on this account needs to approve it. If it was declined, you can start again.';
/** The pending page's quiet second action: ask the store whether anything is really there. */
export const PAYWALL_START_AGAIN = 'Start again';
/** Start again found the store holding the purchase while the server catches up. */
export const PAYWALL_START_AGAIN_WAIT = 'The store shows this purchase went through. We’re still adding it to your account.';
/** Start again could not get an answer from the store. */
export const PAYWALL_START_AGAIN_TROUBLE = 'We couldn’t reach the store just now. Try again in a moment.';

/** The success page, once the server has confirmed what was bought. */
export const SUCCESS_TITLE = 'You’re all set';
export const SUCCESS_START = 'Start speaking';
export const SUCCESS_FOOTNOTE = 'Manage or cancel anytime in Settings › Subscription.';
export const SUCCESS_ROW_PLAN = 'Plan';
export const SUCCESS_ROW_TRIAL_ENDS = 'Trial ends';
export const SUCCESS_ROW_REMINDER = 'Reminder';
export const SUCCESS_ROW_THEN = 'Then';
export const SUCCESS_ROW_TIME = 'Speaking time';

/** "Free for N days, then ", the lead before the bold billed amount. */
export function offerLead(days: number): string {
  return `Free for ${count(days, 'day')}, then `;
}

/** A yearly product's detail line: the store's monthly figure. The saving, when real, is added by the view. */
export function billedYearlyAbout(perMonth: string): string {
  return `${perMonth} a month, billed yearly`;
}

/** The footer disclosure for a trial, from the store's price and period. */
export function trialDisclosure(days: number, price: string, period: 'week' | 'month' | 'year'): string {
  const unit = period === 'year' ? 'year' : period === 'month' ? 'month' : 'week';
  return `Free for ${count(days, 'day')}, then ${price}/${unit}. ${PAYWALL_RENEWS}`;
}

/** The footer disclosure without a trial. */
export function standardDisclosure(price: string, period: 'week' | 'month' | 'year'): string {
  const how = period === 'year' ? 'yearly' : period === 'month' ? 'monthly' : 'weekly';
  return `${price} billed ${how}. ${PAYWALL_RENEWS}`;
}

/** The plan line above the footer: the tier and its live minutes per window. */
export function planAllowanceLine(name: string, minutes: number, days: number): string {
  return `${name}, ${minutes} min every ${count(days, 'day')}`;
}

/** A compare card's allowance. */
export function compareAllowance(minutes: number, days: number): string {
  return `${count(minutes, 'minute')} of live conversation every ${count(days, 'day')}`;
}

/** A compare card's trial line, only for an offer the store says this account may take. */
export function compareTrialLine(minutes: number, days: number): string {
  return `Free trial: ${count(minutes, 'minute')} over ${count(days, 'day')}`;
}

/** Under the compare cards. */
export function compareNote(days: number): string {
  return `Minutes refresh every ${count(days, 'day')}, on yearly plans too. Unused minutes are not kept for later.`;
}

/** The compare sheet's button. */
export function compareContinue(name: string, trial: boolean): string {
  return trial ? `Continue with ${name}` : `Subscribe to ${name}`;
}

/** The success body after a trial this wall bought. */
export function successTrialBody(name: string, minutes: number, days: number): string {
  return `Your ${name} trial has started. You have ${count(minutes, 'minute')} with your tutor over the next ${count(days, 'day')}.`;
}

/** The success body after a paid plan, said for the catalogue's window. */
export function successPaidBody(name: string, minutes: number, days: number): string {
  return `Your ${name} plan is ready. You have ${count(minutes, 'minute')} with your tutor every ${count(days, 'day')}.`;
}

/** The success body when the client cannot tell a trial's week from a month's last (a restore). */
export function successHeldBody(name: string, minutes: number, until: string): string {
  return `Your ${name} plan is ready. You have ${count(minutes, 'minute')} with your tutor until ${until}.`;
}

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
  PAYWALL_APPROVAL_TITLE,
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
  YOURS_RECAPS,
  YOURS_DRILLS,
  YOURS_FREE_TITLE,
  ADDS_TITLE,
  ...ADDS_ROWS,
  ADDS_AGAIN,
  YOURS_NEXT,
  YOURS_DECLINE,
  YOURS_ONLY,
  PLANS_TITLE,
  PLANS_SUB,
  PLANS_BOTH,
  PLANS_COMPARE,
  PLANS_CHOOSE,
  PLANS_RESTORE,
  PLANS_PRIVACY,
  PLANS_TERMS,
  PLANS_RENEWAL,
  PLAN_YEARLY,
  PLAN_MONTHLY,
  PLAN_WEEKLY,
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
  PAYWALL_STANDARD_TITLE,
  ...PAYWALL_BENEFITS,
  PAYWALL_SUBSCRIBE,
  PAYWALL_RESTORE,
  PAYWALL_BILLED_MONTHLY_AFTER_TRIAL,
  PAYWALL_BILLED_MONTHLY,
  PAYWALL_BILLED_YEARLY,
  PAYWALL_BILLED_WEEKLY,
  PAYWALL_RENEWS,
  COMPARE_INTRO,
  PAYWALL_LOADING,
  PAYWALL_UNAVAILABLE_TITLE,
  PAYWALL_UNAVAILABLE_BODY,
  PAYWALL_TRY_AGAIN,
  PAYWALL_PURCHASING,
  PAYWALL_FAILED_TITLE,
  PAYWALL_FAILED_BODY,
  PAYWALL_RESTORE_NONE_TITLE,
  PAYWALL_RESTORE_NONE_BODY,
  PAYWALL_PENDING_TITLE,
  PAYWALL_CHECK_AGAIN,
  PAYWALL_APPROVAL_BODY,
  PAYWALL_START_AGAIN,
  PAYWALL_START_AGAIN_WAIT,
  PAYWALL_START_AGAIN_TROUBLE,
  SUCCESS_TITLE,
  SUCCESS_START,
  SUCCESS_FOOTNOTE,
  SUCCESS_ROW_PLAN,
  SUCCESS_ROW_TRIAL_ENDS,
  SUCCESS_ROW_REMINDER,
  SUCCESS_ROW_THEN,
  SUCCESS_ROW_TIME,
];
