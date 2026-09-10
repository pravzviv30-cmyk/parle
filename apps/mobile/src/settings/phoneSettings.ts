/**
 * Web build: there is no phone settings app here, and it says so.
 *
 * The `reminders/schedule.ts` pattern, and the same contract. Metro picks
 * `phoneSettings.native.ts` on iOS and Android; the compiler only ever resolves
 * this file, so this half is both the web implementation and the shape the whole
 * app is typechecked against. `phoneSettings.test.ts` holds the two halves to the
 * same exported names, because a name that exists in one and not the other
 * typechecks perfectly and crashes on a phone.
 *
 * ## Unavailable, not "fine"
 *
 * Every function answers with the honest negative rather than resolving quietly.
 * A browser has its own permission model, its own address bar padlock and no
 * concept of an app's own page in a settings app, so there is nothing here to
 * open and pretending otherwise would put a row on a screen that does nothing
 * when it is tapped. `PHONE_SETTINGS_AVAILABLE` is what `phoneRows` keys on to
 * leave the whole group out, exactly as `REMINDERS_AVAILABLE` leaves out the
 * reminder card.
 *
 * ## Why permission reads `denied` and not `undetermined`
 *
 * The same reasoning `schedule.ts` gives. `undetermined` means "flipping this
 * will raise a system dialog", and on the web that dialog never comes from here.
 * `denied` is the truth about a build with no microphone permission to read, and
 * the group is absent anyway because the flag above says so.
 *
 * ## Notifications are deliberately absent from this pair
 *
 * They are read through `reminderPermission()` in `reminders/schedule.ts`, which
 * is the only file in the repo allowed to import expo-notifications and has a
 * source scan keeping it that way. A second reader here would be a second
 * importer, and the whole value of that split is that the dependency can be
 * moved or replaced by reading one file.
 */

import type { PhonePermission } from './phone.ts';

/**
 * Whether this build can hand a learner to the phone's own settings.
 *
 * Annotated `boolean` rather than left to infer, for the reason
 * `REMINDERS_AVAILABLE` states: without the annotation this is the literal type
 * `false`, and the one check every caller wants to write becomes a type error
 * against a constant that is `true` on every device the app ships to.
 */
export const PHONE_SETTINGS_AVAILABLE: boolean = false;

/**
 * What opening the phone's settings is allowed to claim, in one word.
 *
 * `done` means the OS took the request without throwing, which is the strongest
 * claim available: whether the settings app actually came forward is the
 * platform's business. `unavailable` means this build has nowhere to send
 * anyone. `failed` means the platform refused a request it could have taken.
 *
 * Declared in both halves rather than shared, because neither half can import
 * the other: Metro would resolve `./phoneSettings.ts` from inside the native
 * module back to the native module.
 */
export type OpenSettingsOutcome = 'done' | 'unavailable' | 'failed';

/** What the OS would allow, if there were an OS microphone to ask about. */
export function microphonePermission(): Promise<PhonePermission> {
  return Promise.resolve('denied');
}

/** There is no settings app to open, so nothing is opened and nothing pretends. */
export function openPhoneSettings(): Promise<OpenSettingsOutcome> {
  return Promise.resolve('unavailable');
}
