import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import type { ConvoSupportView } from '@luvani/core';

import { TAP_TO_TALK } from './choosingView.ts';
import { OPEN_MIC_LABEL, SIMPLER, hasSayableSupportLine, sceneControls, simplerLabel, typedTurn } from './sceneControls.ts';
import { PACE_ROW } from './pace.ts';

const fullLine: ConvoSupportView = {
  kind: 'full-line',
  line: 'Je voudrais un café, sil vous plaît.',
  written: null,
  gloss: 'I would like a coffee, please.',
};
const hint: ConvoSupportView = { kind: 'hint', hint: 'Ask for a coffee.' };
const options: ConvoSupportView = { kind: 'options', options: [{ text: 'Un café.', en: 'A coffee.' }] };
const none: ConvoSupportView = { kind: 'none' };

const controls = (over: Partial<Parameters<typeof sceneControls>[0]> = {}) =>
  sceneControls({ supportView: fullLine, textMode: false, listening: true, typingOpen: false, micOpen: true, ...over });

describe('the controls a live scene offers', () => {
  test('hear it hides when there is no line the tutor would vouch for', () => {
    // The button used to be drawn on every support view, and `hear` speaks the
    // support line: on a hint turn, an options turn or a bare turn there is no
    // such line, so it was pressable and silent. A control that does nothing
    // teaches a learner the app is broken.
    assert.equal(controls({ supportView: fullLine }).showHearIt, true, 'the one turn with a line lost its replay');
    assert.equal(controls({ supportView: hint }).showHearIt, false);
    assert.equal(controls({ supportView: options }).showHearIt, false);
    assert.equal(controls({ supportView: none }).showHearIt, false);
    // An empty string is a line in name only.
    assert.equal(controls({ supportView: { ...fullLine, line: '   ' } }).showHearIt, false);

    // The two conditions that were already right stay right: a replay must not
    // talk over the tutor, and a typed session has no voice to replay.
    assert.equal(controls({ listening: false }).showHearIt, false);
    assert.equal(controls({ textMode: true }).showHearIt, false);

    assert.equal(hasSayableSupportLine(fullLine), true);
    assert.equal(hasSayableSupportLine(none), false);
  });

  test('type instead sends a typed turn through the ordinary path mid-scene', () => {
    // The offer stands in a voice scene until it is taken, and taking it opens
    // the box in place rather than switching the session to text mode, which
    // would rebuild the room and cost the learner the scene they are in.
    const voice = controls();
    assert.equal(voice.showTypeInstead, true, 'a voice scene offers no way to type');
    assert.equal(voice.showInput, false);

    const opened = controls({ typingOpen: true });
    assert.equal(opened.showInput, true, 'tapping Type instead opened nothing');
    assert.equal(opened.showTypeInstead, false, 'the offer is still up after it was taken');

    // A voiceless session was always this way and is not offered a choice.
    const typed = controls({ textMode: true });
    assert.equal(typed.showInput, true);
    assert.equal(typed.showTypeInstead, false);

    // And what it sends is the ordinary turn: the same `say` the text-mode
    // session sends, which the agent already treats as a full typed turn. No
    // new tag, no mode, nothing that restarts a session.
    assert.deepEqual(typedTurn('  Je voudrais un café  '), { t: 'say', text: 'Je voudrais un café' });
    assert.equal(typedTurn(''), null);
    assert.equal(typedTurn('   '), null);
  });
});

describe('a mission scene the learner cannot speak into — F274', () => {
  /**
   * The whole bug in one assertion. A mission runs in `convo`, which does not
   * open the microphone at connect, and the only circle that opened one lived
   * in the choosing block — which the mission's own scene unmounts within a
   * frame. The learner was left with an orb drawn in its listening state above
   * a microphone that did not exist.
   */
  test('a scene with a closed microphone offers the circle that opens it', () => {
    assert.equal(controls({ micOpen: false }).showOpenMic, true);
  });

  test('the scene stops offering the circle once the microphone is open', () => {
    // Not a toggle. Closing it again is the quiet door's job, and two controls
    // claiming the same circle is how the choosing orb got its own bug.
    assert.equal(controls({ micOpen: true }).showOpenMic, false);
  });

  test('a scene in text mode never offers a microphone', () => {
    // A voiceless session is a promise, not a preference: the learner chose a
    // room that publishes nothing, and an orb offering to open one would be the
    // app asking again after being told.
    assert.equal(controls({ micOpen: false, textMode: true }).showOpenMic, false);
    assert.equal(controls({ micOpen: true, textMode: true }).showOpenMic, false);
  });

  test('the offer stands while the tutor is still speaking', () => {
    // `listening` gates the replay button because a replay would talk over the
    // tutor. Opening a microphone does not make a sound, and a learner who
    // wants to answer early should not have to wait to be allowed to try.
    assert.equal(controls({ micOpen: false, listening: false }).showOpenMic, true);
  });

  test('the offer survives the typing box being open', () => {
    // Typing mid-scene is a detour, not a decision. The circle stays.
    assert.equal(controls({ micOpen: false, typingOpen: true }).showOpenMic, true);
  });

  test('it wears the words the chooser already promised', () => {
    // The consent sentence is TAP_TO_TALK and it lives in one place. A second
    // copy here is how the promise and the button drift apart.
    assert.equal(OPEN_MIC_LABEL, TAP_TO_TALK);
  });
});

describe('the screen actually wires it — F274', () => {
  /**
   * The view-model being right is worth nothing if nothing renders it. That is
   * exactly how F274 survived: `micAtConnect: false` was correct, deliberate and
   * tested, and the control it implied was never drawn. ConvoScreen cannot be
   * imported here — it pulls in react-native — so the wiring is read.
   */
  const screen = () => readFileSync(new URL('../ConvoScreen.tsx', import.meta.url), 'utf8');

  test('both conversation rooms wire the same reversible microphone control', () => {
    const source = screen();
    const calls = [...source.matchAll(/onMic=\{\(\) => void \(live\.micOpen \? live\.pauseMic\(\) : live\.openMic\(\)\)\}/g)];
    assert.equal(
      calls.length,
      2,
      'both the opening and the active scene must offer their current room microphone',
    );
  });

  test('the shared live room gates the microphone and mode by real room readiness', () => {
    const source = screen();
    assert.match(source, /micOpen: live\.micOpen/, 'sceneControls cannot decide without being told');
    const room = readFileSync(new URL('../live/C2LiveRoom.tsx', import.meta.url), 'utf8');
    assert.match(room, /typing \? <View style=\{st\.composer\}>/, 'typing must draw a composer instead of the microphone control');
    // 2026-10-21 UI-008, artboards B-Live and B-LiveHelp: the mic is the sun MicControl.
    assert.match(room, /!typing && ready \? <MicControl/, 'a room that is not ready must not offer a microphone');
    assert.match(room, /canResumeSpeaking\(startedWithSpeech, ready, modePending\)/, 'the speaking segment must respect the server speech capability');
  });

  test('a closed microphone is never drawn as listening', () => {
    // The half that made the other half invisible.
    assert.match(screen(), /controls\.showOpenMic\s*\n?\s*\? 'ready'/);
  });
});

/**
 * "Slower" becomes "Simpler" — notebook Phase 4 (B1), report change 25.
 *
 * The control never slowed anything: the voice plays at the speed the cache
 * holds, and what the tap changes is the prompt, shorter sentences and simpler
 * words (tutor/pace.ts says the same about the Profile switch). So the label
 * says what it does. The agent reads the wire tag `{ t: 'slower' }` and never a
 * label, so the tag stays; this is checked against the agent's own source
 * rather than assumed.
 */
describe('the simpler control', () => {
  const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

  test('is labelled Simpler, says what it asks for, and still sends the slower tag the agent reads', () => {
    assert.equal(SIMPLER, 'Simpler');
    assert.equal(simplerLabel('Céline'), 'Ask Céline to say it more simply');
    const screen = read('../ConvoScreen.tsx');
    assert.ok(screen.includes('label="Simpler"'), 'the scene control is not labelled Simpler');
    assert.ok(!screen.includes('>Slower</Text>'), 'the scene control still promises a slower voice');
    assert.match(screen, /accessibilityLabel=\{simplerLabel\(tutorName\)\}/, 'a screen reader still hears a promise about speed');
    assert.match(screen, /live\.sendSlower\(\);/, 'the control stopped sending the tag the agent acts on');
    // The agent decides on the tag, never on the words on the button.
    const agent = read('../../../../services/tutor-agent/src/convo.ts');
    assert.match(agent, /msg\.t === 'slower'/, 'the agent no longer reads the slower tag; this test is stale');
    assert.doesNotMatch(agent, /'Slower'|"Slower"|'Simpler'|"Simpler"/, 'the agent reads a button label, which a relabel would break');
    // And the Profile switch that sets the same thing says the same thing.
    assert.equal(PACE_ROW, 'Tutor speaks more simply');
  });
});
