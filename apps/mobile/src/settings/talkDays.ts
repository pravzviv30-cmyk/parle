/**
 * The rules behind Settings' "Talk days" row and sheet (T1.4), out of the
 * screen so they can be tested without a renderer. The day rules themselves
 * are `reminders/reminder.ts`'s; this only decides what the row and sheet do.
 */
import { TALK_DAYS_COPY, TALK_DAY_MAX, talkDayBlocked, talkDayLabel, talkDaysLine, type ReminderRow } from '../reminders/reminder.ts';

/** The row shows beside a reminder that is on (not off, paused or refused), for an account with a known plan. */
export function talkDaysRowShown(row: ReminderRow | null, offered: boolean): boolean {
  return offered && row !== null && row.on;
}

/** Talk days are on when at least one is saved. */
export function talkDaysOn(saved: readonly number[] | undefined): boolean {
  return (saved?.length ?? 0) > 0;
}

/** Save needs a day picked and no save already under way. */
export function talkDaysCanSave(picked: readonly number[], busy: boolean): boolean {
  return picked.length > 0 && !busy;
}

/** A chip press: picks or frees the day, or, on a blocked chip, changes nothing and says why. */
export function talkDayPress(picked: readonly number[], day: number): { picked: number[]; limitTapped: boolean; said: string } {
  if (talkDayBlocked(picked, day)) {
    const limit = picked.length >= TALK_DAY_MAX;
    return { picked: [...picked], limitTapped: limit, said: limit ? TALK_DAYS_COPY.limit : talkDayLabel(picked, day) };
  }
  const next = picked.includes(day) ? picked.filter((other) => other !== day) : [...picked, day];
  return { picked: next, limitTapped: false, said: talkDaysLine(next, false, TALK_DAYS_COPY.noneSettings) };
}
