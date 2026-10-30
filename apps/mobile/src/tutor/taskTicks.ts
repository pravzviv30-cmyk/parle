/**
 * A scene goal ticking, decided apart from drawing it (come alive, core loop
 * 2.7; README Part 5.E "Conversation").
 *
 * The goals under a scene's title are the agent's observations
 * (`readMissionTasks` in core), and a goal turns from to-practise to achieved
 * on the turn the learner does it. That turn is a moment: the tick pops, its
 * check draws, the row glints once, a screen reader is told which goal it was,
 * and when it was the last goal the orb ripples once before the scene's card
 * arrives. Every one of those is a transition rather than a value, so the rule
 * lives here, where the Node suite can hold it:
 *
 * - Only a goal seen unticked and then ticked moves. Goals already achieved the
 *   first time the list is seen (a reconnect, a resumed room) never animate,
 *   and neither does anything after a safety stop.
 * - The last tick is the one after which every goal is achieved. It is also the
 *   only one that holds the scene's card back, for as long as the ripple takes,
 *   and only when movement is not reduced; nothing else is ever held.
 *
 * No number is drawn and nothing is said aloud but the goal's own words: a
 * mid-session count ("2 of 3") would turn the room into a test.
 */

import type { MissionTasks } from '@luvani/core';

import { DUR } from '../motion/tokens.ts';

type Item = MissionTasks['items'][number];

/** The ids achieved now. */
export function achievedIds(items: readonly Item[]): Set<string> {
  return new Set(items.filter((item) => item.achieved).map((item) => item.id));
}

/**
 * Goals achieved now that were not before, in list order. `before` null is the
 * first look at the list: nothing in it has just happened.
 */
export function newlyAchieved(before: ReadonlySet<string> | null, items: readonly Item[]): string[] {
  if (before === null) return [];
  return items.filter((item) => item.achieved && !before.has(item.id)).map((item) => item.id);
}

/** True when this step ticked something and left every goal achieved. */
export function isFinalTick(fresh: readonly string[], items: readonly Item[]): boolean {
  return fresh.length > 0 && items.length > 0 && items.every((item) => item.achieved);
}

/**
 * How long the scene's card waits after the last tick: the orb's two ripples,
 * the second a beat behind the first (`tutor/OrbRipple.tsx`). The tick itself
 * has landed well inside it.
 */
export const FINAL_TICK_HOLD_MS = DUR.fast + DUR.reveal;

/** What a screen reader is told when goals tick, in the goals' own words. */
export function tickAnnouncement(goals: readonly string[]): string | null {
  const said = goals.map((goal) => goal.trim()).filter((goal) => goal.length > 0);
  if (said.length === 0) return null;
  return said.map((goal) => `Goal reached: ${goal.replace(/[.!?]+$/, '')}.`).join(' ');
}

/**
 * Where a conversation's ticks stand, for the orb and the scene's card. The
 * room's goal stamps draw their own ticks against their first look
 * (`freshGoals`, live/StageParts.tsx).
 */
export interface TickState {
  /** The session these belong to; another session starts again. */
  readonly session: string | null;
  /** Achieved ids at the last look, or null before the first. */
  readonly seen: ReadonlySet<string> | null;
  /** The ripple's key, set on the last tick. */
  readonly cue: string | null;
}

export const NO_TICKS: TickState = Object.freeze({ session: null, seen: null, cue: null });

/**
 * One look at the list. Returns the same state when nothing moved, so a caller
 * can skip a render; `final` is true on the look that ticked the last goal.
 */
export function ticksAfter(
  state: TickState,
  look: { session: string | null; items: readonly Item[]; stopped: boolean },
): { state: TickState; fresh: string[]; final: boolean } {
  // A stopped session moves nothing and remembers nothing new (F137).
  if (look.stopped) return { state, fresh: [], final: false };
  const current = state.session === look.session ? state : { ...NO_TICKS, session: look.session };
  const fresh = newlyAchieved(current.seen, look.items);
  const now = achievedIds(look.items);
  const seenSame = current.seen !== null && current.seen.size === now.size && [...now].every((id) => current.seen!.has(id));
  if (fresh.length === 0 && seenSame && current === state) return { state, fresh, final: false };
  const final = isFinalTick(fresh, look.items);
  return {
    state: {
      session: current.session,
      seen: now,
      cue: final ? `${look.session ?? 'room'}:${[...now].sort().join('|')}` : current.cue,
    },
    fresh,
    final,
  };
}
