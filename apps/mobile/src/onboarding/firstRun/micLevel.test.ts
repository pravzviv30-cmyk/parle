/**
 * The microphone meter on the first run's spoken reply (come alive, README
 * Part 5.C row 7): five bars that stand with the real level of the take, a
 * ring over its real twenty-second cap, words under reduced motion, and no
 * sound or haptic while the microphone is open. The numbers are pure; the
 * wiring is read from source (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../../test/evidence.ts';
import { BAR_REST, BAR_SHAPE, barScales, hearsVoice, meterLevel } from './micLevel.ts';

describe('the microphone meter', () => {
  test('the microphone meter moves only with the real level of the take', () => {
    assert.equal(meterLevel(-160), 0, 'silence moves the meter');
    assert.equal(meterLevel(-50), 0);
    assert.equal(meterLevel(-25), 0.5);
    assert.equal(meterLevel(0), 1);
    assert.equal(meterLevel(6), 1, 'a reading over full overflows the meter');
    for (const broken of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(meterLevel(broken), 0, `${String(broken)} moves the meter`);
    assert.equal(BAR_SHAPE.length, 5, 'the meter is not five bars');
    assert.deepEqual(barScales(0), BAR_SHAPE.map(() => BAR_REST), 'a quiet meter is not at rest');
    assert.deepEqual(barScales(1), BAR_SHAPE.map((share) => BAR_REST + (1 - BAR_REST) * share));
    assert.deepEqual(barScales(Number.NaN), barScales(0));
    assert.equal(hearsVoice(meterLevel(-48)), false, 'the room is read as a voice');
    assert.equal(hearsVoice(meterLevel(-30)), true, 'a voice is read as the room');

    // The replacement reads the same actual room tracks as the regular tutor.
    const recording = evidence('apps/mobile/src/onboarding/FirstLivePractice.tsx');
    assert.match(recording, /<RoomLevels micTrack=\{live\.audioTracks\.mic\} tutorTrack=\{live\.audioTracks\.tutor\}/);
    assert.match(recording, /<VoiceOrb state=\{state\}/);
    assert.match(recording, /await live\.pauseMic\(\)/);
    const meter = evidence('apps/mobile/src/live/RoomLevels.tsx');
    assert.match(meter, /getFloatTimeDomainData/);
    assert.match(meter, /useReduceMotion/);
    assert.doesNotMatch(recording, /useAudioRecorder|<MicMeter|setInterval/);
  });
});
