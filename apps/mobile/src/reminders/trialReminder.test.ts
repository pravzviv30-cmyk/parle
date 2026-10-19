/**
 * The trial-ending reminder: scheduled only when it will be true, taken away
 * when the trial stops being a trial, and never in the daily plan's way.
 *
 * The OS is a fake that keeps pending identifiers and cancels the way the
 * native half does (`idsToCancel` by kind), so coexistence with the daily
 * re-plan is run rather than read. What a phone actually delivers is device
 * evidence and is not claimed here.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { streakGuiltIn } from '../copy/guilt.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { setActiveUser } from '../storage/scope.ts';
import { PRACTICE_PREFIX, TRIAL_PREFIX, idsToCancel, kindOfNotification } from './notificationIds.ts';
import { SLOT_PREFIX, slotDay, type Calendar } from './plan.ts';
import type { ReminderPermission } from './reminder.ts';
import { loadReminder, loadTrialReminder, saveReminder, saveTrialReminder } from './store.ts';
import { routeForReminder, reminderOpenOf } from './openTarget.ts';
import {
  DEFAULT_TRIAL_RECORD,
  TRIAL_REMINDER_BODY,
  TRIAL_REMINDER_COPY,
  TRIAL_REMINDER_TITLE,
  TRIAL_CONFIRM_GRACE_MS,
  trialReminderSlot,
  type StoreTrialFacts,
  type TrialReminderRecord,
} from './trialReminder.ts';
import { trialReminderControl } from './trialReminderSync.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** UTC as the local zone, so every instant below is readable. */
const UTC: Calendar = {
  dayOf: (at) => new Date(at).toISOString().slice(0, 10),
  minuteOf: (at) => Math.floor((at % DAY) / 60_000),
  at: (day, hour, minute) => Date.parse(`${day}T00:00:00Z`) + (hour * 60 + minute) * 60_000,
};

/** Bought on 1 Nov at 10:00; the store's seven-day trial ends 8 Nov at 10:00. */
const BOUGHT = Date.UTC(2026, 10, 1, 10);
const ENDS = BOUGHT + 7 * DAY;
/** Day 5 of the trial (6 Nov), at the reminders' early evening. */
const FIRES = Date.UTC(2026, 10, 6, 18);

function paid(over: Partial<BillingStatus> = {}): BillingStatus {
  return { plan: 'regular', secondsRemaining: 3000, periodEnd: new Date(ENDS).toISOString(), lapsed: false, canStart: true, reason: null, ...over };
}

/** A fake OS: pending identifiers, cancelled by kind exactly as schedule.native.ts does. */
function fakeOs() {
  const pending = new Map<string, number>();
  return {
    pending,
    replanDaily(days: readonly string[]): void {
      for (const id of idsToCancel([...pending.keys()], 'practice')) pending.delete(id);
      for (const day of days) pending.set(`${PRACTICE_PREFIX}${day}`, 0);
    },
    cancelDaily(): void {
      for (const id of idsToCancel([...pending.keys()], 'practice')) pending.delete(id);
    },
  };
}

function harness(opts: { permission?: ReminderPermission; available?: boolean; record?: TrialReminderRecord } = {}) {
  const os = fakeOs();
  let record: TrialReminderRecord = opts.record ?? { ...DEFAULT_TRIAL_RECORD };
  let permission: ReminderPermission = opts.permission ?? 'granted';
  let scheduleCalls = 0;
  const control = trialReminderControl({
    available: opts.available ?? true,
    calendar: UTC,
    permission: async () => permission,
    pending: async () => idsToCancel([...os.pending.keys()], 'trial')[0] ?? null,
    schedule: async (slot) => {
      scheduleCalls++;
      for (const id of idsToCancel([...os.pending.keys()], 'trial')) os.pending.delete(id);
      os.pending.set(slot.id, slot.at);
      return 'done';
    },
    cancel: async () => {
      for (const id of idsToCancel([...os.pending.keys()], 'trial')) os.pending.delete(id);
      return 'done';
    },
    load: async () => ({ ...record }),
    save: async (next) => {
      record = { ...next };
      return 'durable';
    },
  });
  return {
    os,
    control,
    trialIds: () => idsToCancel([...os.pending.keys()], 'trial'),
    record: () => record,
    setRecord: (next: TrialReminderRecord) => {
      record = next;
    },
    setPermission: (next: ReminderPermission) => {
      permission = next;
    },
    scheduleCalls: () => scheduleCalls,
  };
}

describe('the trial-ending reminder', () => {
  test('it fires on day five at early evening, and never in the past or the night', () => {
    const slot = trialReminderSlot(ENDS, BOUGHT, UTC);
    assert.ok(slot);
    assert.equal(slot.at, FIRES);
    assert.equal(slot.id, `${TRIAL_PREFIX}${FIRES}`);
    assert.equal(UTC.minuteOf(slot.at), 18 * 60);
    assert.equal(slot.open, 'settings');
    assert.equal(trialReminderSlot(ENDS, FIRES, UTC), null, 'a reminder was scheduled for an instant already here');
    assert.equal(trialReminderSlot(ENDS, ENDS + DAY, UTC), null);
    // A trial ending at 01:00 still gets its reminder in the evening two days before, not at 01:00.
    const lateNight = Date.UTC(2026, 10, 8, 1);
    assert.equal(trialReminderSlot(lateNight, BOUGHT, UTC)?.at, Date.UTC(2026, 10, 6, 18));
  });

  test('scheduled after confirmation with permission granted, and rescheduling is idempotent', async () => {
    const h = harness();
    assert.equal(await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT }), true);
    assert.deepEqual(h.trialIds(), [`${TRIAL_PREFIX}${FIRES}`]);
    assert.equal(h.record().endsAt, ENDS);
    assert.equal(await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT + HOUR }), true);
    assert.equal(await h.control.syncTrialReminder({ status: paid(), storeFacts: null, now: BOUGHT + DAY }), true);
    assert.deepEqual(h.trialIds(), [`${TRIAL_PREFIX}${FIRES}`], 'a second schedule left two reminders');
    assert.equal(h.scheduleCalls(), 1, 'an unchanged reminder was handed to the OS again');
    const state = await h.control.trialReminderState(BOUGHT + DAY);
    assert.deepEqual(state, { scheduled: true, enabled: true, available: true, permission: 'granted', promised: true, onRecord: true, trialEndsAt: ENDS });
  });

  test('permission denied or undetermined: nothing scheduled, nothing asked, nothing promised', async () => {
    for (const permission of ['denied', 'undetermined'] as const) {
      const h = harness({ permission });
      assert.equal(await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT }), false);
      assert.deepEqual(h.trialIds(), []);
      assert.equal(h.record().endsAt, ENDS, 'the confirmed trial was forgotten, so a later permission cannot schedule it');
      assert.equal((await h.control.trialReminderState()).promised, false);
      // Granted later (the caller asked), a sync schedules it.
      h.setPermission('granted');
      assert.equal(await h.control.syncTrialReminder({ status: paid(), storeFacts: null, now: BOUGHT + DAY }), true);
      assert.deepEqual(h.trialIds(), [`${TRIAL_PREFIX}${FIRES}`]);
    }
    const web = harness({ available: false });
    assert.equal(await web.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT }), false);
    assert.equal((await web.control.trialReminderState()).promised, false);
  });

  test('cancelled on conversion, lapse, auto-renew off, restore into a non-trial state, and the end', async () => {
    const store = (over: Partial<StoreTrialFacts>): StoreTrialFacts => ({ inTrial: true, willRenew: true, expiresAt: ENDS, ...over });
    const cases: { name: string; status: BillingStatus | null; storeFacts: StoreTrialFacts | null; now?: number }[] = [
      { name: 'converted (server period end moved a month on)', status: paid({ periodEnd: new Date(ENDS + 30 * DAY).toISOString() }), storeFacts: null },
      { name: 'converted (store no longer in trial)', status: null, storeFacts: store({ inTrial: false }) },
      { name: 'converted (store expiry moved)', status: null, storeFacts: store({ expiresAt: ENDS + 365 * DAY }) },
      { name: 'auto-renew turned off', status: paid(), storeFacts: store({ willRenew: false }) },
      { name: 'lapsed', status: paid({ lapsed: true }), storeFacts: null },
      { name: 'restored into free minutes', status: paid({ plan: 'trial', periodEnd: null }), storeFacts: null },
      { name: 'the trial ended', status: null, storeFacts: null, now: ENDS + HOUR },
    ];
    for (const c of cases) {
      const h = harness();
      await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT });
      assert.equal(h.trialIds().length, 1);
      assert.equal(await h.control.syncTrialReminder({ status: c.status, storeFacts: c.storeFacts, now: c.now ?? BOUGHT + DAY }), false, c.name);
      assert.deepEqual(h.trialIds(), [], `still pending after: ${c.name}`);
      assert.equal(h.record().endsAt, null, `the trial is still on record after: ${c.name}`);
    }
    // Unknown facts are not evidence: nothing moves.
    const h = harness();
    await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT });
    assert.equal(await h.control.syncTrialReminder({ status: null, storeFacts: null, now: BOUGHT + DAY }), true);
    assert.equal(await h.control.syncTrialReminder({ status: paid(), storeFacts: store({}), now: BOUGHT + DAY }), true);
    assert.equal(h.trialIds().length, 1);
  });

  test('a server still answering the free minutes just after purchase is lag, not a downgrade', async () => {
    const freeMinutes = paid({ plan: 'trial', periodEnd: null });
    const h = harness();
    await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT });
    assert.equal(h.record().confirmedAt, BOUGHT);
    // Inside the window: kept, record kept, and repeated syncs hand nothing new to the OS.
    for (const now of [BOUGHT + 1000, BOUGHT + 5 * 60_000, BOUGHT + TRIAL_CONFIRM_GRACE_MS - 1]) {
      assert.equal(await h.control.syncTrialReminder({ status: freeMinutes, storeFacts: null, now }), true, `cancelled by lag at +${now - BOUGHT} ms`);
    }
    assert.deepEqual(h.trialIds(), [`${TRIAL_PREFIX}${FIRES}`]);
    assert.equal(h.record().endsAt, ENDS);
    assert.equal(h.scheduleCalls(), 1, 'lag syncs re-handed the reminder to the OS');
    // The server catches up: still scheduled, still once.
    assert.equal(await h.control.syncTrialReminder({ status: paid(), storeFacts: null, now: BOUGHT + 20 * 60_000 }), true);
    assert.equal(h.scheduleCalls(), 1);

    // A genuine downgrade after the window cancels and forgets the trial.
    assert.equal(await h.control.syncTrialReminder({ status: freeMinutes, storeFacts: null, now: BOUGHT + TRIAL_CONFIRM_GRACE_MS }), false);
    assert.deepEqual(h.trialIds(), []);
    assert.deepEqual(h.record(), { enabled: true, endsAt: null });
    // And it stays cancelled: later syncs, with or without facts, do not bring it back.
    assert.equal(await h.control.syncTrialReminder({ status: null, storeFacts: null, now: BOUGHT + DAY }), false);
    assert.equal(await h.control.syncTrialReminder({ status: freeMinutes, storeFacts: null, now: BOUGHT + DAY }), false);
    assert.deepEqual(h.trialIds(), []);

    // The grace covers only the free-minutes reading: a lapse inside it still cancels.
    const lapse = harness();
    await lapse.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT });
    assert.equal(await lapse.control.syncTrialReminder({ status: paid({ lapsed: true }), storeFacts: null, now: BOUGHT + 1000 }), false);
    // A record with no confirmation instant (written before this field) gets no grace.
    const old = harness({ record: { enabled: true, endsAt: ENDS } });
    assert.equal(await old.control.syncTrialReminder({ status: paid(), storeFacts: null, now: BOUGHT }), true);
    assert.equal(await old.control.syncTrialReminder({ status: freeMinutes, storeFacts: null, now: BOUGHT + 1000 }), false);
  });

  test('onRecord and trialEndsAt say whether a confirmed trial is ahead, without reading billing', async () => {
    const none = harness();
    assert.deepEqual(await none.control.trialReminderState(BOUGHT), { scheduled: false, enabled: true, available: true, permission: 'granted', promised: true, onRecord: false, trialEndsAt: null });
    // On record even when nothing is scheduled: permission denied, or the switch off.
    const denied = harness({ permission: 'denied' });
    await denied.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT });
    const d = await denied.control.trialReminderState(BOUGHT + HOUR);
    assert.equal(d.scheduled, false);
    assert.equal(d.onRecord, true);
    assert.equal(d.trialEndsAt, ENDS);
    await denied.control.setTrialReminderEnabled(false, BOUGHT + HOUR);
    assert.equal((await denied.control.trialReminderState(BOUGHT + HOUR)).onRecord, true);
    // Its end reached, before any sync has cleared it: no longer on record.
    assert.equal((await denied.control.trialReminderState(ENDS)).trialEndsAt, null);
    assert.equal((await denied.control.trialReminderState(ENDS)).onRecord, false);
    assert.equal((await denied.control.trialReminderState(ENDS - 1)).onRecord, true);
    // Cleared by a conversion: off record.
    const h = harness();
    await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT });
    await h.control.syncTrialReminder({ status: paid({ periodEnd: new Date(ENDS + 30 * DAY).toISOString() }), storeFacts: null, now: BOUGHT + DAY });
    const after = await h.control.trialReminderState(BOUGHT + DAY);
    assert.equal(after.onRecord, false);
    assert.equal(after.trialEndsAt, null);
  });

  test('an account change or sign-out takes it away', async () => {
    const h = harness();
    await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT });
    // Sign-out: the caller cancels before the account changes.
    assert.equal(await h.control.cancelTrialReminder(), 'done');
    assert.deepEqual(h.trialIds(), []);
    // Another account signs in with no trial on record; a stale pending reminder is swept by its sync.
    await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT });
    h.setRecord({ ...DEFAULT_TRIAL_RECORD });
    assert.equal(await h.control.syncTrialReminder({ status: paid(), storeFacts: null, now: BOUGHT + DAY }), false);
    assert.deepEqual(h.trialIds(), []);
  });

  test('turning the setting off cancels; on again schedules again', async () => {
    const h = harness();
    await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT });
    assert.equal(await h.control.setTrialReminderEnabled(false, BOUGHT + HOUR), false);
    assert.deepEqual(h.trialIds(), []);
    assert.equal(h.record().enabled, false);
    assert.equal((await h.control.trialReminderState()).promised, false);
    // Off stays off through a fresh confirmation.
    assert.equal(await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT + HOUR }), false);
    assert.equal(await h.control.setTrialReminderEnabled(true, BOUGHT + 2 * HOUR), true);
    assert.deepEqual(h.trialIds(), [`${TRIAL_PREFIX}${FIRES}`]);
  });

  test('a daily re-plan never removes the trial reminder, and the trial cancel never removes a daily slot', async () => {
    assert.equal(PRACTICE_PREFIX, SLOT_PREFIX, 'the planner and the identifier rule disagree about the practice prefix');
    assert.equal(TRIAL_PREFIX.startsWith(PRACTICE_PREFIX), false);
    assert.equal(kindOfNotification(`${TRIAL_PREFIX}1`), 'trial');
    assert.equal(kindOfNotification('practice:2026-11-02'), 'practice');
    assert.equal(kindOfNotification('someone-else'), null);
    assert.equal(slotDay(`${TRIAL_PREFIX}${FIRES}`), null, 'a trial reminder tap would count as a practice reminder answered');

    const h = harness();
    h.os.replanDaily(['2026-11-02', '2026-11-03']);
    await h.control.scheduleTrialReminder({ trialEndsAt: ENDS, now: BOUGHT });
    h.os.replanDaily(['2026-11-03', '2026-11-04']);
    assert.deepEqual(h.trialIds(), [`${TRIAL_PREFIX}${FIRES}`], 'a daily re-plan wiped the trial reminder');
    h.os.cancelDaily();
    assert.deepEqual(h.trialIds(), [`${TRIAL_PREFIX}${FIRES}`], 'turning the daily reminder off wiped the trial reminder');
    h.os.replanDaily(['2026-11-05']);
    await h.control.setTrialReminderEnabled(false, BOUGHT + HOUR);
    assert.deepEqual([...h.os.pending.keys()], ['practice:2026-11-05'], 'the trial cancel took a daily slot with it');
    // Other apps' or later kinds' identifiers are untouched by both.
    assert.deepEqual(idsToCancel(['billing:1', 'practice:2026-11-05', `${TRIAL_PREFIX}1`], 'practice'), ['practice:2026-11-05']);
    assert.deepEqual(idsToCancel(['billing:1', 'practice:2026-11-05', `${TRIAL_PREFIX}1`], 'trial'), [`${TRIAL_PREFIX}1`]);
  });

  test('a tap opens Settings, where the Subscription group is', () => {
    const slot = trialReminderSlot(ENDS, BOUGHT, UTC)!;
    assert.deepEqual(routeForReminder(reminderOpenOf(slot.open), null), { name: 'Settings' });
  });

  test('the words pass every ban list', () => {
    assert.equal(TRIAL_REMINDER_TITLE, 'Your Luvani trial ends in two days');
    assert.equal(TRIAL_REMINDER_BODY, 'Keep going, or manage your plan in Apple Subscriptions before it renews.');
    for (const line of TRIAL_REMINDER_COPY) {
      assert.equal(streakGuiltIn(line), undefined, `banned word in: ${line}`);
      assert.doesNotMatch(line, /\d/, `a number in: ${line}`);
      assert.doesNotMatch(line, /[—–·!]/, `a dash, middot or exclamation in: ${line}`);
    }
  });
});

describe('the trial reminder record, in the reminders envelope', () => {
  function disk(): Map<string, string> {
    const map = new Map<string, string>();
    const shared = AsyncStorage as unknown as Record<string, unknown>;
    shared.getItem = (key: string) => Promise.resolve(map.get(key) ?? null);
    shared.setItem = (key: string, value: string) => {
      map.set(key, value);
      return Promise.resolve();
    };
    return map;
  }

  test('defaults on, persists per account, and keeps the daily choice either way', async () => {
    const map = disk();
    setActiveUser('trial-a');
    assert.deepEqual(await loadTrialReminder(), { enabled: true, endsAt: null });
    assert.equal(await saveTrialReminder({ enabled: false, endsAt: ENDS }), 'durable');
    assert.deepEqual(await loadTrialReminder(), { enabled: false, endsAt: ENDS });
    await saveTrialReminder({ enabled: false, endsAt: ENDS, confirmedAt: BOUGHT });
    assert.deepEqual(await loadTrialReminder(), { enabled: false, endsAt: ENDS, confirmedAt: BOUGHT });
    await saveTrialReminder({ enabled: false, endsAt: ENDS });
    assert.equal(await loadReminder({ strict: true }), null, 'a trial record invented a daily choice');

    await saveReminder({ enabled: true, time: 'morning' });
    assert.deepEqual(await loadTrialReminder(), { enabled: false, endsAt: ENDS }, 'saving the daily choice dropped the trial record');
    await saveTrialReminder({ enabled: true, endsAt: null });
    assert.deepEqual(await loadReminder({ strict: true }), { enabled: true, time: 'morning' }, 'the trial record dropped the daily choice');

    setActiveUser('trial-b');
    assert.deepEqual(await loadTrialReminder(), { enabled: true, endsAt: null }, "one account's trial leaked into another's");

    // An unreadable envelope is not overwritten into "no choice".
    map.set('luvani.u.trial-b.reminder', '{nope');
    assert.equal(await saveTrialReminder({ enabled: true, endsAt: ENDS }), 'failed');
    assert.equal(map.get('luvani.u.trial-b.reminder'), '{nope');
    setActiveUser(null);
  });
});
