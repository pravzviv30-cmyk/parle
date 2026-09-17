/**
 * The fold, and the two promises it makes to the screen above it.
 *
 * The first is that it decides everything, so `MyFrenchTab.tsx` can decide
 * nothing. The second is that it writes nothing: `sync/policy.ts` states the
 * rule, and a model that quietly sorted its own input in place would be a
 * derived value with a side effect attached.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DAILY_SCENARIOS, missionStates, type ReviewCard } from '@luvani/core';

import { MISSION_TINT } from '../missions/missionTint.ts';
import { isRetained, retainedOrder } from '../progress/momentum.ts';
import { SHELF_EMPTY } from './copy.ts';
import { myFrenchFrom } from './model.ts';

const NOW = Date.parse('2026-09-07T09:00:00Z');
const MISSIONS = missionStates([], [], NOW);

const EMPTY = {
  deck: [] as readonly ReviewCard[],
  missions: [],
  saved: [],
  packs: [],
  suggested: null,
  now: NOW,
};

describe('the model — it decides, and it writes nothing', () => {
  test('a learner who has done nothing gets a page with no blanks and no counts', () => {
    const model = myFrenchFrom(EMPTY);

    assert.deepEqual(model.situations, []);
    assert.equal(model.suggestedId, null);
    assert.equal(model.shelf, SHELF_EMPTY, 'an empty shelf says something other than what it is for');
    assert.deepEqual(model.saved, []);
    assert.equal(model.showSaved, false);
    assert.equal(model.showConversations, false);
  });

  test('the situations arrive with every word and every colour on them already chosen', () => {
    // The screen maps and spells none of it. A ternary on `independence` here
    // would be a second ladder one screen away from the first.
    const model = myFrenchFrom({ ...EMPTY, missions: MISSIONS });

    assert.equal(model.situations.length, MISSIONS.length);
    for (const row of model.situations) {
      assert.equal(row.title, row.progress.mission.title, 'a row is not titled in French');
      assert.equal(row.gloss, row.progress.mission.titleEn, 'a row does not say in English what the place is');
      assert.notEqual(row.title, row.gloss, 'a row says the same thing twice');
      assert.equal(row.tint, MISSION_TINT[row.place], 'a row picked a colour other than its place’s');
      assert.equal(typeof row.earned, 'boolean');
      assert.notEqual(row.chip.text, '', 'a row arrived with no state on it');
      assert.ok(['start', 'refine'].includes(row.action.kind));
    }
  });

  test('a row tells a screen reader what it will do and what state it is in, in one name', () => {
    // Two Texts and a chip reach assistive technology as three unrelated nodes.
    // The row names itself once and says both halves, so nobody has to see the
    // chip to know the place has been handled.
    const model = myFrenchFrom({ ...EMPTY, missions: MISSIONS });
    for (const row of model.situations) {
      assert.equal(row.accessibilityLabel, `${row.action.accessibilityLabel}. ${row.chip.text}.`);
      assert.ok(row.accessibilityLabel.includes(row.gloss), 'the name does not say which place it opens');
    }
  });

  test('the place core suggests is carried as an id, and never re-chosen here', () => {
    const suggested = MISSIONS[2]!;
    const model = myFrenchFrom({ ...EMPTY, missions: MISSIONS, suggested });
    assert.equal(model.suggestedId, suggested.mission.id);

    const source = readFileSync(fileURLToPath(new URL('./model.ts', import.meta.url)), 'utf8');
    assert.ok(!source.includes('suggestedMission('), 'the model picks the next place itself instead of taking core’s');
  });

  test('a saved situation arrives as a row on its own paper, with a name that says where it goes', () => {
    const scenario = DAILY_SCENARIOS[0]!;
    const model = myFrenchFrom({ ...EMPTY, saved: [scenario] });

    assert.equal(model.showSaved, true);
    assert.equal(model.saved.length, 1);
    const row = model.saved[0]!;
    assert.equal(row.scenario, scenario, 'the row lost the scenario the screen opens');
    assert.equal(row.tint, MISSION_TINT[scenario.place], 'a saved row picked a colour other than its place’s');
    assert.equal(row.accessibilityLabel, `Start ${scenario.titleEn}`);
  });

  test('a scene handled with help never sits under the heading that says the learner did it alone', () => {
    // The fill is the passport's fold of best-ever independence, not the rung
    // the learner happened to be on last time. Four of the five independences
    // mean help was still in play, and only one of them may earn the chip.
    const alone = { ...MISSIONS[0]!, independence: 'on-your-own' as const };
    const helped = { ...MISSIONS[1]!, independence: 'mostly-yours' as const };
    const model = myFrenchFrom({ ...EMPTY, missions: [alone, helped] });

    assert.equal(model.situations[0]!.earned, true, 'a scene handled with nothing handed over did not earn its chip');
    assert.equal(model.situations[0]!.chip.earned, true, 'the chip and the fill disagree about the same scene');
    assert.equal(model.situations[1]!.earned, false, 'a scene handled with help was counted as the learner\u2019s own');
    assert.notEqual(model.situations[1]!.chip.text, model.situations[0]!.chip.text, 'help and no help read the same on a row');
  });

  test('a learner with a conversation behind them is offered the way back, and one without is not', () => {
    // An empty library is a door a learner opens for nothing, which is the same
    // refusal the saved shelf makes one block above it.
    assert.equal(myFrenchFrom(EMPTY).showConversations, false);
    const pack = { id: 'pack:one', keyPhrases: [] } as unknown as Parameters<typeof myFrenchFrom>[0]['packs'][number];
    assert.equal(myFrenchFrom({ ...EMPTY, packs: [pack] }).showConversations, true);
  });

  test('the shelf names the phrase Home would call first, so the two surfaces cannot disagree', () => {
    // One comparator, two readers. A second sort here would eventually feature
    // a different phrase from the one Home named on the same afternoon.
    const deck: ReviewCard[] = [
      {
        id: 'phrase:one', kind: 'vocab', front: 'du coup', back: 'so', context: '', ipa: '',
        addedAt: NOW, due: NOW, intervalDays: 6, ease: 2.5, reps: 3, lapses: 0,
        evidence: { retrievals: 1, convoUses: 2, transfers: 0 },
      },
      {
        id: 'phrase:two', kind: 'vocab', front: 'en fait', back: 'actually', context: '', ipa: '',
        addedAt: NOW, due: NOW, intervalDays: 6, ease: 2.5, reps: 3, lapses: 0,
        evidence: { retrievals: 1, convoUses: 9, transfers: 0 },
      },
    ];
    const model = myFrenchFrom({ ...EMPTY, deck });
    assert.equal(model.shelf, retainedOrder(deck.filter(isRetained))[0]!.front);
    assert.equal(model.shelf, 'en fait', 'most used first is the order Home reads');
  });

  test('nothing it is handed is mutated', () => {
    const deck: ReviewCard[] = [
      {
        id: 'phrase:one', kind: 'vocab', front: 'du coup', back: 'so', context: '', ipa: '',
        addedAt: NOW, due: NOW, intervalDays: 6, ease: 2.5, reps: 3, lapses: 0,
        evidence: { retrievals: 1, convoUses: 2, transfers: 0 },
      },
      {
        id: 'phrase:two', kind: 'vocab', front: 'en fait', back: 'actually', context: '', ipa: '',
        addedAt: NOW, due: NOW, intervalDays: 6, ease: 2.5, reps: 3, lapses: 0,
        evidence: { retrievals: 1, convoUses: 9, transfers: 0 },
      },
    ];
    const before = JSON.stringify(deck);
    const missions = [...MISSIONS];

    myFrenchFrom({ ...EMPTY, deck, missions });

    assert.equal(JSON.stringify(deck), before, 'the deck came back in a different order or shape');
    assert.deepEqual(missions, [...MISSIONS], 'the missions were sorted in place');
  });

  test('the model spells no word a learner reads, and counts nothing', () => {
    // Every sentence on this tab is `myfrench/copy.ts`'s or another module's.
    // A literal here would be learner-facing copy inside a fold, which is the
    // one place the app's own copy sweep cannot reach it.
    const source = readFileSync(fileURLToPath(new URL('./model.ts', import.meta.url)), 'utf8');
    const body = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
    for (const literal of body.match(/'[^']*'/g) ?? []) {
      assert.ok(!literal.includes(' '), `the model spells ${literal}, which is a sentence somebody could read`);
    }
    assert.doesNotMatch(source, /export const [A-Z_]+ = '/, 'the model grew a copy constant; the words are copy.ts’s');
  });
});
