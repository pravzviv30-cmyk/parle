/**
 * Where a tap on a reminder lands (Come alive, README Part 5.F).
 *
 * Every line opens the place it promises: "Today's phrase is ready" opens
 * today's phrase, the pause note opens Settings where the reminder can be
 * turned back on, and every other line opens Home. Pure, so the promise is held
 * by a test; `App.tsx` queues the route and follows it once the navigator is
 * ready, which is how a tap that launched the app from cold still lands.
 */

import type { ReminderOpen } from './reminder.ts';

/** A route the root navigator can follow. */
export type ReminderRoute =
  | { name: 'Tabs'; params: { screen: 'Home' } }
  | { name: 'DailyPractice'; params: { id: string } }
  | { name: 'Settings' };

const OPENS: readonly ReminderOpen[] = ['home', 'daily-phrase', 'settings'];

/** What a notification's data says it opens, or Home for anything this build did not write. */
export function reminderOpenOf(value: unknown): ReminderOpen {
  return OPENS.includes(value as ReminderOpen) ? (value as ReminderOpen) : 'home';
}

/**
 * The route for a tap. `phraseId` is today's phrase, the one Home shows, or
 * null when it could not be worked out, when the phrase line opens Home rather
 * than a phrase that is not today's.
 */
export function routeForReminder(open: ReminderOpen, phraseId: string | null): ReminderRoute {
  if (open === 'settings') return { name: 'Settings' };
  if (open === 'daily-phrase' && phraseId !== null && phraseId.length > 0) return { name: 'DailyPractice', params: { id: phraseId } };
  return { name: 'Tabs', params: { screen: 'Home' } };
}
