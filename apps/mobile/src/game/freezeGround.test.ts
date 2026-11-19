/**
 * The freeze crystal on a dark ground (Board A): the blue crystal falls under
 * the 3:1 floor for marks on dark paper, so dark mode draws the white one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { freezeGround } from './freezeGround.ts';

const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('the freeze crystal is white on a dark ground and blue on paper', () => {
  assert.equal(freezeGround('dark'), 'blue');
  assert.equal(freezeGround('light'), 'paper');
  // Every FreezeMark on these dark-aware screens takes its ground from the mode.
  for (const [path, count] of [['./StreakParts.tsx', 2], ['../celebrate/EndScene.tsx', 1]] as const) {
    const marks = read(path).match(/<FreezeMark [^>]*\/>/g) ?? [];
    assert.equal(marks.length, count, `${path} draws a different number of freeze marks`);
    for (const mark of marks) assert.match(mark, /ground=\{freezeGround\(t\.mode\)\}/, `${path}: ${mark} is blue on a dark ground`);
  }
});
