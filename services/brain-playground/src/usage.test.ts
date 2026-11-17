/**
 * usage.ts re-exported three brain helpers nobody imported from it (F1126).
 * The brain is their one home; a second path to them is a second place to
 * forget when they change.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import * as usage from './usage.ts';

describe('the playground meter — one home for the brain helpers', () => {
  test('the playground no longer re-exports the unused usage helpers', () => {
    for (const name of ['addLlmUsage', 'costUsd', 'USD_PER_MTOK']) {
      assert.equal(name in usage, false, `${name} lives in @luvani/brain; usage.ts should not hand out a second copy`);
    }
  });
});
