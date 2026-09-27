/**
 * What Today draws under the scene brief — notebook Phase 3, B1 (2026-09-27).
 *
 * Two blocks, each drawn only when it has something true to show. On day one,
 * "Where you're starting": A0 and the first three can-dos in spine order. After
 * that, two plain sentences about the week, and nothing at all on a quiet week.
 * The four empty tiles and the seven-dot rail they replace are gone.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SCENE_SPINE, getMission, missionStates } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { STARTING_LABEL, WEEK_LINES_MAX, startingPoint, weekLines } from './todayView.ts';

const NOW = new Date(2026, 8, 12, 21, 0, 0).getTime();

describe('where you are starting', () => {
  test('day one shows A0 and the first three can-dos in spine order', () => {
    const start = startingPoint(missionStates([], [], NOW));
    assert.ok(start !== null, 'a learner with nothing behind them is not shown where they are starting');
    assert.equal(start.level, 'A0');
    assert.deepEqual(
      start.canDos,
      SCENE_SPINE.slice(0, 3).map((id) => getMission(id)!.canDoEn),
      'the three can-dos are not the first three on the spine',
    );
    assert.deepEqual(start.canDos, ['Order a coffee at the counter', 'Order food and drink, then pay', 'Check in and ask one question']);
    assert.equal(STARTING_LABEL, "Where you're starting");
  });

  test('the block leaves once any scene has been finished, earned or not', () => {
    const finished = missionStates([{ id: 'mission:premier-cafe', at: NOW - 1000, rung: 1 }], [], NOW);
    assert.equal(startingPoint(finished), null, 'a learner who has finished a scene is still told where they are starting');
    assert.equal(startingPoint([]), null, 'an unread progress list is treated as day one');
  });
});

describe('two plain sentences about the week', () => {
  test('at most two, the reflection first, never repeated, and none on a quiet week', () => {
    assert.equal(WEEK_LINES_MAX, 2);
    assert.deepEqual(weekLines({ story: { sentences: [] }, reflection: null }), [], 'a quiet week says something');
    assert.deepEqual(
      weekLines({ story: { sentences: [] }, reflection: { improvement: null, focus: null, next: null } }),
      [],
      'an empty reflection is drawn as a sentence',
    );
    const story = { sentences: ['You had three conversations this week.', 'This week you mostly found the words on your own.', 'You said forty different French words.'] };
    assert.deepEqual(weekLines({ story, reflection: null }), story.sentences.slice(0, 2));
    assert.deepEqual(
      weekLines({ story, reflection: { improvement: 'This week you mostly found the words on your own.', focus: null, next: null } }),
      ['This week you mostly found the words on your own.', 'You had three conversations this week.'],
      'the reflection does not lead, or a sentence is said twice',
    );
    // The focus can be a bare French correction, which is not a sentence about the week.
    assert.deepEqual(weekLines({ story: { sentences: [] }, reflection: { improvement: null, focus: 'Je voudrais', next: null } }), []);
    for (const line of weekLines({ story, reflection: null })) {
      assert.equal(guiltIn(line), undefined);
    }
  });
});
