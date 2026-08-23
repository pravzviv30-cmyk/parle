import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Rung } from '@parle/core';

import { NO_WIN, dismissWin, winAfterTurn, winCard } from './missionWin.ts';

const turn = (missionDone: boolean, rung: Rung = 2) => ({ missionDone, rung });

describe('the win card', () => {
  test('the win card shows exactly once, at the moment the mission completes', () => {
    // missionDone is sticky: it is true on the winning turn and on every turn
    // after it. A card driven straight off the flag would arrive and never
    // leave, so what is watched here is the flip, not the value.
    let state = NO_WIN;

    const before = winAfterTurn(state, turn(false), 'mission:cafe');
    assert.equal(before.state.showing, false, 'the card is up before any beat is finished');
    state = before.state;

    const flip = winAfterTurn(state, turn(true), 'mission:cafe');
    assert.equal(flip.state.showing, true, 'the card did not appear on the turn that earned it');
    state = flip.state;

    // The same sticky flag, one turn later. Nothing new happened.
    const again = winAfterTurn(state, turn(true), 'mission:cafe');
    assert.equal(again.record, null, 'a later turn wrote a second completion');

    state = dismissWin(state);
    assert.equal(state.showing, false, 'dismissing left the card up');

    const afterDismiss = winAfterTurn(state, turn(true), 'mission:cafe');
    assert.equal(afterDismiss.state.showing, false, 'the card came back after it was closed');
    assert.equal(afterDismiss.record, null);
  });

  test('a conversation with no mission never has one to finish', () => {
    // A free conversation has no goal to have reached, and an agent that
    // shipped before missions sends false anyway.
    assert.equal(winAfterTurn(NO_WIN, turn(true), null).state.showing, false);
    assert.equal(winAfterTurn(NO_WIN, turn(true), undefined).state.showing, false);
    assert.equal(winAfterTurn(NO_WIN, turn(true), null).record, null);
  });

  test('a mission id this build has never heard of behaves as no mission at all', () => {
    // The card's content is the mission's own line. There is nothing honest to
    // put on a card for a mission that is not in the catalogue.
    const step = winAfterTurn(NO_WIN, turn(true), 'mission:zeppelin');
    assert.equal(step.state.showing, false);
    assert.equal(step.record, null);
    assert.equal(step.state.seen, false, 'an unknown id burned the session, so the real win could not fire');
    assert.equal(winCard('mission:zeppelin'), null);
  });

  test('no view yet is not a win', () => {
    assert.deepEqual(winAfterTurn(NO_WIN, null, 'mission:cafe'), { state: NO_WIN, record: null });
  });

  test('the win records the mission with the rung it was earned at', () => {
    // Independence is decided by code from this rung (core's independenceFrom).
    // A record that guessed it later would be a fabricated statement about how
    // much help somebody needed, which is the one thing this app must not do.
    for (const rung of [1, 2, 3, 4] as const) {
      const step = winAfterTurn(NO_WIN, turn(true, rung), 'mission:cafe');
      assert.deepEqual(step.record, { id: 'mission:cafe', rung }, `the rung ${rung} win recorded something else`);
    }

    // Written at the flip and nowhere else, so a long session cannot bank the
    // same mission four times at four different rungs.
    let state = NO_WIN;
    const records = [];
    for (const rung of [3, 4, 4] as const) {
      const step = winAfterTurn(state, turn(true, rung), 'mission:amis');
      state = step.state;
      if (step.record) records.push(step.record);
    }
    assert.deepEqual(records, [{ id: 'mission:amis', rung: 3 }]);
  });

  test('keep talking says it costs minutes', () => {
    // Continuing is offered, never assumed. Minutes are metered, and a door
    // that quietly spends them is a door the learner did not agree to walk
    // through.
    const card = winCard('mission:cafe');
    assert.ok(card !== null);
    assert.equal(card.keepLabel, 'Keep talking');
    assert.match(card.keepSub, /minutes/i, `"${card.keepSub}" never mentions what carrying on costs`);
    assert.ok(!/\d/.test(card.keepSub), 'a mid-session line carries a number');
    assert.ok(!/—/.test(card.keepSub), 'a learner-facing line carries an em dash');
  });

  test('the other door is the ordinary recap, and the card praises nobody', () => {
    const card = winCard('mission:cafe');
    assert.ok(card !== null);
    assert.equal(card.finishLabel, 'Finish and see your recap');
    // The line describes what the learner did. It does not tell them how they
    // did, and no mid-session copy carries a number or a score.
    assert.doesNotMatch(card.line, /amazing|great job|well done|perfect|excellent/i);
    assert.ok(!/\d/.test(card.line), `"${card.line}" carries a number`);
    assert.ok(!/—/.test(card.line), `"${card.line}" carries an em dash`);
  });
});
