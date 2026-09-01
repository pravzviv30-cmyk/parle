/**
 * The daily reminder: what it says, when it says it, and what it is never told.
 *
 * ## The rule this module exists to hold
 *
 * **The reminder does not know whether the learner practised.** It is the most
 * consequential decision in the retention work and the easiest one to erode,
 * because the erosion always arrives as a kindness: "surely we should not nag
 * somebody who already did their French today."
 *
 * We should not, and we do not — but the fix is not to suppress the
 * notification. A notification that disappears on the days you practised is a
 * state signal. Its absence comes to mean "you did enough" and its presence
 * comes to mean "you have not yet", and the learner reads a quota off their
 * lock screen without ever opening the app. That is exactly the mechanic
 * PRODUCT.md:90-93 refuses when it refuses the streak, and dressing it as a
 * scheduling optimisation does not change what it is.
 *
 * It holds mechanically as well as morally. An OS daily trigger repeats and
 * cannot skip one day, so "cancel just today" means cancel and reschedule,
 * driven by whether the learner practised, which means `reminders/` has to
 * import the progress stores. Once that import exists, "you have not practised
 * yet today" is one well-meaning refactor away.
 *
 * So `reminderContent()` takes no arguments. Not "ignores its arguments": takes
 * none, so there is nothing it could vary with, and the test asserts its arity.
 * Above that sits the structural half, `reminder.test.ts`, which reads every
 * module in this directory and fails if one of them imports from `progress/`,
 * `missions/`, `review/` or `practice/`, or names one of the functions that
 * read practice state through `@luvani/core`.
 *
 * **The cost, said plainly.** A learner who practised at 7:55 still gets the
 * 8:00 reminder. That is the price of the rule, and it is why the words are
 * fixed and time-neutral: "Luc is here whenever you want to talk" is a mild
 * redundancy to somebody who just finished, where "ready for today's French?"
 * would be a small accusation. The copy is written for the day it is wrong.
 *
 * **The one thing it may know is whether it can fire at all.** Permission is a
 * property of the channel, not of the learner: it says nothing about what
 * anyone has done, and without it the Profile switch can sit proudly on over a
 * revoked permission and deliver nothing for a month. `reminderRow` is that
 * honesty, and it is the reason a stored "enabled" is not the same thing as an
 * on switch.
 *
 * ## Shape
 *
 * Constants and pure functions, no expo import, nothing that touches the OS.
 * The same split `progress/saveFile.ts` uses: the half that can be tested on
 * node is separated from the half that cannot, so the policy and the words are
 * held by the gate today and the platform module stays a thin, dumb caller.
 * `disclosure.ts` is the discipline for the copy itself — apps/mobile has no
 * renderer, so a sentence that only exists inside a screen is a sentence no
 * test can read.
 *
 * The voice is `progress/today.ts`, which states the no-guilt discipline more
 * fully than anything else in the repo. Read its header before editing a word
 * here. Every string below is checked against `copy/guilt.ts`, the one shared
 * ban list, and the check is substring and apostrophe-folded, so if a warm
 * sentence trips it the answer is a different sentence, never a shorter list.
 */

import { TUTOR_NAME } from '../tutor/tutorName.ts';

/**
 * What the OS says about whether we may post a notification.
 *
 * Deliberately the same three words expo-notifications uses, without importing
 * it: a second vocabulary for the same three states is how the native module
 * and the screen start disagreeing about what "off" means. Nothing here can ask
 * for the value; the caller passes what the platform told it.
 */
export type ReminderPermission = 'undetermined' | 'granted' | 'denied';

/** The presets, named by the moment rather than by the hour. */
export type ReminderTimeId = 'morning' | 'lunch' | 'evening' | 'night';

export interface ReminderTime {
  value: ReminderTimeId;
  /** The moment, in the words a learner would use for it. */
  label: string;
  /** The clock, for the row and under the option. */
  gloss: string;
  /** Local hour, handed to the platform trigger. */
  hour: number;
  /** Always zero, for the reason the preset list gives. */
  minute: number;
}

/**
 * Early evening, when the day's obligations are done and sleep is not close.
 *
 * The default, and a default is a suggestion rather than a decision: the sheet
 * opens on it and one tap changes it. Deliberately not the morning, where a
 * reminder competes with getting out of the door and is dismissed unread. It is
 * named here rather than indexed out of the list below so that `reminderTime`
 * has a fallback the compiler can see is real.
 */
const EARLY_EVENING: ReminderTime = { value: 'evening', label: 'Early evening', gloss: '6:00 pm', hour: 18, minute: 0 };

/**
 * Four presets rather than a time picker.
 *
 * A picker means `@react-native-community/datetimepicker`, a second native
 * dependency in a manifest that is already gaining one this phase, to solve a
 * problem nobody has: the interesting choice is which part of the day, not
 * whether the reminder lands at 18:00 or 18:07. Four options is one tap in the
 * sheet pattern ProfileTab already has, and it maps onto `OptionCard` the same
 * way `STRICTNESS_OPTIONS` does.
 *
 * These four are the moments an adult with a job has ten free minutes: before
 * the day starts, the middle of it, the gap after work, and the wind-down.
 * Always on the hour, because a preset at 18:07 is a time picker that has been
 * hidden rather than removed, and because a round number is easier to plan a
 * habit around than a precise one.
 */
export const REMINDER_TIMES: readonly ReminderTime[] = [
  { value: 'morning', label: 'Morning', gloss: '8:00 am', hour: 8, minute: 0 },
  { value: 'lunch', label: 'Lunchtime', gloss: '1:00 pm', hour: 13, minute: 0 },
  EARLY_EVENING,
  { value: 'night', label: 'Before bed', gloss: '9:00 pm', hour: 21, minute: 0 },
];

/** What a learner who has never opened the sheet is offered. */
export const DEFAULT_REMINDER_TIME: ReminderTimeId = EARLY_EVENING.value;

/**
 * What the learner chose, kept under the account by `reminders/store.ts`.
 *
 * Two fields and no history. There is nothing here about days, counts or the
 * last time anything fired, because a reminder that remembers is a reminder
 * that can compare.
 */
export interface StoredReminder {
  enabled: boolean;
  time: ReminderTimeId;
}

/** The notification itself, in the shape the platform scheduler wants. */
export interface ReminderContent {
  title: string;
  body: string;
}

/**
 * The title. Says what it is, promises nothing, and asks for nothing.
 */
export const REMINDER_TITLE = 'A moment of French';

/**
 * The line, and the whole of the line, every day for as long as this is on.
 *
 * True at every hour and on every day, whether the learner has spoken French
 * today, this week or not since March. It is an open door rather than a
 * summons: no number, no question the learner has to answer, nothing that
 * changes meaning depending on what they have or have not done.
 */
export const REMINDER_BODY = `${TUTOR_NAME} is here whenever you want to talk.`;

/** The Profile row's label. */
export const REMINDER_ROW = 'Daily reminder';

/** The row's value when nothing will arrive. One word, no explanation needed. */
export const REMINDER_OFF = 'Off';

/**
 * Said above the switch, before any system dialog.
 *
 * `MEET_MIC` in disclosure.ts is the discipline: it stops at the ask instead of
 * making a promise the code has not kept. This says three checkable things —
 * that a dialog is coming, that it is one a day, and that the words never
 * change — and stops. It does not claim the app sends nothing else, because
 * that is a promise about the whole app that this module cannot keep.
 *
 * "It says the same thing every day" is the design, stated to the person it
 * protects. It is also the quietest possible way to tell a learner that the
 * notification carries no score.
 *
 * This does NOT belong in `disclosure.ts`. `FIRST_RUN_SURFACES` is an ordered
 * list of the screens a learner meets before their first conversation, and this
 * dialog never fires there. It fires when somebody flips a switch in Profile,
 * weeks later, and a first-run sentence about a permission the first run does
 * not ask for is a promise pointing at nothing.
 */
export const REMINDER_EXPLAIN =
  'Your phone will ask to allow notifications. Luvani sends one a day at the time you pick, and it says the same thing every day.';

/**
 * What the row says when the OS will not deliver.
 *
 * Names the real state, names where it can be changed, and stops. No apology,
 * no second ask, and nothing about what the learner is missing: a person who
 * turned notifications off made a choice, and a product that argues with it is
 * the product this one is trying not to be. iOS will not show the dialog twice
 * anyway, so a re-ask loop would be a button that silently does nothing.
 */
export const REMINDER_REFUSED =
  'Notifications are turned off for Luvani in your phone settings. You can turn them on there whenever you like.';

/** The sheet that picks the time. */
export const REMINDER_TIME_TITLE = 'When to remind you';
export const REMINDER_TIME_SUB = 'Pick a time that suits you. You can change it whenever you like.';

/**
 * Every learner-facing string here, flattened, the way `FIRST_RUN_COPY` is.
 *
 * The guilt scan reads this list rather than the exports one by one, so a new
 * sentence is covered the moment it is added — and a sentence deliberately left
 * out of the list is caught too, because the test asserts the notification's
 * own words are in it.
 */
export const REMINDER_COPY: readonly string[] = [
  REMINDER_TITLE,
  REMINDER_BODY,
  REMINDER_ROW,
  REMINDER_OFF,
  REMINDER_EXPLAIN,
  REMINDER_REFUSED,
  REMINDER_TIME_TITLE,
  REMINDER_TIME_SUB,
  ...REMINDER_TIMES.flatMap((time) => [time.label, time.gloss]),
];

/**
 * The words, built from nothing.
 *
 * The empty parameter list is the feature. See the header: a builder that took
 * one argument could take the learner's day, and the lock screen would start
 * reporting on it. Nothing in this function reads a clock either, which the
 * test checks by reading this file, because "same words every day" and "same
 * words at every hour" are the same promise.
 */
export function reminderContent(): ReminderContent {
  return { title: REMINDER_TITLE, body: REMINDER_BODY };
}

/**
 * The preset for a stored id, and the default for anything else.
 *
 * Sceptical on purpose, the way `strictnessOf` is: this value has been through
 * a JSON blob, a version chain and possibly another device's disk, and a
 * reminder that throws on a mangled byte is a reminder that stops arriving
 * without ever saying why.
 */
export function reminderTime(id: unknown): ReminderTime {
  return REMINDER_TIMES.find((time) => time.value === id) ?? EARLY_EVENING;
}

/** Everything the Profile row needs to render honestly. */
export interface ReminderRow {
  /** What the switch shows. Never on unless a notification would really arrive. */
  on: boolean;
  /** The row's value: the chosen clock time, or `REMINDER_OFF`. */
  value: string;
  /** The one line shown beside the switch, or '' when there is nothing to say. */
  note: string;
  /** True when flipping the switch on will raise the system dialog. */
  asks: boolean;
}

/**
 * What the learner asked for, crossed with what the OS will allow.
 *
 * The stored flag alone is not enough to draw a switch. Permission is per
 * install and can be revoked in Settings months later without the app hearing a
 * word about it, so a row that trusts the stored value shows a confident "on"
 * over a channel that has been closed since April. That is a dead switch: the
 * learner believes a reminder is coming, no reminder comes, and the product has
 * quietly lied to them.
 *
 * So a refusal wins over the stored value, and it wins whether the switch was
 * on or off, because the switch is just as dead before it is flipped as after.
 * An undecided permission reads as off too, and carries the explaining sentence
 * instead: that is the state a learner is in before they have ever been asked,
 * and it is the only state in which flipping the switch raises a dialog.
 */
export function reminderRow(
  stored: StoredReminder | null | undefined,
  permission: ReminderPermission,
): ReminderRow {
  if (permission === 'denied') {
    return { on: false, value: REMINDER_OFF, note: REMINDER_REFUSED, asks: false };
  }
  if (permission === 'undetermined') {
    return { on: false, value: REMINDER_OFF, note: REMINDER_EXPLAIN, asks: true };
  }
  if (stored?.enabled !== true) {
    return { on: false, value: REMINDER_OFF, note: '', asks: false };
  }
  return { on: true, value: reminderTime(stored.time).gloss, note: '', asks: false };
}
