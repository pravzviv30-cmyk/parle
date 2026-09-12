import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MISSIONS, missionStates } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { stampsFrom } from '../progress/passport.ts';
import { ABILITIES_LABEL, MAX_ABILITIES, SO_FAR_LABEL, abilitiesFrom } from './abilities.ts';

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
