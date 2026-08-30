import type { StoreOffering, StoreProduct } from './adapter.ts';

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
