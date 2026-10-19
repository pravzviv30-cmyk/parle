/**
 * The trial reminder row in Settings: the switch never says on while nothing
 * can be sent (review P2 #3), and the row re-reads when the learner comes
 * back from the phone's settings. The rule is pure; the wiring is read.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TRIAL_REMINDER_BLOCKED_SUB,
  TRIAL_REMINDER_COPY,
  TRIAL_REMINDER_ROW_SUB,
  trialReminderRowView,
  trialReminderTap,
} from './trialReminder.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('trial reminder row', () => {
  test('the trial reminder switch never shows on while notifications are denied', () => {
    for (const enabled of [true, false]) {
      const view = trialReminderRowView({ enabled, permission: 'denied', available: true });
      assert.equal(view.value, false, 'the switch reads on beside a reminder that can never be sent');
      assert.equal(view.blocked, true);
      assert.equal(view.sub, TRIAL_REMINDER_BLOCKED_SUB);
    }
    assert.equal(TRIAL_REMINDER_BLOCKED_SUB, "Notifications are off for Luvani, so this reminder can't be sent. Turn them on in Settings.");
    assert.deepEqual(trialReminderRowView({ enabled: true, permission: 'granted', available: true }), { value: true, sub: TRIAL_REMINDER_ROW_SUB, blocked: false });
    assert.deepEqual(trialReminderRowView({ enabled: true, permission: 'undetermined', available: true }), { value: true, sub: TRIAL_REMINDER_ROW_SUB, blocked: false });
    assert.deepEqual(trialReminderRowView({ enabled: false, permission: 'granted', available: true }), { value: false, sub: TRIAL_REMINDER_ROW_SUB, blocked: false });
    assert.ok(TRIAL_REMINDER_COPY.includes(TRIAL_REMINDER_BLOCKED_SUB), 'the new line escapes the ban-list scans');
  });

  test('turning the trial reminder on while notifications are denied does not save it as on and points to Settings', () => {
    assert.equal(trialReminderTap({ next: true, permission: 'denied' }), 'blocked');
    assert.equal(trialReminderTap({ next: true, permission: 'undetermined' }), 'ask');
    assert.equal(trialReminderTap({ next: true, permission: 'granted' }), 'save');
    assert.equal(trialReminderTap({ next: false, permission: 'granted' }), 'save');

    const row = read('../settings/TrialReminderRow.tsx');
    assert.match(row, /trialReminderRowView\(/, 'the row decides what to draw itself');
    assert.match(row, /trialReminderTap\(/, 'the row decides what a tap does itself');
    assert.match(row, /if \(tap === 'blocked'\) return;/, 'a blocked tap still reaches the save');
    assert.match(row, /void openPhoneSettings\(\)\.then\(/, 'the row reaches the phone settings some other way than the pair');
    assert.match(row, /LINK_TROUBLE/, 'a phone that will not open says nothing');
    assert.ok(!/TRIAL_REMINDER_ROW_SUB/.test(row), 'the row draws a sentence the view did not choose');
  });

  test('the trial reminder row re-reads when the app comes back to the foreground', () => {
    const hook = read('./useTrialReminder.ts');
    assert.match(hook, /AppState\.addEventListener\('change'/, 'nothing re-reads after the learner comes back from Settings');
    assert.match(hook, /next === 'active'/);
    assert.ok(!/next === 'background'|next === 'inactive'/.test(hook));
    assert.match(hook, /scopeGeneration\(\)/, 'a read that lands after an account change is written anyway');
    assert.match(hook, /mounted\.current/, 'a read that lands after unmount is written anyway');
  });
});
