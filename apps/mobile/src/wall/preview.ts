/**
 * Whether the wall may be opened straight away, for review, before a store exists.
 *
 * The purchase half of this feature cannot be switched on until the RevenueCat
 * keys exist and F263 and F266 close, and `docs/RELEASE_GATE.md` is explicit
 * that switching payments on first and fixing after is not acceptable. But a
 * wall nobody can look at until then is a wall nobody can correct, and the three
 * value pages need no store at all.
 *
 * So this exists, and it is gated the way `developmentEntitlementsEnabled` in
 * the token server is gated: three conditions that must all hold, one of which
 * is the absence of a production build. A reviewer sets the flag, sees the wall,
 * and nothing about a shipped app changes.
 *
 * It opens the wall and nothing else. It grants no minutes, buys nothing, and
 * makes no claim about a plan: pages one to three are the learner's own progress
 * and a promise about what stays free, all of which is as true in a preview as
 * anywhere.
 */
import { PLANS, type Plan, type PlanSpec } from '@luvani/core';

import type { StoreOffering } from '../purchases/adapter.ts';

export interface PreviewEnvironment {
  EXPO_PUBLIC_LUVANI_WALL_PREVIEW?: string;
  EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT?: string;
  NODE_ENV?: string;
}

export function wallPreviewEnabled(env: PreviewEnvironment = process.env): boolean {
  // A production build never opens on this, whatever else is set.
  if (env.NODE_ENV === 'production') return false;
  // And neither does a real build pointed at real infrastructure: the preview
  // rides on the same explicit local-development switch the mock auth adapter
  // needs, so it cannot be reached by a build that talks to anything real.
  if (env.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT !== '1') return false;
  return env.EXPO_PUBLIC_LUVANI_WALL_PREVIEW === '1';
}

/**
 * A fixture offering, so page four can be looked at before a store exists.
 *
 * Page four is null-gated on a real store answer, which is the property that
 * lets everything else ship dark. The cost is that the one page selling anything
 * is the one page nobody can review, and it is also the page most likely to be
 * wrong: it is where a price, an allowance and a legal requirement all meet.
 *
 * So a preview build gets two made-up products. They are made up in the open:
 * the ids say `preview`, and nothing about them can reach a learner, because
 * `wallPreviewEnabled` refuses a production build outright and refuses any build
 * that is not on the explicit local-development switch. No purchase can complete
 * either, because `purchases.purchase` on web answers `{ ok: false }` and on a
 * device asks a store that has never heard of these ids.
 *
 * Returns null when preview is off, which is every real build, and null is what
 * the wall already does with a store that answers nothing.
 */
export function previewOffering(env: PreviewEnvironment = process.env): StoreOffering | null {
  if (!wallPreviewEnabled(env)) return null;
  return {
    available: true,
    products: [
      { plan: 'starter', productId: 'luvani_starter_monthly_preview', title: 'Starter', localizedPrice: '£14.99', price: 14.99, currencyCode: 'GBP', period: 'month', intro: PREVIEW_WEEK, introEligible: true },
      { plan: 'regular', productId: 'luvani_regular_monthly_preview', title: 'Max', localizedPrice: '£24.99', price: 24.99, currencyCode: 'GBP', period: 'month', intro: PREVIEW_WEEK, introEligible: true },
    ],
    // The yearly products and a week's free trial (D16), so the page's yearly
    // rows and the trial timeline can be looked at too. Made up the same way:
    // the ids say preview, and no store has ever heard of them.
    yearly: [
      { plan: 'starter', productId: 'luvani_starter_yearly_preview', title: 'Starter', localizedPrice: '£119.99', price: 119.99, currencyCode: 'GBP', period: 'year', localizedPricePerMonth: '£10.00', intro: PREVIEW_WEEK, introEligible: true },
      { plan: 'regular', productId: 'luvani_regular_yearly_preview', title: 'Max', localizedPrice: '£179.99', price: 179.99, currencyCode: 'GBP', period: 'year', localizedPricePerMonth: '£15.00', intro: PREVIEW_WEEK, introEligible: true },
    ],
  };
}

const PREVIEW_WEEK = { priceString: '£0.00', periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 } as const;

/**
 * A catalogue for the preview, and the one place this repo compiles an allowance in.
 *
 * The plans page shows what a plan buys in minutes, and those minutes belong to
 * the server: a copy compiled into the app can disagree with the meter that
 * enforces it, which is F266 and is the reason `catalogue.ts` holds only what the
 * server sent. So a preview build with no session behind it shows no minutes, and
 * the card is honest but the page is unreviewable in the one respect that matters
 * most.
 *
 * This closes that, and it is deliberately the shape the rest of the feature
 * refuses. It is tolerable for exactly one reason: `wallPreviewEnabled` cannot be
 * true in a production build or in a build off the local-development switch, so
 * this line cannot run in any app a learner has. If that gate ever loosens, this
 * is the first thing that has to go, which is why it lives beside the gate rather
 * than next to the page it serves.
 */
export function previewCatalogue(env: PreviewEnvironment = process.env): Record<Plan, PlanSpec> | null {
  return wallPreviewEnabled(env) ? PLANS : null;
}
