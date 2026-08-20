import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { ServerMessage } from '@parle/core';
import { thinkingAfter } from './thinking.ts';

/** The learner has said something and is waiting on the tutor. */
const WAITING = true;

describe('is the tutor still deciding', () => {
  test('a trouble notice stops the tutor looking like it is still thinking', () => {
    // The bug: the tutor says "I cannot answer that one" and the orb beside the
    // message went on insisting it was thinking — and the notice cleared itself
    // after eight seconds while the orb never did.
    const notice: ServerMessage = { t: 'error', message: 'Say that once more for me.' };
    assert.equal(thinkingAfter(WAITING, notice), false);
  });

  test('a final transcript starts the wait', () => {
    assert.equal(thinkingAfter(false, { t: 'transcript', text: 'Bonjour', final: true }), true);
  });

  test('a partial transcript changes nothing — they are still talking', () => {
    assert.equal(thinkingAfter(false, { t: 'transcript', text: 'Bon', final: false }), false);
    assert.equal(thinkingAfter(WAITING, { t: 'transcript', text: 'Bon', final: false }), true);
  });

  test('every shape of answer ends the wait', () => {
    const answers: ServerMessage[] = [
      { t: 'prompt', prompt: {} as never },
      { t: 'convo', view: {} as never },
      { t: 'opening', prompt: { fr: 'x', en: 'x' } },
      { t: 'recap', recap: {} as never, profile: {} },
      { t: 'summary', summary: {} as never },
    ];
    for (const answer of answers) {
      assert.equal(thinkingAfter(WAITING, answer), false, `${answer.t} is an answer and must stop the orb`);
    }
  });

  test('taking the floor ends the wait; giving it up does not start one', () => {
    assert.equal(thinkingAfter(WAITING, { t: 'speaking', speaking: true }), false);
    assert.equal(thinkingAfter(false, { t: 'speaking', speaking: false }), false, 'the learner has the floor, nobody is deciding');
  });

  test('messages that ride alongside an answer leave the wait alone', () => {
    // Feedback arrives with a prompt and drills arrive after a recap; both would
    // already have cleared it, and neither is an answer on its own.
    assert.equal(thinkingAfter(WAITING, { t: 'feedback', feedback: {} as never }), true);
    assert.equal(thinkingAfter(WAITING, { t: 'drills', exercises: [] }), true);
  });
});
