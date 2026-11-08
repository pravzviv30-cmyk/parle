import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as silero from '@livekit/agents-plugin-silero';
import { STUCK_SILENCE_MS } from '@luvani/core';

import {
  CUT_OFF_STEP_MS,
  BEGINNER_ENDPOINTING_MAX_DELAY_MS,
  CUT_OFF_WINDOW_MS,
  CutOffTracker,
  ENDPOINTING_MAX_DELAY_MS,
  MOMENT_HOLD_DELAY_MS,
  PAUSE_FLOOR_CAP_MS,
  ThinkingTime,
  endpointingFor,
  type Endpointing,
} from './thinkingTime.ts';
import { turnHandlingFor } from './turnHandling.ts';

describe('thinking time (VOICE-010)', () => {
  test('rungs 1-2 wait at least 1,200 ms, longer than the VAD already waits', async () => {
    // In VAD mode minDelay is max(VAD silence, minDelay). A floor at or under
    // Silero's own silence changes nothing, which is exactly how 400 ms was
    // shadowed before. Read the plugin's default, the one agent.ts loads.
    const vad = await silero.VAD.load();
    const vadSilence = vad.minSilenceDuration;
    assert.ok(typeof vadSilence === 'number', 'Silero no longer reports its silence duration');
    for (const rung of [1, 2] as const) {
      const { minDelay } = endpointingFor({ rung, cutOffs: 0, holding: false });
      assert.ok(minDelay >= 1_200, `rung ${rung} floor ${minDelay} is under 1,200 ms`);
      assert.ok(minDelay > vadSilence, `rung ${rung} floor ${minDelay} is shadowed by Silero's ${vadSilence} ms`);
    }
  });

  test('rungs 3-4 keep 400 ms', () => {
    for (const rung of [3, 4] as const) {
      assert.equal(endpointingFor({ rung, cutOffs: 0, holding: false }).minDelay, 400);
    }
  });

  test('no known rung is a beginner', () => {
    assert.equal(endpointingFor({ cutOffs: 0, holding: false }).minDelay, 1_200);
  });

  test('maxDelay is pinned, not left to the SDK default', () => {
    for (const rung of [3, 4] as const) {
      assert.equal(endpointingFor({ rung, cutOffs: 0, holding: false }).maxDelay, ENDPOINTING_MAX_DELAY_MS);
      assert.equal(endpointingFor({ rung, cutOffs: 2, holding: false }).maxDelay, ENDPOINTING_MAX_DELAY_MS);
    }
    assert.equal(ENDPOINTING_MAX_DELAY_MS, 2_500);
  });

  test('rungs 1-2 wait up to 3,500 ms when the detector holds the turn (VOICE-022)', () => {
    // 2026-11-07 pause table: 3,500 cuts the 2.5 s-pause cut-offs from 6/6 to 1/6
    // at no p50 cost; 2,500 cut every one of them.
    for (const rung of [1, 2] as const) {
      assert.equal(endpointingFor({ rung, cutOffs: 0, holding: false }).maxDelay, BEGINNER_ENDPOINTING_MAX_DELAY_MS);
      assert.equal(endpointingFor({ rung, cutOffs: 2, holding: false }).maxDelay, BEGINNER_ENDPOINTING_MAX_DELAY_MS);
    }
    assert.equal(endpointingFor({ cutOffs: 0, holding: false }).maxDelay, BEGINNER_ENDPOINTING_MAX_DELAY_MS);
    assert.equal(endpointingFor({ rung: 1, cutOffs: 0, holding: true }).maxDelay, BEGINNER_ENDPOINTING_MAX_DELAY_MS);
    for (const rung of [1, 2] as const) {
      assert.ok(endpointingFor({ rung, cutOffs: 0, holding: true }).maxDelay >= endpointingFor({ rung, cutOffs: 0, holding: false }).maxDelay, `holding at rung ${rung} waits less than not holding`);
    }
    assert.equal(BEGINNER_ENDPOINTING_MAX_DELAY_MS, 3_500);
  });

  test('the beginner maxDelay stays a second ahead of the stuck-silence rescue', async () => {
    // The rescue clock (STUCK_SILENCE_MS) is armed when the VAD reports the end
    // of speech, Silero's silence after the last voiced frame; the SDK commits
    // the held turn maxDelay after that frame. Commit must come first, with
    // room for a late final transcript, or the rescue lands on the answer.
    const vad = await silero.VAD.load();
    const vadSilence = vad.minSilenceDuration as number;
    const margin = STUCK_SILENCE_MS + vadSilence - BEGINNER_ENDPOINTING_MAX_DELAY_MS;
    assert.ok(margin >= 1_000, `the turn commits only ${margin} ms before the rescue clock`);
  });

  test('each cut-off adds 400 ms and the floor never passes 2,000 ms', () => {
    assert.equal(CUT_OFF_STEP_MS, 400);
    assert.equal(endpointingFor({ rung: 1, cutOffs: 1, holding: false }).minDelay, 1_600);
    assert.equal(endpointingFor({ rung: 1, cutOffs: 2, holding: false }).minDelay, 2_000);
    for (let cutOffs = 0; cutOffs < 20; cutOffs++) {
      for (const rung of [1, 2, 3, 4] as const) {
        assert.ok(endpointingFor({ rung, cutOffs, holding: false }).minDelay <= PAUSE_FLOOR_CAP_MS);
      }
    }
    assert.equal(PAUSE_FLOOR_CAP_MS, 2_000);
  });

  test('a hold waits 2,500 ms and its release restores the floor', () => {
    const applied: Endpointing[] = [];
    const t = new ThinkingTime(1, (e) => applied.push(e));
    t.holding(true);
    assert.equal(t.endpointing.minDelay, MOMENT_HOLD_DELAY_MS);
    assert.equal(MOMENT_HOLD_DELAY_MS, 2_500);
    t.holding(false);
    assert.equal(t.endpointing.minDelay, 1_200);
    assert.deepEqual(applied, [{ minDelay: 2_500, maxDelay: 3_500 }, { minDelay: 1_200, maxDelay: 3_500 }]);
  });

  test('a rung move that changes only maxDelay still reaches the session', () => {
    // At four cut-offs both rungs sit on the 2,000 ms floor cap, so the move
    // between rung 2 and rung 3 changes nothing but maxDelay.
    let now = 0;
    const applied: Endpointing[] = [];
    const t = new ThinkingTime(2, (e) => applied.push(e), () => now);
    for (let i = 0; i < 4; i++) {
      t.turnCommitted();
      now += 500;
      t.learnerSpeechStarted();
      now += 5_000;
    }
    assert.equal(t.endpointing.minDelay, 2_000);
    applied.length = 0;
    t.rung(3);
    t.rung(2);
    assert.deepEqual(applied, [{ minDelay: 2_000, maxDelay: 2_500 }, { minDelay: 2_000, maxDelay: 3_500 }]);
  });

  test('a learner who starts after the tutor began speaking, or after 1,500 ms, is not cut off', () => {
    const tracker = new CutOffTracker();
    tracker.turnCommitted(0);
    tracker.tutorSpeaking();
    assert.equal(tracker.learnerSpeechStarted(200), false, 'the tutor had already begun its reply');

    tracker.turnCommitted(10_000);
    assert.equal(tracker.learnerSpeechStarted(10_000 + CUT_OFF_WINDOW_MS + 1), false, 'too late to be the rest of the sentence');

    tracker.turnCommitted(20_000);
    assert.equal(tracker.learnerSpeechStarted(20_900), true);
    assert.equal(tracker.learnerSpeechStarted(21_000), false, 'one committed turn counts once');
    assert.equal(tracker.count, 1);
  });

  test('a cut-off raises the floor the session is given, and only real changes reach it', () => {
    let now = 0;
    const applied: Endpointing[] = [];
    const t = new ThinkingTime(2, (e) => applied.push(e), () => now);
    t.rung(2); // same value: nothing sent
    assert.equal(applied.length, 0);
    t.turnCommitted();
    now = 700;
    t.learnerSpeechStarted();
    assert.deepEqual(applied, [{ minDelay: 1_600, maxDelay: 3_500 }]);
    t.rung(3); // a fluent rung keeps the cut-off it earned
    assert.equal(t.endpointing.minDelay, 800);
  });

  test('the session is built on the starting rung', () => {
    assert.equal(turnHandlingFor('convo', { startRung: 1 }).endpointing.minDelay, 1_200);
    assert.equal(turnHandlingFor('lesson', { startRung: 4 }).endpointing.minDelay, 400);
    assert.equal(turnHandlingFor('convo').endpointing.minDelay, 1_200);
    assert.equal(turnHandlingFor('convo').endpointing.maxDelay, 3_500);
    assert.equal(turnHandlingFor('lesson', { startRung: 4 }).endpointing.maxDelay, 2_500);
  });
});
