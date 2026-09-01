import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CAFE_FRAME, createProfile } from '@luvani/brain';

import { beginSession } from './sessionLoop.ts';

test('a scene opening keeps the model-authored answer private until the learner asks for help', () => {
  const { lines } = beginSession(createProfile(), CAFE_FRAME);
  const visible = lines.join('\n');

  assert.doesNotMatch(visible, /\[AIDE\]/);
  assert.doesNotMatch(visible, /say:/i);
  const hiddenAnswer = CAFE_FRAME.openingSupport.fullLine.fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.doesNotMatch(visible, new RegExp(hiddenAnswer, 'i'));
});
