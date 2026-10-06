/**
 * The moments a settled sitting may celebrate, read off its GameDelta and
 * nothing else (Come alive, Phase 1, F744).
 *
 * Pure. Every event here names a fact the delta carries, and the delta is read
 * back from disk after the writes resolved, so a takeover is always about
 * something persisted (founder KEEP rule: no fake progress). The order, the
 * budget of three and the merging are the celebration host's; this only says
 * what happened.
 *
 * The end card itself is not an event: the screen draws it in place from the
 * delta. A safety stop never settles (F137), so it never reaches this file.
 */

import { QUEST_XP, localDayKey, type DayKey } from '@luvani/core';

import { celebrationKey, type CelebrationEvent, type CelebrationOrigin } from '../celebrate/events.ts';
import type { GameDelta } from './delta.ts';
import type { GameView } from './view.ts';

/**
 * The takeovers a delta earns, in the host's order, each keyed by the one key
 * table. `day` is the local day the sitting was settled on (the quest day and
 * the day a streak was extended); it defaults to the sitting's own day.
 */
export function eventsFromDelta(delta: GameDelta, origin: CelebrationOrigin, day: DayKey = localDayKey(delta.at)): CelebrationEvent[] {
  const out: CelebrationEvent[] = [];
  const at = delta.at;
  const after = delta.streak.after;

  if (delta.streak.milestone !== null) {
    // A milestone replaces the same day's plain streak moment.
    if (after.runStart !== null) {
      out.push({
        type: 'streak-milestone',
        key: celebrationKey.milestone(delta.streak.milestone, after.runStart),
        origin,
        at,
        data: { day, current: after.current, lifetimeDays: after.lifetimeDays, milestone: delta.streak.milestone, runStart: after.runStart },
      });
    }
  } else if (delta.streak.extendedNow && after.today === 'practised') {
    out.push({
      type: 'streak-extended',
      key: celebrationKey.streak(day),
      origin,
      at,
      data: { day, current: after.current, lifetimeDays: after.lifetimeDays },
    });
  }

  if (delta.quests.chestNow) {
    out.push({ type: 'quest-chest', key: celebrationKey.chest(day), origin, at, data: { day, xp: chestXpOf(delta) } });
  }

  if (delta.level.after > delta.level.before) {
    out.push({ type: 'level-up', key: celebrationKey.level(delta.level.after), origin, at, data: { before: delta.level.before, level: delta.level.after } });
  }

  for (const id of delta.badges) {
    out.push({ type: 'badge-earned', key: celebrationKey.badge(id), origin, at, data: { id } });
  }
  return out;
}

/** The chest XP this sitting credited: the quest XP it wrote beyond its quests' own. */
function chestXpOf(delta: GameDelta): number {
  return Math.max(0, delta.xp.questXp - delta.quests.completedNow.length * QUEST_XP);
}

/**
 * A durable moment rebuilt from what is true now, for the one replay the quiet
 * catch-up allows (a takeover a crash cut short). Only levels, badges and
 * milestones are durable; a day-scoped key answers null and is marked seen.
 */
export function durableEventFor(key: string, view: GameView, origin: CelebrationOrigin, at: number): CelebrationEvent | null {
  const [kind, first, second] = key.split(':');
  if (kind === 'level' && first !== undefined) {
    const level = Number(first);
    if (!Number.isSafeInteger(level) || level < 2 || level > view.level.level) return null;
    return { type: 'level-up', key, origin, at, data: { before: level - 1, level } };
  }
  if (kind === 'badge' && first !== undefined) {
    if (!view.badges.some((badge) => badge.id === first)) return null;
    return { type: 'badge-earned', key, origin, at, data: { id: first } };
  }
  if (kind === 'milestone' && first !== undefined && second !== undefined) {
    const milestone = Number(first);
    if (view.streak.runStart !== second || !Number.isSafeInteger(milestone) || milestone > view.streak.current) return null;
    return {
      type: 'streak-milestone',
      key,
      origin,
      at,
      data: { day: view.today, current: view.streak.current, lifetimeDays: view.streak.lifetimeDays, milestone, runStart: second },
    };
  }
  return null;
}
