/**
 * Native build: the one file in this repo that talks to the notification OS.
 *
 * The `progress/saveFile.native.ts` pattern. Metro picks this on iOS and
 * Android and `schedule.ts` everywhere else, so the compiler never opens this
 * file when it typechecks the app: `schedule.test.ts` holds the two halves to
 * the same exported names, because a name that exists here and not there is a
 * crash on a device and a clean build on a laptop.
 *
 * ## Sole importer, and why that is the design rather than a tidiness
 *
 * `expo-notifications` is imported here and nowhere else in the repo, and a
 * test scans apps/, packages/, services/ and scripts/ to keep it that way. A
 * native dependency touched by one module can be replaced, moved behind a
 * different SDK, or removed, by reading one file.
 *
 * ## Dated slots from the plan, and nothing that repeats (founder decision D2)
 *
 * The reminder is no longer one daily trigger the OS repeats: a repeating
 * trigger cannot skip the day the learner already practised. `plan.ts` decides
 * one slot per day, each with its own words and its own time, and this module
 * hands each to the OS as a one-off `DATE` trigger, identified `practice:{day}`
 * so a second plan for a day replaces the first. Nothing here reads a clock:
 * every instant arrives in the plan.
 *
 * The trial-ending reminder (`trial-end:`) is a second kind handed over by
 * the same loop; `notificationIds.ts` keeps each kind's cancels to its own.
 *
 * Cancelling is by identifier and only for this app's own `practice:` slots,
 * found through `getAllScheduledNotificationsAsync`. Nothing here ever cancels
 * everything: a notification some other part of the app schedules one day (a
 * billing notice) must not be swept away by a re-plan.
 *
 * ## No badge, no banner over the app
 *
 * A badge is the number on the app icon that grows while the app is not
 * opened, which is the counter this product refuses to show. On iOS the
 * permission request asks for alert and sound only; on Android the channel is
 * created with the badge turned off (F240). And there is no notification
 * handler: with none, a reminder that arrives while the app is open is not
 * presented, which is right while somebody is practising.
 *
 * ## Taps
 *
 * `onReminderTapped` hears a tap on one of this app's slots, including the tap
 * that launched the app from cold, once each. Where the tap leads is decided in
 * `openTarget.ts` and the navigation happens in `App.tsx`.
 *
 * ## What it is not responsible for
 *
 * It does not check permission before scheduling: the caller owns the order
 * the dialog appears in. Local scheduled notifications have not worked in Expo
 * Go on Android since SDK 53, so nothing here can be checked on a device
 * without a dev build.
 */

import * as Notifications from 'expo-notifications';

import type { ReminderSlot } from './plan.ts';
import type { ReminderPermission } from './reminder.ts';
import type { TrialReminderSlot } from './trialReminder.ts';

/**
 * The channel this app's reminders land on.
 *
 * The id is arbitrary and then permanent. Android will not let a channel's
 * importance be changed after it exists, so editing this string does not
 * rename anything: it creates a second channel and orphans whatever the
 * learner had already set on the first.
 */
const REMINDER_CHANNEL_ID = 'daily-reminder';

/** What a learner reads in Settings, above the switch that turns this off. */
const REMINDER_CHANNEL_NAME = 'Daily reminder';


/** The identifier prefix of the daily plan's slots. `practice:{day}`. */
const SLOT_PREFIX = 'practice:';

/**
 * The identifier prefix of the trial-ending reminder. Never a practice slot,
 * so the daily plan's cancels never reach it (`notificationIds.ts` holds the
 * same two strings, and `trialReminder.test.ts` holds them equal).
 */
const TRIAL_SLOT_PREFIX = 'trial-end:';

/** This build has a real scheduler. See schedule.ts for why it is annotated. */
export const REMINDERS_AVAILABLE: boolean = true;

/**
 * What a scheduling attempt is allowed to claim, in one word.
 *
 * `done` means the OS accepted the request without throwing; delivery is the
 * platform's business. `unavailable` is the web half's answer and cannot happen
 * on a device. `failed` means the platform refused. Declared in both halves
 * rather than shared, because neither can import the other.
 */
export type ScheduleOutcome = 'done' | 'unavailable' | 'failed';

/** A tap on one of this app's reminders: where its slot says it opens, and its identifier. */
export type ReminderTapHandler = (open: string, id: string) => void;

/**
 * Three OS states, in the three words reminder.ts already uses.
 *
 * Read off `granted` and `canAskAgain` rather than off `status`, because the
 * question the row asks is "will flipping this switch open a dialog?".
 */
function permissionOf(status: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/** What the OS currently allows. Raises no dialog. A thrown call is `denied`. */
export async function reminderPermission(): Promise<ReminderPermission> {
  try {
    return permissionOf(await Notifications.getPermissionsAsync());
  } catch {
    return 'denied';
  }
}

/**
 * Raise the system dialog, once, and answer with what the learner chose.
 *
 * Guarded by a read first, because iOS shows this dialog exactly once per
 * install: asking again after a refusal resolves immediately with the old
 * answer.
 */
export async function askReminderPermission(): Promise<ReminderPermission> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    if (!current.canAskAgain) return 'denied';
    return permissionOf(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } }));
  } catch {
    return 'denied';
  }
}

/**
 * Create the channel the triggers below name, and never let it cost a schedule.
 *
 * `DEFAULT` importance, and `showBadge` false for the reason the header gives.
 * A channel the OS refused is a reminder that arrives on expo's fallback
 * channel under a name we did not choose: a wrong label beats no reminder.
 */
async function ensureReminderChannel(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: REMINDER_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: false,
    });
  } catch {
    // Deliberately nothing. The reminder outranks its own label.
  }
}

/**
 * Cancel this app's own notifications of one kind, one identifier at a time.
 *
 * `SLOT_PREFIX` is the daily plan and `TRIAL_SLOT_PREFIX` the trial-ending
 * reminder: each cancel touches only its own prefix, so a daily re-plan
 * leaves the trial reminder where it is, and the other way round.
 */
async function cancelOwn(prefix: string = SLOT_PREFIX): Promise<void> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of pending) {
    if (request.identifier.startsWith(prefix)) await Notifications.cancelScheduledNotificationAsync(request.identifier);
  }
}

/** Hand dated one-offs to the OS on the named channel. The one place anything is scheduled. */
async function hand(slots: readonly (ReminderSlot | TrialReminderSlot)[]): Promise<void> {
  await ensureReminderChannel();
  for (const slot of slots) {
    await Notifications.scheduleNotificationAsync({
      identifier: slot.id,
      content: { title: slot.title, body: slot.body, data: { open: slot.open } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot.at, channelId: REMINDER_CHANNEL_ID },
    });
  }
}

/**
 * Hand the plan to the OS, replacing whatever this app had planned.
 *
 * Cancel this app's own slots, then schedule each slot once, as a dated
 * one-off on the named channel. A refusal part way takes back what was
 * scheduled, so the OS never holds half a plan the app does not know about.
 */
export async function schedulePlan(slots: readonly ReminderSlot[]): Promise<ScheduleOutcome> {
  try {
    await cancelOwn();
    if (slots.length === 0) return 'done';
    await hand(slots);
    return 'done';
  } catch {
    await cancelOwn().catch(() => {});
    return 'failed';
  }
}

/** Take every pending reminder of this app's away, and nothing else. */
export async function cancelReminder(): Promise<ScheduleOutcome> {
  try {
    await cancelOwn();
    return 'done';
  } catch {
    return 'failed';
  }
}

/**
 * Put the one trial-ending reminder in front of the OS, replacing any earlier one.
 *
 * Its own kind (`trial-end:`), so the daily plan's cancels never reach it. The
 * caller has already checked permission, the trial and the learner's setting
 * (`trialReminderSync.ts`); this only hands over the slot it was given.
 */
export async function scheduleTrialReminderSlot(slot: TrialReminderSlot): Promise<ScheduleOutcome> {
  try {
    await cancelOwn(TRIAL_SLOT_PREFIX);
    await hand([slot]);
    return 'done';
  } catch {
    await cancelOwn(TRIAL_SLOT_PREFIX).catch(() => {});
    return 'failed';
  }
}

/** Take the trial-ending reminder away, and nothing else. */
export async function cancelTrialReminderSlot(): Promise<ScheduleOutcome> {
  try {
    await cancelOwn(TRIAL_SLOT_PREFIX);
    return 'done';
  } catch {
    return 'failed';
  }
}

/** The identifier of the trial-ending reminder the OS holds, or null. A refused read answers null. */
export async function pendingTrialReminder(): Promise<string | null> {
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    return pending.find((request) => request.identifier.startsWith(TRIAL_SLOT_PREFIX))?.identifier ?? null;
  } catch {
    return null;
  }
}

/** Taps already handed on, so a tap heard twice (live and as the launch tap) leads once. */
const handled = new Set<string>();

/**
 * Hear taps on this app's reminders until the answer is called.
 *
 * Also takes the tap that launched the app from cold, once, and clears it so a
 * later launch does not follow it again.
 */
export function onReminderTapped(handler: ReminderTapHandler): () => void {
  const take = (response: Notifications.NotificationResponse | null): void => {
    if (response === null) return;
    const request = response.notification.request;
    if (!request.identifier.startsWith(SLOT_PREFIX) && !request.identifier.startsWith(TRIAL_SLOT_PREFIX)) return;
    const key = `${request.identifier}@${String(response.notification.date)}`;
    if (handled.has(key)) return;
    handled.add(key);
    const open: unknown = request.content.data?.open;
    handler(typeof open === 'string' ? open : 'home', request.identifier);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(take);
  try {
    const launch = Notifications.getLastNotificationResponse();
    if (launch !== null) {
      take(launch);
      Notifications.clearLastNotificationResponse();
    }
  } catch {
    // No launch tap to follow; live taps still arrive.
  }
  return () => subscription.remove();
}
