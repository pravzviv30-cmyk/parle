import type { Plan, PlanSpec } from '@luvani/core';

import { purchasable } from '../purchases/paywallView.ts';
import type { PaidPlan, StoreOffering } from '../purchases/adapter.ts';

/**
 * One plan, as page four draws it.
 *
 * Every value here comes off the wire and none of it is compiled in. The price
 * is the store's own localised string, because a price in the binary goes stale
 * in a country nobody checked. The allowance is the server's, because an
 * allowance in the binary can disagree with the one the meter enforces, which is
 * F266 exactly. The page renders these and adds nothing.
 */
export interface WallPlanRow {
  plan: PaidPlan;
  /** What `purchase` is called with. Never shown. */
  productId: string;
  /** The name a learner reads. The catalogue's, or the store's if there is no catalogue. */
  name: string;
  /**
   * Whole minutes a month, or null when the server has not sent a catalogue.
   *
   * A number and not a sentence, so the words beside it stay in `wallCopy.ts`
   * where the guilt scan reads them, and this module is the only thing dividing
   * by sixty.
   */
  minutes: number | null;
  /** The store's own localised price string, exactly as the store wrote it. */
  price: string;
}

/**
 * The plans to draw, cheapest first, or null when there is nothing to sell.
 *
 * Null here is what makes the whole wall safe to ship before any RevenueCat key
 * exists: `wallPages` asks this question by asking the same `purchasable`, the
 * plans page never enters the list, and the wall ends on the free promise.
 */
export function wallPlanRows(
  offering: StoreOffering,
  catalogue: Record<Plan, PlanSpec> | null,
): readonly WallPlanRow[] | null {
  const products = purchasable(offering);
  if (products === null) return null;

  return products.map((product): WallPlanRow => {
    const spec = catalogue === null ? null : catalogue[product.plan];
    return {
      plan: product.plan,
      productId: product.productId,
      // The catalogue's label is the name we chose ("Max"), and the store's title
      // is the name the store was configured with. Ours first, because the store
      // listing is a shop window and this is the product.
      name: spec?.label ?? product.title,
      minutes: spec === undefined || spec === null ? null : Math.floor(spec.secondsPerPeriod / 60),
      price: product.localizedPrice,
    };
  });
}
