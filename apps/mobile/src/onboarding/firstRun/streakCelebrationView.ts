/**
 * The streak celebration reads saved progress. Opening, formatting or revisiting
 * it cannot finish a practice or award a day.
 *
 * Calendar keys have already gone through the app's local-day rule. Date
 * formatting uses UTC only to preserve that calendar date in every locale;
 * reinterpreting the key in the device's time zone could show the previous day.
 */
import { addDays, isStreakMilestone, nextStreakMilestone, type DayKey } from '@luvani/core';
import { celebrationKey } from '../../celebrate/events.ts';
import type { GuestStreak } from '../guestProgress.ts';

export interface CelebrationDay {
  readonly day: DayKey;
  /** Abbreviated weekday in the device's locale. */
  readonly label: string;
  readonly isToday: boolean;
  readonly completed: boolean;
  readonly state: 'practised' | 'today-open' | 'ahead';
  /** Full weekday, date and completion state; ambiguous initials are never spoken. */
  readonly accessibilityLabel: string;
}

export interface StreakCelebrationView {
  readonly achievementDay: DayKey;
  /** Same key as the persisted finish's celebration; rerenders do not invent a new event. */
  readonly eventKey: string;
  readonly current: number;
  readonly headline: string;
  readonly encouragement: string;
  readonly summary: string;
  readonly countLabel: string;
  readonly week: readonly CelebrationDay[];
  readonly nextMilestone: {
    readonly days: number;
    readonly remaining: number;
    readonly title: string;
    readonly line: string;
  };
  readonly variant: 'first' | 'daily' | 'milestone';
}

/** A nearby early target, then the app's existing named milestones. No badge is created for this target. */
function nextTarget(current: number): number {
  return current < 3 ? 3 : nextStreakMilestone(current);
}

/** Null while there is no authoritative run, including before the first finished practice. */
export function streakCelebrationView(
  streak: GuestStreak | null,
  today: DayKey,
  locale?: string | readonly string[],
): StreakCelebrationView | null {
  if (streak === null) return null;
  const locales = typeof locale === 'string' || locale === undefined ? locale : [...locale];
  const shortWeekday = new Intl.DateTimeFormat(locales, { weekday: 'short', timeZone: 'UTC' });
  const fullDate = new Intl.DateTimeFormat(locales, { dateStyle: 'full', timeZone: 'UTC' });
  const dateOf = (day: DayKey): Date => new Date(`${day}T12:00:00.000Z`);
  const first = streak.current === 1;
  const isToday = streak.achievementDay === today;
  const achievementWhen = isToday ? 'today' : streak.achievementDay === addDays(today, -1) ? 'yesterday' : `on ${fullDate.format(dateOf(streak.achievementDay))}`;
  const week = Array.from({ length: 7 }, (_, index): CelebrationDay => {
    const day = addDays(streak.achievementDay, index);
    const completed = index === 0;
    const dayIsToday = day === today;
    const state = completed ? 'practised' : dayIsToday ? 'today-open' : 'ahead';
    const completion = completed ? 'Practice completed' : dayIsToday ? 'Ready to practise' : 'Upcoming, not completed';
    return {
      day,
      label: shortWeekday.format(dateOf(day)),
      isToday: dayIsToday,
      completed,
      state,
      accessibilityLabel: `${fullDate.format(dateOf(day))}${dayIsToday ? ', today' : ''}. ${completion}.`,
    };
  });
  const days = nextTarget(streak.current);
  const remaining = days - streak.current;
  return {
    achievementDay: streak.achievementDay,
    eventKey: celebrationKey.streak(streak.achievementDay),
    current: streak.current,
    headline: first ? 'Your streak has started.' : 'Your streak continues.',
    encouragement: 'Practise every day to carry on the streak.',
    summary: first ? isToday ? 'Your streak has started today' : `Your streak started ${achievementWhen}` : `Your streak continued ${achievementWhen}`,
    countLabel: `${streak.current}-day streak`,
    week,
    nextMilestone: {
      days,
      remaining,
      title: `Next milestone: ${days} days`,
      line: `${remaining} more ${remaining === 1 ? 'day' : 'days'} to go`,
    },
    variant: first ? 'first' : isStreakMilestone(streak.current) ? 'milestone' : 'daily',
  };
}
