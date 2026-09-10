/**
 * Native build: the one file that reads the microphone permission for a settings
 * row, and the one file that opens the phone's own settings.
 *
 * The `reminders/schedule.native.ts` pattern. Metro picks this on iOS and
 * Android and `phoneSettings.ts` everywhere else, so the compiler never opens
 * this file when it typechecks the app: `phoneSettings.test.ts` holds the two
 * halves to the same exported names, because a name that exists here and not
 * there is a crash on a device and a clean build on a laptop.
 *
 * ## It reads, and it never asks
 *
 * `getRecordingPermissionsAsync` raises no dialog. That is the whole reason this
 * module exists as a reader rather than as an asker: iOS offers the microphone
 * dialog once per install, and the moment it is worth spending is the moment a
 * learner goes to speak, in the scene. A settings screen that spent it would
 * take the ask away from where it makes sense and give it to a list somebody was
 * browsing. `settings/phone.ts` is where that decision is written down and
 * tested; nothing here decides anything.
 *
 * `requestRecordingPermissionsAsync` is deliberately not imported. There is no
 * asking from this file at all, so there is no second opinion about when a
 * dialog is worth raising.
 *
 * ## Granted and canAskAgain, not status
 *
 * The same reading `schedule.native.ts` makes of the notification permission,
 * and for the same reason: the question a row actually asks is "has the OS
 * refused, so that only the phone's settings can change it?". `canAskAgain` is
 * literally that. Anything that is not granted and cannot be asked for again is
 * `denied`, which is the one state that draws a row.
 *
 * ## Notifications are not read here
 *
 * `reminderPermission()` in `reminders/schedule.ts` already reads them, and its
 * native half is the only file in the repo allowed to import expo-notifications.
 * A second reader here would be a second importer and the split would stop
 * meaning anything. The Settings screen calls both, which costs one extra import
 * and keeps the dependency where a source scan can see it.
 *
 * ## `openSettings` opens this app's page, not the settings root
 *
 * On iOS `Linking.openSettings()` resolves `UIApplication.openSettingsURLString`,
 * which is Luvani's own page rather than the top of Settings, so a learner lands
 * on the switch they came for. On Android it opens the app's details page, which
 * is the equivalent. Neither is a deep link to one toggle, and neither can be:
 * the platforms do not offer one, and a hand-built `App-Prefs:` URL is the kind
 * of private scheme that gets a build rejected.
 */

import { getRecordingPermissionsAsync, type PermissionResponse } from 'expo-audio';
import * as Linking from 'expo-linking';

import type { PhonePermission } from './phone.ts';

/** This build has a settings app to open. See phoneSettings.ts for the annotation. */
export const PHONE_SETTINGS_AVAILABLE: boolean = true;

/**
 * What opening the phone's settings is allowed to claim, in one word.
 *
 * `done` means the OS took the request without throwing. `unavailable` is the
 * web half's answer and cannot happen here. `failed` means the platform refused.
 *
 * Declared in both halves rather than shared, because neither can import the
 * other: Metro resolves `./phoneSettings.ts` from inside this file back to this
 * file. `phoneSettings.test.ts` compares the two declarations word for word.
 */
export type OpenSettingsOutcome = 'done' | 'unavailable' | 'failed';

/**
 * Three OS states, in the three words `settings/phone.ts` already uses.
 *
 * Written as its own function rather than inline, so the reading is one thing a
 * test can point at, exactly as `permissionOf` is in `schedule.native.ts`.
 */
function permissionOf(status: PermissionResponse): PhonePermission {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * What the OS currently allows. Raises no dialog and has no user-facing effect.
 *
 * A thrown call answers `undetermined` rather than `denied`, which is the
 * opposite of what `reminderPermission` does with a throw, and the difference is
 * the direction each one fails in. There, a throw draws an off switch, which is
 * the honest thing to show for a channel we cannot ask about. Here, `denied` is
 * the one value that puts a row on the screen, so a module that answered it on a
 * failed read would invite a learner into their phone's settings to fix
 * something that may not be broken. Silence is the safer wrong answer.
 */
export async function microphonePermission(): Promise<PhonePermission> {
  try {
    return permissionOf(await getRecordingPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

/**
 * Hand the learner to this app's page in the phone's settings.
 *
 * The failure is reported rather than swallowed, because the caller has a row on
 * screen that was just tapped. A tap that quietly does nothing is the dead
 * switch F239 refused; the screen says the phone would not open its settings and
 * the learner is not left staring at a row wondering whether they hit it.
 */
export async function openPhoneSettings(): Promise<OpenSettingsOutcome> {
  try {
    await Linking.openSettings();
    return 'done';
  } catch {
    return 'failed';
  }
}
