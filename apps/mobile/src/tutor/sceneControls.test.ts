import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ConvoSupportView } from '@parle/core';

import { hasSayableSupportLine, sceneControls, typedTurn } from './sceneControls.ts';

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
  sceneControls({ supportView: fullLine, textMode: false, listening: true, typingOpen: false, ...over });

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
