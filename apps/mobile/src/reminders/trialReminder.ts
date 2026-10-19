/**
 * The trial-ending reminder: one local notification two days before a store
 * free trial ends, and the rules for when it may exist (founder decision D16,
 * come alive README Part 5.G).
 *
 * The paywall's timeline says "Day 5: we'll send a reminder that your trial
 * ends in two days" only when this module will keep that promise. Every rule
 * here is pure and takes its instants and calendar as arguments; the
 * scheduling and the storage are `trialReminderSync.ts`, and the OS is
 * `schedule.native.ts`.
 *
 * ## When it is scheduled
 *
 * Only after a trial purchase is confirmed (the paywall calls
 * `scheduleTrialReminder` with the trial's end instant the store or server
 * confirmed), only with notification permission already granted (nothing here
 * ever asks), and only while the learner's "Trial ending reminder" setting is
 * on, which it is by default. It fires on the local day two days before the
 * end, at the reminders' early-evening default (`SMART_FALLBACK`, 6 pm), never
 * in the night, and never in the past.
 *
 * ## When it is taken away
 *
 * Whenever the facts stop showing an active trial: the end has passed, the
 * store says the subscription is no longer in its trial period or will not
 * renew, the server or store reports a period end that is not the trial's
 * (it converted), the server says the plan has lapsed or is the free minutes,
 * or there is no trial on record for the signed-in account (a sign-out or an
 * account change). Also when the setting is turned off or permission is gone.
 * Unknown facts (no billing answer, no store answer) change nothing.
 *
 * ## The words
 *
 * No countdown, no plea, no scarcity: the title says when, the body says what
 * the learner can do. `trialReminder.test.ts` runs both lines through
 * BANNED_IN_STREAK_COPY, which includes the shared list.
 */

import type { BillingStatus } from '../purchases/billingStatus.ts';
import { trialReminderId } from './notificationIds.ts';
import type { Calendar } from './plan.ts';
import { SMART_FALLBACK, type ReminderOpen, type ReminderPermission } from './reminder.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How many days before the trial ends the reminder arrives. */
export const TRIAL_REMINDER_DAYS_BEFORE = 2;

/** Two reported ends further apart than this are two different periods, not one end said twice. */
const SAME_END_SLACK_MS = DAY_MS;

export const TRIAL_REMINDER_TITLE = 'Your Luvani trial ends in two days';
export const TRIAL_REMINDER_BODY = 'Keep going, or manage your plan in Apple Subscriptions before it renews.';

/** The Settings row and its explanation. */
export const TRIAL_REMINDER_ROW = 'Trial ending reminder';
export const TRIAL_REMINDER_ROW_SUB = 'One notification two days before your free trial ends.';
/** The row's sentence while notifications are denied: nothing can be sent, and where to fix it. */
export const TRIAL_REMINDER_BLOCKED_SUB = "Notifications are off for Luvani, so this reminder can't be sent. Turn them on in Settings.";
/** The action under a blocked row. */
export const TRIAL_REMINDER_OPEN_SETTINGS = 'Open Settings';

/** Every learner-facing line here, for the ban-list scans. */
export const TRIAL_REMINDER_COPY: readonly string[] = [TRIAL_REMINDER_TITLE, TRIAL_REMINDER_BODY, TRIAL_REMINDER_ROW, TRIAL_REMINDER_ROW_SUB, TRIAL_REMINDER_BLOCKED_SUB, TRIAL_REMINDER_OPEN_SETTINGS];

/** A tap opens Settings, where the Subscription group is. */
export const TRIAL_REMINDER_OPENS: ReminderOpen = 'settings';

/** The one trial reminder, ready for the OS. */
export interface TrialReminderSlot {
  id: string;
  at: number;
  title: string;
  body: string;
  open: ReminderOpen;
}

/** What the learner's account remembers about the trial reminder. */
export interface TrialReminderRecord {
  /** False only when the learner turned the reminder off. Default on. */
  enabled: boolean;
  /** The confirmed trial's end instant, or null when no trial is on record. */
  endsAt: number | null;
  /** When the trial was confirmed on this device, for the server-lag grace window. Absent when unknown. */
  confirmedAt?: number;
}

/**
 * How long after confirmation a server reading of the free-minutes plan is
 * taken as the server not having caught up yet, rather than as a downgrade.
 */
export const TRIAL_CONFIRM_GRACE_MS = 15 * 60 * 1000;

export const DEFAULT_TRIAL_RECORD: TrialReminderRecord = { enabled: true, endsAt: null };

/**
 * What the store says about the subscription now, when it says anything.
 *
 * The purchases adapter does not expose these yet (RevenueCat's entitlement
 * `periodType`, `willRenew` and `expirationDate`); until it does, callers pass
 * null and only the server's facts are read.
 */
export interface StoreTrialFacts {
  /** True while the entitlement is in its free trial period, false once it is not, null when unknown. */
  inTrial: boolean | null;
  /** False once auto-renew is turned off. Null when unknown. */
  willRenew: boolean | null;
  /** The entitlement's expiry instant, or null when unknown. */
  expiresAt: number | null;
}

/**
 * The slot for a trial ending at `endsAt`, or null when none can honestly be sent:
 * the reminder day's evening has already passed, or does not fall before the end.
 */
export function trialReminderSlot(endsAt: number, now: number, calendar: Calendar): TrialReminderSlot | null {
  if (!Number.isFinite(endsAt) || !Number.isFinite(now)) return null;
  const day = calendar.dayOf(endsAt - TRIAL_REMINDER_DAYS_BEFORE * DAY_MS);
  const at = calendar.at(day, SMART_FALLBACK.hour, SMART_FALLBACK.minute);
  if (!Number.isFinite(at) || at <= now || at >= endsAt) return null;
  return { id: trialReminderId(at), at, title: TRIAL_REMINDER_TITLE, body: TRIAL_REMINDER_BODY, open: TRIAL_REMINDER_OPENS };
}

/**
 * Whether the paywall may promise the reminder before the purchase: the build
 * can schedule one, the learner has not turned it off, and permission is
 * already granted. The timeline's `remind` input.
 */
export function trialReminderPromised(input: { available: boolean; enabled: boolean; permission: ReminderPermission }): boolean {
  return input.available && input.enabled && input.permission === 'granted';
}

/**
 * What the Settings row draws (review P2 #3). While notifications are denied
 * the switch reads off, because nothing can be sent, and the sentence says so
 * and where to fix it. The stored preference is not touched, so it comes back
 * once permission does.
 */
export function trialReminderRowView(input: { enabled: boolean; permission: ReminderPermission; available: boolean }): {
  value: boolean;
  sub: string;
  blocked: boolean;
} {
  const blocked = input.permission === 'denied';
  return blocked ? { value: false, sub: TRIAL_REMINDER_BLOCKED_SUB, blocked } : { value: input.enabled, sub: TRIAL_REMINDER_ROW_SUB, blocked };
}

/**
 * What a tap on the row does: `blocked` saves nothing (the row already points
 * to Settings), `ask` raises the dialog nobody has seen yet, `save` writes.
 */
export function trialReminderTap(input: { next: boolean; permission: ReminderPermission }): 'blocked' | 'ask' | 'save' {
  if (input.next && input.permission === 'denied') return 'blocked';
  if (input.next && input.permission === 'undetermined') return 'ask';
  return 'save';
}

function isoInstant(value: string | null): number | null {
  if (value === null) return null;
  const at = new Date(value).getTime();
  return Number.isFinite(at) ? at : null;
}

/**
 * Why a trial on record is no longer an active trial, or null while it still is.
 * Unknown facts are not evidence either way.
 */
export function trialOverBecause(input: {
  endsAt: number;
  status: BillingStatus | null;
  store: StoreTrialFacts | null;
  now: number;
  /** When the trial was confirmed, if known: inside the grace window a free-minutes reading is lag. */
  confirmedAt?: number;
}): 'ended' | 'converted' | 'will-not-renew' | 'lapsed' | 'no-paid-plan' | null {
  const { endsAt, status, store, now } = input;
  if (now >= endsAt) return 'ended';
  if (store !== null) {
    if (store.willRenew === false) return 'will-not-renew';
    if (store.inTrial === false) return 'converted';
    if (store.expiresAt !== null && Math.abs(store.expiresAt - endsAt) > SAME_END_SLACK_MS) return 'converted';
  }
  if (status !== null) {
    if (status.lapsed) return 'lapsed';
    if (status.plan === 'trial') {
      // Just after a confirmed purchase the server may still answer the free
      // minutes. That is lag, not evidence: the confirmation is newer.
      const lagging = input.confirmedAt !== undefined && now >= input.confirmedAt && now - input.confirmedAt < TRIAL_CONFIRM_GRACE_MS;
      return lagging ? null : 'no-paid-plan';
    }
    const periodEnd = isoInstant(status.periodEnd);
    if (periodEnd !== null && Math.abs(periodEnd - endsAt) > SAME_END_SLACK_MS) return 'converted';
  }
  return null;
}

/** What the OS should hold, and what the account should remember, after a sync. */
export interface TrialSyncStep {
  /** `schedule` hands `slot` over; `cancel` takes any pending one away; `keep` does nothing. */
  os: { kind: 'schedule'; slot: TrialReminderSlot } | { kind: 'cancel' } | { kind: 'keep' };
  /** The record to write, or null to leave it as it is. */
  record: TrialReminderRecord | null;
}

/**
 * The one decision: given what is on record, what the OS holds, the
 * learner's setting and permission, and what billing says now, what to do.
 */
export function trialSyncStep(input: {
  record: TrialReminderRecord;
  /** The identifier of the pending trial reminder, or null when none is pending. */
  pending: string | null;
  available: boolean;
  permission: ReminderPermission;
  status: BillingStatus | null;
  store: StoreTrialFacts | null;
  now: number;
  calendar: Calendar;
}): TrialSyncStep {
  const { record, pending } = input;
  const cancel: TrialSyncStep['os'] = pending === null ? { kind: 'keep' } : { kind: 'cancel' };
  if (record.endsAt === null) return { os: cancel, record: null };
  const over = trialOverBecause({
    endsAt: record.endsAt,
    status: input.status,
    store: input.store,
    now: input.now,
    ...(record.confirmedAt !== undefined ? { confirmedAt: record.confirmedAt } : {}),
  });
  if (over !== null) return { os: cancel, record: { enabled: record.enabled, endsAt: null } };
  if (!input.available || !record.enabled || input.permission !== 'granted') return { os: cancel, record: null };
  const slot = trialReminderSlot(record.endsAt, input.now, input.calendar);
  if (slot === null) return { os: pending !== null && pending === trialPendingIdFor(record.endsAt, input.calendar) ? { kind: 'keep' } : cancel, record: null };
  if (pending === slot.id) return { os: { kind: 'keep' }, record: null };
  return { os: { kind: 'schedule', slot }, record: null };
}

/**
 * The identifier the reminder for `endsAt` was given, whatever `now` is.
 * Lets a sync after the reminder's day has begun keep a reminder that is
 * still on its way rather than cancel it for being too late to schedule.
 */
function trialPendingIdFor(endsAt: number, calendar: Calendar): string {
  const day = calendar.dayOf(endsAt - TRIAL_REMINDER_DAYS_BEFORE * DAY_MS);
  return trialReminderId(calendar.at(day, SMART_FALLBACK.hour, SMART_FALLBACK.minute));
}
