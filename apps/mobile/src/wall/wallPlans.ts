import type { Plan, PlanSpec } from '@luvani/core';

import { purchasable } from '../purchases/paywallView.ts';
import type { PaidPlan, StoreOffering } from '../purchases/adapter.ts';

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
    const minutes = spec === undefined || spec === null ? null : Math.floor(spec.secondsPerPeriod / 60);
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
    };
  });
}

/** The free trial, in minutes and in whole conversations. */
export interface WallTrial {
  minutes: number;
  conversations: number;
}

/**
 * The trial's size, from the catalogue, or null when there is none.
 *
 * The trial does not renew, so it has no week to count in: it is said as
 * minutes, with what those minutes are in conversations beside them.
 */
export function wallTrial(catalogue: Record<Plan, PlanSpec> | null): WallTrial | null {
  const spec = catalogue === null ? null : catalogue.trial;
  if (spec === undefined || spec === null) return null;
  const minutes = Math.floor(spec.secondsPerPeriod / 60);
  return { minutes, conversations: conversationsIn(minutes) };
}
