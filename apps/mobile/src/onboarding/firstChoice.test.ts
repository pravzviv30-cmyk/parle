import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_CHOICES, firstChoiceFeedback } from './firstChoice.ts';
import { FIRST_LINE } from './firstRun.ts';
test('the first local choice distinguishes coffee from water without inventing an assessment', () => {
  assert.equal(FIRST_CHOICES[0].fr, FIRST_LINE.reply.fr);
  assert.match(firstChoiceFeedback('water', false), /water/);
  assert.match(firstChoiceFeedback('coffee', false), /chose/);
  assert.match(firstChoiceFeedback('coffee', true), /hint/);
  for (const choice of FIRST_CHOICES) assert.doesNotMatch(firstChoiceFeedback(choice.id, false), /passed|mastered|pronunciation|fluent|perfect/i);
});
