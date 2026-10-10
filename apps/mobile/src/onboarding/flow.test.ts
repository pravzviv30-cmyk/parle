import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountEntry, signedOutEntry, FULL_SETUP, FIVE_SETUP, earnedChoices, nextSetup, nextSetupLabel } from './flow.ts';
import { freshPreAccountDraft } from './preAccountDraft.ts';
test('device history chooses the door but a new account always receives onboarding', () => {
  assert.equal(signedOutEntry(false), 'welcome'); assert.equal(signedOutEntry(true), 'signin');
  assert.equal(accountEntry(false, false), 'new-onboarding');
  assert.equal(accountEntry(true, true), 'app'); assert.equal(accountEntry(true, false), 'repair');
});
test('Next labels name the destination in both setup variants', () => {
  assert.equal(nextSetupLabel('reason'), 'Next: Your French today');
  assert.equal(nextSetupLabel('reason', true), 'Next: Find your confidence');
  assert.equal(nextSetupLabel('start-level'), 'Next: Find your confidence');
  assert.equal(nextSetupLabel('confidence'), 'Next: Your practice style');
  assert.equal(nextSetupLabel('focus'), 'Next: Make time for French');
  assert.equal(nextSetupLabel('time'), 'Next: See your personal plan');
});
test('the short experiment omits ability while both flows use confidence and focus answers', () => {
  assert.deepEqual(FULL_SETUP, ['hear-it', 'reason', 'start-level', 'confidence', 'focus', 'time', 'plan']);
  assert.deepEqual(FIVE_SETUP, ['hear-it', 'reason', 'confidence', 'focus', 'time', 'plan']);
  assert.ok(!FULL_SETUP.includes('frequency') && !FIVE_SETUP.includes('frequency'), 'the retired days-a-week page is still in the setup');
  const draft = { ...freshPreAccountDraft(), drink: 'tea', reason: 'trip', startLevel: 'few', speakingConfidence: 'trying', practiceFocus: 'speaking', minutes: 10, frequency: 5 } as const;
  assert.equal(earnedChoices(freshPreAccountDraft()), 0);
  assert.equal(earnedChoices(draft), 5); assert.equal(earnedChoices(draft, true), 4);
  assert.equal(earnedChoices({ ...freshPreAccountDraft(), drink: 'tea', frequency: 5 }), 0);
  assert.equal(nextSetup('reason', true), 'confidence'); assert.equal(nextSetup('reason'), 'start-level');
  assert.equal(nextSetup('start-level'), 'confidence'); assert.equal(nextSetup('confidence'), 'focus');
  assert.equal(nextSetup('focus'), 'time');
  assert.equal(nextSetup('plan'), 'plan');
});
