/**
 * The Progress screen's rule and its headings, read as a module — F572.
 *
 * There is no renderer in this workspace, so the only way to hold "which places
 * appear under You can now" is to keep that question out of the screen. This is
 * that module, tested directly.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { guiltIn } from '../copy/guilt.ts';
import { ABILITIES_LABEL } from '../home/abilities.ts';
import type { Stamp } from './passport.ts';
import { CAN_DO_LABEL, MOMENTUM_LABEL, PROGRESS_TITLE, canDoRows, hasCanDo } from './progressView.ts';

const stamp = (missionId: string, state: Stamp['state'], place: Stamp['place'] = 'cafe'): Stamp => ({
  missionId: missionId as Stamp['missionId'],
  place,
  titleEn: `Handle ${missionId}`,
  state,
});

describe('what a learner can now do, on the progress screen — F572', () => {
  test('only a situation handled without help is something the learner can now do', () => {
    const rows = canDoRows([
      stamp('cafe-order', 'on-your-own'),
      stamp('hotel-desk', 'with-help', 'hotel'),
      stamp('market-stall', 'not-yet', 'market'),
    ]);
    assert.deepEqual(
      rows.map((row) => row.missionId),
      ['cafe-order'],
      'a place walked through with help is printed under a heading that says the learner can now do it alone',
    );
    assert.equal(rows[0]?.place, 'cafe', 'the row loses the place, so it can carry neither its paper nor its mark');
    assert.equal(rows[0]?.title, 'Handle cafe-order', "the row does not carry the passport's own words for the situation");
  });

  test('a learner who has handled five places reads five rows, because this is the screen they came for', () => {
    // Home shows at most three and joins them into one sentence, because Home
    // is one row deep. This screen is the list, so a sixth month must not
    // quietly hide the first.
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => stamp(id, 'on-your-own'));
    assert.equal(canDoRows(many).length, 5, 'the list is capped, so the places a learner earned first disappear');
    assert.deepEqual(
      canDoRows(many).map((row) => row.missionId),
      ['a', 'b', 'c', 'd', 'e'],
      'the list reorders the learner’s own situations, which is ranking them',
    );
  });

  test('a learner with nothing stamped yet is shown no heading at all, never an empty one', () => {
    assert.deepEqual(canDoRows([]), [], 'a learner with no stamps is handed rows anyway');
    assert.equal(hasCanDo([]), false, 'an empty list still earns its heading, which is a quota drawn blank');
    assert.equal(hasCanDo(canDoRows([stamp('cafe-order', 'with-help')])), false, 'help alone lights the heading');
    assert.equal(hasCanDo(canDoRows([stamp('cafe-order', 'on-your-own')])), true, 'a real stamp does not light the heading');
  });

  test('every heading the progress screen writes is plain, carries no count and passes the guilt list', () => {
    for (const line of [PROGRESS_TITLE, CAN_DO_LABEL, MOMENTUM_LABEL]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d/, `"${line}" counts something in its own heading`);
      assert.doesNotMatch(line, /—/, `"${line}" carries an em dash`);
      assert.ok(line.trim() === line && line.length > 0, `"${line}" is padded or empty`);
    }
    // Borrowed, not retyped: two surfaces that spell the same claim twice are
    // two surfaces that will one day disagree about what it is called.
    assert.equal(CAN_DO_LABEL, ABILITIES_LABEL, 'the progress screen spells the can-do heading for itself');
  });
});
