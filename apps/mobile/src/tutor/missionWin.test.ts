import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Rung } from '@luvani/core';

import { streakGuiltIn } from '../copy/guilt.ts';
import { NO_WIN, SCENE_WON_BURST, dismissWin, winAfterTurn, winCard } from './missionWin.ts';

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

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

describe('the scene won card in the room — come alive, core loop 2.8', () => {
  test('the scene won card names the moment in plain words, keeps one primary and plays no sound in the room', () => {
    const card = winCard('mission:cafe');
    assert.ok(card !== null);
    assert.equal(card.kicker, 'Scene complete');
    assert.doesNotMatch(card.kicker, /\d|[—–·]|amazing|great|well done|perfect|excellent|bravo|super/i, 'the kicker scores or praises');
    assert.equal(streakGuiltIn(card.kicker), undefined);

    const win = stripComments(readFileSync(fileURLToPath(new URL('./MissionWin.tsx', import.meta.url)), 'utf8'));
    // "Keep talking" stays the one pill; leaving stays the ghost.
    assert.equal((win.match(/<PillButton\b/g) ?? []).length, 1, 'the card grew a second primary');
    assert.match(win, /<PillButton label=\{card\.keepLabel\} onPress=\{onKeep\} \/>/);
    assert.match(win, /<GhostButton label=\{card\.finishLabel\} onPress=\{onFinish\} \/>/);
    // The glow, the drawing and the confetti, from the shared primitives, once, and none of it with movement reduced.
    // 2026-10-21 UI-008: the glow reads the mint token (the same mint in both modes).
    assert.match(win, /<DiscBloom color=\{t\.mint\}/, 'no mint glow opens behind the card');
    assert.match(win, /<Burst seed=\{momentKey\} origin=\{\{ x: width \/ 2, y: 0 \}\} count=\{SCENE_WON_BURST\} \/>/, 'no confetti leaves the card\'s top edge');
    assert.equal(SCENE_WON_BURST, 24);
    assert.match(win, /const final = useLatch\(reduced \|\| !first\);/, 'the card replays on a remount, or moves with movement reduced');
    assert.match(win, /claimInPlace\(`\$\{scopeGeneration\(\)\}:scene-won:\$\{momentKey\}`\)/);
    // Silent and still to the touch in a live room (decision D8): no sound and no haptic reach from here.
    assert.doesNotMatch(win, /sound\/|haptics|celebrate\/effects|ConfettiStill|<Confetti\b/, 'the card in the room plays a sound or a haptic, or draws the still confetti under Reduce Motion');
    // And the conversation draws it from here, behind the ripple hold.
    const convo = stripComments(readFileSync(fileURLToPath(new URL('../ConvoScreen.tsx', import.meta.url)), 'utf8'));
    assert.match(convo, /import \{ MissionWin \} from '\.\/tutor\/MissionWin\.tsx';/);
    assert.match(convo, /art=\{wonMission \? sceneIllustration\(wonMission\.id\) : null\}/, 'the card does not draw the scene\'s own place');
  });
});
