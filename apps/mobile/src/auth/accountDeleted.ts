/**
 * The confirmation a learner meets after a complete account deletion. F914.
 *
 * Before this a clean delete signed out in silence and the learner landed on
 * the welcome with no word that the account had gone, and nothing to say that a
 * store subscription keeps renewing until it is cancelled in the store. Deleting
 * a Luvani account cannot cancel it: Apple and Google own the subscription.
 *
 * Shown only when the server confirmed the deletion (2xx, not the 202 queued
 * case, which keeps `DeletionPendingNotice`). It is held in `Gate` memory and
 * stores nothing: no account id, no email, no flag on disk under the old
 * account's keys, which have just been erased.
 *
 * The store pages are fixed constants, never built from anything a learner or
 * server sent. On the web there is no store to choose truthfully, so the line
 * names both and no button is drawn.
 */

export const ACCOUNT_DELETED_TITLE = 'Your account has been deleted.';
export const ACCOUNT_DELETED_BODY = 'If you subscribed, cancel it in the App Store or Google Play too.';
export const ACCOUNT_DELETED_STORE = 'Open my subscriptions';
export const ACCOUNT_DELETED_DISMISS = 'Continue';

export const STORE_SUBSCRIPTIONS_URL = {
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
} as const;

/** The store page this platform's purchases live in, or null where there is none. */
export function storeSubscriptionsUrl(os: string): string | null {
  if (os === 'ios') return STORE_SUBSCRIPTIONS_URL.ios;
  if (os === 'android') return STORE_SUBSCRIPTIONS_URL.android;
  return null;
}
