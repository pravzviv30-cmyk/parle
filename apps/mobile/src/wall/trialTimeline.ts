/**
 * The store free trial, as a timeline a learner can read before paying
 * (founder decision D16, come alive README Part 5.G).
 *
 * Drawn only for a real offer this account may take: a chosen product whose
 * store free trial the store says this account is still eligible for
 * (`WallPlanOffer.trialDays`, null otherwise). Any other answer draws nothing
 * and the page shows the plain price, which is what a learner is actually
 * offered.
 *
 * Every number is somebody else's: the days are the store's introductory
 * period, the minutes are the server's week of the plan (`storeTrialMinutes`,
 * absent with no catalogue, and then that line is not drawn rather than
 * guessed), and the price is the store's for the product's own period. A
 * trial is never described as a month (F742).
 *
 * The reminder line is a promise, so it is said only when it will be kept:
 * notifications allowed, the learner's trial reminder setting on, and a build
 * that schedules the reminder once the server has confirmed the trial
 * (`trialReminderPromised` in reminders/trialReminder.ts). Otherwise the
 * timeline says how to pay nothing, which is always true.
 *
 * Pure, so `trialTimeline.test.ts` can ask it questions; the page only draws it.
 */

import { PLANS } from '@luvani/core';

import {
  TRIAL_NOW,
  TRIAL_REMIND,
  startTrialLabel,
  trialBeforeDay,
  trialCancelBy,
  trialDay,
  trialMinutes,
  trialTerms,
  trialThen,
  trialTitle,
  trialToday,
} from './wallCopy.ts';
import type { WallChosen } from './wallPlans.ts';

export type TrialNodeKey = 'today' | 'during' | 'remind' | 'cancel' | 'then';

export interface TrialNode {
  key: TrialNodeKey;
  /** "Today" or "Day N", or null for the line about what the trial holds. */
  title: string | null;
  line: string;
}

export interface TrialTimelineView {
  /** The store's trial length, in whole days. */
  days: number;
  title: string;
  nodes: readonly TrialNode[];
  /** The pill's words while this offer is chosen. */
  cta: string;
  /** The trial's terms, at the button. */
  terms: string;
}

export function trialTimeline(input: {
  /** The chosen way to pay, or null when none is chosen. */
  offer: WallChosen | null;
  /** The server's minutes for the trial, or null when it has sent no catalogue. */
  minutes: number | null;
  /** A reminder will really be scheduled for two days before the trial ends. */
  remind: boolean;
}): TrialTimelineView | null {
  const { offer } = input;
  if (offer === null || offer.trialDays === null) return null;
  const days = offer.trialDays;
  const nodes: TrialNode[] = [{ key: 'today', title: TRIAL_NOW, line: trialToday(offer.name) }];
  if (input.minutes !== null) nodes.push({ key: 'during', title: null, line: trialMinutes(input.minutes) });
  // The day is worked out here and handed to the sentence, so no copy line
  // prints a number it was not given (wallCopy's digit rule).
  nodes.push(input.remind
    ? { key: 'remind', title: trialDay(days - 2), line: TRIAL_REMIND }
    : { key: 'cancel', title: trialBeforeDay(days), line: trialCancelBy(days) });
  nodes.push({ key: 'then', title: trialDay(days), line: trialThen(offer.name, offer.price, offer.period) });
  return {
    days,
    // The plan is named from the catalogue Luvani wrote (F932): "Your first week with Core".
    title: trialTitle(PLANS[offer.plan].label, days),
    nodes,
    cta: startTrialLabel(days),
    terms: trialTerms(days, offer.price, offer.period),
  };
}
