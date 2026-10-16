import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInputReplyTiming, createSceneReplyTiming } from './sceneReplyTiming.ts';

test('confirmed input stage timing separates queue, brain, checkpoint and transport dispatch with exact clocks', () => {
  let now = 100; const lines: string[] = [];
  const timing = createInputReplyTiming(() => now, line => lines.push(line));
  const record = timing.begin('typed');
  now = 110; record.mark('queueStarted'); now = 115; record.mark('brainSent');
  now = 155; record.mark('brainParsed'); now = 157; record.mark('checkpointStarted');
  now = 177; record.mark('checkpointAcknowledged'); now = 180; record.mark('viewDispatched');
  record.finish('dispatched');
  const report = timing.snapshot('typed');
  assert.equal(report.n, 1); assert.equal(report.stages.queue.n, 1);
  for (const [stage, expected] of Object.entries({ queue: 10, prepare: 5, brain: 40, integrate: 2, checkpoint: 20, dispatch: 3, inputToView: 80 })) {
    assert.deepEqual(report.stages[stage as keyof typeof report.stages], { n: 1, p50Ms: expected, p95Ms: expected });
  }
  assert.equal(report.stages.inputToSay.n, 0, 'a typed reply has no fabricated speech dispatch');
  assert.equal(timing.snapshot('spoken').n, 0, 'input cohorts never mix');
  assert.match(lines[0]!, /boundary=confirmed-input-to-view-dispatch input=typed outcome=dispatched queue=10ms/);
  assert.doesNotMatch(lines[0]!, /eou|audible|session|user|text=/i);
});

test('input stage timing excludes missing checkpoints, reordered clocks, failures and cancellation', () => {
  let now = 100; const timing = createInputReplyTiming(() => now);
  const missing = timing.begin('spoken'); missing.mark('queueStarted'); missing.mark('brainSent'); missing.mark('brainParsed'); missing.mark('viewDispatched'); missing.finish('dispatched');
  const backwards = timing.begin('spoken'); backwards.mark('queueStarted'); backwards.mark('brainSent');
  now = 99; backwards.mark('brainParsed'); now = 101; backwards.mark('checkpointStarted'); backwards.mark('checkpointAcknowledged'); backwards.mark('viewDispatched'); backwards.finish('dispatched');
  timing.begin('spoken').finish('failed'); timing.begin('spoken').finish('cancelled');
  for (const invalid of [Number.NaN, Infinity, -1]) {
    now = invalid; const record = timing.begin('spoken');
    now = 200; for (const stage of ['queueStarted', 'brainSent', 'brainParsed', 'checkpointStarted', 'checkpointAcknowledged', 'viewDispatched'] as const) record.mark(stage);
    record.finish('dispatched');
  }
  assert.equal(timing.snapshot('spoken').n, 0); assert.equal(timing.snapshot('spoken').missing, 5);
  assert.equal(timing.snapshot('spoken').failed, 1); assert.equal(timing.snapshot('spoken').cancelled, 1);
  assert.equal(timing.snapshot('spoken').stages.brain.p50Ms, null);
});

test('input timing bounds each cohort, validates speech dispatch and contains telemetry callback failure', () => {
  let now = 0; const timing = createInputReplyTiming(() => now, () => { throw new Error('sink failure'); });
  for (let i = 1; i <= 140; i++) {
    now = i * 1000; const record = timing.begin('spoken'); record.mark('queueStarted'); record.mark('brainSent'); record.mark('brainParsed'); record.mark('checkpointStarted'); record.mark('checkpointAcknowledged');
    now += i; record.mark('viewDispatched'); now += 1; record.mark('sayCalled'); record.finish('dispatched', true); record.finish('failed');
  }
  assert.equal(timing.snapshot('spoken').n, 128); assert.equal(timing.snapshot('spoken').stages.inputToView.p50Ms, 76);
  assert.equal(timing.snapshot('spoken').stages.inputToSay.p95Ms, 135);
  const noSpeech = timing.begin('spoken');
  for (const stage of ['queueStarted', 'brainSent', 'brainParsed', 'checkpointStarted', 'checkpointAcknowledged', 'viewDispatched'] as const) noSpeech.mark(stage);
  noSpeech.finish('dispatched', true); assert.equal(timing.snapshot('spoken').missing, 1);
  const pending = timing.begin('typed'); const summaries = timing.close(); pending.mark('brainSent'); pending.finish('dispatched');
  assert.deepEqual(timing.close(), summaries); assert.equal(timing.snapshot('typed').cancelled, 1);
  timing.begin('typed').finish('dispatched'); assert.equal(timing.snapshot('typed').started, 1);
});

test('queued scene timing keeps its own speech end and omits failed or missing samples', () => {
  let now = 100;
  const timing = createSceneReplyTiming(() => now);
  timing.speechEnded(now);
  const first = timing.begin();
  now = 200; timing.speechEnded(now);
  const second = timing.begin();
  now = 300; first.mark('brainSent');
  now = 400; first.mark('brainParsed');
  now = 500; first.mark('sayCalled'); first.finish('dispatched');
  now = 600; second.mark('brainSent');
  now = 700; second.mark('brainParsed');
  now = 900; second.mark('sayCalled'); second.finish('dispatched');
  first.finish('failed');
  const failed = timing.begin(); failed.finish('failed');
  const missing = timing.begin(); missing.mark('sayCalled'); missing.finish('dispatched');
  const report = timing.snapshot();
  assert.deepEqual(report, {
    started: 4, dispatched: 3, failed: 1, cancelled: 0, missing: 1,
    active: 0, n: 2, p50Ms: 400, p95Ms: 700,
  });
  assert.match(timing.format(), /boundary=framework-eou-to-say/);
  assert.match(timing.format(), /first-audio=unmeasured phone-audible=unmeasured/);
});

test('stale, negative, reordered and incomplete timing marks never become a fast reply', () => {
  let now = 20;
  const timing = createSceneReplyTiming(() => now);
  timing.speechEnded(10); timing.speechStarted();
  const stale = timing.begin(); stale.finish('dispatched');
  timing.speechEnded(30);
  const future = timing.begin(); future.mark('brainSent'); future.mark('brainParsed'); future.mark('sayCalled'); future.finish('dispatched');
  timing.speechEnded(15);
  const reordered = timing.begin(); reordered.mark('brainSent');
  now = 19; reordered.mark('brainParsed');
  now = 21; reordered.mark('sayCalled'); reordered.finish('dispatched');
  timing.speechEnded(Number.NaN);
  const absent = timing.begin(); absent.mark('sayCalled'); absent.finish('dispatched');
  assert.equal(timing.snapshot().n, 0);
  assert.equal(timing.snapshot().missing, 4);
  assert.equal(timing.snapshot().p50Ms, null);
  assert.equal(timing.snapshot().p95Ms, null);
  assert.doesNotMatch(timing.format(), /p50=0|p95=0/);
});

test('scene latency keeps a bounded comparable cohort and exposes its sample count', () => {
  let now = 0;
  const timing = createSceneReplyTiming(() => now);
  for (let i = 1; i <= 140; i++) {
    now = i * 1000; timing.speechEnded(now);
    const record = timing.begin(); record.mark('brainSent'); record.mark('brainParsed');
    now += i; record.mark('sayCalled'); record.finish('dispatched');
  }
  assert.equal(timing.snapshot().n, 128);
  assert.equal(timing.snapshot().started, 140);
  assert.equal(timing.snapshot().p50Ms, 76);
  assert.equal(timing.snapshot().p95Ms, 134);
  assert.match(timing.format(), /window=last128 n=128/);
});

test('closing timing cancels active records once and late marks cannot add samples', () => {
  const timing = createSceneReplyTiming(() => 20);
  timing.speechEnded(10);
  const pending = timing.begin(); pending.mark('brainSent');
  const first = timing.close();
  pending.mark('brainParsed'); pending.mark('sayCalled'); pending.finish('dispatched');
  timing.begin().finish('dispatched');
  assert.equal(timing.close(), first);
  assert.equal(timing.snapshot().cancelled, 1);
  assert.equal(timing.snapshot().n, 0);
  assert.equal(timing.snapshot().started, 1);
});

test('an excluded input consumes its speech end without entering the measured cohort', () => {
  const timing = createSceneReplyTiming(() => 20);
  timing.speechEnded(10);
  timing.begin(false).finish('dispatched');
  const next = timing.begin(); next.mark('brainSent'); next.mark('brainParsed'); next.mark('sayCalled'); next.finish('dispatched');
  assert.equal(timing.snapshot().started, 1);
  assert.equal(timing.snapshot().missing, 1);
  assert.equal(timing.snapshot().n, 0);
});

test('ambiguous speech boundaries are missing rather than falsely fast samples', () => {
  for (const nextStarts of [true, false]) {
    let now = 100;
    const timing = createSceneReplyTiming(() => now);
    timing.speechEnded(now);
    if (nextStarts) timing.speechStarted();
    now = 200; timing.speechEnded(now);
    const first = timing.begin(); first.mark('brainSent'); first.mark('brainParsed');
    now = 240; first.mark('sayCalled'); first.finish('dispatched');
    const second = timing.begin(); second.mark('brainSent'); second.mark('brainParsed'); second.mark('sayCalled'); second.finish('dispatched');
    assert.equal(timing.snapshot().n, 0, 'neither input can borrow the other boundary');
    assert.equal(timing.snapshot().missing, 2);
    timing.speechStarted(); timing.speechEnded(now);
    const unambiguous = timing.begin(); unambiguous.mark('brainSent'); unambiguous.mark('brainParsed');
    now = 260; unambiguous.mark('sayCalled'); unambiguous.finish('dispatched');
    assert.equal(timing.snapshot().n, 1, 'a fresh complete boundary becomes eligible again');
    assert.equal(timing.snapshot().p50Ms, 20);
  }
});

test('a newer boundary cannot revive attribution while older callbacks remain outstanding', () => {
  let now = 100;
  const timing = createSceneReplyTiming(() => now);
  const finish = () => { const record = timing.begin(); record.mark('brainSent'); record.mark('brainParsed'); record.mark('sayCalled'); record.finish('dispatched'); };
  timing.speechEnded(now);
  timing.speechStarted(); now = 200; timing.speechEnded(now);
  now = 220; finish();
  timing.invalidate(); // A typed control is not another physical-turn callback.
  timing.speechStarted(); now = 300; timing.speechEnded(now);
  now = 320; finish(); finish();
  assert.equal(timing.snapshot().n, 0);
  assert.equal(timing.snapshot().missing, 3);
  timing.speechStarted(); timing.speechEnded(now);
  now = 340; finish();
  assert.equal(timing.snapshot().n, 1);
  assert.equal(timing.snapshot().p50Ms, 20);
});

test('worker first-frame quantiles require guarded ordered clocks and ignore late or failed replies', () => {
  let now = 100; const timing = createSceneReplyTiming(() => now);
  const dispatch = () => { timing.speechEnded(now); const record = timing.begin(); record.mark('brainSent'); record.mark('brainParsed'); now += 20; record.mark('sayCalled'); record.finish('dispatched'); return record; };
  const one = dispatch(); now += 30; one.firstFrame?.(); one.firstFrame?.();
  assert.equal(timing.audioSnapshot().n, 1); assert.equal(timing.audioSnapshot().p50Ms, 50);
  const late = dispatch(); timing.close(); now += 10; late.firstFrame?.();
  assert.equal(timing.audioSnapshot().n, 1);
  assert.match(timing.audioFormat(), /boundary=framework-eou-to-worker-tts-frame/);
  assert.match(timing.audioFormat(), /phone-audible=unmeasured/);
});
