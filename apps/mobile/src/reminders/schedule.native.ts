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
 * different SDK, or removed, by reading one file. Touched by five, it is load
 * bearing in five places and the next SDK upgrade is a week.
 *
 * It buys two smaller things as well. Cancelling every scheduled notification
 * below is safe precisely because nothing else in the repo can schedule one, so
 * "cancel all" means "cancel this reminder" and cannot grow a second meaning
 * while nobody is looking. And there is no notification identifier to persist:
 * a stored id is a third place the truth can live, and it goes stale the moment
 * a schedule fails halfway.
 *
 * ## The trigger repeats, and the app never gets a vote
 *
 * One daily trigger, at the hour and minute of a preset in reminder.ts, handed
 * to the OS once. It repeats there. Nothing in this module reads a clock, and
 * nothing re-arms it, which is the mechanical half of the rule reminder.ts
 * spends its header on: a reminder the app rewrites each day is a reminder the
 * app can suppress on the days the learner practised, and a notification that
 * disappears when you have done enough is a streak wearing a scheduler for a
 * costume. F227's source scan makes the import that would enable it impossible;
 * the daily trigger makes the mechanism unnecessary.
 *
 * Changing the time is a different act and it is the learner's. It cancels and
 * schedules once more, because they moved the reminder, not because of anything
 * they did or did not say in French.
 *
 * ## No badge, on either platform, and they are two different jobs
 *
 * A badge is the number on the app icon that grows while the app is not opened,
 * which is the counter this whole phase refuses to show, hosted by the home
 * screen instead of by us. Turning it off is one decision and two mechanisms.
 *
 * On iOS the permission request is spelled out, because expo's default asks for
 * alert, sound *and* badge. An omitted `allowBadge` is read as false, so the
 * suppression there is the absence of the key: alert and sound only.
 *
 * On Android the badge is a property of the channel, so it has to be written
 * down. `setShowBadge` is only called at all when the channel input carries the
 * key, and a channel created without it takes the platform default; the channel
 * expo auto-creates when we name none sets it true outright. `showBadge: false`
 * below is the whole of the Android half, and F240 is why it looks like a line
 * that says nothing: the guard that forbade the word `badge` outright forbade
 * the one spelling of it that removes a count. The guard now separates asking
 * for a badge from suppressing one, and requires this line.
 *
 * What no test here can show is what a launcher actually draws. That is device
 * evidence and needs a dev build; the source only proves the request was made.
 *
 * ## The channel the reminder lands on, and why it is named from here
 *
 * Android puts every notification on a channel, and the channel is the row a
 * learner reads in Settings and the switch they reach for when they have had
 * enough. The obvious place to name it is the config plugin's `defaultChannel`
 * prop in app.json, and that is a trap: the plugin writes that prop to
 * `com.google.firebase.messaging.default_notification_channel_id`, which is
 * read for a remote push and for nothing else. A locally scheduled
 * notification ignores it, and expo's `BaseNotificationBuilder` falls back to
 * an auto-created channel whose name comes from an Android string resource. So
 * the reminder arrives, under a name nobody wrote, in the one screen where a
 * learner goes to turn it off.
 *
 * Naming it is a runtime call, which means it has to be made here: this is the
 * only file allowed to import expo-notifications, so there is nowhere else it
 * could go. Both ends are required and neither is any use alone — the channel
 * is created below, and the daily trigger names the same id. A channel nothing
 * routes to, and an id with no channel behind it, both fall back exactly as if
 * they had not been written.
 *
 * ## What it is not responsible for
 *
 * It does not check permission before scheduling. The caller owns the order the
 * dialog appears in, and `reminderRow` already owns what a permission means for
 * the switch; a second opinion here is how the two come to disagree.
 *
 * Local scheduled notifications have not worked in Expo Go on Android since
 * SDK 53, so nothing here can be checked on a device without a dev build.
 */

import * as Notifications from 'expo-notifications';

import { reminderContent, reminderTime, type ReminderPermission, type ReminderTimeId } from './reminder.ts';

/**
 * The channel this app's one notification lands on.
 *
 * The id is arbitrary and then permanent. Android will not let a channel's
 * importance be changed after it exists, so editing this string does not
 * rename anything: it creates a second channel and orphans whatever the
 * learner had already set on the first. Name and description are the two
 * fields Android does allow an update to, which is why the name is a separate
 * constant from the id rather than doing both jobs.
 */
const REMINDER_CHANNEL_ID = 'daily-reminder';

/** What a learner reads in Settings, above the switch that turns this off. */
const REMINDER_CHANNEL_NAME = 'Daily reminder';

/** This build has a real scheduler. See schedule.ts for why it is annotated. */
export const REMINDERS_AVAILABLE: boolean = true;

/**
 * What a scheduling attempt is allowed to claim, in one word.
 *
 * `done` means the OS accepted the request without throwing. Nothing stronger
 * than that exists here: permission can be revoked an hour later and delivery
 * is the platform's business, so this is never a promise that a notification
 * will be presented. `unavailable` is the web half's answer and cannot happen
 * on a device. `failed` means the platform refused.
 *
 * Declared in both halves rather than shared, because neither can import the
 * other: Metro resolves `./schedule.ts` from inside this file back to this
 * file. `schedule.test.ts` compares the two declarations word for word.
 */
export type ScheduleOutcome = 'done' | 'unavailable' | 'failed';

/**
 * Three OS states, in the three words reminder.ts already uses.
 *
 * Read off `granted` and `canAskAgain` rather than off `status`, because the
 * question the row actually asks is "will flipping this switch open a dialog?".
 * `canAskAgain` is literally that, and it is the field that moves when a
 * learner denies the Android 13 permission prompt or turns Luvani off in iOS
 * Settings months later. Anything that is not granted and cannot be asked for
 * again is `denied`, which draws an off switch and one honest sentence.
 */
function permissionOf(status: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * What the OS currently allows. Raises no dialog and has no user-facing effect.
 *
 * A thrown call is reported as `denied` rather than as undetermined: the switch
 * then draws off, which is what a channel we cannot ask about is worth.
 */
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
 * answer, so a screen that treats the call as "the learner is being asked" gets
 * a silent no and a button that appears broken. When the OS will not ask again,
 * this says so without spending the one chance.
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
 * Create the channel the trigger below names, and never let it cost a schedule.
 *
 * The failure is swallowed on purpose, and it is the only place in this module
 * where that is the right answer. If the OS refuses the channel, the trigger
 * still names an id, expo-notifications falls back to its auto-created one,
 * and the learner gets the reminder they asked for under a name we did not
 * choose. Reporting `failed` instead would trade a slightly wrong word in a
 * settings screen for no reminder at all, which is not a trade anyone would
 * make on purpose.
 *
 * `DEFAULT` importance rather than the `HIGH` the fallback channel is created
 * with. This arrives in the shade at an hour the learner picked; it has no
 * business jumping over whatever they are doing at the time. And `showBadge`
 * false for the reason the header gives: the count is the one thing this
 * reminder must never put on a home screen, and the key is the only way to say
 * so on Android.
 *
 * Swallowing the failure therefore has a cost worth naming: a channel the OS
 * refused is a reminder that arrives on expo's fallback channel, and that one
 * badges. The trade still goes the same way — a wrong label and an unwanted
 * count beat no reminder at all — but it is a trade, not a free catch.
 *
 * On iOS this resolves to a no-op returning null, because channels are an
 * Android idea. The platform split for that lives inside the package, and a
 * second one written here would be another thing to keep in step with it.
 */
async function ensureReminderChannel(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: REMINDER_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.DEFAULT,
      showBadge: false,
    });
  } catch {
    // Deliberately nothing. See above: the reminder outranks its own label.
  }
}

/**
 * Put one daily reminder in front of the OS, replacing whatever was there.
 *
 * Cancel then schedule, so changing the preset moves the reminder instead of
 * adding a second one. The cancel is unconditional and total for the reason the
 * header gives: this module is the only scheduler in the repo, so there is
 * nothing else it could take with it.
 *
 * The preset is resolved through `reminderTime`, which repairs an unknown id to
 * the default rather than throwing. A value that came back off a disk should
 * cost the learner the time they picked, never the reminder itself.
 */
export async function scheduleReminder(time: ReminderTimeId, days?: readonly number[]): Promise<ScheduleOutcome> {
  const preset = reminderTime(time);
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await ensureReminderChannel();
    const chosen = days ? [...new Set(days)].filter(day => Number.isInteger(day) && day >= 1 && day <= 7) : null;
    if (chosen && chosen.length === 0) return 'failed';
    const triggers = chosen ? chosen.map(weekday => ({ type: Notifications.SchedulableTriggerInputTypes.WEEKLY as const, weekday, channelId: REMINDER_CHANNEL_ID, hour: preset.hour, minute: preset.minute })) : [{ type: Notifications.SchedulableTriggerInputTypes.DAILY as const, channelId: REMINDER_CHANNEL_ID, hour: preset.hour, minute: preset.minute }];
    for (const trigger of triggers) await Notifications.scheduleNotificationAsync({ content: reminderContent(), trigger });
    return 'done';
  } catch {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    // The OS refused. The caller must not record this as a reminder that is on,
    // because the row the learner would use to turn it off already says Off.
    return 'failed';
  }
}

/** Take the reminder away. Total, for the same reason the cancel above is. */
export async function cancelReminder(): Promise<ScheduleOutcome> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return 'done';
  } catch {
    return 'failed';
  }
}
