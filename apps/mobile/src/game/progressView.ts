/**
 * What the Progress tab's game cards say (F769; README Part 5.F).
 *
 * In order down the tab: the level and its XP (`LevelXpCard`), the streak and
 * this week (`StreakSummaryCard`, which keeps the pinned weekly day line), four
 * counts (`CountsGrid`), and the badges (`BadgeShelf`). Each reads its own
 * record:
 *
 * - the level and XP from `useLevel()` and `useXp()`, never worked out here
 *   (README Part 6, `display.test.ts`); rank names are never shown;
 * - the streak and the week from the game view's practice days and covers;
 * - phrases kept and conversations from the deck and the conversation records
 *   the tab already reads; minutes from the game view (`minutesPractised`:
 *   measured active time over every finished sitting, floored, untimed
 *   practice adding nothing, the same sittings and rule as Home's goal ring);
 *   practice days from the streak's lifetime total;
 * - the badges from the awards the game store keeps for good.
 *
 * A card whose record could not be read is null and is not drawn. The badge
 * shelf shows what was earned and at most three to aim for, each with how it
 * is earned. It never says locked, remaining or collect.
 *
 * Pure, so `progressView.test.ts` holds it without a renderer.
 */

import {
  BADGES,
  badgeFor,
  localDayKey,
  weekStripFrom,
  type StreakCover,
  type XpLevel,
} from '@luvani/core';

import type { BulkIconName } from '../icons/names.ts';
import type { MedalState } from './art/shapes.ts';
import { GAME_COPY } from './copy.ts';
import type { BadgeAward } from './model.ts';
import { dateWords, dayWords, type DayCellView } from './streakScreenView.ts';
import type { GameView, XpView } from './view.ts';

export interface LevelXpCardView {
  title: string;
  /** XP into this level over the level's span, 0 to 1. */
  fraction: number;
  total: number;
  totalWords: string;
  next: string;
  /** Said once today's activity XP has reached the shown cap. */
  capped: string | null;
  label: string;
}

export function levelXpCardView(level: XpLevel | null, xp: XpView | null): LevelXpCardView | null {
  if (level === null || xp === null) return null;
  const total = Math.max(0, Math.floor(xp.total));
  const next = GAME_COPY.level.next(level.toNext, level.level + 1);
  return {
    title: GAME_COPY.level.title(level.level),
    fraction: level.levelSpan > 0 ? Math.min(1, Math.max(0, level.intoLevel / level.levelSpan)) : 0,
    total,
    totalWords: GAME_COPY.progress.xpTotal(total),
    next,
    capped: xp.todayCapped ? GAME_COPY.progress.capped : null,
    label: `${GAME_COPY.level.title(level.level)}. ${GAME_COPY.progress.xpTotal(total)}. ${next}.`,
  };
}

export interface StreakSummaryView {
  count: number;
  lit: boolean;
  words: string;
  longest: string | null;
  week: readonly DayCellView[];
  label: string;
}

export function streakSummaryView(view: Pick<GameView, 'today' | 'streak' | 'days'> | null): StreakSummaryView | null {
  if (view === null) return null;
  const { streak } = view;
  const week = weekStripFrom({ practiceDays: view.days.practiceDays, covers: view.days.covers as readonly StreakCover[], today: view.today }).map(
    (cell): DayCellView => ({ day: cell.day, state: cell.state, cover: cell.cover, mark: cell.label, label: `${cell.name}, ${dayWords(cell.state, cell.cover)}`, today: cell.day === view.today }),
  );
  const words = GAME_COPY.streakScreen.count(streak.current);
  const longest = streak.longest > 0 ? GAME_COPY.streakScreen.longest(streak.longest) : null;
  return {
    count: streak.current,
    lit: streak.today === 'practised',
    words,
    longest,
    week,
    label: `${words}. ${longest === null ? '' : `${longest}. `}Opens your streak.`,
  };
}

export type CountId = 'phrases' | 'conversations' | 'minutes' | 'days';

export interface CountTile {
  id: CountId;
  value: number;
  words: string;
  icon: BulkIconName;
  /** Where the tile opens. */
  opens: 'Phrasebook' | 'Conversations' | 'Streak';
  label: string;
}

export function countTiles(counts: { phrases: number; conversations: number; minutes: number | null; days: number | null }): CountTile[] {
  const said = GAME_COPY.progress.counts;
  const tile = (id: CountId, value: number, words: string, icon: BulkIconName, opens: CountTile['opens']): CountTile => ({
    id,
    value: Math.max(0, Math.floor(value)),
    words,
    icon,
    opens,
    label: `${Math.max(0, Math.floor(value))} ${words.toLowerCase()}`,
  });
  const tiles = [
    tile('phrases', counts.phrases, said.phrases, 'quote', 'Phrasebook'),
    tile('conversations', counts.conversations, said.conversations, 'chat', 'Conversations'),
  ];
  // The minutes and the practice days are the game view's; unread, a tile is not drawn rather than drawn at nought.
  if (counts.minutes !== null) tiles.push(tile('minutes', counts.minutes, said.minutes, 'clock', 'Streak'));
  if (counts.days !== null) tiles.push(tile('days', counts.days, said.days, 'calendar-tick', 'Streak'));
  return tiles;
}

export interface BadgeView {
  id: string;
  title: string;
  /** What was done, or for a badge ahead, how it is earned. */
  line: string;
  /** "Earned 3 October 2026", "Counted from practice already saved", or null for one ahead. */
  when: string | null;
  medal: MedalState;
  label: string;
}

export interface BadgeShelfView {
  heading: string;
  earned: readonly BadgeView[];
  /** At most three badges ahead, in the catalogue's order, each with how it is earned. */
  next: readonly BadgeView[];
  nextHeading: string;
  /** Said when nothing is earned yet. */
  empty: string | null;
}

/** Badges ahead shown at once, never the whole catalogue. */
export const NEXT_BADGES = 3;

const EARNED_MEDALS: readonly MedalState[] = ['sun', 'mint', 'blue'];

export function badgeShelfView(badges: readonly BadgeAward[] | null): BadgeShelfView | null {
  if (badges === null) return null;
  const held = new Set(badges.map((badge) => badge.id));
  // Newest first; a badge counted from practice saved before badges existed has no date and sorts last.
  const ordered = [...badges].sort((a, b) => (b.at ?? -1) - (a.at ?? -1));
  const earned: BadgeView[] = [];
  for (const award of ordered) {
    const badge = badgeFor(award.id);
    if (badge === null) continue;
    const when = award.at === null ? GAME_COPY.progress.countedFromSaved : GAME_COPY.progress.earnedOn(dateWords(localDayKey(award.at)));
    earned.push({
      id: badge.id,
      title: badge.title,
      line: badge.line,
      when,
      medal: EARNED_MEDALS[earned.length % EARNED_MEDALS.length]!,
      label: `${badge.title}. ${badge.line} ${when}.`,
    });
  }
  const next: BadgeView[] = BADGES.filter((badge) => !held.has(badge.id))
    .slice(0, NEXT_BADGES)
    .map((badge) => ({ id: badge.id, title: badge.title, line: badge.hint, when: null, medal: 'next', label: `${badge.title}. ${badge.hint}.` }));
  return {
    heading: GAME_COPY.progress.badges,
    earned,
    next,
    nextHeading: GAME_COPY.progress.nextUp,
    empty: earned.length === 0 ? GAME_COPY.progress.badgesEmpty : null,
  };
}

/**
 * Whether the tab draws its game cards: once there is practice to show. A
 * first visit with no practice day yet keeps the one first-visit line and
 * nothing empty; a learner who has practised (a daily phrase counts) sees
 * their run and their level even before anything else is kept.
 */
export function progressShowsGame(firstVisit: boolean, lifetimeDays: number | null): boolean {
  return !firstVisit || (lifetimeDays !== null && lifetimeDays > 0);
}

/** The tile each ledger row on the tab leads with. */
export function rowTile(kind: 'phrases' | 'sounds' | 'conversations' | 'goal' | 'saved'): BulkIconName {
  switch (kind) {
    case 'phrases':
      return 'quote';
    case 'sounds':
      return 'waveform';
    case 'conversations':
      return 'chat';
    case 'goal':
      return 'flag';
    case 'saved':
      return 'bookmark';
  }
}
