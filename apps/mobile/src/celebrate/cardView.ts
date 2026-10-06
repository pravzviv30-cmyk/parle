/**
 * What a takeover card says and shows, decided apart from drawing it.
 *
 * Every word comes from `game/copy.ts` (the purchase line from the wall's own
 * copy, `wall/wallCopy.ts`, which owns it), and every number from the moment's
 * own data, which the game pipeline read back from disk before it published
 * (README Part 6; founder KEEP rule: no invented numbers). A level is a number,
 * never a rank name. Pure, so `cardView.test.ts` can hold every line to the
 * streak copy rules.
 */

import { badgeFor, type Badge } from '@luvani/core';

import { GAME_COPY } from '../game/copy.ts';
import { WALL_READY } from '../wall/wallCopy.ts';
import type { CelebrationEvent, TakeoverType } from './events.ts';
import type { TakeoverCard } from './queue.ts';
import type { TimelineId } from './timelines.ts';

/** The ground a card sits on. Ink words on paper, sun and mint; white words on blue and coral. */
export type CardGround = 'paper' | 'blue' | 'coral' | 'sun' | 'mint';

export interface CardView {
  readonly ground: CardGround;
  readonly timeline: TimelineId;
  /** The big number and its unit, or null for a card without one. */
  readonly hero: { readonly value: number; readonly unit: string } | null;
  /** The card's header: focused and announced when it appears. */
  readonly title: string;
  /** For a level, the title it replaces as the new one arrives; otherwise null. */
  readonly titleBefore: string | null;
  readonly lines: readonly string[];
  /** The badges a badge card draws, one medal each. */
  readonly badges: readonly Badge[];
  /** Moments past the budget, one line each under "Also today". */
  readonly rows: readonly string[];
  /** What a screen reader hears when the card appears: the title and the main value. */
  readonly announce: string;
}

const GROUND: Readonly<Record<TakeoverType, CardGround>> = {
  'purchase-confirmed': 'mint',
  'streak-milestone': 'coral',
  'streak-extended': 'paper',
  'quest-chest': 'sun',
  'level-up': 'blue',
  'badge-earned': 'paper',
};

/** Two sentences said as one, with one stop between them however the first one ends. */
export function spoken(parts: readonly (string | null)[]): string {
  return parts
    .filter((part): part is string => part !== null && part.trim() !== '')
    .map((part) => part.trim())
    .map((part, i, all) => (i < all.length - 1 && !/[.?!]$/.test(part) ? `${part}.` : part))
    .join(' ');
}

const streakValue = (current: number): string => `${current} ${GAME_COPY.streak.label}`;

/** One "Also today" line for a moment that did not get its own card. */
export function rowFor(event: CelebrationEvent): string | null {
  switch (event.type) {
    case 'purchase-confirmed':
      return WALL_READY;
    case 'streak-milestone':
    case 'streak-extended':
      return streakValue(event.data.current);
    case 'quest-chest':
      return GAME_COPY.chest.title;
    case 'level-up':
      return GAME_COPY.level.title(event.data.level);
    case 'badge-earned': {
      const badge = badgeFor(event.data.id);
      return badge === null ? null : GAME_COPY.badge.row(badge.title);
    }
    default:
      return null;
  }
}

/**
 * The title a card shows at this instant. A level card shows the old level
 * until its title beat, then the new one, but never while a screen reader is
 * on: changing the header under the reader would take its place away, and the
 * header already says the new level with the main value. Until the OS has
 * answered (null) the swap plays, so a sighted learner never sees the new
 * level, then the old, then the new again.
 */
export function shownTitle(view: CardView, at: { readonly titleReached: boolean; readonly screenReader: boolean | null }): string {
  if (view.titleBefore === null || at.titleReached || at.screenReader === true) return view.title;
  return view.titleBefore;
}

export function cardView(card: TakeoverCard): CardView {
  const rows = card.also.map(rowFor).filter((row): row is string => row !== null);
  const base = { ground: GROUND[card.type], timeline: card.type, rows, titleBefore: null, badges: [] as Badge[] };
  const first = card.shows[0];
  if (first === undefined) throw new Error('a card with nothing to show');

  switch (first.type) {
    case 'streak-extended': {
      const { current, lifetimeDays } = first.data;
      const title = GAME_COPY.streak.line(current);
      return { ...base, hero: { value: current, unit: GAME_COPY.streak.label }, title, lines: [GAME_COPY.streak.lifetime(lifetimeDays)], announce: spoken([title, streakValue(current)]) };
    }
    case 'streak-milestone': {
      const { milestone, lifetimeDays } = first.data;
      const title = GAME_COPY.streak.milestone(milestone);
      return { ...base, hero: { value: milestone, unit: GAME_COPY.streak.label }, title, lines: [GAME_COPY.streak.lifetime(lifetimeDays)], announce: spoken([title, streakValue(milestone)]) };
    }
    case 'quest-chest': {
      const title = GAME_COPY.chest.title;
      const line = GAME_COPY.chest.line(first.data.xp);
      return { ...base, hero: null, title, lines: [line], announce: spoken([title, line]) };
    }
    case 'level-up': {
      const title = GAME_COPY.level.title(first.data.level);
      return {
        ...base,
        hero: null,
        title,
        titleBefore: GAME_COPY.level.title(first.data.before),
        lines: [GAME_COPY.level.line],
        announce: spoken([title, GAME_COPY.level.line]),
      };
    }
    case 'badge-earned': {
      const badges = card.shows
        .map((event) => (event.type === 'badge-earned' ? badgeFor(event.data.id) : null))
        .filter((badge): badge is Badge => badge !== null);
      const title = badges.map((badge) => badge.title).join(', ');
      const lines = badges.map((badge) => badge.line);
      return { ...base, badges, hero: null, title, lines, announce: spoken([title, lines[0] ?? null]) };
    }
    case 'purchase-confirmed':
      return { ...base, hero: null, title: WALL_READY, lines: [], announce: WALL_READY };
    default:
      throw new Error(`no card for ${first.type}`);
  }
}
