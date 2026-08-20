import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { PathNode } from '@parle/core';

import { statusLine } from './statusLine.ts';

const node = (over: Partial<PathNode> = {}): PathNode => ({
  id: 'topic:my-job',
  title: 'My job',
  sub: 'Talked about once',
  kind: 'topic',
  phraseKeys: [],
  state: 'available',
  isNext: false,
  ...over,
});

describe('the line under a node title', () => {
  test('a still-being-written topic says the tutor is writing it', () => {
    // Locked covers two different things now. A locked topic is one the learner
    // has ALREADY talked about, waiting on its drills; telling them their
    // conversations will write it describes something that already happened.
    assert.equal(statusLine(node({ state: 'locked', kind: 'topic' })), 'Your tutor is still writing this one');
  });

  test('the promise before any conversation is unchanged', () => {
    assert.equal(statusLine(node({ state: 'locked', kind: 'mine' })), 'Your conversations write this one');
  });

  test('nothing here scolds, and nothing carries a number', () => {
    // Mid-app copy never carries digits, and no state is phrased as a failure.
    for (const state of ['complete', 'needs-review', 'in-progress', 'locked', 'available'] as const) {
      const line = statusLine(node({ state }));
      assert.ok(!/\d/.test(line), `"${line}" carries a number`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      assert.ok(line.length > 0);
    }
  });

  test('the other states still say what they always said', () => {
    assert.equal(statusLine(node({ state: 'complete' })), 'Learned');
    assert.equal(statusLine(node({ state: 'needs-review' })), 'Ready to come back to');
    assert.equal(statusLine(node({ state: 'in-progress' })), 'Started');
    assert.equal(statusLine(node({ state: 'available', sub: 'Talked about twice' })), 'Talked about twice');
  });
});
