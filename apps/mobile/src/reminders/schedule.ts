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
 * quietly. A no-op that returns success is worse than no feature: the switch in
 * Profile goes on, the store records that the learner asked for a reminder, and
 * nothing ever arrives. Weeks later they conclude the app is broken, and they
 * are right, and no log anywhere says so.
 *
 * A browser could deliver something through the Notifications API, and this
 * file deliberately does not. The reminder is a phone thing: it has to survive
 * the tab being closed, which needs a service worker and a whole second
 * delivery path with its own permission model and its own failure modes, for a
 * surface almost nobody runs Parle on. Reporting `unavailable` is the small
 * honest answer; a half-working web notification is the expensive dishonest
 * one. If that changes, it changes here and nowhere else.
 *
 * ## Why permission reads `denied` and not `undetermined`
 *
 * `reminderRow` turns `undetermined` into "flipping this switch will raise a
 * system dialog". On the web that dialog never comes, so the row would sit
 * there inviting a tap that does nothing: a dead switch, which is the exact
 * thing F231 exists to prevent. `denied` draws an off switch that asks for
 * nothing, which is the truth. The sentence `denied` carries names phone
 * settings and is wrong on a laptop, so `REMINDERS_AVAILABLE` is what a screen
 * keys on to leave the row out altogether.
 *
 * ## What this module is not responsible for
 *
 * It does not ask whether the learner has practised, and it could not: nothing
 * under `reminders/` may import the stores that know (F227, enforced by the
 * source scan in `reminder.test.ts`). It also does not check permission before
 * scheduling. The caller asks first, because the caller is the one that owns
 * the order the dialog appears in, and a permission check buried in a scheduler
 * is a second opinion about a decision `reminderRow` already makes.
 */

import type { ReminderPermission, ReminderTimeId } from './reminder.ts';

/**
 * Whether this build can put a reminder in front of anyone.
 *
 * A screen keys on this to decide whether the row belongs on the page at all.
 * Hiding a row is honest here in a way that a disabled switch is not: there is
 * nothing to enable, and nothing the learner could do about it.
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
 * The same discipline as `PersistAck` in storage/ack.ts, and the same reason: a
 * caller that cannot tell "the OS took it" from "nothing happened" will show a
 * switch that is on over a reminder that does not exist.
 *
 * - `done` means the OS accepted the request without throwing. That is the
 *   strongest claim available on-device, and it is not a promise that a
 *   notification will be presented: permission can be revoked afterwards, and
 *   delivery is the platform's business.
 * - `unavailable` means this build has no scheduler. Not a failure, and not
 *   something to retry.
 * - `failed` means the platform refused a request it could have taken.
 *
 * Declared in both halves rather than shared, because neither half can import
 * the other: Metro would resolve `./schedule.ts` from inside the native module
 * back to the native module. `schedule.test.ts` compares the two declarations.
 */
export type ScheduleOutcome = 'done' | 'unavailable' | 'failed';

/** What the OS would allow, if there were an OS notification channel to allow. */
export function reminderPermission(): Promise<ReminderPermission> {
  return Promise.resolve('denied');
}

/** No dialog exists to raise, so nothing is raised and the answer does not move. */
export function askReminderPermission(): Promise<ReminderPermission> {
  return Promise.resolve('denied');
}

/**
 * Accepts the preset so the two halves share one signature, and schedules
 * nothing. The argument is read and discarded on purpose: a parameter the web
 * half omitted would let the native half's signature drift unnoticed.
 */
export function scheduleReminder(time: ReminderTimeId): Promise<ScheduleOutcome> {
  void time;
  return Promise.resolve('unavailable');
}

/** Nothing was ever scheduled, so there is nothing to cancel and no pretending. */
export function cancelReminder(): Promise<ScheduleOutcome> {
  return Promise.resolve('unavailable');
}
