import { localDayKey } from '@luvani/core';

/** Keep tiny date keys after detailed sessions age out. Never reset on a break. */
export function mergeActiveDays(entries: readonly { at: number; xp: number }[], ...histories: unknown[]): string[] {
  const days = new Set<string>();
  for (const history of histories) if (Array.isArray(history)) for (const day of history) {
    if (typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day))) days.add(day);
  }
  for (const entry of entries) if (entry.xp > 0 && Number.isFinite(entry.at)) days.add(localDayKey(entry.at));
  return [...days].sort();
}
