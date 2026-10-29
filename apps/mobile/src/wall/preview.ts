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

import type { StoreHeldPlan, StoreOffering } from '../purchases/adapter.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';

export interface PreviewEnvironment {
  EXPO_PUBLIC_LUVANI_WALL_PREVIEW?: string;
  EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT?: string;
  EXPO_PUBLIC_LUVANI_LAUNCH_WALL_AWAY_SEC?: string;
  NODE_ENV?: string;
}

/**
 * The bundle's environment, read with literal property accesses.
 *
 * Expo inlines `process.env.EXPO_PUBLIC_…` only where it is written out
 * literally; handing `process.env` around as an object reads nothing on a
 * device. So every default below comes through here.
 */
export function bundledEnvironment(): PreviewEnvironment {
  return {
    EXPO_PUBLIC_LUVANI_WALL_PREVIEW: process.env.EXPO_PUBLIC_LUVANI_WALL_PREVIEW,
    EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: process.env.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT,
    EXPO_PUBLIC_LUVANI_LAUNCH_WALL_AWAY_SEC: process.env.EXPO_PUBLIC_LUVANI_LAUNCH_WALL_AWAY_SEC,
    NODE_ENV: process.env.NODE_ENV,
  };
}

/** Never a production build, and only on the explicit local-development switch. */
export function localDevelopmentBuild(env: PreviewEnvironment = bundledEnvironment()): boolean {
  return env.NODE_ENV !== 'production' && env.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT === '1';
}

/**
 * Whether the fixture offering stands in for a store that answers nothing.
 *
 * True for `1` (the wall-first review) and for `store`, which gives the launch
 * wall something to sell on a simulator with no RevenueCat keys while leaving
 * the navigator to open on the tabs, so cold launch and return can be watched.
 */
export function storePreviewEnabled(env: PreviewEnvironment = bundledEnvironment()): boolean {
  if (!localDevelopmentBuild(env)) return false;
  return env.EXPO_PUBLIC_LUVANI_WALL_PREVIEW === '1' || env.EXPO_PUBLIC_LUVANI_WALL_PREVIEW === 'store';
}

export function wallPreviewEnabled(env: PreviewEnvironment = bundledEnvironment()): boolean {
  // A production build never opens on this, whatever else is set.
  if (env.NODE_ENV === 'production') return false;
  // And neither does a real build pointed at real infrastructure: the preview
  // rides on the same explicit local-development switch the mock auth adapter
  // needs, so it cannot be reached by a build that talks to anything real.
  if (env.EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT !== '1') return false;
  return env.EXPO_PUBLIC_LUVANI_WALL_PREVIEW === '1';
}

/**
 * How long in the background makes coming back an open of the app (D24).
 *
 * `EXPO_PUBLIC_LUVANI_LAUNCH_WALL_AWAY_SEC`, a positive whole number of
 * seconds, shortens the 30 minutes so the return rule can be watched on a
 * simulator. Same gate as the preview; anything else is the 30 minutes.
 */
export function launchWallAwayMs(env: PreviewEnvironment = bundledEnvironment(), fallbackMs = 30 * 60 * 1000): number {
  if (!localDevelopmentBuild(env)) return fallbackMs;
  const raw = env.EXPO_PUBLIC_LUVANI_LAUNCH_WALL_AWAY_SEC;
  if (raw === undefined || !/^[1-9][0-9]*$/.test(raw)) return fallbackMs;
  const ms = Number(raw) * 1000;
  return Number.isSafeInteger(ms) ? ms : fallbackMs;
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
 * `storePreviewEnabled` refuses a production build outright and refuses any build
 * that is not on the explicit local-development switch. No purchase can complete
 * either, because `purchases.purchase` on web answers `{ ok: false }` and on a
 * device asks a store that has never heard of these ids.
 *
 * Returns null when preview is off, which is every real build, and null is what
 * the wall already does with a store that answers nothing.
 */
export function previewOffering(env: PreviewEnvironment = bundledEnvironment()): StoreOffering | null {
  if (!storePreviewEnabled(env)) return null;
  return {
    available: true,
    products: [
      { plan: 'starter', productId: 'luvani_starter_monthly_preview', title: 'Core', localizedPrice: '£14.99', price: 14.99, currencyCode: 'GBP', period: 'month', intro: PREVIEW_WEEK, introEligible: true },
      { plan: 'regular', productId: 'luvani_regular_monthly_preview', title: 'Max', localizedPrice: '£24.99', price: 24.99, currencyCode: 'GBP', period: 'month', intro: PREVIEW_WEEK, introEligible: true },
    ],
    // The yearly products and a week's free trial (D16), so the page's yearly
    // rows and the trial timeline can be looked at too. Made up the same way:
    // the ids say preview, and no store has ever heard of them.
    yearly: [
      { plan: 'starter', productId: 'luvani_starter_yearly_preview', title: 'Core', localizedPrice: '£119.99', price: 119.99, currencyCode: 'GBP', period: 'year', localizedPricePerMonth: '£10.00', intro: PREVIEW_WEEK, introEligible: true },
      { plan: 'regular', productId: 'luvani_regular_yearly_preview', title: 'Max', localizedPrice: '£179.99', price: 179.99, currencyCode: 'GBP', period: 'year', localizedPricePerMonth: '£15.00', intro: PREVIEW_WEEK, introEligible: true },
    ],
  };
}

/**
 * The held plan a preview build pretends the store answered (F909), so the
 * Subscription screen's dated renewal line can be looked at on web with a paid
 * file entitlement. Gated exactly like `previewOffering`: null on any production
 * build, off the local-development switch, or for a free or lapsed plan. The
 * product is the preview's own yearly fixture for the server's tier, renewing
 * four weeks from now.
 */
export function previewHeldPlan(status: BillingStatus | null, env: PreviewEnvironment = bundledEnvironment(), now: number = Date.now()): StoreHeldPlan | null {
  if (!storePreviewEnabled(env) || status === null || status.plan === 'trial' || status.lapsed) return null;
  return { productId: `luvani_${status.plan}_yearly_preview`, expiresAt: now + 28 * 24 * 60 * 60 * 1000, willRenew: true, inTrial: false };
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
 * refuses. It is tolerable for exactly one reason: `storePreviewEnabled` cannot be
 * true in a production build or in a build off the local-development switch, so
 * this line cannot run in any app a learner has. If that gate ever loosens, this
 * is the first thing that has to go, which is why it lives beside the gate rather
 * than next to the page it serves.
 */
export function previewCatalogue(env: PreviewEnvironment = bundledEnvironment()): Record<Plan, PlanSpec> | null {
  return storePreviewEnabled(env) ? PLANS : null;
}
