import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  COACH_MARK_TEXT,
  coachMarksAfter,
  coachMarksAt,
  dismissCoachMark,
  type CoachMarkId,
  type CoachSignals,
} from './coachMarks.ts';

const nothingYet: CoachSignals = { sceneOpen: false, learnerSpoke: false, frenchLanded: false, voiceControlsShown: true };
const sceneOpen: CoachSignals = { ...nothingYet, sceneOpen: true };
const spoken: CoachSignals = { ...sceneOpen, learnerSpoke: true };
const everything: CoachSignals = { sceneOpen: true, learnerSpoke: true, frenchLanded: true, voiceControlsShown: true };
/** The quiet typed path: the same session, without the voice-only controls. */
const everythingTyped: CoachSignals = { ...everything, voiceControlsShown: false };

describe('the contextual coach marks', () => {
  test('each coach mark shows once, ever, and never two at a time', () => {
    // Once ever: the store already holds "help", so the situation that would
    // have shown it passes in silence.
    const secondSession = coachMarksAfter(coachMarksAt(['help']), sceneOpen);
    assert.equal(secondSession.showing, null, 'a mark this learner has already read came back');

    // Never two: everything has happened at once, and exactly one note is up.
    const busy = coachMarksAfter(coachMarksAt([]), everything);
    assert.equal(busy.showing, 'help');
    assert.equal(busy.seen.length, 1, 'more than one mark was recorded as read in a single beat');

    // Still one, on the render after. A mark on screen is not replaced by the
    // next situation coming true underneath it.
    assert.equal(coachMarksAfter(busy, everything).showing, 'help');

    // And once all three have been read, nothing appears again for good.
    const readEverything = coachMarksAt(['help', 'moment', 'english']);
    assert.equal(coachMarksAfter(readEverything, everything).showing, null);
    assert.deepEqual(coachMarksAfter(readEverything, everything).seen, ['help', 'moment', 'english']);
  });

  test('at most one new coach mark appears per session', () => {
    // This is the rule that stops three notes becoming the manual again. A
    // learner who dismisses one and immediately meets another has been given a
    // tour, not a hint.
    let state = coachMarksAt([]);

    state = coachMarksAfter(state, sceneOpen);
    assert.equal(state.showing, 'help');

    state = dismissCoachMark(state);
    assert.equal(state.showing, null);

    // The learner takes a turn. The second mark waits for the next conversation.
    state = coachMarksAfter(state, spoken);
    assert.equal(state.showing, null, 'a second new mark appeared in the same session');

    state = coachMarksAfter(state, everything);
    assert.equal(state.showing, null);
    assert.deepEqual(state.seen, ['help'], 'a mark nobody was shown was recorded as read');

    // Next conversation, with what the store now remembers.
    const nextTime = coachMarksAfter(coachMarksAt(state.seen), spoken);
    assert.equal(nextTime.showing, 'moment');
  });

  test('nothing appears before there is anything to point at', () => {
    const state = coachMarksAfter(coachMarksAt([]), nothingYet);
    assert.equal(state.showing, null);
    assert.equal(state.usedItsTurn, false);
    assert.deepEqual(state.seen, []);
  });

  test('an id from some other build is kept and blocks nothing', () => {
    // tutor/store.ts deliberately keeps ids it does not recognise, so a mark
    // some other build showed is never shown twice.
    const state = coachMarksAfter(coachMarksAt(['tour-de-france']), sceneOpen);
    assert.equal(state.showing, 'help');
    assert.deepEqual(state.seen, ['tour-de-france', 'help']);
  });

  test('a mark describes a button and never remarks on the learner', () => {
    // The invariant, in the one place it is easiest to break: a note that
    // appears the moment somebody hesitates and then asks about the hesitation
    // is a remark on it.
    for (const id of Object.keys(COACH_MARK_TEXT) as CoachMarkId[]) {
      const text = COACH_MARK_TEXT[id];
      assert.ok(text.length > 0 && text.length <= 60, `"${text}" is longer than a glance`);
      assert.ok(!/\d/.test(text), `"${text}" carries a number`);
      assert.ok(!/—/.test(text), `"${text}" carries an em dash`);
      assert.doesNotMatch(text, /stuck|struggl|take your time|don't worry|no rush|hard|sorry|wrong/i, text);
    }
    // Every mark names the control it is about, so none of them is a general
    // encouragement wearing a hint's clothes.
    // 2026-10-21 UI-008, artboard B-Live: the room's Help control opens the help sheet.
    assert.match(COACH_MARK_TEXT.help, /^Help gives you the line/);
    assert.match(COACH_MARK_TEXT.moment, /Give me a moment/);
    assert.match(COACH_MARK_TEXT.english, /In English/);
  });
});

describe('a coach mark never points at a control that is not on screen', () => {
  test('the quiet path is never taught a voice-only control', () => {
    // "In English" and "Slower" render behind the voice branch, so in text mode
    // they are not there at all. Teaching them anyway would point a learner at
    // nothing, and would tell them the quiet route is the lesser one. It is not:
    // PEDAGOGY.md says every spoken path has a quiet twin, and the twin is the
    // product working as intended for somebody who cannot speak aloud right now.
    let typed = coachMarksAt(['help', 'moment']);
    typed = coachMarksAfter(typed, everythingTyped);

    assert.equal(typed.showing, null, 'nothing is pointed at, because there is nothing there to point at');
    assert.ok(!typed.seen.includes('english'), 'and it is not marked read, so it still waits for a session that has it');
  });

  test('and the same learner is taught it the moment they switch to voice', () => {
    let seen = coachMarksAt(['help', 'moment']);
    seen = coachMarksAfter(seen, everythingTyped);
    seen = coachMarksAfter(seen, everything);

    assert.equal(seen.showing, 'english', 'the mark was waiting, not spent');
  });
});
