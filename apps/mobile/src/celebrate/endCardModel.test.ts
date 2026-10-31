/**
 * The end card's numbers and words (F743; README Part 6): a tile only when its
 * number exists, every number from the GameDelta or the screen's own count,
 * every word from the copy contract.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { StreakState } from '@luvani/core';

import { streakGuiltIn } from '../copy/guilt.ts';
import { GAME_COPY } from '../game/copy.ts';
import type { GameDelta } from '../game/delta.ts';
import { endCardView, timeText, xpText } from './endCardModel.ts';

const RUN: StreakState = { current: 3, today: 'practised', runStart: '2026-10-04', longest: 3, lifetimeDays: 9, lastPracticeDay: '2026-10-06', gap: [], coveredInRun: [] };

function delta(change: {
  source?: GameDelta['source'];
  activeMs?: number | null;
  xp?: Partial<GameDelta['xp']>;
  goal?: Partial<GameDelta['goal']>;
  quests?: Partial<GameDelta['quests']>;
} = {}): GameDelta {
  const completedNow = change.quests?.completedNow ?? [];
  const done = change.quests?.done ?? 0;
  return {
    key: 'sitting:drill:1791000000000',
    source: change.source ?? 'drill',
    at: 1_791_000_000_000,
    activeMs: change.activeMs === undefined ? 312_000 : change.activeMs,
    xp: { earned: 30, counted: 30, capped: false, bonus: 0, questXp: 0, totalBefore: 100, totalAfter: 130, ...change.xp },
    goal: { target: 10, minutesBefore: 4, minutesAfter: 9, metNow: false, ...change.goal },
    streak: { before: RUN, after: RUN, extendedNow: false, milestone: null, restoredBy: null },
    // Unless a test says otherwise, the day stood at what this sitting's own quests added to.
    quests: { completedNow, done, doneBefore: Math.max(0, done - completedNow.length), ...change.quests },
    level: { before: 3, after: 3 },
    badges: [],
  };
}

describe('the end card — F743', () => {
  test('an end card shows a tile only when its number exists', () => {
    const full = endCardView(delta(), { count: 7 });
    assert.deepEqual(
      full.tiles.map((tile) => [tile.id, tile.value, tile.label]),
      [
        ['xp', 30, GAME_COPY.endCard.xpLabel],
        ['time', 312, GAME_COPY.endCard.timeLabel],
        ['count', 7, GAME_COPY.endCard.countLabel.drill],
      ],
    );
    const bare = endCardView(delta({ activeMs: null, xp: { earned: 40, counted: 0, capped: true } }), { count: null });
    assert.deepEqual(bare.tiles, [], 'a tile was drawn for a number that does not exist');
    assert.deepEqual(endCardView(delta({ activeMs: 400 }), { count: 0 }).tiles.map((tile) => tile.id), ['xp'], 'a zero count or a sub-second time drew a tile');
    assert.equal(endCardView(delta({ source: 'convo' }), { count: 4 }).tiles[2]!.label, 'Lines you said');
    assert.equal(endCardView(delta({ source: 'review' }), { count: 4.5 }).tiles.length, 2, 'a count that is not a whole number drew a tile');
  });

  test('the XP tile counts what the sitting credited: the activity XP the cap let through and the fixed XP for an ungraded win', () => {
    const capped = endCardView(delta({ xp: { earned: 40, counted: 12, capped: true } }));
    assert.equal(capped.tiles[0]!.value, 12, 'the XP tile shows XP the daily cap held back');
    const phrase = endCardView(delta({ source: 'phrase', xp: { earned: 0, counted: 0, bonus: 5 } }));
    assert.deepEqual(phrase.tiles[0], { id: 'xp', value: 5, label: GAME_COPY.endCard.xpLabel }, "today's phrase earned its fixed XP and the card did not say so");
    const quests = endCardView(delta({ xp: { counted: 20, questXp: 25 } }));
    assert.equal(quests.tiles[0]!.value, 20, 'quest XP was counted as the sitting\'s own');
    assert.equal(xpText(12), '+12');
  });

  test('a capped sitting says so, and the goal ring draws from before to now', () => {
    assert.equal(endCardView(delta({ xp: { capped: true } })).capLine, GAME_COPY.endCard.capLine);
    assert.equal(endCardView(delta()).capLine, null);

    const partway = endCardView(delta()).goal;
    assert.deepEqual(partway, { from: 0.4, to: 0.9, line: GAME_COPY.goal.progress(9, 10) });
    const met = endCardView(delta({ goal: { minutesBefore: 8, minutesAfter: 13, metNow: true } })).goal;
    assert.deepEqual(met, { from: 0.8, to: 1, line: GAME_COPY.goal.reached }, 'the ring overflowed or the goal was not said to be reached');
    assert.equal(endCardView(delta({ goal: { target: null } })).goal, null, 'a learner with no goal was shown a ring');
  });

  test("a sitting's time reads m:ss under ten minutes and whole minutes from there", () => {
    assert.equal(timeText(5), '0:05');
    assert.equal(timeText(312), '5:12');
    assert.equal(timeText(599), '9:59');
    assert.equal(timeText(600), '10 min');
    assert.equal(timeText(1834), '30 min');
  });

  test('quest rows name each quest this sitting finished, and the day so far', () => {
    const view = endCardView(delta({ quests: { completedNow: ['finish-practice', 'conversation'], done: 2 } }), { tutorName: 'Celine' });
    assert.deepEqual(view.quests, ['Quest complete: Finish a practice', 'Quest complete: Finish a conversation with Celine']);
    assert.equal(view.questProgress, '2 of 3 quests done today');
    assert.equal(endCardView(delta({ quests: { done: 3 } })).questProgress, 'All three quests done today.');
    assert.equal(endCardView(delta()).questProgress, null);
    // The quest sound plays with the quiet line only on the sitting that finished the third quest (D22).
    assert.equal(endCardView(delta({ quests: { completedNow: ['goal'], done: 3 } })).timeline, 'end-card-quests');
    assert.equal(endCardView(delta({ quests: { done: 3 } })).timeline, 'end-card', 'a day already done played the quest sound again');
    // After a merge a day can already read three, and a sitting that then finishes a quest of its own deal did not finish the day.
    assert.equal(endCardView(delta({ quests: { completedNow: ['conversation'], done: 3, doneBefore: 3 } })).timeline, 'end-card', 'a quest finished on a day already done played the quest sound again');
    assert.equal(view.timeline, 'end-card', 'two of three quests played the quest sound');
    const xpQuest = endCardView(delta({ quests: { completedNow: ['xp'], done: 1 } })).quests[0]!;
    assert.doesNotMatch(xpQuest, /\{|\}/, 'a quest title kept a placeholder');
  });

  test('every end card line comes from the copy and never threatens', () => {
    for (const source of ['convo', 'lesson', 'drill', 'review', 'phrase', 'guest'] as const) {
      const view = endCardView(delta({ source, xp: { capped: true }, quests: { completedNow: ['goal'], done: 3 } }), { count: 2 });
      assert.equal(view.kicker, GAME_COPY.endCard.kicker);
      assert.equal(view.line, GAME_COPY.endCard.line[source]);
      const lines = [view.kicker, view.line, ...view.tiles.map((tile) => tile.label), view.goal?.line ?? '', ...view.quests, view.questProgress ?? '', view.capLine ?? ''];
      for (const line of lines) {
        assert.equal(streakGuiltIn(line), undefined, `"${line}" says "${streakGuiltIn(line) ?? ''}"`);
        assert.doesNotMatch(line, /[—–·!]/, `"${line}" carries a dash, a middot or a shout`);
      }
    }
  });

  test('a count may carry its whole ("4/5" first try), only when the whole holds it', () => {
    const count = (opts: { count: number; countOf?: number | null }) => endCardView(delta(), opts).tiles.find((t) => t.id === 'count');
    assert.deepEqual(count({ count: 4, countOf: 5 }), { id: 'count', value: 4, label: GAME_COPY.endCard.countLabel.drill, of: 5 });
    assert.equal(count({ count: 4 })?.of, undefined, 'a count with no whole grew one');
    assert.equal(count({ count: 4, countOf: 3 })?.of, undefined, 'a whole smaller than its count was drawn');
    assert.equal(count({ count: 4, countOf: null })?.of, undefined);
  });
});
