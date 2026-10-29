/**
 * After a session, the Celebration and the Recap band, decided apart from
 * drawing them (2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and
 * B-Recap). Pure, so each rule has a test.
 *
 * Every number is one somebody measured: the minutes are the room's own active
 * clock for this sitting, the phrases are the recap's, the XP is the settled
 * delta's, the day is the streak after this sitting and the bars are this
 * calendar week's active days (`progress/momentum.ts`). A number that was not
 * measured leaves its tile out rather than showing a zero.
 */

import { calendarWeekFrom, rhythmSentence, type WeekDay } from '../progress/momentum.ts';

export interface StatTile {
  key: 'minutes' | 'phrases' | 'xp';
  value: string;
  label: string;
  ground: 'sun' | 'card' | 'mint';
}

/** The three stat tiles, in the artboard's order, each only when measured. */
export function afterSessionStats(input: { activeSec: number | null; phrases: number; xp: number | null }): StatTile[] {
  const tiles: StatTile[] = [];
  const { activeSec, phrases, xp } = input;
  if (activeSec !== null && Number.isFinite(activeSec) && activeSec > 0) {
    const minutes = Math.floor(activeSec / 60);
    tiles.push({ key: 'minutes', value: minutes < 1 ? 'Under 1 min' : `${minutes} min`, label: 'spoken', ground: 'sun' });
  }
  if (Number.isSafeInteger(phrases) && phrases > 0) {
    tiles.push({ key: 'phrases', value: String(phrases), label: phrases === 1 ? 'new phrase' : 'new phrases', ground: 'card' });
  }
  if (xp !== null && Number.isSafeInteger(xp) && xp > 0) {
    tiles.push({ key: 'xp', value: `+${xp}`, label: 'XP', ground: 'mint' });
  }
  return tiles;
}

/** "Day n." and the week in a sentence, under the flame. Null with neither. */
export function streakLine(streak: number | null, week: readonly WeekDay[] | null): string | null {
  const day = streak !== null && Number.isSafeInteger(streak) && streak > 0 ? `Day ${streak}.` : null;
  // A settled day of the streak is today, so today is a day of French in the week too (F937).
  const counted = day !== null && week !== null ? withToday(week) : week;
  const said = counted !== null && counted.length > 0 ? rhythmSentence(counted) : null;
  if (day === null && said === null) return null;
  return [day, said].filter((part) => part !== null).join(' ');
}

/** The week with today, the last day not ahead, marked done. */
function withToday(week: readonly WeekDay[]): readonly WeekDay[] {
  const today = week.reduce((last, day, index) => (day.state === 'ahead' ? last : index), -1);
  return week.map((day, index) => (index === today ? { ...day, state: 'done' } : day));
}

/** The seven bars: lit for a day with French in it, Monday to Sunday. */
export function weekBars(week: readonly WeekDay[] | null): boolean[] | null {
  return week === null || week.length === 0 ? null : week.map((day) => day.state === 'done');
}

/** The Recap band's eyebrow: the scene, and its minutes when measured. Commas, never middots. */
export function recapEyebrow(title: string, activeSec: number | null): string {
  if (activeSec === null || !Number.isFinite(activeSec) || activeSec < 60) return title;
  return `${title}, ${Math.floor(activeSec / 60)} min`;
}

/** The speaker under a learner's line plays the tutor's voice saying it, and says so. */
export const HEAR_IT_SAID = 'Hear it said';

/** The Celebration's words (B-Celebrate), from the scene the learner finished. */
export function celebrateView(input: {
  mission: { title: string; canDoEn: string };
  independent: boolean;
  stamp: 'first' | 'again' | 'neutral' | null;
  next: { canDoEn: string } | null;
}): { eyebrow: string; ability: string; line: string | null; postcardEyebrow: string; next: string | null } {
  const { mission, independent, stamp, next } = input;
  return {
    eyebrow: 'You can now',
    ability: mission.canDoEn,
    line: independent ? `Earned on your own in ${mission.title}.` : null,
    postcardEyebrow: stamp === 'first' || stamp === 'neutral' ? 'New postcard' : 'Your postcard',
    next: next === null ? null : `Next: ${next.canDoEn}`,
  };
}

/** The most fixes the Recap shows: the ones that matter now first, each said once. */
export const MAX_SMALL_FIXES = 3;

/** Small fixes from `recap.fixes`: plural, matters-now first, no repeats, no empty ones. */
export function smallFixes<F extends { quote: string; better: string; weight: 'matters-now' | 'minor' }>(fixes: readonly F[]): F[] {
  const seen = new Set<string>();
  const kept: F[] = [];
  for (const fix of [...fixes].sort((a, b) => (a.weight === b.weight ? 0 : a.weight === 'matters-now' ? -1 : 1))) {
    if (!fix.quote.trim() || !fix.better.trim() || fix.quote.trim() === fix.better.trim()) continue;
    const key = `${fix.quote.trim()}\u0000${fix.better.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(fix);
  }
  return kept.slice(0, MAX_SMALL_FIXES);
}

/**
 * This week from the practice days the streak counts (F937): every day key in
 * the activity history, zero-XP sittings included, read after the settle.
 */
export function recapWeekFrom(days: readonly string[], now: number): readonly WeekDay[] {
  const at: { at: number }[] = [];
  for (const day of days) {
    const [y, m, d] = day.split('-').map(Number);
    if (y !== undefined && m !== undefined && d !== undefined) at.push({ at: new Date(y, m - 1, d, 12).getTime() });
  }
  return calendarWeekFrom(at, now);
}
