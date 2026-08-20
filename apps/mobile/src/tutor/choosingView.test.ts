import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ANYTHING_GOES,
  QUIET_DOOR,
  TAP_TO_TALK,
  choosingView,
  micOpensAtConnect,
  type ChoosingState,
} from './choosingView.ts';
import { pushTurn, type TurnLine } from '../live/turns.ts';

/** The tutor's question, which the hook puts in the thread the moment it lands. */
const asked: TurnLine[] = [
  { id: 't1', who: 'tutor', fr: 'De quoi voulez-vous parler ?', frWritten: null, en: 'What would you like to talk about?' },
];

/** A spoken session, freshly connected, with the tutor's question on screen. */
const opening: ChoosingState = {
  textMode: false,
  micOpen: false,
  thinking: false,
  tutorSpeaking: false,
  turns: asked,
};

describe('the choosing moment — what the screen decides before a scene exists', () => {
  test('a free conversation keeps the microphone closed until the learner taps the circle', () => {
    // The founder chose this: the tutor asks out loud, and the learner agrees
    // to be heard by tapping. Connecting is not agreeing.
    assert.equal(
      micOpensAtConnect('convo'),
      false,
      'connecting must not publish a microphone the learner has not offered',
    );
    assert.equal(micOpensAtConnect('convo-text'), false, 'the quiet twin has no microphone to publish at all');
    assert.equal(micOpensAtConnect('lesson'), true, 'the lesson surface keeps its hot microphone: its first beat is the learner');
    assert.equal(micOpensAtConnect(undefined), true, 'no mode named is the lesson path, and it is unchanged');

    // Until the tap, the circle is a control that says so rather than a green
    // one claiming the learner is already being heard.
    const before = choosingView(opening);
    assert.equal(before.showQuestion, true, 'before anyone has answered, the question is the whole screen');
    assert.equal(before.showTranscript, false, 'a thread holding only the question the headline already asks is noise');
    assert.equal(before.orb, 'idle', 'a green circle over a closed microphone tells the learner something untrue');
    assert.equal(before.orbIsButton, true, 'the circle is the way the microphone opens, so it has to be pressable');
    assert.equal(before.helper, TAP_TO_TALK, 'a control with no instruction is a control nobody presses');

    const after = choosingView({ ...opening, micOpen: true });
    assert.equal(after.orb, 'listening', 'once the microphone is open, green means the learner may speak');
    assert.equal(after.orbIsButton, false, 'one tap opens it for the session, so a second tap has nothing left to do');
    assert.equal(after.helper, ANYTHING_GOES, 'the instruction is spent, and what replaces it is what to talk about');
  });

  test('the tutor asking its question out loud is red, not green', () => {
    // The screen used to hardcode the circle to listening, so it said "Speak"
    // over the top of the tutor's own spoken question.
    const asking = choosingView({ ...opening, tutorSpeaking: true });
    assert.equal(asking.orb, 'speaking', 'red means the tutor holds the floor, on this screen as on every other');
    assert.equal(
      asking.orbIsButton,
      true,
      'a learner ready before the question ends must not be made to sit through it',
    );
  });

  test('the moment a topic is sent the learner sees their own words and a tutor visibly thinking', () => {
    // The typed topic already reached the transcript and already set thinking.
    // The screen simply rendered neither, so a send moved nothing on screen for
    // as long as the tutor took to answer.
    const said = pushTurn(asked, { who: 'learner', fr: 'the metro', frWritten: null, en: null }, 't2');
    assert.equal(said.length, 2, 'a sent topic has to be somewhere the learner can see it');
    assert.equal(said[1]?.who, 'learner', 'their own words, on their own side of the thread');

    // The founder's own path: typed the topic, pressed send, watched nothing.
    const sent = choosingView({ ...opening, textMode: true, thinking: true, turns: said });
    assert.equal(sent.showTranscript, true, 'the thread is where the learner reads back what they just sent');
    assert.equal(
      sent.showQuestion,
      false,
      'the thread opens with the tutor question, so the headline saying it again is the same sentence twice',
    );
    assert.equal(sent.orb, 'thinking', 'amber is the app saying it heard them, and it costs nothing to say it at once');
    assert.equal(sent.orbLabel, 'Your tutor is thinking', 'a learner who cannot see the amber still gets told');
  });

  test('thinking outranks a tutor who has taken the floor back', () => {
    const both = choosingView({ ...opening, micOpen: true, thinking: true, tutorSpeaking: true });
    assert.equal(both.orb, 'thinking', 'the circle says one thing at a time, and waiting is the one that matters');
  });

  test('a learner who cannot speak can switch to typing without leaving the choosing moment', () => {
    const spoken = choosingView(opening);
    assert.equal(spoken.showQuietDoor, true, 'the offer belongs on the screen where the learner discovers they need it');
    assert.equal(spoken.showInput, false, 'a spoken session offers the circle, not a box');
    assert.equal(QUIET_DOOR, 'Unable to speak right now?', 'one wording for one offer, wherever it appears');

    const typed = choosingView({ ...opening, textMode: true });
    // The question is still the headline of this screen, so the learner has not
    // been sent anywhere: the box simply appeared under it.
    assert.equal(typed.showInput, true, 'the quiet twin answers in a box');
    assert.equal(typed.showQuietDoor, false, 'already typing means typing is no longer an offer worth making');
    assert.equal(typed.orb, 'idle', 'a session with no microphone must never show a circle saying speak');
    assert.equal(typed.orbIsButton, false, 'a circle that cannot open a microphone is not a control');
    assert.equal(typed.helper, null, 'the box already says what to type, and saying it twice is noise');
  });

  test('the circle and its label never say two different things', () => {
    const states: ChoosingState[] = [
      opening,
      { ...opening, micOpen: true },
      { ...opening, tutorSpeaking: true },
      { ...opening, thinking: true },
      { ...opening, textMode: true },
      { ...opening, textMode: true, thinking: true },
    ];
    for (const state of states) {
      const view = choosingView(state);
      assert.ok(view.orbLabel.length > 0, 'a control with no spoken label is a control a blind learner cannot find');
      if (view.orbIsButton) {
        assert.match(view.orbLabel, /tap/i, `"${view.orbLabel}" is on a pressable circle and never says to press it`);
      }
    }
  });

  test('nothing this screen says carries a number, an em dash, or a word that scolds', () => {
    const lines = [TAP_TO_TALK, ANYTHING_GOES, QUIET_DOOR];
    for (const state of [opening, { ...opening, micOpen: true }, { ...opening, textMode: true }]) {
      lines.push(choosingView(state).orbLabel);
    }
    for (const line of lines) {
      assert.ok(!/\d/.test(line), `"${line}" carries a number into a live session`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      assert.ok(!/\b(wrong|bad|failed|incorrect)\b/i.test(line), `"${line}" scolds`);
    }
  });
});
