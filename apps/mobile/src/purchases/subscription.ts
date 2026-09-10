/**
 * The Subscription group on Settings: two rows, and the rule for drawing them.
 *
 * Restore existed only inside the paywall, and the paywall is mounted only
 * where a session has been refused for want of minutes, so the one moment a
 * learner could ask the store what they already own was the moment they ran
 * out. There was no way to a subscription at all, which Apple asks for on any
 * app selling an auto renewing one (Guideline 3.1.1).
 *
 * Everything the group draws is decided here rather than in the screen, for the
 * reason `profile/dailyGoal.ts` states: apps/mobile has no renderer, so a
 * decision inside a `.tsx` is a decision nothing can ask a question about.
 *
 * No price anywhere. The store owns pricing, it is localised per account and
 * per country, and a price compiled into the binary is a price that goes stale
 * without anyone noticing. No count either: minutes are decided at token
 * issuance on the server, and a number the phone cannot verify is the dead
 * switch F239 refused and the minutes row F377 still refuses.
 */

import type { StoreOffering } from './adapter.ts';
import {
  PURCHASE_TROUBLE,
  REFRESH_TROUBLE,
  RESTORE_BUSY,
  paywallSurface,
} from './paywallView.ts';

/** Which of the two was tapped. The screen holds no other state about them. */
export type SubscriptionAction = 'manage' | 'restore';

export interface SubscriptionRow {
  action: SubscriptionAction;
  /** The row's own words. No digits: a settings label that counts is one that shouts. */
  label: string;
  /** The quiet line under it, saying what tapping does before it is tapped. */
  sub: string;
}

export const MANAGE_ROW = 'Manage subscription';

/**
 * Honest about whose screen opens next.
 *
 * The sheet is the store's, and so is cancelling, changing tier and every
 * billing question behind it. Saying so before the tap means the store
 * appearing is what the learner expected rather than a surprise.
 */
export const MANAGE_SUB = 'Opens your subscriptions in the store.';

export const RESTORE_ROW = 'Restore purchases';

/** What restoring is for, in the words of someone who has just changed phones. */
export const RESTORE_SUB = 'Brings back speaking time you already paid for.';

/**
 * Said after a restore on Settings, and it reports a check, not a result.
 *
 * The store tells us it finished and nothing more: it cannot say whether it
 * found anything, and entitlement is settled on the server at token issuance
 * rather than here. Claiming restored speaking time the phone cannot see would
 * be the same lie F377 refuses about a minutes row, and the learner would meet
 * it at the room door instead.
 *
 * The paywall says more after its own restore, and may: there a purchase has
 * genuinely just happened.
 */
export const RESTORE_DONE = 'The store has been checked, and anything you paid for is on this account.';

const ROWS: readonly SubscriptionRow[] = [
  { action: 'manage', label: MANAGE_ROW, sub: MANAGE_SUB },
  { action: 'restore', label: RESTORE_ROW, sub: RESTORE_SUB },
];

/**
 * The rows to draw, or null for no group at all.
 *
 * Drawn only when the store answered with a real product, which is the same
 * test the paywall applies before it offers to sell anything. That is what
 * keeps the group honest in Expo Go, on the web, and on a build with no
 * RevenueCat keys: in all three the store answers nothing, both rows would
 * open onto nothing, and a row that cannot do what it says is worse than an
 * absent one.
 *
 * Both rows stand or fall together. A learner who can be sold a subscription is
 * a learner who must be able to leave it, and splitting them would let the
 * first ship without the second.
 */
export function subscriptionGroup(offering: StoreOffering): readonly SubscriptionRow[] | null {
  return paywallSurface(offering) === null ? null : ROWS;
}

/**
 * Every word this group can say, flattened, the way `REMINDER_COPY` is.
 *
 * The guilt scan reads this list rather than the exports one by one, so a new
 * sentence is covered the moment it is added. The last three are borrowed from
 * the paywall rather than rewritten, and they are in the list because the
 * learner meets them here too and nothing else was scanning them.
 */
export const SUBSCRIPTION_COPY: readonly string[] = [
  MANAGE_ROW,
  MANAGE_SUB,
  RESTORE_ROW,
  RESTORE_SUB,
  RESTORE_DONE,
  RESTORE_BUSY,
  PURCHASE_TROUBLE,
  REFRESH_TROUBLE,
];
