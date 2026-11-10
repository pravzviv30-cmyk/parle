/**
 * After a session, the Celebration and the Recap band, decided apart from
 * drawing them (2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and
 * B-Recap). Pure, so each rule has a test.
 *
 * Every number is one somebody measured: the minutes are the room's own active
 * clock for this sitting, the phrases are the recap's, the XP is the settled
 * delta's. A number that was not measured leaves its tile out rather than
 * showing a zero.
 */

import type { SceneTile } from '../celebrate/EndScene.tsx';
import type { ClosureFocus } from '../conversationPacks/closure.ts';
import { KEEPSAKE_COPY } from '../live/keepsake.ts';
import { SOUND_FOCUS_LABEL, exampleFirstHeading } from '../tutor/soundExample.ts';

export interface StatTile {
  key: 'minutes' | 'phrases' | 'xp';
  label: string;
  /** The whole number the tile counts up to (0 under a minute, which reads "<1"). */
  count: number;
}

/** The three stat tiles, in the artboard's order, each only when measured. */
export function afterSessionStats(input: { activeSec: number | null; phrases: number; xp: number | null }): StatTile[] {
  const tiles: StatTile[] = [];
  const { activeSec, phrases, xp } = input;
  if (activeSec !== null && Number.isFinite(activeSec) && activeSec > 0) {
    const minutes = Math.floor(activeSec / 60);
    tiles.push({ key: 'minutes', label: 'minutes', count: minutes });
  }
  if (Number.isSafeInteger(phrases) && phrases > 0) {
    tiles.push({ key: 'phrases', label: phrases === 1 ? 'new phrase' : 'new phrases', count: phrases });
  }
  if (xp !== null && Number.isSafeInteger(xp) && xp > 0) {
    tiles.push({ key: 'xp', label: 'XP', count: xp });
  }
  return tiles;
}

/** The sitting's active seconds, only when a reply settled it: with no reply nothing is measured (sessionCredit). */
export function measuredSec(settles: boolean, activeSec: number | null): number | null {
  return settles ? activeSec : null;
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

/** The recap's title (UI-020): with no reply the credit line stands alone; otherwise the headline, the credit line under it. */
export function recapTitle(settles: boolean): { title: 'headline' | 'line'; lineUnder: boolean } {
  return settles ? { title: 'headline', lineUnder: true } : { title: 'line', lineUnder: false };
}

/** The stat tiles on EndScene's row: each its coin, its number and word, and no tick (the moment's chime is the one sound). */
export function recapTiles(stats: readonly StatTile[]): SceneTile[] {
  return stats.map((tile) => ({
    id: tile.key,
    coin: tile.key === 'xp' ? 'xp' : tile.key === 'minutes' ? 'time' : 'count',
    to: tile.count,
    format: tile.key === 'xp' ? (value: number) => `+${value}` : tile.key === 'minutes' ? (value: number) => (value < 1 ? '<1' : String(value)) : (value: number) => String(value),
    word: tile.label,
    tick: 'none',
  }));
}

/** The one focus row: a sound, or with no sound one thing to tune, or none. */
export function recapFocusRow(focus: ClosureFocus | null): { kind: 'sound' | 'other'; label: string; line: string } | null {
  if (focus === null) return null;
  if (focus.kind === 'sound') return { kind: 'sound', label: focus.source === 'live' ? SOUND_FOCUS_LABEL : KEEPSAKE_COPY.sound, line: exampleFirstHeading(focus.acoustic, focus.example) };
  return { kind: 'other', label: 'One thing to tune', line: focus.kind === 'clarity' ? focus.line : focus.fr };
}

/** The pinned footer: practise the kept phrase once it is saved, or Done; "See your journey" only on an earned scene. */
export function recapFooter(input: { kept: boolean; practice: boolean; saved: boolean; earned: boolean; journey: boolean }): { primary: 'practise' | 'done'; practiseDisabled: boolean; journey: 'beside' | 'under' | null } {
  const practise = input.kept && input.practice;
  return {
    primary: practise ? 'practise' : 'done',
    practiseDisabled: practise && !input.saved,
    journey: input.earned && input.journey ? (practise ? 'beside' : 'under') : null,
  };
}
