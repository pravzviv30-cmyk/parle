import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FeedbackLedger, FEEDBACK_MS } from './feedbackPolicy.ts';
test('a saved event settles once and deduplication has bounded session memory', () => {
  const ledger = new FeedbackLedger(); assert.equal(ledger.claim('owner-1:save-1'), true);
  assert.equal(ledger.claim('owner-1:save-1'), false);
  assert.equal(ledger.claim('owner-2:save-1'), true);
  for (let i = 0; i < 128; i++) ledger.claim(`event-${i}`);
  assert.equal(ledger.claim('owner-1:save-1'), true);
});
test('feedback timings stay bounded and the earned flourish lasts longer than an ordinary selection', () => {
  for (const ms of Object.values(FEEDBACK_MS)) assert.ok(ms >= 180 && ms <= 700);
  assert.ok(FEEDBACK_MS.earned > FEEDBACK_MS.selection);
});
