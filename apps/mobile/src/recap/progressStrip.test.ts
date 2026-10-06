/**
 * The recap's progress strip (come alive, core loop 2.9): three things the
 * finished conversation changed, every number read back from disk by the
 * settle, and nothing at all rather than a number nobody stored.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StreakState } from '@luvani/core';

import { streakGuiltIn } from '../copy/guilt.ts';
import { GAME_COPY } from '../game/copy.ts';
import type { GameDelta } from '../game/delta.ts';
import { progressStripView } from './progressStrip.ts';

const RUN: StreakState = { current: 4, today: 'practised', runStart: '2026-10-03', longest: 6, lifetimeDays: 12, lastPracticeDay: '2026-10-06', gap: [], coveredInRun: [] };

function delta(change: { xp?: Partial<GameDelta['xp']>; goal?: Partial<GameDelta['goal']>; current?: number } = {}): GameDelta {
  return {
    key: 'sitting:convo:1791000000000',
    source: 'convo',
    at: 1_791_000_000_000,
    activeMs: 540_000,
    xp: { earned: 24, counted: 24, capped: false, bonus: 0, questXp: 0, totalBefore: 100, totalAfter: 124, ...change.xp },
    goal: { target: 10, minutesBefore: 3, minutesAfter: 12, metNow: true, ...change.goal },
    streak: { before: RUN, after: { ...RUN, current: change.current ?? RUN.current }, extendedNow: false, milestone: null, restoredBy: null },
    quests: { completedNow: [], chestNow: false, done: 0 },
    level: { before: 3, after: 3 },
    badges: [],
  };
}

test('the recap strip shows only what the settle read back, and nothing rather than a number nobody stored', () => {
  // No delta yet, or never: no strip at all.
  assert.equal(progressStripView(null), null, 'a strip was drawn before the settle said anything');

  const full = progressStripView(delta())!;
  assert.deepEqual(full.xp, { value: 24, label: GAME_COPY.endCard.xpLabel }, 'the XP is not the XP the settle credited');
  assert.deepEqual(full.streak, { value: 4, label: GAME_COPY.streak.label });
  assert.deepEqual(full.goal, { from: 0.3, to: 1, line: GAME_COPY.goal.reached });
  assert.equal(full.capLine, null);

  // The cap held some back: the strip says so and counts only what was credited.
  const capped = progressStripView(delta({ xp: { earned: 40, counted: 6, capped: true } }))!;
  assert.equal(capped.xp?.value, 6, 'the strip counts XP the daily limit held back');
  assert.equal(capped.capLine, GAME_COPY.endCard.capLine);

  // Each part only when its number exists.
  const bare = progressStripView(delta({ xp: { earned: 0, counted: 0 }, goal: { target: null }, current: 0 }));
  assert.equal(bare, null, 'a strip of nothing was drawn');
  const noXp = progressStripView(delta({ xp: { earned: 0, counted: 0 } }))!;
  assert.equal(noXp.xp, null, 'a +0 was drawn');
  const partway = progressStripView(delta({ goal: { minutesBefore: 2, minutesAfter: 7, metNow: false } }))!;
  assert.deepEqual(partway.goal, { from: 0.2, to: 0.7, line: GAME_COPY.goal.progress(7, 10) });

  // Every word is the game copy's, and none of it threatens.
  for (const line of [full.xp!.label, full.streak!.label, full.goal!.line, partway.goal!.line, capped.capLine!]) {
    assert.equal(streakGuiltIn(line), undefined, `"${line}" carries a word the copy rules ban`);
    assert.doesNotMatch(line, /[—–·]/);
  }
});
