/**
 * Home's quests card (F767, D22): today's three, frozen when dealt, each with
 * its own progress; "{done} of 3 quests done today" and at three the one quiet
 * line. No chest, no reward row, no countdown, and nothing when unread.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { streakGuiltIn } from '../copy/guilt.ts';
import { emptyGame } from './model.ts';
import { questsCardView } from './questsCardView.ts';
import { NO_OUTSIDE_FACTS, gameViewFrom, type GameFacts } from './view.ts';

const TODAY = '2026-10-07';
const at = (hour: number): number => new Date(2026, 9, 7, hour).getTime();

function facts(claimed: ('finish-practice' | 'practise-twice' | 'practice-set')[]): GameFacts {
  return {
    activity: [{ at: at(9), kind: 'drill', xp: 20, activeMs: 180_000 }],
    practiceDays: [TODAY],
    game: {
      ...emptyGame(),
      questDays: [{ day: TODAY, ids: ['finish-practice', 'practise-twice', 'practice-set'], at: at(8) }],
      claims: claimed.map((questId) => ({ day: TODAY, questId, xp: 10, at: at(9) })),
    },
    outside: { ...NO_OUTSIDE_FACTS, goalTarget: 10 },
    billing: null,
  };
}

describe("Home's quests card — F767", () => {
  test("today's three quests, the day so far, and the one quiet line once all three are done", () => {
    const one = questsCardView(gameViewFrom(facts(['finish-practice']), TODAY).quests)!;
    assert.equal(one.title, 'Daily quests');
    assert.equal(one.progress, '1 of 3 quests done today');
    assert.equal(one.allDone, false);
    assert.deepEqual(one.rows.map((row) => [row.title, row.count, row.complete]), [
      ['Finish a practice', 'Done', true],
      ['Practise twice today', '1 of 2', false],
      ['Finish a short practice set', 'Done', true],
    ]);

    const all = questsCardView(gameViewFrom(facts(['finish-practice', 'practise-twice', 'practice-set']), TODAY).quests)!;
    assert.equal(all.progress, 'All three quests done today.');
    assert.equal(all.allDone, true);
    assert.equal(all.rows.length, 3, 'a fourth row, a chest or a reward row was drawn');

    // Unread or not dealt yet: no card at all.
    assert.equal(questsCardView(null), null);
    const undealt = gameViewFrom({ ...facts([]), game: emptyGame() }, TODAY).quests;
    assert.equal(questsCardView(undealt), null);

    for (const view of [one, all]) {
      for (const said of [view.title, view.progress, ...view.rows.flatMap((row) => [row.title, row.count, row.label])]) {
        assert.equal(streakGuiltIn(said), undefined, `"${said}" says "${streakGuiltIn(said) ?? ''}"`);
        assert.doesNotMatch(said, /chest|reward|tomorrow|left|hours?/i, `"${said}" promises a chest or counts down`);
      }
    }
    const card = readFileSync(new URL('./QuestsCard.tsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(card, /[Cc]hest/, 'the quests card draws a chest');
    assert.doesNotMatch(card, /<Press\b|<Pressable\b|onPress/, 'a quest row became a door');
  });
});
