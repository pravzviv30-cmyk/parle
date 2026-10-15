import assert from 'node:assert/strict';
import { test } from 'node:test';
import { C2_MOTION } from '../../motion/tokens.ts';
import { c2FloatAmount, c2GestureAmount, c2MotionRuns } from './c2MotionPolicy.ts';

test('C2 continuous illustrations never run hidden, backgrounded or before the OS motion answer', () => {
  const visible = { active: true, visible: true, foreground: true, reduced: false };
  assert.equal(c2MotionRuns(visible), true);
  for (const key of ['active', 'visible', 'foreground'] as const) assert.equal(c2MotionRuns({ ...visible, [key]: false }), false, key);
  assert.equal(c2MotionRuns({ ...visible, reduced: true }), false);
  assert.equal(c2MotionRuns({ ...visible, reduced: undefined }), false);
});

test('Figma Rest and Float form a seamless complete loop with zero velocity at the seam', () => {
  assert.equal(C2_MOTION.halfLoopMs * 2, 4800);
  assert.equal(c2FloatAmount(0), 0);
  assert.equal(c2FloatAmount(0.5), 1);
  assert.equal(c2FloatAmount(1), 0);
  assert.ok(Math.abs(c2FloatAmount(0.25) - 0.5) < 0.0001);
  for (let i = 1; i < 500; i++) {
    const phase = i / 1000;
    const value = c2FloatAmount(phase);
    assert.ok(value >= 0 && value <= 1, `${phase}`);
    assert.ok(Math.abs(value - c2FloatAmount(1 - phase)) < 0.0001, `${phase} is not symmetric`);
  }
  const tiny = 0.00001;
  assert.ok(c2FloatAmount(tiny) / tiny < 0.01, 'the outgoing boundary snaps');
  assert.ok(c2FloatAmount(1 - tiny) / tiny < 0.01, 'the incoming boundary snaps');
});

test('the welcome ring waits 800 ms and rotates uniformly through four authored quarters', () => {
  assert.equal(C2_MOTION.ringDelayMs, 800);
  assert.equal(C2_MOTION.ringRotationMs, 8800);
  assert.equal(C2_MOTION.ringRotationMs / 4, 2200);
  assert.deepEqual(C2_MOTION.linear, [0, 0, 1, 1]);
});

test('offset character gestures return to authored rest with a continuous seam', () => {
  for (const offset of [0, 0.125, 0.25, 0.5, 0.875]) {
    assert.equal(c2GestureAmount(0, offset), 0, 'Reduce Motion must show the authored still pose');
    assert.equal(c2GestureAmount(1, offset), 0);
    const baseline = c2FloatAmount(offset);
    for (let i = 0; i <= 100; i++) {
      const pose = c2GestureAmount(i / 100, offset);
      assert.ok(pose >= -baseline - 0.00001 && pose <= 1 - baseline + 0.00001);
    }
    const tiny = 0.0001;
    const outgoing = c2GestureAmount(tiny, offset) / tiny;
    const incoming = -c2GestureAmount(1 - tiny, offset) / tiny;
    assert.ok(Math.abs(outgoing - incoming) < 0.01, `${offset}: seam velocity changes`);
    if (offset === 0 || offset === 0.5) assert.ok(Math.abs(outgoing) < 0.01, `${offset}: seam does not settle`);
  }
});
