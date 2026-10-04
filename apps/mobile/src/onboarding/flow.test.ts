import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountEntry, signedOutEntry, FULL_SETUP, FIVE_SETUP, earnedChoices, nextSetup } from './flow.ts';
import { freshPreAccountDraft } from './preAccountDraft.ts';
test('device history chooses the door but a new account always receives onboarding', () => {
  assert.equal(signedOutEntry(false), 'welcome'); assert.equal(signedOutEntry(true), 'signin');
  assert.equal(accountEntry(false, false), 'new-onboarding');
  assert.equal(accountEntry(true, true), 'app'); assert.equal(accountEntry(true, false), 'repair');
});
test('the five-surface experiment omits ability and never counts optional ability as earned progress', () => {
  assert.equal(FULL_SETUP.length, 6); assert.equal(FIVE_SETUP.length, 5);
  const draft = { ...freshPreAccountDraft(), drink: 'tea', reason: 'trip', startLevel: 'few', minutes: 10, frequency: 5 } as const;
  assert.equal(earnedChoices(freshPreAccountDraft()), 0);
  assert.equal(earnedChoices(draft), 5); assert.equal(earnedChoices(draft, true), 4);
  assert.equal(nextSetup('reason', true), 'time'); assert.equal(nextSetup('reason'), 'start-level');
  assert.equal(nextSetup('plan'), 'plan');
});
