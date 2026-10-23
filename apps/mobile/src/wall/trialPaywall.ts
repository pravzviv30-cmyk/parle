/**
 * The trial paywall ("P2 · Luvani", user-approved 2026-10-19), as decisions a
 * test can ask about. The `.tsx` files under `wall/` only lay these out.
 *
 * Two kinds, decided by one fact: `trialTimeline` answered with a view, which
 * it does only for a product the store says this account may still take a
 * free trial on. Unknown eligibility is never eligible here, because
 * `WallPlanOffer.trialDays` is null for it and the timeline is then null.
 *
 * Every number is somebody else's: the price and period are the store's, the
 * trial days are the store's introductory period, the minutes are the server
 * catalogue's. The billed amount is always the most prominent price on the
 * page (Apple Guideline 3.1.2): it is `billed`, drawn bold in the trial offer
 * line and as the standard headline price, and nothing else on the page is a
 * price drawn larger.
 */

import { ALLOWANCE_WINDOW_DAYS, STORE_TRIAL_DAYS, type Plan, type PlanSpec } from '@luvani/core';

import { PURCHASE_AWAITING_APPROVAL, PURCHASE_TROUBLE, REFRESH_TROUBLE } from '../purchases/paywallView.ts';
import type { BillingStatus } from '../purchases/billingStatus.ts';
import type { TrialNodeKey, TrialTimelineView } from './trialTimeline.ts';
import { dayAndMonth } from './wallAccount.ts';
import {
  PAYWALL_BENEFITS,
  PAYWALL_BILLED_MONTHLY,
  PAYWALL_BILLED_MONTHLY_AFTER_TRIAL,
  PAYWALL_BILLED_WEEKLY,
  PAYWALL_BILLED_YEARLY,
  PAYWALL_FAILED_BODY,
  PAYWALL_FAILED_TITLE,
  PAYWALL_APPROVAL_TITLE,
  PAYWALL_APPROVAL_BODY,
  PAYWALL_PURCHASING,
  PAYWALL_RESTORE_NONE_BODY,
  PAYWALL_RESTORE_NONE_TITLE,
  PAYWALL_STANDARD_TITLE,
  PAYWALL_SUBSCRIBE,
  PAYWALL_TRY_AGAIN,
  SUCCESS_ROW_PLAN,
  SUCCESS_ROW_REMINDER,
  SUCCESS_ROW_THEN,
  SUCCESS_ROW_TIME,
  SUCCESS_ROW_TRIAL_ENDS,
  billedPrice,
  billedYearlyAbout,
  compareAllowance,
  compareContinue,
  compareTrialLine,
  offerLead,
  planAllowanceLine,
  dailyAllowance,
  standardDisclosure,
  successHeldBody,
  successPaidBody,
  successTrialBody,
  trialDisclosure,
} from './wallCopy.ts';
import { offerForTier, offerMinutes, storeTrialMinutes, type WallChosen, type WallPlanOffer, type WallPlanRow } from './wallPlans.ts';
import type { WallSuccess } from './wallSuccess.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A weekly product's window, which is its billing period. */
const WEEK_DAYS = 7;

/**
 * The product the page shows and the button buys: the learner's own choice,
 * else the page's suggestion (`preselectedOffer`, which keeps priority), else
 * the default: Starter yearly, Starter monthly, then the first product the
 * store sells. The main page has no cards to pick from, so with an available
 * offering something is always chosen and the empty page cannot draw. Null
 * only when no row carries any product, which the wall treats as unavailable.
 */
export function effectiveSelection(rows: readonly WallPlanRow[] | null, selected: string | null, suggestion: string | null): string | null {
  if (rows === null) return null;
  const exists = (id: string | null) => id !== null && rows.some(row => row.offers.some(offer => offer.productId === id));
  if (exists(selected)) return selected;
  if (exists(suggestion)) return suggestion;
  const starter = rows.find(row => row.plan === 'starter');
  return starter?.offers.find(offer => offer.period === 'year')?.productId
    ?? starter?.offers.find(offer => offer.period === 'month')?.productId
    ?? rows.flatMap(row => row.offers)[0]?.productId
    ?? null;
}

export interface PaywallOffer {
  kind: 'trial' | 'standard';
  headline: string;
  /** The words before the billed amount on a trial ("Free for 7 days, then "), or null. */
  lead: string | null;
  /** The billed amount and its period, the most prominent price on the page. */
  billed: string;
  /** Under it, smaller and muted: the monthly figure and a genuine saving, or how often. */
  detail: string;
  cta: string;
  /** The footer line right under the button. */
  disclosure: string;
  /** The standard paywall's three benefits; empty on a trial, which shows its timeline. */
  benefits: readonly string[];
}

/**
 * What the paywall says for the chosen product. `trial` is `trialTimeline`'s
 * answer for the same product, so the two can never disagree about whether
 * this is a trial.
 */
export function paywallOffer(offer: WallChosen, trial: TrialTimelineView | null): PaywallOffer {
  const billed = billedPrice(offer.price, offer.period);
  const detail = detailLine(offer, trial !== null);
  if (trial !== null) {
    return {
      kind: 'trial',
      headline: trial.title,
      lead: offerLead(trial.days),
      billed,
      detail,
      cta: trial.cta,
      disclosure: trialDisclosure(trial.days, offer.price, offer.period),
      benefits: [],
    };
  }
  return {
    kind: 'standard',
    headline: PAYWALL_STANDARD_TITLE,
    lead: null,
    billed,
    detail,
    cta: PAYWALL_SUBSCRIBE,
    disclosure: standardDisclosure(offer.price, offer.period),
    benefits: PAYWALL_BENEFITS,
  };
}

/**
 * The muted line under the billed amount. A yearly product says the store's
 * own monthly figure, and the saving only when `wallPlans` could compute a
 * genuine one from two store prices in one currency (`annualSavingsPercent`).
 * The saving is said here, beside the store's figures, rather than in
 * `wallCopy.ts`, whose scan refuses saving words in its own sentences.
 */
export function detailLine(offer: WallPlanOffer, trial: boolean): string {
  if (offer.period === 'week') return PAYWALL_BILLED_WEEKLY;
  if (offer.period === 'month') return trial ? PAYWALL_BILLED_MONTHLY_AFTER_TRIAL : PAYWALL_BILLED_MONTHLY;
  if (offer.perMonth === null) return PAYWALL_BILLED_YEARLY;
  const about = billedYearlyAbout(offer.perMonth);
  return offer.annualSavingsPercent === null ? about : `${about}. Save ${offer.annualSavingsPercent}%`;
}

/** The days in a plan's allowance window, from the catalogue, or the shared window. */
export function windowDays(catalogue: Record<Plan, PlanSpec> | null, plan: Plan, period: WallPlanOffer['period']): number {
  if (period === 'week') return WEEK_DAYS;
  const days = catalogue?.[plan]?.periodDays;
  return typeof days === 'number' && days > 0 ? days : ALLOWANCE_WINDOW_DAYS;
}

/**
 * A paid plan's month or year as a day's worth (REV-001): "about 10 minutes a
 * day" for Core, "up to 20 minutes a day" for Max. Undefined for the weekly
 * product and for a window too small to say per day, which keep the minutes.
 */
export function paidDaily(plan: Plan, minutes: number, days: number, period: WallPlanOffer['period']): string | undefined {
  if (period === 'week' || plan === 'trial' || days <= 0) return undefined;
  const perDay = Math.floor(minutes / days);
  return perDay >= 1 ? dailyAllowance(plan, perDay) : undefined;
}

/** "<Tier>, about <n> minutes a day", or the minutes over the window, or just the tier with no catalogue. */
export function planLine(row: WallPlanRow, offer: WallPlanOffer | null, catalogue: Record<Plan, PlanSpec> | null): string {
  const minutes = offerMinutes(row, offer);
  if (minutes === null) return row.name;
  const days = windowDays(catalogue, row.plan, offer?.period ?? 'month');
  return planAllowanceLine(row.name, minutes, days, paidDaily(row.plan, minutes, days, offer?.period ?? 'month'));
}

export interface CompareCard {
  plan: WallPlanRow['plan'];
  name: string;
  offer: WallPlanOffer;
  /** The billed amount for the period currently chosen. */
  price: string;
  allowance: string | null;
  /** Only when the store says this account may take this offer's trial. */
  trial: string | null;
}

/** The compare sheet's cards: one per tier, in the period the learner chose. */
export function compareCards(rows: readonly WallPlanRow[], current: WallPlanOffer | null, catalogue: Record<Plan, PlanSpec> | null): CompareCard[] {
  return rows.flatMap((row) => {
    const offer = offerForTier(row, current);
    if (offer === null) return [];
    const minutes = offerMinutes(row, offer);
    const trialMinutes = offer.trialDays === null ? null : storeTrialMinutes(catalogue, row.plan);
    return [{
      plan: row.plan,
      name: row.name,
      offer,
      price: billedPrice(offer.price, offer.period),
      allowance: minutes === null ? null : compareAllowance(minutes, windowDays(catalogue, row.plan, offer.period), paidDaily(row.plan, minutes, windowDays(catalogue, row.plan, offer.period), offer.period)),
      trial: offer.trialDays === null || trialMinutes === null ? null : compareTrialLine(trialMinutes, offer.trialDays),
    }];
  });
}

/** The compare sheet's button for the card picked in it. */
export function compareCta(card: CompareCard): string {
  return compareContinue(card.name, card.offer.trialDays !== null);
}

/** The glyph each timeline row carries. */
export const TIMELINE_GLYPHS: Record<TrialNodeKey, 'unlock' | 'bell' | 'calendar' | 'star' | 'chat'> = {
  today: 'unlock',
  during: 'chat',
  remind: 'bell',
  cancel: 'calendar',
  then: 'star',
};

/**
 * The timeline's rows as drawn: the minutes line folded into Today, so the
 * page reads Today, Day 5, Day 7. Pure; the view is never changed.
 */
export function timelineRows(view: TrialTimelineView): TrialTimelineView['nodes'] {
  const during = view.nodes.find((node) => node.key === 'during');
  return view.nodes
    .filter((node) => node.key !== 'during')
    .map((node) => (node.key === 'today' && during ? { ...node, line: `${node.line} ${during.line}` } : node));
}

export interface PaywallNotice {
  title: string | null;
  body: string;
  danger: boolean;
}

/**
 * The notice above the button, from the message the wall's money code set and
 * the action the learner last took. A cancel in Apple's sheet sets no message,
 * so it returns null and the page is as it was.
 */
export function paywallNotice(message: string | null, last: 'buy' | 'restore' | null): PaywallNotice | null {
  if (message === null) return null;
  if (message === PURCHASE_TROUBLE && last === 'buy') return { title: PAYWALL_FAILED_TITLE, body: PAYWALL_FAILED_BODY, danger: true };
  if (message === PURCHASE_AWAITING_APPROVAL) return { title: PAYWALL_APPROVAL_TITLE, body: PURCHASE_AWAITING_APPROVAL, danger: false };
  if (message === REFRESH_TROUBLE && last === 'restore') return { title: PAYWALL_RESTORE_NONE_TITLE, body: PAYWALL_RESTORE_NONE_BODY, danger: false };
  return { title: null, body: message, danger: false };
}

/**
 * The Ask to Buy card on the pending-checkout page, or null for the default one. It reads the saved checkout's
 * `deferred` mark, never screen memory, so it survives a reopen and a "Check again". The checkout fence stays up while a
 * purchase is deferred, so nobody buys twice; only the words change.
 */
export function pendingCheckoutNotice(deferred: boolean): PaywallNotice | null {
  return deferred ? { title: PAYWALL_APPROVAL_TITLE, body: PAYWALL_APPROVAL_BODY, danger: false } : null;
}

/** The footer button's words and look while the offer is on screen. */
export function paywallCta(input: {
  offer: PaywallOffer | null;
  /** The store sheet or the settling after it is in flight. */
  busy: boolean;
  /** The label the frame would otherwise say (confirming, ready). */
  morphLabel: string | null;
  notice: PaywallNotice | null;
}): { label: string; dim: number } {
  if (input.morphLabel !== null) return { label: input.morphLabel, dim: 0.6 };
  if (input.busy) return { label: PAYWALL_PURCHASING, dim: 0.6 };
  if (input.offer === null) return { label: PAYWALL_SUBSCRIBE, dim: 0.45 };
  if (input.notice?.danger) return { label: PAYWALL_TRY_AGAIN, dim: 1 };
  return { label: input.offer.cta, dim: 1 };
}

/**
 * When the trial bought on this wall ends: the server's confirmed period end,
 * else the purchase time plus the offer's trial days (the store's default
 * trial length when the offer did not say). Null when neither is usable.
 */
export function trialEndsAt(periodEnd: string | null, boughtAt: number | null, trialDays: number | null): number | null {
  const confirmed = periodEnd === null ? NaN : Date.parse(periodEnd);
  if (Number.isFinite(confirmed)) return confirmed;
  if (boughtAt === null || !Number.isFinite(boughtAt)) return null;
  return boughtAt + (trialDays ?? STORE_TRIAL_DAYS) * DAY_MS;
}

export interface SuccessSummary {
  body: string;
  rows: ReadonlyArray<{ key: string; value: string }>;
}

/**
 * The success page's words and summary rows. The Reminder row is present only
 * when a reminder is actually scheduled (`reminderScheduled`, the answer
 * `scheduleTrialReminder` gave), the same real state the timeline promised
 * from. A paid plan says nothing about a trial.
 */
export function successSummary(input: {
  success: WallSuccess;
  offer: WallChosen | null;
  catalogue: Record<Plan, PlanSpec> | null;
  plan: Plan | null;
  endsAt: number | null;
  reminderScheduled: boolean;
  reminderAt: number | null;
}): SuccessSummary {
  const { success, offer } = input;
  const at = (ms: number | null) => (ms === null ? null : dayAndMonth(new Date(ms).toISOString()));
  if (success.trial) {
    const days = offer?.trialDays ?? STORE_TRIAL_DAYS;
    const rows: { key: string; value: string }[] = [{ key: SUCCESS_ROW_PLAN, value: success.name }];
    const ends = at(input.endsAt);
    if (ends !== null) rows.push({ key: SUCCESS_ROW_TRIAL_ENDS, value: ends });
    const reminder = input.reminderScheduled ? at(input.reminderAt) : null;
    if (reminder !== null) rows.push({ key: SUCCESS_ROW_REMINDER, value: reminder });
    if (offer !== null) rows.push({ key: SUCCESS_ROW_THEN, value: billedPrice(offer.price, offer.period) });
    return { body: successTrialBody(success.name, success.minutes, days), rows };
  }
  const rows = [{ key: SUCCESS_ROW_PLAN, value: success.name }];
  if (success.until !== undefined) return { body: successHeldBody(success.name, success.minutes, success.until), rows };
  const days = input.plan === null ? ALLOWANCE_WINDOW_DAYS : windowDays(input.catalogue, input.plan, 'month');
  return { body: successPaidBody(success.name, success.minutes, days), rows: [...rows, { key: SUCCESS_ROW_TIME, value: `${success.minutes} min` }] };
}

/** Whether a confirmed grant is a trial this wall should schedule the reminder for. */
export function shouldScheduleTrialReminder(success: WallSuccess | null, grant: BillingStatus | null): boolean {
  return success?.trial === true && grant !== null;
}
