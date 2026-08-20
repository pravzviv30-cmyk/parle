/**
 * The return key, and what is actually known about it.
 *
 * The first report of this said Enter was dead on react-native-web and that it
 * had been reproduced live. That claim is retracted. It was a harness artifact:
 * the browser automation sent Return as an empty key event (`key: ""`,
 * `keyCode: 0`), so nothing was ever under test, and a keydown probe run
 * afterwards showed a real `Enter` producing a real event. Enter almost
 * certainly worked before this change.
 *
 * Every test below stands, because none of them ever rested on that report.
 * They rest on react-native-web 0.21.2's own source, read out of
 * `node_modules/react-native-web/dist/exports/TextInput/index.js`:
 *
 *   - `submitBehavior` is inert on RNW 0.21.2. The prop list it destructures
 *     knows only the deprecated `blurOnSubmit`, and `pickProps` is a strict
 *     `forwardPropsList` whitelist, so `submitBehavior` is dropped before the
 *     DOM sees it. The prop the screen already had wired was doing nothing.
 *   - RNW blurs the field after every Enter, because `blurOnSubmit` defaults to
 *     `!multiline`. Web therefore contradicted `submitBehavior="submit"` and
 *     dropped the caret on every send, which is the opposite of what that prop
 *     was asked for.
 *   - `onKeyPress` fires from inside RNW's own `handleKeyDown`, BEFORE its Enter
 *     branch. That is why routing the send through it and calling
 *     `preventDefault()` gives exactly one send, never two, and no blur.
 *   - Separately, the choosing ScrollView was the only input screen in the app
 *     without `keyboardShouldPersistTaps`, which swallows the Send tap on iOS
 *     and Android. That is why the in-scene reply Send worked and the topic Send
 *     did not, and it is pinned by keyboardTaps.test.ts rather than here.
 *
 * enterRecord.test.ts holds this file and the ledger to that story, so neither
 * can drift back into claiming a reproduction nobody made.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { enterSubmits, keyPressFrom } from './enterSubmit.ts';

describe('the return key — whether a typed line has been sent', () => {
  test('pressing enter in a typed input is a send, not a no-op', () => {
    // On web the send has to come from our own handler. RNW never saw the
    // `submitBehavior` prop, and its own Enter branch takes the caret away, so
    // answering yes here is what makes a typed topic leave the box intact.
    assert.equal(
      enterSubmits('web', { key: 'Enter' }, 'the metro'),
      true,
      'a learner who typed a topic and pressed enter has finished asking',
    );
    assert.equal(
      enterSubmits('web', { key: 'Enter' }, '  the metro  '),
      true,
      'stray spaces around a real sentence are not a reason to swallow it',
    );
  });

  test('the same key press does nothing twice on a phone', () => {
    // iOS and Android already send through onSubmitEditing. Answering yes here
    // as well would put the learner's topic on the wire twice.
    assert.equal(enterSubmits('ios', { key: 'Enter' }, 'the metro'), false, 'the native return key already sends');
    assert.equal(enterSubmits('android', { key: 'Enter' }, 'the metro'), false, 'the native return key already sends');
  });

  test('an empty box stays where it is when the learner leans on the return key', () => {
    assert.equal(enterSubmits('web', { key: 'Enter' }, ''), false, 'there is nothing to send');
    assert.equal(enterSubmits('web', { key: 'Enter' }, '   \n '), false, 'whitespace is not a topic');
  });

  test('a learner typing an accented word is not interrupted mid-letter', () => {
    // Enter while an input method is composing confirms the character being
    // built. Reading it as send is how a half-typed French word gets sent.
    assert.equal(
      enterSubmits('web', { key: 'Enter', isComposing: true }, 'un caf'),
      false,
      'the key press belongs to the accent, not to the message',
    );
    assert.equal(
      enterSubmits('web', { key: 'Enter', keyCode: 229 }, 'un caf'),
      false,
      'some browsers report a composition only as the sentinel key code',
    );
  });

  test('holding shift keeps the line open instead of sending it', () => {
    assert.equal(
      enterSubmits('web', { key: 'Enter', shiftKey: true }, 'the metro'),
      false,
      'shift and enter is somebody still writing',
    );
  });

  test('the two platforms hand the same handler two different objects', () => {
    // What react-native-web passes: the synthetic keyboard event, with the DOM
    // event underneath carrying the composition flags.
    const web = { key: 'Enter', shiftKey: false, nativeEvent: { key: 'Enter', isComposing: false, keyCode: 13 } };
    assert.deepEqual(keyPressFrom(web), { key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13 });
    assert.equal(enterSubmits('web', keyPressFrom(web), 'the metro'), true, 'a real browser return key is a send');

    // What react-native passes: a bare key on nativeEvent and nothing else.
    const native = { nativeEvent: { key: 'Enter' } };
    assert.equal(keyPressFrom(native).key, 'Enter', 'the key still has to be found where native puts it');
    assert.equal(enterSubmits('ios', keyPressFrom(native), 'the metro'), false, 'and still must not send twice there');

    // Nothing at all is not a send, and must not throw on the way to saying so.
    assert.deepEqual(keyPressFrom(undefined), {}, 'an event that is not an object cannot be read for a key');
    assert.equal(enterSubmits('web', keyPressFrom(null), 'the metro'), false, 'no key press, no send');
  });

  test('every other key is left alone', () => {
    for (const key of ['a', ' ', 'Backspace', 'Tab', 'ArrowDown', 'Escape']) {
      assert.equal(enterSubmits('web', { key }, 'the metro'), false, `"${key}" is not a send`);
    }
    assert.equal(enterSubmits('web', {}, 'the metro'), false, 'a key press with no key named is not a send');
  });
});
