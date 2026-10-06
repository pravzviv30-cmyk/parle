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

    // The recorder reports its level; the meter shows it only while a take is
    // recording; the permission is still asked only on the tap.
    const recording = evidence('apps/mobile/src/onboarding/GuestRecording.tsx');
    assert.match(recording, /const TAKE_OPTIONS = \{ \.\.\.RecordingPresets\.HIGH_QUALITY, isMeteringEnabled: true \};/);
    assert.match(recording, /useAudioRecorderState\(recorder, METER_EVERY_MS\)/);
    assert.match(recording, /\{recording \? <MicMeter level=\{meterLevel\(take\.metering\)\} seconds=\{take\.durationMillis \/ 1000\} \/> : null\}/);
    assert.match(recording, /\}, TAKE_CAP_SECONDS \* 1000\);/, 'the take is cut at something other than its cap');
    assert.match(recording, /haptic=\{recording \? 'none' : 'light'\}/, 'the microphone button buzzes while it records');
    assert.match(recording, /haptic=\{recording \? 'none' : undefined\}/, 'Type instead buzzes while the microphone records');
    assert.match(recording, /label=\{FIRST_RUN_COPY\.typeInstead\}/);
    assert.match(recording, /silenceRecordingHaptics\(\)/);

    const meter = evidence('apps/mobile/src/onboarding/firstRun/MicMeter.tsx');
    assert.match(meter, /if \(reduced\) \{ return \( <View style=\{st\.words\}>/, 'reduced motion still draws moving bars');
    assert.match(meter, /hearsVoice\(level\) \? FIRST_RUN_COPY\.hearingYou : FIRST_RUN_COPY\.waitingForVoice/);
    assert.match(meter, /seconds \/ TAKE_CAP_SECONDS/, 'the ring does not fill over the real cap');
    assert.doesNotMatch(meter, /setInterval|setTimeout|playSfx|haptics|tick\(/, 'the meter moves on a clock of its own or makes a sound');
  });
});
