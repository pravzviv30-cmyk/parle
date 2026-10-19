/**
 * Web build: there is no daily reminder here, and it says so.
 *
 * The `progress/saveFile.ts` pattern. Metro picks `schedule.native.ts` on iOS
 * and Android; the compiler only ever resolves this file, so this half is both
 * the web implementation and the shape the whole app is typechecked against.
 * `schedule.test.ts` holds the two of them to the same exported names, because
 * a name that exists in one half and not the other typechecks perfectly and
 * crashes on a phone.
 *
 * ## Unavailable, not "fine"
 *
 * Every function here answers with the honest negative rather than resolving
 * quietly. A no-op that returns success is worse than no feature: the switch
 * goes on, the store records that the learner asked for a reminder, and nothing
 * ever arrives. A browser could deliver something through the Notifications
 * API, and this file deliberately does not: the reminder has to survive the tab
 * being closed, which needs a service worker and a second delivery path for a
 * surface almost nobody runs Luvani on.
 *
 * ## Why permission reads `denied` and not `undetermined`
 *
 * `reminderRow` turns `undetermined` into "flipping this switch will raise a
 * system dialog". On the web that dialog never comes, so the row would sit
 * there inviting a tap that does nothing. `denied` draws an off switch that
 * asks for nothing, and `REMINDERS_AVAILABLE` is what a screen keys on to leave
 * the row out altogether.
 *
 * ## What this module is not responsible for
 *
 * It does not decide which days get a reminder (`plan.ts`) or read what the
 * learner has done (`ReminderPlanner.tsx`). It does not check permission
 * before scheduling: the caller owns the order the dialog appears in.
 */

import type { ReminderSlot } from './plan.ts';
import type { ReminderPermission } from './reminder.ts';
import type { TrialReminderSlot } from './trialReminder.ts';

/**
 * Whether this build can put a reminder in front of anyone.
 *
 * Annotated `boolean` rather than left to infer. Without the annotation this is
 * the literal type `false`, the compiler decides `REMINDERS_AVAILABLE === true`
 * can never hold, and the one check every caller wants to write becomes a type
 * error against a constant that is `true` on every device the app ships to.
 */
export const REMINDERS_AVAILABLE: boolean = false;

/**
 * What a scheduling attempt is allowed to claim, in one word.
 *
 * - `done` means the OS accepted the request without throwing. That is the
 *   strongest claim available on-device, and it is not a promise that a
 *   notification will be presented.
 * - `unavailable` means this build has no scheduler. Not a failure, and not
 *   something to retry.
 * - `failed` means the platform refused a request it could have taken.
 *
 * Declared in both halves rather than shared, because neither half can import
 * the other: Metro would resolve `./schedule.ts` from inside the native module
 * back to the native module. `schedule.test.ts` compares the two declarations.
 */
export type ScheduleOutcome = 'done' | 'unavailable' | 'failed';

/** A tap on one of this app's reminders: where its slot says it opens, and its identifier. */
export type ReminderTapHandler = (open: string, id: string) => void;

/** What the OS would allow, if there were an OS notification channel to allow. */
export function reminderPermission(): Promise<ReminderPermission> {
  return Promise.resolve('denied');
}

/** No dialog exists to raise, so nothing is raised and the answer does not move. */
export function askReminderPermission(): Promise<ReminderPermission> {
  return Promise.resolve('denied');
}

/**
 * Accepts the plan so the two halves share one signature, and schedules
 * nothing. The argument is read and discarded on purpose: a parameter the web
 * half omitted would let the native half's signature drift unnoticed.
 */
export function schedulePlan(slots: readonly ReminderSlot[]): Promise<ScheduleOutcome> {
  void slots;
  return Promise.resolve('unavailable');
}

/** Nothing was ever scheduled, so there is nothing to cancel and no pretending. */
export function cancelReminder(): Promise<ScheduleOutcome> {
  return Promise.resolve('unavailable');
}

/** The trial-ending reminder has no OS here either, so nothing is scheduled and it says so. */
export function scheduleTrialReminderSlot(slot: TrialReminderSlot): Promise<ScheduleOutcome> {
  void slot;
  return Promise.resolve('unavailable');
}

/** Nothing was scheduled, so nothing is cancelled. */
export function cancelTrialReminderSlot(): Promise<ScheduleOutcome> {
  return Promise.resolve('unavailable');
}

/** No trial reminder is ever pending on the web. */
export function pendingTrialReminder(): Promise<string | null> {
  return Promise.resolve(null);
}

/** No reminder can be tapped here. The answer is a stop that stops nothing. */
export function onReminderTapped(handler: ReminderTapHandler): () => void {
  void handler;
  return () => {};
}
