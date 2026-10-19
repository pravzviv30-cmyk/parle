/**
 * The trial-ending reminder, wired to the store and the OS.
 *
 * Thin on purpose: every decision is `trialReminder.ts` `trialSyncStep`, and
 * this file reads the facts it needs, asks it, and carries out the answer.
 * The pieces it touches are injected (`trialReminderControl(deps)`), so
 * `trialReminder.test.ts` drives the whole loop with a fake OS; the exported
 * functions are the same loop bound to the real store and scheduler.
 *
 * Nothing here asks for notification permission. The caller decides when the
 * system dialog appears (`askReminderPermission`), then calls
 * `syncTrialReminder` or `setTrialReminderEnabled` again.
 *
 * Call sites the app needs:
 * - the paywall, once the server has confirmed a trial purchase:
 *   `scheduleTrialReminder({ trialEndsAt, now })`;
 * - launch, foreground, and after every billing refresh or restore:
 *   `syncTrialReminder({ status, storeFacts, now })`;
 * - sign-out, before the account changes: `cancelTrialReminder()`;
 * - the Settings switch: `setTrialReminderEnabled(value, now)`.
 */

import type { PersistAck } from '../storage/ack.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { LOCAL_CALENDAR, type Calendar } from './plan.ts';
import type { ReminderPermission } from './reminder.ts';
import {
  REMINDERS_AVAILABLE,
  cancelTrialReminderSlot,
  pendingTrialReminder,
  reminderPermission,
  scheduleTrialReminderSlot,
  type ScheduleOutcome,
} from './schedule.ts';
import { loadTrialReminder, saveTrialReminder } from './store.ts';
import {
  trialReminderPromised,
  trialSyncStep,
  type StoreTrialFacts,
  type TrialReminderRecord,
  type TrialReminderSlot,
} from './trialReminder.ts';

export interface TrialReminderDeps {
  available: boolean;
  calendar: Calendar;
  permission(): Promise<ReminderPermission>;
  pending(): Promise<string | null>;
  schedule(slot: TrialReminderSlot): Promise<ScheduleOutcome>;
  cancel(): Promise<ScheduleOutcome>;
  load(): Promise<TrialReminderRecord>;
  save(record: TrialReminderRecord): Promise<PersistAck>;
}

/** What the paywall's timeline and the Settings row read. */
export interface TrialReminderState {
  /** The OS holds a trial-ending reminder now. */
  scheduled: boolean;
  /** The learner's setting. Default on. */
  enabled: boolean;
  /** This build can schedule one at all. */
  available: boolean;
  permission: ReminderPermission;
  /** The paywall may say the reminder line: it will be scheduled once the trial is confirmed. */
  promised: boolean;
  /** A confirmed trial is on record for this account and its end is still ahead. Settings shows the switch on this. */
  onRecord: boolean;
  /** That trial's end instant while `onRecord`, otherwise null. */
  trialEndsAt: number | null;
}

export interface TrialSyncFacts {
  /** The server's billing answer, or null when there is none. */
  status: BillingStatus | null;
  /** The store's entitlement facts, or null when the adapter does not say. */
  storeFacts: StoreTrialFacts | null;
  now: number;
}

export function trialReminderControl(deps: TrialReminderDeps) {
  let chain: Promise<unknown> = Promise.resolve();
  /** One step at a time: two syncs racing could schedule and cancel out of order. */
  const alone = <T>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(work, work);
    chain = next.catch(() => {});
    return next;
  };

  const sync = async (facts: TrialSyncFacts): Promise<boolean> => {
    const record = await deps.load();
    const [pending, permission] = await Promise.all([deps.pending(), deps.permission()]);
    const step = trialSyncStep({
      record,
      pending,
      available: deps.available,
      permission,
      status: facts.status,
      store: facts.storeFacts,
      now: facts.now,
      calendar: deps.calendar,
    });
    if (step.record !== null) await deps.save(step.record);
    if (step.os.kind === 'cancel') {
      await deps.cancel();
      return false;
    }
    if (step.os.kind === 'schedule') return (await deps.schedule(step.os.slot)) === 'done';
    return pending !== null;
  };

  return {
    /** The paywall, once the trial purchase is confirmed. Resolves whether a reminder is now scheduled. */
    scheduleTrialReminder(input: { trialEndsAt: number; now: number }): Promise<boolean> {
      return alone(async () => {
        if (!Number.isFinite(input.trialEndsAt) || input.trialEndsAt <= input.now) return sync({ status: null, storeFacts: null, now: input.now });
        const record = await deps.load();
        await deps.save({ enabled: record.enabled, endsAt: Math.round(input.trialEndsAt), confirmedAt: input.now });
        return sync({ status: null, storeFacts: null, now: input.now });
      });
    },
    /** Launch, foreground, billing refresh, restore. Resolves whether a reminder is scheduled after it. */
    syncTrialReminder(facts: TrialSyncFacts): Promise<boolean> {
      return alone(() => sync(facts));
    },
    /** Take the pending reminder away (sign-out, account change). The account's record is left for its return. */
    cancelTrialReminder(): Promise<ScheduleOutcome> {
      return alone(() => deps.cancel());
    },
    /** The Settings switch. Off cancels; on schedules again if a trial is on record. */
    setTrialReminderEnabled(enabled: boolean, now: number): Promise<boolean> {
      return alone(async () => {
        const record = await deps.load();
        await deps.save({ ...record, enabled });
        return sync({ status: null, storeFacts: null, now });
      });
    },
    /** `now` defaults to the clock; tests pass one. */
    async trialReminderState(now: number = Date.now()): Promise<TrialReminderState> {
      const [record, pending, permission] = await Promise.all([deps.load(), deps.pending(), deps.permission()]);
      const onRecord = record.endsAt !== null && record.endsAt > now;
      return {
        onRecord,
        trialEndsAt: onRecord ? record.endsAt : null,
        scheduled: pending !== null,
        enabled: record.enabled,
        available: deps.available,
        permission,
        promised: trialReminderPromised({ available: deps.available, enabled: record.enabled, permission }),
      };
    },
  };
}

const live = trialReminderControl({
  available: REMINDERS_AVAILABLE,
  calendar: LOCAL_CALENDAR,
  permission: reminderPermission,
  pending: pendingTrialReminder,
  schedule: scheduleTrialReminderSlot,
  cancel: cancelTrialReminderSlot,
  load: loadTrialReminder,
  save: saveTrialReminder,
});

export const scheduleTrialReminder = live.scheduleTrialReminder;
export const syncTrialReminder = live.syncTrialReminder;
export const cancelTrialReminder = live.cancelTrialReminder;
export const setTrialReminderEnabled = live.setTrialReminderEnabled;
export const trialReminderState = live.trialReminderState;
