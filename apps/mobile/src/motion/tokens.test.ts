/**
 * The motion tokens hold the numbers the come-alive spec gives them — F721.
 *
 * tokens.ts imports nothing, so this suite loads it directly: no engine, no
 * renderer. The springs are checked against the way they are described (a
 * response and a damping ratio) rather than against a copy of their numbers,
 * so a spring retuned by eye fails here instead of drifting.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  BURST_MAX,
  CELEBRATION_MAX_MS,
  DUR,
  EASE,
  INPUT_READY_MS,
  PRESS_SCALE_TILE,
  SELECT_POP,
  SELECT_RING_OPACITY,
  SPRING,
  SPRING_SHAPE,
  STAGGER,
} from './tokens.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('the motion tokens — F721', () => {
  test('spring tokens match their response and damping derivations', () => {
    const names = Object.keys(SPRING_SHAPE).sort();
    assert.deepEqual(Object.keys(SPRING).sort(), names, 'a spring has numbers and no description, or a description and no numbers');
    assert.deepEqual(names, ['pop', 'press', 'settle', 'snap'], 'the four springs are press, pop, settle and snap');
    for (const name of names) {
      const key = name as keyof typeof SPRING;
      const { response, ratio } = SPRING_SHAPE[key];
      const { stiffness, damping, mass } = SPRING[key];
      assert.equal(mass, 1, `${name}: the derivation assumes a mass of 1`);
      const wantStiffness = (2 * Math.PI / response) ** 2;
      assert.ok(
        Math.abs(stiffness - wantStiffness) <= 1,
        `${name}: stiffness ${stiffness} is not (2 PI / ${response})^2 = ${wantStiffness.toFixed(1)}`,
      );
      const wantDamping = 2 * ratio * Math.sqrt(stiffness * mass);
      assert.ok(
        Math.abs(damping - wantDamping) <= 1,
        `${name}: damping ${damping} is not 2 * ${ratio} * sqrt(${stiffness}) = ${wantDamping.toFixed(2)}`,
      );
    }
    // The press is the legacy spring, unchanged: response 0.3, ratio 0.7.
    assert.deepEqual(SPRING.press, { stiffness: 439, damping: 29.3, mass: 1 });
    // The pop overshoots by about 12.6 percent, which is the point of it; the
    // settle barely overshoots at all, which is the point of that.
    const overshoot = (ratio: number): number => Math.exp((-ratio * Math.PI) / Math.sqrt(1 - ratio * ratio));
    assert.ok(Math.abs(overshoot(SPRING_SHAPE.pop.ratio) - 0.126) < 0.005, 'the pop no longer overshoots by about 12.6 percent');
    assert.ok(overshoot(SPRING_SHAPE.settle.ratio) < 0.01, 'the settle overshoots by 1 percent or more');
  });

  test('the durations, staggers, curves and budgets are the spec\'s numbers', () => {
    assert.deepEqual(DUR, {
      instant: 0, micro: 120, fast: 180, base: 260, settle: 380, slow: 420,
      flight: 480, reveal: 650, count: 900, celebrate: 900, burst: 1400,
    });
    assert.deepEqual(STAGGER, { tight: 40, base: 60, loose: 90, tiles: 140 });
    assert.deepEqual(EASE, {
      out: [0.22, 1, 0.36, 1],
      settle: [0.33, 1, 0.68, 1],
      inOut: [0.65, 0, 0.35, 1],
      in: [0.55, 0, 1, 0.45],
      linear: [0, 0, 1, 1],
    });
    assert.equal(PRESS_SCALE_TILE, 0.95);
    assert.equal(SELECT_POP, 1.03);
    assert.equal(SELECT_RING_OPACITY, 0.16);
    assert.equal(INPUT_READY_MS, 600);
    assert.equal(CELEBRATION_MAX_MS, 2600);
    assert.deepEqual(BURST_MAX, { phone: 36, ipad: 56, web: 24 });
    // The settling entrance has one number: the token and the legacy constant agree.
    assert.match(read('../motion.ts'), new RegExp(`export const SETTLE_MS = ${DUR.settle};`), 'DUR.settle and SETTLE_MS disagree');
  });

  test('a tile presses deeper than a control, and the control scale stays a literal in motion.ts', () => {
    // F597 pins `export const PRESS_SCALE = 0.97;` in motion.ts, so the
    // control scale is not a token here; the tile's stronger press is.
    const motion = read('../motion.ts');
    const control = /export const PRESS_SCALE = (0\.\d+);/.exec(motion);
    assert.ok(control, 'motion.ts no longer writes the control press scale as a literal');
    assert.ok(PRESS_SCALE_TILE < Number(control[1]), 'a tile does not press deeper than a control');
    assert.ok(SELECT_POP > 1, 'the select pop does not rise');
    // Pure: a Node suite loads this file, so it may import nothing at all.
    assert.doesNotMatch(read('./tokens.ts'), /^\s*import\b/m, 'tokens.ts imports something, so a Node suite may fail to load it');
  });
});
