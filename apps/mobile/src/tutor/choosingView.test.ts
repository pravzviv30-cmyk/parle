import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  MODE_CAPS,
  QUIET_DOOR,
  TAP_TO_TALK,
  anythingGoes,
  choosingView,
  micOpensAtConnect,
  modeCarriesAudio,
  publishesMicAtConnect,
  type ChoosingState,
  type LiveMode,
} from './choosingView.ts';
import { pushTurn, type TurnLine } from '../live/turns.ts';
// A name to interpolate, and deliberately not the default one. F293 made the
// tutor per learner, so a suite that fed the default name back in would pass
// just as happily over a module that had gone back to reading the constant.
const CHOSEN = 'Celine';

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
  tutorName: CHOSEN,
  typingOpen: false,
};

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

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
    // J1. This was 'idle', which kept the promise below — a closed microphone
    // is never green — by drawing the primary control of the whole product in
    // the hairline colour. 'ready' keeps the promise and is visible.
    assert.equal(before.orb, 'ready', 'a green circle over a closed microphone tells the learner something untrue');
    assert.notEqual(before.orb, 'listening', 'and it must still never be the green that means the learner is heard');
    assert.equal(before.orbIsButton, true, 'the circle is the way the microphone opens, so it has to be pressable');
    assert.equal(before.helper, TAP_TO_TALK, 'a control with no instruction is a control nobody presses');

    const after = choosingView({ ...opening, micOpen: true });
    assert.equal(after.orb, 'listening', 'once the microphone is open, green means the learner may speak');
    assert.equal(after.orbIsButton, false, 'one tap opens it for the session, so a second tap has nothing left to do');
    assert.equal(after.helper, anythingGoes(CHOSEN), 'the instruction is spent, and what replaces it is what to talk about');
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
    assert.equal(sent.orbLabel, `${CHOSEN} is thinking`, 'a learner who cannot see the amber still gets told');
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

  test('a learner who prefers typing opens the conversation with the box showing and the circle still a button — F370', () => {
    // The whole of F370 in one state: the box is open, and nothing else moved.
    // A learner who asked for a keyboard has not asked to be made silent, and
    // the four assertions after the first are what keeps those two apart.
    const typed = choosingView({ ...opening, typingOpen: true });
    assert.equal(typed.showInput, true, 'the stored choice did not open the box, which is the whole of the setting');
    assert.equal(
      typed.orbIsButton,
      true,
      'preferring a keyboard closed the door to the microphone, which is the quiet twin and not what was asked for',
    );
    assert.equal(typed.orb, 'ready', 'the circle went quiet over a session that still carries a voice');
    assert.equal(
      typed.showQuietDoor,
      true,
      'the offer to go quiet is gone, so a learner who really cannot speak has nowhere left to say so',
    );
    assert.equal(typed.helper, TAP_TO_TALK, 'the circle lost the one line that says it can be pressed');

    // And the box opens once the microphone is live too: this is a way of
    // answering, not a stage the learner leaves by tapping the circle.
    const speaking = choosingView({ ...opening, typingOpen: true, micOpen: true });
    assert.equal(speaking.showInput, true, 'opening the microphone took the box away from somebody who wanted both');
    assert.equal(speaking.orb, 'listening', 'the open microphone stopped saying the learner may speak');

    // The quiet twin is unchanged by the new input, in both directions.
    assert.equal(choosingView({ ...opening, textMode: true, typingOpen: false }).showInput, true, 'the quiet twin lost its box');
    assert.equal(choosingView({ ...opening, textMode: true, typingOpen: true }).showQuietDoor, false);

    // The screen's half. There is no renderer here, so the seed and the input
    // are read out of the file: a rule nothing wires is the shape this had.
    const convo = stripComments(read('../ConvoScreen.tsx'));
    assert.match(
      convo,
      /useState\(typingOpenAtStart \?\? \(listenOnly \|\| prefersTyping\(profile\)\)\)/,
      'the conversation opens with the box closed however the learner set it, so the setting does nothing',
    );
    const call = convo.slice(convo.indexOf('choosingView({'));
    assert.ok(call.length > 0, 'the choosing moment no longer asks choosingView anything; this test is stale');
    assert.match(
      call.slice(0, call.indexOf('})')),
      /typingOpen,/,
      'the choosing moment decides the box without telling choosingView the box is open',
    );
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
    const lines = [TAP_TO_TALK, anythingGoes(CHOSEN), QUIET_DOOR];
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

describe('the circle a learner has to press — J1', () => {
  test('a closed microphone offers a control, not a hairline', () => {
    const view = choosingView(opening);
    assert.equal(view.orbIsButton, true);
    assert.equal(view.orb, 'ready', 'the one thing a learner must press cannot be drawn as a rule');
  });

  test('the orb only goes quiet when there is nothing to tap', () => {
    // Text mode has no microphone to open, so there the circle really is idle.
    const typing = choosingView({ ...opening, textMode: true });
    assert.equal(typing.orbIsButton, false);
    assert.equal(typing.orb, 'idle');
  });

  test('reporting a state always outranks asking to be pressed', () => {
    assert.equal(choosingView({ ...opening, thinking: true }).orb, 'thinking');
    assert.equal(choosingView({ ...opening, tutorSpeaking: true }).orb, 'speaking');
  });
});

describe('what each session mode may do with a microphone — F139', () => {
  /**
   * Every mode, written out, because the omission is the defect.
   *
   * The test this replaces asserted three modes and never `lesson-text`, which
   * is exactly how a typed lesson came to publish a microphone: the mode was
   * added to the union, was never named here, and nothing noticed. Naming all
   * four and then checking the count against the table means the fifth mode
   * fails this test on the day it is added rather than on the day a learner in
   * a quiet carriage finds out.
   */
  const EXPECTED: Record<LiveMode, { carriesAudio: boolean; micAtConnect: boolean }> = {
    lesson: { carriesAudio: true, micAtConnect: true },
    convo: { carriesAudio: true, micAtConnect: false },
    'convo-text': { carriesAudio: false, micAtConnect: false },
    'lesson-text': { carriesAudio: false, micAtConnect: false },
  };

  test("every mode's microphone and audio behaviour matches the mode table", () => {
    const modes = Object.keys(EXPECTED) as LiveMode[];
    assert.equal(
      Object.keys(MODE_CAPS).length,
      modes.length,
      'a mode was added to MODE_CAPS and not to this test, which is the omission that shipped the defect',
    );

    for (const mode of modes) {
      const want = EXPECTED[mode];
      assert.equal(
        micOpensAtConnect(mode),
        want.micAtConnect,
        `${mode} ${want.micAtConnect ? 'must publish' : 'must not publish'} a microphone when the room opens`,
      );
      assert.equal(
        modeCarriesAudio(mode),
        want.carriesAudio,
        `${mode} ${want.carriesAudio ? 'carries' : 'carries no'} audio, and the hook builds its pipeline from this`,
      );
      assert.deepEqual(MODE_CAPS[mode], want, `${mode} declares capabilities the two readers do not agree with`);
    }
  });

  test('a mode that carries no audio can never open a microphone', () => {
    // The invariant underneath the table, so a future edit that sets
    // micAtConnect on a quiet mode fails here as well as above. Every quiet
    // path in this product is a promise that nobody has to speak aloud.
    for (const [mode, caps] of Object.entries(MODE_CAPS)) {
      if (caps.carriesAudio) continue;
      assert.equal(caps.micAtConnect, false, `${mode} carries no audio and still opens a microphone`);
    }
  });

  test('a session that names no mode is the lesson path, unchanged', () => {
    assert.equal(micOpensAtConnect(undefined), true, 'the lesson surface lost its hot microphone');
    assert.equal(modeCarriesAudio(undefined), true, 'the lesson surface lost its voice');
  });
});

describe('Listen only: the voiced grant with the microphone kept closed', () => {
  const MODES: LiveMode[] = ['lesson', 'convo', 'convo-text', 'lesson-text'];

  test('listen only never publishes a microphone at connect, in any mode', () => {
    for (const mode of [...MODES, undefined]) {
      assert.equal(publishesMicAtConnect(mode, true), false, `${String(mode)}: listen only opened the microphone`);
    }
  });

  test('without listen only the connect-time answer is the mode table, unchanged', () => {
    for (const mode of [...MODES, undefined]) {
      assert.equal(publishesMicAtConnect(mode, false), micOpensAtConnect(mode), `${String(mode)}: the ordinary path moved`);
    }
    assert.equal(publishesMicAtConnect('lesson', false), true, 'the lesson lost its hot microphone');
  });

  test('listen only is not a mode: the table still has four rows and the same caps', () => {
    assert.deepEqual(MODE_CAPS, {
      lesson: { carriesAudio: true, micAtConnect: true },
      convo: { carriesAudio: true, micAtConnect: false },
      'convo-text': { carriesAudio: false, micAtConnect: false },
      'lesson-text': { carriesAudio: false, micAtConnect: false },
    });
  });

  test('the hook asks this helper, with the listen-only flag, at the connect-time publish', () => {
    const hook = stripComments(read('../live/useLiveSession.ts'));
    assert.match(hook, /if \(publishesMicAtConnect\(mode, listenOnly\)\) \{\s*await room\.localParticipant\.setMicrophoneEnabled\(true\)/);
    assert.match(hook, /const listenOnly = opts\?\.listenOnly \?\? false;/);
    assert.doesNotMatch(hook, /micOpensAtConnect\(/, 'a second, unfiltered call would reopen the microphone');
  });
});
