import type { StoreOffering, StoreProduct } from './adapter.ts';
import type { RestoreOutcome } from './restore.ts';

export interface PaywallSurface {
  title: string;
  body: string;
  purchaseLabel: string;
  restoreLabel: string;
}

/** No package, wrong tier or blank store price means no purchase surface. */
export function paywallSurface(offering: StoreOffering): (PaywallSurface & { product: StoreProduct }) | null {
  if (!offering.available) return null;
  const product = offering.product;
  if (product.plan !== 'starter' || product.localizedPrice.trim().length === 0) return null;
  return {
    product,
    title: 'More speaking time',
    body: 'Practice and review still work offline. When you want more conversations, the store can add speaking time here.',
    purchaseLabel: `Continue with Starter · ${product.localizedPrice}`,
    restoreLabel: 'Restore a previous purchase',
  };
}

export const PURCHASE_TROUBLE = 'The store could not finish that just now. Nothing was changed, and you can try later.';
export const REFRESH_TROUBLE = 'The store finished, but speaking time is still catching up. Try again in a moment.';
export const PURCHASE_READY = 'Your speaking time is ready.';

/**
 * The button while the store is being asked, said once for both surfaces.
 *
 * The paywall spelled this inline, and the Settings row needs the same words:
 * two spellings of one wait is how a learner meets two different apps.
 */
export const RESTORE_BUSY = 'Checking the store…';

/**
 * What went wrong, or null when nothing did.
 *
 * A cancelled sheet answers null on purpose. Backing out of the store is a
 * choice, not a failure, and a learner who made it has done nothing that needs
 * explaining to them.
 *
 * A success answers null too, because the two surfaces do not agree about what
 * one means and neither should be told here.
 */
export function restoreTrouble(outcome: RestoreOutcome): string | null {
  if (outcome.kind === 'store-trouble') return PURCHASE_TROUBLE;
  if (outcome.kind === 'refresh-trouble') return REFRESH_TROUBLE;
  return null;
}
