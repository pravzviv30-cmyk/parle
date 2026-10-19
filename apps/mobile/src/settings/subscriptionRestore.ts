/**
 * What Settings › Subscription › Restore says, and whether the plan should be
 * read again (review P2 #4). Pure, so it is tested rather than buried in the
 * screen.
 *
 * `done` is the only outcome that may say the purchase is on this account.
 * `nothing-granted` on this surface means the store had nothing for this Apple
 * ID, and says so. The troubles reuse the paywall's pinned wording; only
 * `refresh-trouble` re-reads the plan, because the store did grant something
 * and the server read is what failed.
 */

import type { RestoreOutcome } from '../purchases/restore.ts';
import { restoreTrouble } from '../purchases/paywallView.ts';
import { RESTORE_DONE } from '../purchases/subscription.ts';

export const RESTORE_NOTHING_FOUND = "We checked the store and didn't find a subscription for this Apple ID.";

/** Every learner-facing line owned here, for the copy scans. */
export const SUBSCRIPTION_RESTORE_COPY: readonly string[] = [RESTORE_NOTHING_FOUND];

export function restoreResult(outcome: RestoreOutcome): { message: string | null; refreshPlan: boolean } {
  if (outcome.kind === 'done') return { message: RESTORE_DONE, refreshPlan: true };
  if (outcome.kind === 'nothing-granted') return { message: RESTORE_NOTHING_FOUND, refreshPlan: false };
  return { message: restoreTrouble(outcome), refreshPlan: outcome.kind === 'refresh-trouble' };
}
