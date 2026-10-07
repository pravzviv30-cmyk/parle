/**
 * How Home's numbers move while Home stays on screen, and when Home may draw a
 * new one at all (F767; retention 1.6).
 *
 * Home is a tab, so it stays mounted under every screen pushed over it, and
 * the game layer reads again the moment a sitting settles, while the sitting
 * still covers Home. `homeSeen.ts` decides where a number starts the first
 * time Home draws it; this file decides everything after that.
 *
 * - **Only where the learner can see it.** A new value is drawn only while
 *   Home is the screen on top, the app is in front, nothing holds the
 *   celebration queue (a sitting, an end card, a sheet) and no takeover is on
 *   screen, and only once that has held for `DRAW_SETTLE_MS`, long enough for
 *   the next card of a run of takeovers to appear. Until then Home keeps what
 *   it drew. So the flame, the ring and the chip tick up in front of the
 *   learner after the takeovers rather than behind them, and `home-seen`
 *   remembers only what was on screen.
 * - **Never down.** A counter that rises counts on from where it stands. One
 *   that fell, and a day's number on a new day, is mounted again at its value
 *   under a new mount number, which the card keys the counter on, so a
 *   mounted counter is never handed a lower value to run back to. A new day
 *   starts the day's numbers at nought, and a rise since midnight counts up
 *   from nought.
 * - **Nothing invented.** A number that was not drawn before is drawn as it
 *   stands.
 *
 * Pure, so `homeDraw.test.ts` holds it without a renderer.
 */

import type { DayKey } from '@luvani/core';

import { BURST_WINDOW_MS, RESUME_AFTER_MS } from '../celebrate/queue.ts';
import type { QuestsCardView } from '../game/questsCardView.ts';
import type { TodayHeroView } from '../game/todayHeroView.ts';
import { DAILY_FIELDS, SHOWN_FIELDS, startFrom, type HomeSeen, type ShownField, type ShownValues } from './homeSeen.ts';

/** One number as drawn. */
export interface Counter {
  /** Where the counter started when it was last mounted. */
  from: number;
  /** The value it is drawn at. */
  to: number;
  /** Moves each time the counter is mounted again at a value. The card keys the counter on it. */
  mount: number;
}

/** What Home has drawn: the day it drew for, and each number. */
export interface HomeDraw {
  day: DayKey;
  counters: Partial<Record<ShownField, Counter>>;
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** The first draw since Home mounted: each number starts where `home-seen` says, never above itself. */
export function firstDraw(seen: HomeSeen | null, fresh: ShownValues, today: DayKey): HomeDraw {
  const counters: Partial<Record<ShownField, Counter>> = {};
  for (const field of SHOWN_FIELDS) {
    const value = fresh[field];
    if (!isCount(value)) continue;
    counters[field] = { from: Math.min(startFrom(seen, field, value, today), value), to: value, mount: 0 };
  }
  return { day: today, counters };
}

/**
 * The draw after `drawn`, for `fresh` on `today`. A rise counts on from where
 * the counter stands; a fall, and a day's number on a new day, mounts the
 * counter again; a number no longer drawn is dropped, and one drawn for the
 * first time is drawn as it stands.
 */
export function nextDraw(drawn: HomeDraw, fresh: ShownValues, today: DayKey): HomeDraw {
  const newDay = drawn.day !== today;
  const counters: Partial<Record<ShownField, Counter>> = {};
  for (const field of SHOWN_FIELDS) {
    const value = fresh[field];
    if (!isCount(value)) continue;
    const was = drawn.counters[field];
    if (was === undefined) counters[field] = { from: value, to: value, mount: 0 };
    else if (newDay && DAILY_FIELDS.includes(field)) counters[field] = { from: 0, to: value, mount: was.mount + 1 };
    else if (value === was.to) counters[field] = was;
    else if (value > was.to) counters[field] = { from: was.from, to: value, mount: was.mount };
    else counters[field] = { from: value, to: value, mount: was.mount + 1 };
  }
  return { day: today, counters };
}

/** True when the counter rose to where it is: it counts up, and the flame may light. */
export function risen(counter: Counter | undefined): boolean {
  return counter !== undefined && counter.to > counter.from;
}

/** True when the new draw shows something the last one did not, so it is worth remembering. */
export function drawMoved(before: HomeDraw | null, after: HomeDraw): boolean {
  if (before === null || before.day !== after.day) return true;
  for (const field of SHOWN_FIELDS) {
    if (before.counters[field]?.to !== after.counters[field]?.to) return true;
  }
  return false;
}

/** What Home's gate reads, each from its own source. */
export interface DrawGate {
  /** Home is the screen on top. */
  focused: boolean;
  /** The app is in front. */
  active: boolean;
  /** A sitting, an end card or a sheet holds the celebration queue. */
  held: boolean;
  /** A takeover card is on screen over Home. */
  takeover: boolean;
}

/** Whether the learner can see Home's numbers now. */
export function mayDraw(gate: DrawGate): boolean {
  return gate.focused && gate.active && !gate.held && !gate.takeover;
}

/**
 * How long the gate stays open before Home draws a new value: the queue's
 * pause between one takeover and the next, and its window for gathering a
 * burst, so a run of cards that has not finished yet is waited for.
 */
export const DRAW_SETTLE_MS = RESUME_AFTER_MS + BURST_WINDOW_MS;

/** The goal ring's fraction is drawn and remembered in thousandths, whole numbers like the rest. */
export const RING_STEPS = 1000;

/** The numbers the hero draws: the run (nought with none), today's minutes, the ring and the level. */
export function heroCounts(hero: TodayHeroView): ShownValues {
  const counts: ShownValues = { streak: hero.flame.count ?? 0, minutes: hero.goal.minutes, level: hero.level.level };
  if (hero.goal.fraction !== null) counts.ring = Math.round(hero.goal.fraction * RING_STEPS);
  return counts;
}

/** The one number the quests card draws: today's quests done. */
export function questCounts(card: QuestsCardView): ShownValues {
  return { questsDone: card.done };
}
