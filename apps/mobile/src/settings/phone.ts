/**
 * The Phone group: one row per permission the operating system has refused.
 *
 * `reminders/reminder.ts` already says out loud that notifications are off in
 * phone settings, and then offers no way there. The microphone has no sentence
 * anywhere outside a live scene. Both are the same shape: the app asked, the OS
 * said no, and iOS will not offer that dialog again, so nothing this app can do
 * will change it. What it can do is open its own page in the phone's settings.
 *
 * ## A row appears only when the OS has refused
 *
 * This is the whole rule, and it is worth being exact about the two states it
 * leaves out.
 *
 * **Granted draws nothing.** A row reading "Microphone, Allowed" does nothing
 * when it is tapped except take a learner to a screen where the only thing they
 * can do is turn something off. That is not a setting, it is a report, and a
 * settings list is not where the app reports on itself.
 *
 * **Undetermined draws nothing either**, and that one is the real decision. The
 * ask belongs where the learner is already trying to do the thing: the scene
 * asks for the microphone when they go to speak, and the reminder switch asks
 * for notifications when they turn it on. iOS shows each dialog exactly once per
 * install, so a row here that spent it would take the ask away from the moment
 * it makes sense and give it to a settings screen somebody was only browsing.
 *
 * ## Null is not a state, it is a silence
 *
 * Both permissions arrive as `null` until the first read comes back. Guessing
 * `denied` for a frame would flash a row at somebody who has never been asked,
 * which is the same reason `ProfileTab` holds its reminder permission null until
 * it is read. Nothing is drawn from a value nobody has yet.
 *
 * ## What this file may not do
 *
 * It talks to nothing. `settings/phoneSettings.ts` and its native half are the
 * only files that read a permission or open the phone's settings, and they hand
 * their answer here. That is `reminderRow`'s split applied to a second
 * permission: the judgement is a pure function a test can ask, and the module
 * that touches the OS makes no judgements at all.
 */

/**
 * The three OS states, in the three words `reminders/reminder.ts` already uses.
 *
 * Deliberately the same vocabulary rather than a second one, and deliberately
 * not imported from there: the reminder's type is about a notification channel,
 * and a microphone is not one. Two names for one shape is fine; one name
 * covering two unrelated permissions is how a change to one silently moves the
 * other.
 */
export type PhonePermission = 'undetermined' | 'granted' | 'denied';

/** Which permission a row is about. The screen holds no other state about it. */
export type PhonePermissionKey = 'microphone' | 'notifications';

export interface PhoneRow {
  key: PhonePermissionKey;
  /** The row's own words. No digits: a settings label that counts is one that shouts. */
  label: string;
  /** What is true now, and what tapping does about it. */
  sub: string;
}

export const MICROPHONE_ROW = 'Microphone';

/**
 * Says three things, and the third is the one that matters most.
 *
 * Where the setting actually lives, because it is not in this app and a learner
 * hunting for it here would not find it. That the tap opens that place, so the
 * phone's own screen appearing is expected rather than a surprise. And that
 * typing is still a way through, because a learner is never forced to speak
 * aloud and a refused microphone must not read as a locked door.
 */
export const MICROPHONE_SUB = 'Off in your phone settings, which this opens. You can type your answers instead.';

export const NOTIFICATIONS_ROW = 'Notifications';

/**
 * The same three things for the daily reminder, and nothing about practising.
 *
 * It says what a reminder is for and stops. No count of days, nothing about what
 * happens without one, and no reason to turn it on beyond the plain fact that
 * this is what is in the way.
 */
export const NOTIFICATIONS_SUB = 'Off in your phone settings, which this opens. The daily reminder needs them.';

/** Every word this group can say, flattened, the way `REMINDER_COPY` is. */
export const PHONE_COPY: readonly string[] = [
  MICROPHONE_ROW,
  MICROPHONE_SUB,
  NOTIFICATIONS_ROW,
  NOTIFICATIONS_SUB,
];

const ROWS: Record<PhonePermissionKey, PhoneRow> = {
  microphone: { key: 'microphone', label: MICROPHONE_ROW, sub: MICROPHONE_SUB },
  notifications: { key: 'notifications', label: NOTIFICATIONS_ROW, sub: NOTIFICATIONS_SUB },
};

/**
 * The rows to draw, in the order the screen draws them, or none at all.
 *
 * `available` is the platform pair saying whether there is a phone settings app
 * to open. On the web there is not, so the group is absent rather than sitting
 * there offering a walk nobody can take. It is the same job `REMINDERS_AVAILABLE`
 * does for the reminder card, and the same reason: a row whose sentence names
 * phone settings is a row that lies on a laptop.
 *
 * The microphone comes first because it is the one that stops a conversation.
 */
export function phoneRows({
  microphone,
  notifications,
  available,
}: {
  microphone: PhonePermission | null;
  notifications: PhonePermission | null;
  available: boolean;
}): readonly PhoneRow[] {
  if (!available) return [];
  const out: PhoneRow[] = [];
  if (microphone === 'denied') out.push(ROWS.microphone);
  if (notifications === 'denied') out.push(ROWS.notifications);
  return out;
}
