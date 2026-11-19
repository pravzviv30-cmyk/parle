/**
 * The Settings "Talk days" row and sheet (T1.4), as plain rules: when the row
 * shows, what Save and Turn off may do, and what a chip press does. The screen
 * is held to using these in SettingsScreen.test.ts.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { TALK_DAYS_COPY, reminderRow, talkDayLabel } from '../reminders/reminder.ts';
import { talkDayPress, talkDaysCanSave, talkDaysOn, talkDaysRowShown } from './talkDays.ts';

const on = { enabled: true, time: 'smart' as const };

describe('the Talk days row on Settings', () => {
  test('shows only beside a reminder that is on, for an account with a known plan', () => {
    assert.equal(talkDaysRowShown(reminderRow(on, 'granted'), true), true);
    assert.equal(talkDaysRowShown(reminderRow({ enabled: false, time: 'smart' }, 'granted'), true), false, 'off');
    assert.equal(talkDaysRowShown(reminderRow({ ...on, paused: true }, 'granted'), true), false, 'paused');
    assert.equal(talkDaysRowShown(reminderRow(on, 'denied'), true), false, 'refused');
    assert.equal(talkDaysRowShown(reminderRow(on, 'undetermined'), true), false, 'never asked');
    assert.equal(talkDaysRowShown(null, true), false, 'unread');
    assert.equal(talkDaysRowShown(reminderRow(on, 'granted'), false), false, 'a guest or an unknown plan');
  });

  test('Save needs a day picked; Turn off shows only when talk days are on', () => {
    assert.equal(talkDaysCanSave([], false), false);
    assert.equal(talkDaysCanSave([2], true), false, 'saving twice');
    assert.equal(talkDaysCanSave([2, 4], false), true);
    assert.equal(talkDaysOn(undefined), false);
    assert.equal(talkDaysOn([]), false);
    assert.equal(talkDaysOn([2, 4, 6]), true);
  });

  test('a chip press picks and frees; a blocked chip ignores it and says why', () => {
    assert.deepEqual(talkDayPress([2], 4).picked, [2, 4]);
    assert.deepEqual(talkDayPress([2, 4], 2).picked, [4]);
    const nextTo = talkDayPress([2], 3);
    assert.deepEqual(nextTo.picked, [2], 'a blocked day was picked');
    assert.equal(nextTo.said, talkDayLabel([2], 3));
    assert.equal(nextTo.limitTapped, false);
    const full = talkDayPress([2, 4, 6], 1);
    assert.deepEqual(full.picked, [2, 4, 6]);
    assert.equal(full.limitTapped, true);
    assert.equal(full.said, TALK_DAYS_COPY.limit);
    assert.equal(talkDayPress([2], 2).said, TALK_DAYS_COPY.noneSettings, 'the none line is the Settings one');
  });
});
