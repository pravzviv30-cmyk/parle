/**
 * Restoring a purchase, as one function two surfaces call.
 *
 * This lived inside Paywall.tsx, and the paywall is mounted only where a
 * session has been refused for want of minutes. So the only moment a learner
 * could ask the store what they already own was the moment they ran out, which
 * Apple asks us not to do (Guideline 3.1.1) and which is unkind besides. A
 * Settings row needs the same two steps in the same order, and two copies of
 * two steps is how one of them quietly stops calling the server.
 *
 * The order is the whole rule. The store is asked first, because it is the only
 * party that knows what this Apple or Google account has paid for. The token
 * server is asked second, because it is the only party that knows how many
 * minutes that buys: entitlement is decided at token issuance and never on the
 * phone, so a restore that skipped the refresh would leave the device believing
 * something the room would refuse.
 *
 * Nothing here says anything to the learner. The two surfaces disagree about
 * what a success means, and they should: on the paywall a purchase has just
 * happened, and on Settings we know only that the store was asked.
 */

import { trackProductEvent } from '../analytics/track.ts';
import type { Plan } from '@luvani/core';

import { purchases, type StoreAction } from './adapter.ts';
import { refreshBilling } from './client.ts';
import { scopeGeneration } from '../storage/scope.ts';
import { ownedStoreSettlement } from './storeSettlement.ts';

/**
 * What became of it, in the four ways it can end.
 *
 * `cancelled` is separate from trouble because a learner who backed out of a
 * store sheet has not hit a problem and must not be told they have.
 * `refresh-trouble` is separate from `done` because the store finishing is not
 * the same event as the server agreeing, and only the second one moves minutes.
 * `nothing-granted` is separate from both because the server answering clearly
 * that this account owns nothing is not a failure of anything. It used to be
 * indistinguishable from success: `done` meant the refresh returned `response.ok`,
 * which it does for a learner with nothing to restore, and the paywall then said
 * their speaking time was ready and hid the buy and restore buttons behind that
 * sentence (F265). The two surfaces word this one differently and should: after a
 * purchase it means the grant is still catching up, and on Settings it means the
 * store was checked and there was nothing there.
 */
export type RestoreOutcome =
  | { kind: 'done'; plan: Plan }
  | { kind: 'nothing-granted' }
  | { kind: 'cancelled' }
  /** The store deferred it (Ask to Buy). Nothing was paid or granted. */
  | { kind: 'awaiting-approval' }
  | { kind: 'store-trouble' }
  | { kind: 'refresh-trouble' };

/**
 * The half that happens after the store has answered, whatever it was asked.
 *
 * Shared with the paywall's buy button, because a purchase and a restore differ
 * only in the question put to the store. Everything after it is identical, and
 * was identical when it was written twice.
 */
export async function settleStoreAction(userId: string, operation: () => Promise<StoreAction>): Promise<RestoreOutcome> {
  const owner = scopeGeneration();
  return ownedStoreSettlement(operation, () => refreshBilling(userId, owner), () => owner === scopeGeneration());
}

/** Ask the store what this account owns, then ask the server what it is worth. */
export async function restorePurchases(userId: string, entry: 'settings' | 'wall' | 'inline' = 'settings'): Promise<RestoreOutcome> {
  const expected = { userId, generation: scopeGeneration() };
  const started = trackProductEvent({ name: 'restore_started', properties: { entry } }, expected);
  const outcome = await settleStoreAction(userId, () => purchases.restore(userId));
  void started.then(() => trackProductEvent({ name: 'restore_settled', properties: { entry, outcome: outcome.kind } }, expected));
  return outcome;
}
