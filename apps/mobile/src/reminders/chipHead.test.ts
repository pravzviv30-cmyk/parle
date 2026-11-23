import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CHIP_INLINE_WIDTH, chipsStack } from './chipHead.ts';

describe('chipsStack: one head layout for the whole talk-day grid', () => {
  test('a 375 cell keeps the tick beside the day', () => {
    assert.equal(chipsStack(75, 1), false);
  });
  test('a 320 cell stacks every head', () => {
    assert.equal(chipsStack(62, 1), true);
  });
  test('larger text stacks a cell that fits at default size', () => {
    assert.equal(chipsStack(75, 1.5), true);
  });
  test('the boundary is the inline width at the font scale', () => {
    assert.equal(chipsStack(CHIP_INLINE_WIDTH(1), 1), false);
    assert.equal(chipsStack(CHIP_INLINE_WIDTH(1) - 1, 1), true);
  });
  test('an unmeasured grid (width 0) stays inline until onLayout lands', () => {
    assert.equal(chipsStack(0, 1), false);
  });
});
