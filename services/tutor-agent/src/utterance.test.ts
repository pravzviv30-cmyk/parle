import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { AudioFrame } from '@livekit/rtc-node';
import { stt } from '@livekit/agents';

import { UtteranceTap, audioScoringEnabled, observeEvents, observeFrames } from './utterance.ts';
import { decodeWav } from './wav.ts';

const RATE = 16_000;
const FRAME_MS = 100;
const SAMPLES = (RATE * FRAME_MS) / 1000;

/** One frame of a steady tone, so a slice is identifiable by its contents. */
function frame(marker: number): AudioFrame {
  const data = new Int16Array(SAMPLES).fill(marker);
  return new AudioFrame(data, RATE, 1, SAMPLES);
}

function finalTranscript(startTime: number, endTime: number): stt.SpeechEvent {
  return {
    type: stt.SpeechEventType.FINAL_TRANSCRIPT,
    alternatives: [{ language: 'fr', text: 'un café', startTime, endTime, confidence: 0.9 }],
  } as unknown as stt.SpeechEvent;
}

/** Feed `seconds` of audio, one 100 ms frame at a time. */
function feed(tap: UtteranceTap, seconds: number, marker = 1000): void {
  for (let i = 0; i < (seconds * 1000) / FRAME_MS; i++) tap.push(frame(marker));
}

describe('capturing what the learner said', () => {
  test('an utterance carries the duration the recogniser measured', () => {
    const tap = new UtteranceTap();
    feed(tap, 3);

    // Deepgram reports where the words actually were, which is not where the
    // stream started — the silence either side is not speaking time.
    const captured = tap.observe(finalTranscript(0.5, 2.0));

    assert.ok(captured, 'an utterance was spoken and must be captured');
    assert.equal(captured.durationSec, 1.5);

    const wav = decodeWav(captured.wav);
    assert.equal(wav.sampleRate, RATE);
    assert.equal(wav.channels, 1);
    // Frames are whole; the slice is the frames that overlap the window.
    assert.equal(wav.samples.length / RATE, 1.5);
  });

  test('the captured audio is the utterance, not the whole stream', () => {
    const tap = new UtteranceTap();
    feed(tap, 2, 111); // before
    feed(tap, 1, 222); // the utterance
    feed(tap, 2, 333); // after

    const captured = tap.observe(finalTranscript(2.0, 3.0));
    assert.ok(captured);
    const wav = decodeWav(captured.wav);
    assert.ok(
      [...wav.samples].every((s) => s === 222),
      'the slice must contain only the frames inside the reported window',
    );
  });

  test('a recogniser with no usable timings still yields the audio it heard', () => {
    const tap = new UtteranceTap();
    tap.observe({ type: stt.SpeechEventType.START_OF_SPEECH } as unknown as stt.SpeechEvent);
    feed(tap, 1.2);

    // A reconnect can shift the recogniser's clock out from under us. Falling
    // back to "everything since speech started" is never wrong by more than the
    // leading silence, and is much better than scoring nothing.
    const captured = tap.observe(finalTranscript(99, 99));
    assert.ok(captured, 'a broken timestamp must not cost the learner their score');
    assert.equal(Math.round(captured.durationSec * 10) / 10, 1.2);
  });

  test('the buffer stays bounded however long the learner talks', () => {
    const tap = new UtteranceTap();
    feed(tap, 120);
    const captured = tap.observe(finalTranscript(0, 120));
    assert.ok(captured);
    const wav = decodeWav(captured.wav);
    assert.ok(wav.samples.length / RATE <= 31, 'raw PCM is held in memory; the window is capped at 30s');
  });

  test('taking an utterance clears it, so no turn is scored on the last turn audio', () => {
    const tap = new UtteranceTap();
    feed(tap, 1);
    tap.observe(finalTranscript(0, 1));

    assert.ok(tap.take(), 'the turn that just ended gets its audio');
    assert.equal(tap.take(), null, 'and the next turn does not inherit it');
  });

  test('frames pass through to the recogniser untouched', async () => {
    const tap = new UtteranceTap();
    const source = (async function* () {
      for (let i = 0; i < 5; i++) yield frame(7);
    })();

    const seen: AudioFrame[] = [];
    for await (const f of observeFrames(source, tap)) seen.push(f);

    assert.equal(seen.length, 5, 'recognition must see exactly what it would have seen');
    assert.equal(Math.round(tap.elapsedSec * 10) / 10, 0.5);
  });

  test('events pass through while the end of an utterance is noticed', async () => {
    const tap = new UtteranceTap();
    feed(tap, 1);
    const source = (async function* () {
      yield 'interim';
      yield finalTranscript(0, 1);
    })();

    const seen = [];
    for await (const e of observeEvents(source, tap)) seen.push(e);

    assert.equal(seen.length, 2);
    assert.ok(tap.take(), 'the utterance was captured on the way past');
  });
});

describe('the audio scoring flag', () => {
  test('scoring stays off until it is deliberately turned on', () => {
    assert.equal(audioScoringEnabled({}), false);
    assert.equal(audioScoringEnabled({ LUVANI_AUDIO_SCORING: '' }), false);
    assert.equal(audioScoringEnabled({ LUVANI_AUDIO_SCORING: 'true' }), false, 'one spelling, so a typo cannot half-enable it');
    assert.equal(audioScoringEnabled({ LUVANI_AUDIO_SCORING: '1' }), true);
  });
});
