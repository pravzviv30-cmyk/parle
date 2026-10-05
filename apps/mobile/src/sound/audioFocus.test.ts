/**
 * The focus holds: counted, each releaser safe to call twice, and observable
 * (docs/come-alive/motion-sound.md section 6.4).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { anyHold, holdLive, holdMic, holdVoice, liveRoom, micLive, subscribe, voiceBusy } from './audioFocus.ts';

describe('who has the learner’s ears', () => {
  test('each hold is counted, and a releaser called twice takes away only its own hold', () => {
    assert.deepEqual([micLive(), voiceBusy(), liveRoom(), anyHold()], [false, false, false, false]);
    const first = holdMic();
    const second = holdMic();
    assert.equal(micLive(), true);
    first();
    first();
    assert.equal(micLive(), true, 'a second release of the first recorder took the second recorder’s hold away');
    second();
    assert.equal(micLive(), false);

    const voice = holdVoice();
    const live = holdLive();
    assert.deepEqual([micLive(), voiceBusy(), liveRoom(), anyHold()], [false, true, true, true]);
    voice();
    assert.deepEqual([voiceBusy(), anyHold()], [false, true]);
    live();
    assert.deepEqual([liveRoom(), anyHold()], [false, false]);
  });

  test('listeners hear every hold and release until they unsubscribe, and one failing listener stops nobody', () => {
    const heard: string[] = [];
    const quiet = subscribe(() => { throw new Error('a listener fails'); });
    const stop = subscribe(() => heard.push(`${micLive()}/${voiceBusy()}/${liveRoom()}`));
    const release = holdMic();
    release();
    release();
    assert.deepEqual(heard, ['true/false/false', 'false/false/false'], 'a double release was announced twice');
    stop();
    quiet();
    holdVoice()();
    assert.equal(heard.length, 2);
  });
});
