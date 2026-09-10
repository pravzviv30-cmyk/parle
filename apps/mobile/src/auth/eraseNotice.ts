/**
 * The one thing the app still has to say after it has signed you out — F496.
 *
 * Deleting an account is three steps: the server delete, the local erase, the
 * sign-out. The middle one can fail on a device with no free storage, and when
 * it does the learner walks away believing everything is gone while this handset
 * still holds their learning history. On a shared device that is the whole
 * reason the sentence was ever written.
 *
 * The sentence itself is unchanged, word for word, from the one `App.tsx`
 * carried inline. What changed is where it is delivered: it used to be returned
 * to the Settings sheet, which the sign-out had already unmounted, so nothing
 * drew it. It now belongs to a screen on the signed-out side of the door.
 *
 * The words live here rather than in the `.tsx` for the reason `dailyGoal.ts`
 * states: apps/mobile has no renderer, so a sentence inside JSX is a sentence
 * nothing can ask a question about. Here, `eraseNotice.test.ts` holds all three
 * against the copy rules directly.
 *
 * There is deliberately no retry offered. By the time this is read the sign-out
 * has happened and `storage/scope.ts` has no active user to resolve a namespace
 * from, so a second attempt would erase nothing and say it had. A button that
 * quietly does nothing is worse than the plain instruction below it.
 */

/**
 * The headline. It says "device" and not "phone" on purpose: the same build
 * runs in a browser, and the sentence under it already speaks of a device.
 */
export const ERASE_NOTICE_TITLE = 'This device kept a copy';

/**
 * What happened and what to do about it, in that order. Both halves matter:
 * the account really is gone, and this handset really is not clean.
 */
export const ERASE_NOTICE_BODY =
  'Your online account was deleted, but this device could not finish erasing its local copy. Clear the app data before sharing this device.';

/**
 * The way forward. It acknowledges rather than promises, because tapping it
 * fixes nothing on the disk; it returns the learner to the welcome.
 */
export const ERASE_NOTICE_DISMISS = 'Got it';
