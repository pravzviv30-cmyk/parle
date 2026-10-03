import { localDayKey } from '@luvani/core';

export function lifetimeDayLine(days: readonly string[]): string {
  const count = new Set(days).size;
  return count === 0 ? 'Your first day of French starts with practice.'
    : `${count} ${count === 1 ? 'day' : 'days'} you have practised`;
}

export function weeklyDayLine(days: readonly string[], now: number): string | null {
  const today = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const from = localDayKey(start.getTime());
  const through = localDayKey(today.getTime());
  const count = new Set(days.filter(day => day >= from && day <= through)).size;
  return count === 0 ? null : `Practised on ${count} ${count === 1 ? 'day' : 'days'} this week`;
}
