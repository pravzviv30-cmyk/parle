import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MISSIONS, missionStates, type MissionId } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { stampsFrom } from '../progress/passport.ts';
import {
  ABILITIES_LABEL,
  AND_MORE,
  CAN_NOW,
  MAX_ABILITIES,
  REAL_PROGRESS_LABEL,
  REAL_PROGRESS_START,
  SO_FAR_LABEL,
  SO_FAR_WITH_HELP,
  abilitiesFrom,
  canDoSentence,
} from './abilities.ts';

const NOW = Date.parse('2026-09-12T20:00:00.000Z');

describe('what the learner can now do, on Home (F545)', () => {
  test('home draws an ability only for a stamp earned on your own, and none for a learner with none', () => {
    // Nothing behind them: nothing drawn, not a row of blanks.
    assert.equal(abilitiesFrom(stampsFrom(missionStates([], [], NOW))), null);

    // Through the café with help: a softer sentence, and no "you can now".
    const helped = stampsFrom(missionStates([{ id: 'mission:cafe', at: NOW - 1000, rung: 1 }], [], NOW));
    const soft = abilitiesFrom(helped);
    assert.ok(soft !== null);
    assert.equal(soft.label, SO_FAR_LABEL);
    assert.deepEqual(soft.rows, []);
    assert.match(soft.softLine!, /with help/i);
    assert.match(soft.softLine!, /Order at a café/);

    // Handled on their own: a row, in the passport's words, and the softer
    // line falls away. A later tired replay cannot take the row back.
    const own = stampsFrom(
      missionStates(
        [
          { id: 'mission:cafe', at: NOW - 5000, rung: 4 },
          { id: 'mission:cafe', at: NOW - 1000, rung: 1 },
          { id: 'mission:hotel', at: NOW - 2000, rung: 2 },
        ],
        [],
        NOW,
      ),
    );
    const view = abilitiesFrom(own);
    assert.ok(view !== null);
    assert.equal(view.label, ABILITIES_LABEL);
    assert.deepEqual(view.rows.map((row) => row.missionId), ['mission:cafe']);
    assert.equal(view.softLine, null, 'a learner with one stamp is not also told what they did with help');

    // Capped, so six situations at rung four are three rows and a door.
    const all = stampsFrom(missionStates(MISSIONS.map((m) => ({ id: m.id, at: NOW - 1000, rung: 4 as const })), [], NOW));
    assert.equal(abilitiesFrom(all)!.rows.length, MAX_ABILITIES);

    for (const line of [ABILITIES_LABEL, SO_FAR_LABEL, soft.softLine!]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d|%/);
    }
  });
});

/**
 * The same passport as one sentence, for Home's "Real progress" row (F572).
 *
 * The list has its own suite above. This is about the joining, which is where
 * a sentence about somebody's own progress goes wrong: a comma where an "and"
 * belongs reads as a list that got cut off, and a count where "and more"
 * belongs is the score this app does not keep.
 */
describe("the one sentence Home has room for (F572)", () => {
  test('two stamps join with and, no comma', () => {
    const own = (ids: readonly MissionId[]) =>
      stampsFrom(missionStates(ids.map((id) => ({ id, at: NOW - 1000, rung: 4 as const })), [], NOW));

    // One is a claim, and it reads as the founder's mockup reads: the stem,
    // the situation in the passport's own words, lower-cased into the sentence.
    const one = canDoSentence(own(['mission:cafe']));
    assert.equal(one.kind, 'own');
    assert.equal(one.label, REAL_PROGRESS_LABEL);
    assert.equal(one.line, 'You can now order at a café.');
    assert.ok(one.line.startsWith(CAN_NOW), 'the claim is not built on the stem every screen shares');

    // Two joins with "and" and nothing else. A comma here reads as a list with
    // its tail cut off, which is exactly what a learner should not see about
    // the two things they can now do.
    const two = canDoSentence(own(['mission:cafe', 'mission:hotel']));
    assert.equal(two.line, 'You can now order at a café and check into a hotel.');
    assert.ok(!two.line.includes(','), `"${two.line}" joins two situations with a comma`);
    assert.equal((two.line.match(/ and /g) ?? []).length, 1, 'two situations are joined by something other than one "and"');

    // Three takes the one comma English gives it, and no more.
    const three = canDoSentence(own(['mission:cafe', 'mission:hotel', 'mission:marche']));
    assert.equal((three.line.match(/,/g) ?? []).length, 1, `"${three.line}" does not take exactly one comma`);
    assert.equal((three.line.match(/ and /g) ?? []).length, 1, `"${three.line}" does not take exactly one "and"`);
    assert.ok(three.line.endsWith('.'), 'the sentence does not finish');

    // Past three the sentence says there are others rather than counting them.
    // A numeral here would be the score PRODUCT.md has refused twice.
    const many = canDoSentence(own(MISSIONS.map((m) => m.id)));
    assert.ok(many.line.endsWith(`${AND_MORE}.`), `"${many.line}" does not say that there is more`);
    assert.doesNotMatch(many.line, /\d/, `"${many.line}" counts the situations`);
    assert.equal(
      many.line.split(' and ').length - 1,
      2,
      `"${many.line}" names more than three situations, which is more than one line on a phone holds`,
    );

    // With help is said as with help, never as "you can now". The whole value
    // of the claim is that it is not made early.
    const helped = canDoSentence(stampsFrom(missionStates([{ id: 'mission:cafe', at: NOW - 1000, rung: 1 }], [], NOW)));
    assert.equal(helped.kind, 'helped');
    assert.ok(helped.line.startsWith(SO_FAR_WITH_HELP), `"${helped.line}" does not say that the help was still there`);
    assert.ok(!helped.line.includes(CAN_NOW), `"${helped.line}" claims independence the learner has not shown yet`);

    for (const line of [one.line, two.line, three.line, many.line, helped.line]) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|%/, `"${line}" carries something no learner-facing line may`);
    }
  });

  test('before any stamp the card says where progress starts and never a count', () => {
    // Nothing behind them. The row is still drawn, because it is also how a
    // learner finds out that this is what the app keeps track of, and what it
    // says is about the product rather than about them: no nought, no empty
    // rail, no "0 of 6", nothing that reads as an absence being reported back.
    const none = canDoSentence(stampsFrom(missionStates([], [], NOW)));
    assert.equal(none.kind, 'none');
    assert.equal(none.label, REAL_PROGRESS_LABEL);
    assert.equal(none.line, REAL_PROGRESS_START);
    assert.equal(none.line, 'Your first conversation is where this starts.');
    assert.ok(!none.line.includes(CAN_NOW), 'a learner with nothing behind them is told what they can already do');
    assert.doesNotMatch(none.line, /\d|%/, `"${none.line}" carries a count of what has not happened yet`);
    assert.equal(guiltIn(none.line), undefined, `"${none.line}" carries "${guiltIn(none.line)}"`);
    assert.doesNotMatch(none.line, /—/, 'the starting line carries an em dash');

    // The label never changes with the state. A row that renamed itself when a
    // learner had nothing would be the app reporting the absence in its
    // heading instead of in its sentence.
    const stamped = canDoSentence(stampsFrom(missionStates([{ id: 'mission:cafe', at: NOW - 1000, rung: 4 }], [], NOW)));
    assert.equal(stamped.label, none.label, 'the heading changes with how much a learner has done');
    assert.equal(REAL_PROGRESS_LABEL, 'Real progress');
  });
});
