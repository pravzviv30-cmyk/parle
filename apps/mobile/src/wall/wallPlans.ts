import { ALLOWANCE_WINDOW_DAYS, STORE_TRIAL_DAYS, WEEKLY_STARTER_SECONDS, type Plan, type PlanSpec } from '@luvani/core';

import { purchasable } from '../purchases/paywallView.ts';
import type { PaidPlan, StoreOffering, StoreProduct } from '../purchases/adapter.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import { requiredPlan, type LockedFeature } from '../purchases/featureLocks.ts';

/**
 * How long "a conversation" is, stated once and said on the page.
 *
 * 2026-09-27, notebook Phase 6-E. The plans are priced in conversations a week
 * because minutes a month is a number nobody can picture. A conversation is not
 * a unit the meter knows, so the page says which length it counts in, and this
 * is the only place that length is written. It is a unit, not an allowance:
 * every allowance still comes from the catalogue the server sent.
 */
export const CONVERSATION_MINUTES = 10;

const DAYS_A_WEEK = 7;

/**
 * Whole conversations a week that a period's minutes buy, rounded down.
 *
 * Down, always. A plan that buys 4.2 a week is "about four", and one that buys
 * 0.9 says nothing in conversations at all rather than "about one". The page may
 * undersell a plan and may never oversell one. The division is done on whole
 * numbers so the answer at an exact boundary (Max: 300 minutes over 30 days is
 * exactly seven) is not lost to a float landing a hair under.
 */
export function conversationsAWeek(minutes: number, periodDays: number | null): number | null {
  if (periodDays === null || periodDays <= 0) return null;
  const perWeek = Math.floor((minutes * DAYS_A_WEEK) / (periodDays * CONVERSATION_MINUTES));
  return perWeek >= 1 ? perWeek : null;
}

/** Whole conversations in a number of minutes, rounded down. */
export function conversationsIn(minutes: number): number {
  return Math.floor(minutes / CONVERSATION_MINUTES);
}

/**
 * One way to pay for a plan: yearly or monthly, each its own store product
 * (founder decision D16).
 *
 * Every field is the store's. The page chooses one of these, never a plan in
 * the abstract, because a purchase is of a product and the product decides the
 * period, the price and whether a free trial comes with it.
 */
export interface WallPlanOffer {
  plan: PaidPlan;
  /** What `purchase` is called with. Never shown. */
  productId: string;
  /** How often the store bills it, from the store's own subscription period. */
  period: 'week' | 'month' | 'year';
  /** The store's own localised price for one period, exactly as the store wrote it. */
  price: string;
  /**
   * A yearly product's monthly figure, as RevenueCat formats it on the device
   * (the yearly price over twelve, in the store's currency), or null when it
   * did not say. An approximation, which is why the page says "about".
   */
  perMonth: string | null;
  /** Whole percent saved against twelve monthly payments of this same tier and currency. */
  annualSavingsPercent: number | null;
  /**
   * The store's free trial in whole days, only when the store says this
   * account may still take it. Null otherwise, and then nothing calls it a
   * trial: no timeline, no "free" on the button.
   */
  trialDays: number | null;
  /**
   * Whether the store carries a free trial on this product at all, whatever
   * it said about this account's eligibility. Never drawn: it is what the
   * success page needs to know after a purchase, because the store applies
   * the trial it has even when the eligibility answer was unknown, and the
   * server then grants a week, which must not be said as a month (F742).
   */
  hasFreeTrial: boolean;
}

/**
 * One plan, as the plans page draws it.
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
  /** Those minutes as whole conversations a week, rounded down, or null with no catalogue. */
  perWeek: number | null;
  /** The store's own localised price string, exactly as the store wrote it. */
  price: string;
  /**
   * Whole minutes a day the plan's allowance comes to, rounded down, or null
   * with no catalogue. What `goalFitLine` compares with the learner's goal.
   */
  daily: number | null;
  /** The ways to pay for it: the yearly product first when the store sells one, then the monthly. */
  offers: readonly WallPlanOffer[];
}

/**
 * Whole minutes a day that a period's minutes come to, rounded down, or null
 * when there is no period to divide by. Down, like every count on this page.
 */
export function dailyMinutes(minutes: number, periodDays: number | null): number | null {
  if (periodDays === null || periodDays <= 0) return null;
  return Math.floor(minutes / periodDays);
}

/**
 * The store's free trial on a product, in whole days, or null.
 *
 * Only a trial this account may still take (`introEligible`, the store's own
 * answer, unknown reading as no), and only one the store describes in days or
 * weeks, so the timeline can name its days without guessing how long a month
 * is. One cycle only. Anything else reads as no trial: the plain price shows,
 * and the store's own sheet still describes whatever it offers.
 */
export function storeTrialDays(product: Pick<StoreProduct, 'intro' | 'introEligible'>): number | null {
  const intro = product.intro;
  if (intro === null || !product.introEligible || intro.cycles !== 1) return null;
  const unit = intro.periodUnit === 'DAY' ? 1 : intro.periodUnit === 'WEEK' ? DAYS_A_WEEK : null;
  if (unit === null) return null;
  const days = unit * intro.periodNumberOfUnits;
  // The reminder day is two before the last, so a trial shorter than three
  // days has no timeline to draw; a month in days is not the store's to say.
  return Number.isInteger(days) && days >= 3 && days <= 31 ? days : null;
}

/**
 * The minutes a store free trial holds, in the server's own terms, or null.
 *
 * The server grants a trial a week of the chosen plan, allowance x 7/30
 * (`storeTrialSeconds` in core's meter, applied at the projection), whatever
 * length the store configures. This is the same rule applied to the catalogue
 * the server sent, so the number is the one the meter will enforce, and with no
 * catalogue there is no number.
 */
export function storeTrialMinutes(catalogue: Record<Plan, PlanSpec> | null, plan: PaidPlan): number | null {
  const spec = catalogue === null ? null : catalogue[plan];
  if (spec === undefined || spec === null || !Number.isFinite(spec.secondsPerPeriod) || spec.secondsPerPeriod <= 0) return null;
  return Math.floor(Math.floor((spec.secondsPerPeriod * STORE_TRIAL_DAYS) / ALLOWANCE_WINDOW_DAYS) / 60);
}

/** A display comparison only. Missing numeric store facts never become a claim. */
function annualSavingsPercent(product: StoreProduct, monthly: StoreProduct | undefined): number | null {
  if (product.period !== 'year' || monthly?.period !== 'month' || product.plan !== monthly.plan
    || !product.currencyCode || !/^[A-Z]{3}$/.test(product.currencyCode) || product.currencyCode !== monthly.currencyCode
    || typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price <= 0
    || typeof monthly.price !== 'number' || !Number.isFinite(monthly.price) || monthly.price <= 0) return null;
  const twelveMonths = monthly.price * 12;
  if (!Number.isFinite(twelveMonths) || product.price >= twelveMonths) return null;
  const percent = Math.floor((1 - product.price / twelveMonths) * 100);
  return percent >= 1 && percent <= 99 ? percent : null;
}

function offerOf(product: StoreProduct, monthly?: StoreProduct): WallPlanOffer {
  return {
    plan: product.plan,
    productId: product.productId,
    period: product.period,
    price: product.localizedPrice,
    perMonth: product.period === 'year' ? product.localizedPricePerMonth?.trim() || null : null,
    annualSavingsPercent: annualSavingsPercent(product, monthly),
    trialDays: product.period === 'year' || product.period === 'month' ? storeTrialDays(product) : null,
    hasFreeTrial: (product.period === 'year' || product.period === 'month') && product.intro !== null,
  };
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
  // Yearly products travel apart (purchases/contract.ts), so nothing built for
  // monthly prices can draw one as a month. They join the tier the store also
  // sells monthly; one with no priced monthly sibling is not drawn, because the
  // page frames every plan by its monthly allowance.
  const weekly = offering.available ? (offering.weekly ?? []) : [];
  const yearly = offering.available ? (offering.yearly ?? []) : [];

  return products.filter((product, index) => products.findIndex(candidate => candidate.plan === product.plan) === index).map((product): WallPlanRow => {
    const spec = catalogue === null ? null : catalogue[product.plan];
    const minutes = spec === undefined || spec === null ? null : Math.floor(spec.secondsPerPeriod / 60);
    const year = yearly.find((candidate) => candidate.plan === product.plan && candidate.period === 'year' && candidate.localizedPrice.trim().length > 0);
    const monthly = products.find(candidate => candidate.plan === product.plan && candidate.period === 'month');
    const week = weekly.find(candidate => candidate.plan === product.plan && candidate.plan === 'starter' && candidate.period === 'week' && candidate.intro === null && candidate.localizedPrice.trim().length > 0);
    return {
      plan: product.plan,
      productId: product.productId,
      // The catalogue's label is the name we chose ("Max"), and the store's title
      // is the name the store was configured with. Ours first, because the store
      // listing is a shop window and this is the product.
      name: spec?.label ?? product.title,
      minutes,
      perWeek: minutes === null || spec === undefined || spec === null ? null : conversationsAWeek(minutes, spec.periodDays),
      price: product.localizedPrice,
      daily: minutes === null || spec === undefined || spec === null ? null : dailyMinutes(minutes, spec.periodDays),
      offers: [...(week ? [offerOf(week)] : []), ...products.filter(candidate => candidate.plan === product.plan && candidate.period === 'month').map(candidate => offerOf(candidate)), ...(year ? [offerOf(year, monthly)] : [])],
    };
  });
}

/** A chosen way to pay, with the name of the plan it belongs to. */
export type WallChosen = WallPlanOffer & { name: string };

/** The offer with this product id, with its plan's name, or null when none is chosen or it left the page. */
export function chosenOffer(rows: readonly WallPlanRow[] | null, productId: string | null): WallChosen | null {
  if (rows === null || productId === null) return null;
  for (const row of rows) {
    const offer = row.offers.find((candidate) => candidate.productId === productId);
    if (offer !== undefined) return { ...offer, name: row.name };
  }
  return null;
}

/** Comparing tiers keeps the chosen billing period when that tier sells it. */
export function offerForTier(row: WallPlanRow, current: Pick<WallPlanOffer, 'period'> | null): WallPlanOffer | null {
  return row.offers.find(offer => offer.period === current?.period) ?? row.offers[0] ?? null;
}

/**
 * The way to pay the page chooses before the learner does (D16), or null.
 *
 * The yearly product of the cheapest plan whose minutes a day cover the
 * learner's own daily goal. Null when there is no goal (F907: it used to fall
 * to Core monthly, so the page flipped between plans as its reads landed), no plan covers it, the
 * covering plan is not sold yearly, or the learner already holds a paid plan
 * that has not lapsed: they came to manage what they have, not to be steered.
 * Choosing this is the page's suggestion, not the learner's choice, so the
 * screen that applies it records nothing (no `plan_selected`).
 */
export function preselectedOffer(
  rows: readonly WallPlanRow[] | null,
  goal: number | null,
  standing: Pick<BillingStatus, 'plan' | 'lapsed'> | null,
): WallPlanOffer | null {
  if (rows === null) return null;
  if (standing !== null && standing.plan !== 'trial' && !standing.lapsed) return null;
  if (goal === null) return null;
  const covering = rows.find((row) => row.daily !== null && row.daily >= goal);
  if (covering === undefined) return null;
  return covering.offers.find((offer) => offer.period === 'year') ?? null;
}

/** The goal as the game layer has read it: unread until `loaded`, then a target or none. */
export interface GoalRead {
  loaded: boolean;
  target: number | null;
}

/**
 * The product the page suggests, or null until both the goal and the server's
 * status have been read. WallScreen locks in the first suggestion, so one
 * made from half the facts would stick; waiting means the same plan however
 * the reads arrive (F907). No goal suggests nothing, and the page shows its
 * default (`effectiveSelection`: Core yearly).
 */
export function wallSuggestion(
  rows: readonly WallPlanRow[] | null,
  goal: GoalRead,
  status: Pick<BillingStatus, 'plan' | 'lapsed'> | null,
  feature: LockedFeature | null = null,
  plan: PaidPlan | null = null,
): string | null {
  if (status === null || rows === null) return null;
  const yearlyOf = (plan: PaidPlan) => rows.find((row) => row.plan === plan)?.offers.find((offer) => offer.period === 'year')?.productId ?? null;
  // F912: a subscriber is offered the other plan, never their own again.
  const held = currentPaidPlan(status);
  if (held !== null) return yearlyOf(held === 'starter' ? 'regular' : 'starter');
  // F910: a lock opened the wall, so the plan that opens it, whatever the goal.
  if (feature !== null) return yearlyOf(requiredPlan(feature));
  // A plan lock that is no feature (Explore's collections) names its plan directly.
  if (plan !== null) return yearlyOf(plan);
  if (!goal.loaded) return null;
  return preselectedOffer(rows, goal.target, status)?.productId ?? null;
}

/** The free plan's minutes, in minutes and in whole conversations. */
export interface WallTrial {
  minutes: number;
  conversations: number;
}

/**
 * The free plan's size, from the catalogue, or null when there is none.
 *
 * Its window is 44 hours from first use (REV-001), so it is said as one
 * conversation every other day, never per week or "every 2 days".
 */
export function wallTrial(catalogue: Record<Plan, PlanSpec> | null): WallTrial | null {
  const spec = catalogue === null ? null : catalogue.trial;
  if (spec === undefined || spec === null) return null;
  const minutes = Math.floor(spec.secondsPerPeriod / 60);
  return { minutes, conversations: conversationsIn(minutes) };
}

/** Weekly allowance is enabled only by the matching server billing contract. */
export function offerMinutes(row: WallPlanRow, offer: WallPlanOffer | null): number | null {
  return offer?.period === 'week' ? WEEKLY_STARTER_SECONDS / 60 : row.minutes;
}

/**
 * Whether trial copy may show at all (F912): only to a learner the server has
 * read as on the free plan and not lapsed. The offer must still carry the
 * store's own `trialDays` too. An unread status says no, so a subscriber is
 * never shown a trial while the read is in flight, and a lapsed learner is
 * never told a trial is coming even if the store still says intro-eligible.
 */
export function trialCopyAllowed(status: Pick<BillingStatus, 'plan' | 'lapsed'> | null): boolean {
  return status !== null && status.plan === 'trial' && !status.lapsed;
}

/** The paid plan this learner currently holds, or null (free, lapsed, or unread). */
export function currentPaidPlan(status: Pick<BillingStatus, 'plan' | 'lapsed'> | null): PaidPlan | null {
  if (status === null || status.lapsed || status.plan === 'trial') return null;
  return status.plan;
}
