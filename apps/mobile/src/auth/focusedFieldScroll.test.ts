import assert from 'node:assert/strict';
import { test } from 'node:test';
import { focusedFieldScroll } from './focusedFieldScroll.ts';

test('a password partly under the keyboard scrolls into the actual body viewport', () => {
  // iPhone 13 mini native QA: body bottom 445, password 426–471.
  assert.equal(focusedFieldScroll(0, 154, 291, 426, 45), 34);
  assert.equal(focusedFieldScroll(34, 154, 291, 392, 45), 34);
});

test('switching focus preserves visible fields and brings fields above or below the viewport back', () => {
  assert.equal(focusedFieldScroll(0, 154, 291, 352, 46), 0);
  assert.equal(focusedFieldScroll(120, 154, 291, 104, 48), 62);
  assert.equal(focusedFieldScroll(60, 154, 291, 420, 48), 91);
  assert.equal(focusedFieldScroll(0, 154, 0, 420, 48), 0);
  assert.equal(focusedFieldScroll(0, 154, 291, 420, 0), 0);
});

test('a visible input still scrolls when its strength guidance below it is obscured', () => {
  assert.equal(focusedFieldScroll(34, 154, 291, 368, 98), 63);
  assert.equal(focusedFieldScroll(63, 154, 291, 339, 98), 63);
});

test('oversized feedback groups keep their label and input visible without oscillating', () => {
  assert.equal(focusedFieldScroll(0, 154, 220, 170, 340), 8);
  assert.equal(focusedFieldScroll(8, 154, 220, 162, 340), 8);
  assert.equal(focusedFieldScroll(200, 154, 220, 130, 340), 168);
});
