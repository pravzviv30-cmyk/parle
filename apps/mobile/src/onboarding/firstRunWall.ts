/**
 * The first-run offer's trigger (come alive, README Part 5.C row 12 and Part 6
 * "Wall entry": `path-complete` with a `pendingWall` trigger; review finding 3).
 *
 * A learner who keeps their guest practice at the hand-off is shown the plans
 * once, after the hand-off and on the existing wall, with the door it already
 * has for a finished path. Only when both of these are true, and never before
 * either is known:
 *
 * - the server says this account holds no paid plan (`fetchBillingStatus`): the
 *   free allowance, or a plan that has lapsed. An unread status is not a "no",
 *   so it shows nothing; and
 * - the store has plans to sell (the same `paywallSurface` rule the wall draws
 *   its plans page from), which is never true on the web.
 *
 * Once: the pending flag is taken before anything is read, so a failure, a
 * "no" or an account change drops it, and nothing writes it to the disk, so
 * it is never shown again on its own. The wall itself is Phase 4's to redesign;
 * this only decides whether to open it.
 *
 * Pure apart from the calls handed in, so `firstRunWall.test.ts` runs it.
 */

import type { BillingStatus } from '../purchases/billingStatus.ts';

/** Whether the first-run offer may open, from the server's answer and the store's. */
export function firstRunWallDue(status: BillingStatus | null, storeHasPlans: boolean): boolean {
  if (status === null || !storeHasPlans) return false;
  const paid = (status.plan === 'starter' || status.plan === 'regular') && !status.lapsed;
  return !paid;
}

export interface FirstRunWallDeps {
  /** Take the pending flag: true once, after a kept practice; it is cleared by taking it. */
  take: () => boolean;
  /** The server's answer about this account, or null when it could not say. */
  status: () => Promise<BillingStatus | null>;
  /** Whether the store has plans to sell to this account. */
  storeHasPlans: () => Promise<boolean>;
  /** Still the same account, and the navigator ready, once the answers are in. */
  stillHere: () => boolean;
  /** Open the existing wall at its `path-complete` door. */
  open: () => void;
}

/** Open the first-run offer if it is pending and due. True only when it opened. */
export async function flushFirstRunWall(deps: FirstRunWallDeps): Promise<boolean> {
  if (!deps.take()) return false;
  let status: BillingStatus | null;
  let plans: boolean;
  try {
    [status, plans] = await Promise.all([deps.status(), deps.storeHasPlans()]);
  } catch {
    return false;
  }
  if (!firstRunWallDue(status, plans) || !deps.stillHere()) return false;
  deps.open();
  return true;
}
