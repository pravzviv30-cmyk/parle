import { billedPrice, PLANS_PRIVACY, PLANS_RENEWAL, PLANS_RESTORE, PLANS_TERMS, PLANS_TRUST } from '../wall/wallCopy.ts';
import { PAID_PLANS, type StoreOffering, type StoreProduct } from './contract.ts';
import type { RestoreOutcome } from './restore.ts';

export interface PaywallSurface {
  title: string;
  body: string;
  purchaseLabel: string;
  restoreLabel: string;
}

/**
 * Every tier that can be bought right now, cheapest first.
 *
 * The single source of "is there anything to sell", so the Settings group, the
 * terminal refusal block and the wall's plans page cannot disagree about it. A
 * product with a blank price is dropped rather than drawn: a price is what makes
 * something purchasable, and a button with nothing after the interpunct is a
 * button that has already failed.
 *
 * Returns null rather than an empty list when there is nothing, because null is
 * what every caller here already means by "draw no surface at all".
 */
export function purchasable(offering: StoreOffering): readonly StoreProduct[] | null {
  if (!offering.available) return null;
  const priced = [...offering.products, ...(offering.weekly ?? []), ...(offering.yearly ?? [])].filter((product) => product.localizedPrice.trim().length > 0);
  // Ordered here rather than trusted from the adapter, so a caller that builds
  // an offering by hand gets the same order a real store answer produces.
  const ordered = PAID_PLANS.flatMap((plan) => priced.filter((product) => product.plan === plan));
  return ordered.length === 0 ? null : ordered;
}

/**
 * The terminal refusal block: one tier, one button, no choice to make.
 *
 * This is what a learner meets at the door of a room they cannot enter, and it
 * offers the cheapest tier deliberately. Somebody who has just been stopped is
 * not in a position to weigh two plans, and the wall is where that comparison
 * belongs. Widening this into a picker would put a pricing decision on the one
 * screen with no room for the evidence that justifies it.
 */
export function paywallSurface(offering: StoreOffering): (PaywallSurface & { product: StoreProduct }) | null {
  const products = purchasable(offering);
  if (products === null) return null;
  const product = products[0]!;
  return {
    product,
    title: 'More speaking time',
    body: 'Practice and review still work offline. When you want more conversations, the store can add speaking time here.',
    // The store's own name for it, not the word "Starter". With two tiers the
    // cheapest is normally starter, but a build configured with only the second
    // product would have offered Max under the wrong name, and the price beside
    // it would have made that look deliberate.
    purchaseLabel: `Continue with ${product.title} · ${product.localizedPrice}`,
    restoreLabel: 'Restore a previous purchase',
  };
}

/**
 * Said inside the out-of-minutes card when the store has nothing to offer.
 *
 * It used to say nothing at all: `Paywall` returned null, so the card held a
 * headline and a Back button. A store that did not answer is not an upgrade
 * requirement, so this names what is true, offers the restore a learner who
 * already paid may need, and points at what still works for free. No price,
 * no plan name, nothing the phone cannot see.
 */
export const STORE_UNAVAILABLE_TITLE = 'Plans are not available here yet';
export const STORE_UNAVAILABLE_BODY = 'The store did not answer on this device. If you already have a plan, you can restore it here. Practice and review still work without minutes.';

/**
 * What the inline paywall draws, decided here so a test can ask.
 *
 * `offer` is the shared surface plus the plans page's own renewal terms and the
 * two documents, which Apple asks for beside the buy button and a learner is
 * owed anyway. `unavailable` is the same small print around a restore, with no
 * buy button. Every string is borrowed from `wall/wallCopy.ts`, so the inline
 * card and the full plans page cannot come to say different things.
 */
export type InlinePaywallView =
  | {
      kind: 'offer';
      surface: PaywallSurface & { product: StoreProduct };
      renewal: string;
      privacy: string;
      terms: string;
      trust: string;
    }
  | {
      kind: 'unavailable';
      title: string;
      body: string;
      restoreLabel: string;
      privacy: string;
      terms: string;
      trust: string;
    };

export function inlinePaywall(offering: StoreOffering): InlinePaywallView {
  const surface = paywallSurface(offering);
  if (surface === null) {
    return {
      kind: 'unavailable',
      title: STORE_UNAVAILABLE_TITLE,
      body: STORE_UNAVAILABLE_BODY,
      restoreLabel: PLANS_RESTORE,
      privacy: PLANS_PRIVACY,
      terms: PLANS_TERMS,
      trust: PLANS_TRUST,
    };
  }
  return { kind: 'offer', surface, renewal: `${billedPrice(surface.product.localizedPrice, surface.product.period)}. ${PLANS_RENEWAL}`, privacy: PLANS_PRIVACY, terms: PLANS_TERMS, trust: PLANS_TRUST };
}

export const PURCHASE_TROUBLE ='The store could not finish that just now. Nothing was changed, and you can try later.';
export const REFRESH_TROUBLE = 'The store finished, but speaking time is still catching up. Try again in a moment.';
/** Ask to Buy: the store is holding the purchase until a parent or organiser approves it. */
export const PURCHASE_AWAITING_APPROVAL = 'Someone on your Family Sharing account needs to approve this. Nothing has been charged yet. Your plan will appear here once it is approved.';
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
  if (outcome.kind === 'awaiting-approval') return PURCHASE_AWAITING_APPROVAL;
  // The store finished and the server granted nothing. On this surface that has
  // just followed a purchase, so the honest reading is that the grant has not
  // arrived yet rather than that the learner owns nothing. Settings reads the
  // same outcome the other way, which is why neither wording lives in here.
  if (outcome.kind === 'nothing-granted') return REFRESH_TROUBLE;
  return null;
}
