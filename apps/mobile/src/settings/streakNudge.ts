/**
 * The Evening nudge on the Streak screen (2026-10-20 UI-008, artboard
 * B-Streak), decided here so the screen only lays it out.
 *
 * There is one reminder in Luvani, the daily one (`reminders/reminder.ts`):
 * at most one a day, skipped on a day already practised, early evening until
 * the learner's rhythm shows. The nudge row is that reminder's switch, drawn
 * where the streak is. It writes the same store through the same doors as
 * Settings' Daily reminder (`saveReminder`, then `replanReminders`), so the two
 * switches can never disagree.
 *
 * What the switch shows is `reminderRow`'s answer: never on unless a
 * notification would really arrive. Turning it on asks the system only when
 * the permission is undecided; a refusal draws it off with the refusal's own
 * sentence. Turning it off keeps the chosen time, so turning it back on
 * restores the part of the day the learner picked.
 */

import {
  reminderChoice,
  reminderRow,
  type ReminderPermission,
  type ReminderRow,
  type StoredReminder,
} from '../reminders/reminder.ts';

export const NUDGE_COPY = {
  title: 'Evening nudge',
  line: "One gentle reminder, only if you haven't practised",
  /** The write failed on the phone: nothing changed, and the switch says so by not moving. */
  trouble: 'Your phone did not save that. The reminder is unchanged, and you can try again.',
  /** The phone would not schedule or cancel it. */
  scheduleTrouble: 'Your phone would not change the reminder just now. You can try again.',
} as const;

export const NUDGE_LINES: readonly string[] = Object.values(NUDGE_COPY);

/** What the row draws: the switch, and the reminder's own sentence when it has one (a refusal, a pause). */
export function nudgeRow(stored: StoredReminder | null, permission: ReminderPermission): ReminderRow {
  return reminderRow(stored, permission);
}

/**
 * What to write when the learner flips the switch to `next`, against the
 * permission just read: the honest choice, and the choice to put back if the
 * phone will not schedule it. Both keep the chosen time.
 */
export function nudgeWrite(
  stored: StoredReminder | null,
  before: ReminderRow,
  next: boolean,
  fresh: ReminderPermission,
): { wanted: StoredReminder; reverted: StoredReminder } {
  const time = reminderChoice(stored?.time).value;
  const honest = reminderRow({ enabled: next, time }, fresh);
  return {
    wanted: { ...stored, enabled: honest.on, time, paused: false },
    reverted: { ...stored, enabled: before.on, time },
  };
}
