/**
 * Which pending notifications belong to which of this app's schedules.
 *
 * Two things schedule local notifications: the daily practice plan
 * (`practice:{day}`, `plan.ts`) and the one trial-ending reminder
 * (`trial-end:{instant}`, `trialReminder.ts`). Each one replaces and cancels
 * only its own identifiers, so a daily re-plan never takes the trial reminder
 * away and turning the trial reminder off never takes a practice day away.
 *
 * Pure, so the rule is held by `trialReminder.test.ts` with no OS: the native
 * half (`schedule.native.ts`) only feeds it the pending identifiers.
 */

/** The daily plan's slots. Mirrors `plan.ts` `SLOT_PREFIX`, which a test holds equal. */
export const PRACTICE_PREFIX = 'practice:';

/** The trial-ending reminder. Never starts with the practice prefix. */
export const TRIAL_PREFIX = 'trial-end:';

/** Which of this app's schedules an identifier belongs to, or null for one it did not write. */
export type NotificationKind = 'practice' | 'trial';

export function kindOfNotification(id: string): NotificationKind | null {
  if (id.startsWith(PRACTICE_PREFIX)) return 'practice';
  if (id.startsWith(TRIAL_PREFIX)) return 'trial';
  return null;
}

/** The pending identifiers a cancel of `kind` may touch, and nothing else. */
export function idsToCancel(pending: readonly string[], kind: NotificationKind): string[] {
  return pending.filter((id) => kindOfNotification(id) === kind);
}

/** The identifier of a trial reminder that fires at `at`. */
export function trialReminderId(at: number): string {
  return `${TRIAL_PREFIX}${at}`;
}
