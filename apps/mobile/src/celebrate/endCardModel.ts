/**
 * What an end scene's tiles and rows show (`celebrate/EndScene.tsx`), decided apart from drawing it (README Part 6: the
 * finished sitting's numbers sit in place on the page, never in a takeover).
 *
 * Every number is the GameDelta's, which `game/settle.ts` read back from disk
 * after the writes landed, or the count the screen hands over from the sitting
 * it just ran. A tile appears only when its number exists: no XP tile for a
 * sitting the cap left at nothing, no time tile for a sitting nobody timed, no
 * count tile when the screen has none. Every word is `game/copy.ts`'s. Pure, so
 * `endCardModel.test.ts` can hold it.
 *
 * Finishing the day's third quest is said here and nowhere else: the quiet line
 * "All three quests done today." with the `quest` sound, on the card of the
 * sitting that finished it (founder decision D22). No chest, no takeover.
 */

import { questTitle, type QuestId } from '@luvani/core';

import { allQuestsDoneNow, type GameDelta } from '../game/delta.ts';
import { GAME_COPY } from '../game/copy.ts';
import type { TimelineId } from './timelines.ts';

export type EndTileId = 'xp' | 'time' | 'count';

export interface EndTile {
  readonly id: EndTileId;
  /** The number the tile counts up to. */
  readonly value: number;
  readonly label: string;
  /** The count's whole, drawn after it ("4/5" first try), when the screen hands one over. */
  readonly of?: number;
}

export interface EndGoal {
  /** The ring's fraction before this sitting and after it, 0 to 1. */
  readonly from: number;
  readonly to: number;
  readonly line: string;
}

export interface EndCardView {
  readonly kicker: string;
  readonly line: string;
  readonly tiles: readonly EndTile[];
  readonly goal: EndGoal | null;
  /** "Quest complete: …" for each quest this sitting finished, in slot order. */
  readonly quests: readonly string[];
  /** "2 of 3 quests done today", when any quest is done today; at three, the one quiet line "All three quests done today.". */
  readonly questProgress: string | null;
  /** Said when the daily XP limit held some of this sitting back. */
  readonly capLine: string | null;
  /** The card's beats: `end-card-quests` (the quest sound with the quiet line) only on the sitting that finished the third quest. */
  readonly timeline: Extract<TimelineId, 'end-card' | 'end-card-quests'>;
}

const MINUTE_S = 60;
/** Under this, a time reads as minutes and seconds; from it, as whole minutes. */
const SECONDS_UP_TO_S = 10 * MINUTE_S;

/** A sitting's time, as the Time tile writes it: `m:ss` under ten minutes, `{m} min` from there. */
export function timeText(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / MINUTE_S);
  if (whole >= SECONDS_UP_TO_S) return `${minutes} min`;
  return `${minutes}:${String(whole % MINUTE_S).padStart(2, '0')}`;
}

/** The XP tile's words: a gain is always written with its plus. */
export function xpText(xp: number): string {
  return `+${Math.max(0, Math.floor(xp))}`;
}

/** A tile's figure at `value`: the XP and Time words, or the count with its whole ("4/5"). */
export function tileText(tile: EndTile, value: number): string {
  if (tile.id === 'xp') return xpText(value);
  if (tile.id === 'time') return timeText(value);
  return tile.of === undefined ? String(value) : `${value}/${tile.of}`;
}

const fraction = (minutes: number, target: number): number => Math.min(1, Math.max(0, minutes / target));

export function endCardView(
  delta: GameDelta,
  options: { readonly count?: number | null; readonly countOf?: number | null; readonly tutorName?: string | null } = {},
): EndCardView {
  const tiles: EndTile[] = [];
  // The XP this sitting itself credited: the activity XP the cap let through and
  // the fixed XP for a win nothing grades (D6). Quest XP belongs to the quests,
  // which say so in their own rows.
  const xp = Math.max(0, Math.floor(delta.xp.counted)) + Math.max(0, Math.floor(delta.xp.bonus));
  if (xp > 0) tiles.push({ id: 'xp', value: xp, label: GAME_COPY.endCard.xpLabel });
  const seconds = delta.activeMs === null ? 0 : Math.floor(delta.activeMs / 1000);
  if (seconds > 0) tiles.push({ id: 'time', value: seconds, label: GAME_COPY.endCard.timeLabel });
  const count = options.count;
  if (typeof count === 'number' && Number.isSafeInteger(count) && count > 0) {
    const of = options.countOf;
    const whole = typeof of === 'number' && Number.isSafeInteger(of) && of >= count ? { of } : {};
    tiles.push({ id: 'count', value: count, label: GAME_COPY.endCard.countLabel[delta.source], ...whole });
  }

  const target = delta.goal.target;
  const goal: EndGoal | null =
    target === null
      ? null
      : {
          from: fraction(delta.goal.minutesBefore, target),
          to: fraction(delta.goal.minutesAfter, target),
          line:
            delta.goal.metNow || delta.goal.minutesAfter >= target
              ? GAME_COPY.goal.reached
              : GAME_COPY.goal.progress(Math.floor(delta.goal.minutesAfter), target),
        };

  const tutorName = options.tutorName ?? null;
  const quests = delta.quests.completedNow.map((id: QuestId) => GAME_COPY.quests.row(questTitle(id, { tutorName, goalTarget: target })));
  const done = delta.quests.done;

  return {
    kicker: GAME_COPY.endCard.kicker,
    line: GAME_COPY.endCard.line[delta.source],
    tiles,
    goal,
    quests,
    questProgress: done > 0 ? GAME_COPY.quests.progress(done) : null,
    capLine: delta.xp.capped ? GAME_COPY.endCard.capLine : null,
    timeline: allQuestsDoneNow(delta) ? 'end-card-quests' : 'end-card',
  };
}
