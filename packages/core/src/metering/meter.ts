/**
 * Usage metering and cost modelling.
 *
 * This exists in v1 not because we are charging yet, but because we cannot
 * retrofit it. Entitlement checks touch session start, session end, the paywall,
 * and every analytics question worth asking; bolting them on later means
 * rewriting all four.
 *
 * The numbers below come from measured vendor rates (2026-10-23, VOICE-008,
 * docs/cogs-evidence/rates.md). An uncached mission minute costs $0.04825,
 * which means a learner talking thirty minutes a day costs about $43.43/month
 * (900 minutes) to serve. Issen sells "unlimited" at $29. That is the trap this module exists to
 * keep us out of.
 *
 * The business works the way a gym works: on unused allowance. Sell 180 minutes,
 * expect 40-60% utilisation, and the margin lives in the gap. That is fine and
 * normal — but only if the allowance is finite and measured from day one.
 */

export type Plan = 'trial' | 'starter' | 'regular';

export interface PlanSpec {
  id: Plan;
  label: string;
  /** Total seconds granted per period. */
  secondsPerPeriod: number;
  /**
   * Days in one allowance period, for display only on the free plan: its real
   * rule is TASTE_REFILL_HOURS (44 h) after the first debit of a window
   * (REV-001), which `recordUsage` and `refillTaste` apply. A paid plan renews
   * when a verified receipt says so. null is kept in the type for a non-renewing grant;
   * no plan uses it, and nothing keys on it to recognise the free plan.
   */
  periodDays: number | null;
  priceUsd: number;
}

/**
 * The free plan is one free conversation every other day (REV-001, 2026-10-23,
 * superseding D24's five minutes a week).
 *
 * 600 seconds, one full mission (missions run 9-11 minutes), on a rolling
 * window that starts at the first debit and refills TASTE_REFILL_HOURS (44 h)
 * after it: 44 rather than 48 so a learner who comes back at the same time
 * every other day is not blocked by a few minutes of drift. Fully burned in
 * every window that is $0.4825 a window and at most 30 days / 44 h = 16.36
 * windows, $7.90 a month, at DEFAULT_COST_MODEL (2026-10-23 rates). The id
 * stays `trial` because it is a database value; the learner reads "Free".
 *
 * It still cannot be farmed: the allowance is claimed once per device (the
 * server's device claim), and only a claimed entitlement refills. A fresh
 * install on a claimed device gets nothing new; the claimed allowance simply
 * refills.
 */
/**
 * The first paid tier is stored as `starter` and shown as "Core" (2026-10-20),
 * the second is stored as `regular` and shown as "Max".
 *
 * The id is a value in a database check constraint and in four migrations'
 * allowance tables; the label is a word on a screen. Renaming the id to match
 * the label would buy nothing and cost a constraint migration on the payment
 * path, so the two are allowed to differ and this is the note that says so.
 * `label` is the only thing a learner ever reads.
 *
 * Prices and allowances are REV-001 (2026-10-23, superseding D16's $19/$29):
 * Core $14.99 for 300 minutes ("about 10 minutes a day"), Max $24.99 for 600
 * ("up to 20 minutes a day", never "unlimited").
 *
 * Both have a NEGATIVE full-utilisation margin, accepted by the founder on the
 * gym model: at $0.04825 a minute Core's 300 minutes cost $14.48 against
 * $12.74 received at the 15% store rate (-13.6%; -37.9% at 30%), and Max's
 * 600 cost $28.95 against $21.24 (-36.3%; -65.5% at 30%). At 40% utilisation
 * they leave 54.6% and 45.5% at 15%. meter.test.ts pins all of these as bands.
 */
export const PLANS: Record<Plan, PlanSpec> = {
  trial: { id: 'trial', label: 'Free', secondsPerPeriod: 600, periodDays: 2, priceUsd: 0 },
  starter: { id: 'starter', label: 'Core', secondsPerPeriod: 300 * 60, periodDays: 30, priceUsd: 14.99 },
  regular: { id: 'regular', label: 'Max', secondsPerPeriod: 600 * 60, periodDays: 30, priceUsd: 24.99 },
};

/**
 * What the app stores take off the top of every sale.
 *
 * Nothing reaches us at the sticker price. Apple and Google both run a reduced
 * rate for small developers and a standard one, and which of the two we pay is a
 * paperwork question, not a pricing one - which is why enrolling in the Small
 * Business programme sits on the founder's checklist as a requirement rather
 * than a nicety. The margin floors in meter.test.ts are pinned at the reduced
 * rate and name the standard-rate figure when they fail, so the day the
 * paperwork lapses the number that changes is visible rather than inferred.
 */
export const STORE_FEE_RATES = {
  /** Apple Small Business / Google's first-million rate. Enrolment required. */
  smallBusiness: 0.15,
  /** What we pay unenrolled, and what we pay once we outgrow the programme. */
  standard: 0.3,
} as const;

/** A tier the store sells. The free trial is granted, never bought. */
export type PaidTier = Exclude<Plan, 'trial'>;

/**
 * How the store bills a paid tier (founder decision D16, 2026-10-05).
 *
 * The tier decides the allowance and the period decides how the store sells
 * it. A yearly product is the same monthly allowance refilled window by window
 * inside the paid year: never a whole year of minutes at once, which is a year
 * of exposure on day one, and never one month's minutes stretched over twelve,
 * which is a learner paying for twelve and getting one.
 */
export type BillingPeriod = 'week' | 'month' | 'year';

/** Starter Weekly: one verified paid seven-day window, no rollover. */
export const WEEKLY_STARTER_SECONDS = 45 * 60;

/**
 * Days in one allowance window.
 *
 * A monthly product's store period is a single window, whatever its calendar
 * length. A yearly product is cut into windows of this length from the start of
 * its paid year; see `allowanceWindowEnd`.
 */
export const ALLOWANCE_WINDOW_DAYS = 30;

/** The App Store introductory free trial, in days (D16). */
export const STORE_TRIAL_DAYS = 7;

/**
 * What a store free trial grants: a week of the chosen plan's monthly
 * allowance, allowance x 7/30. Core 70 minutes, Max 140.
 *
 * Computed and enforced on the server, at the projection that writes the
 * entitlement. Without it an introductory offer would hand a learner the full
 * 300 or 600 minutes before anything was paid, which is the freeloader cost the
 * free tier above is sized to avoid. A store configured with a longer trial
 * still grants this week, so the cost of a trial is bounded here and not in a
 * console setting. Full burn costs about $3.38 on Core and $6.76 on Max at
 * DEFAULT_COST_MODEL; meter.test.ts holds the ceiling.
 */
export function storeTrialSeconds(plan: PaidTier): number {
  return Math.floor((PLANS[plan].secondsPerPeriod * STORE_TRIAL_DAYS) / ALLOWANCE_WINDOW_DAYS);
}

export interface YearlySpec {
  plan: PaidTier;
  /**
   * The sticker price of the yearly product, for margin modelling only. The
   * price a learner sees is the store's localised string, never this number.
   */
  priceUsd: number;
}

/**
 * The yearly products (REV-001, superseding D16's $149/$229): Core $99 a
 * year, Max $169 a year.
 *
 * Each grants the tier's monthly allowance once per allowance window, twelve
 * windows in a paid year. The founder accepted that both lose money on a
 * learner who uses every minute of every window; meter.test.ts pins the
 * expected margin at 40% utilisation, so the day a vendor price moves that
 * number is visible rather than inferred.
 */
export const YEARLY_PLANS: Record<PaidTier, YearlySpec> = {
  starter: { plan: 'starter', priceUsd: 99 },
  regular: { plan: 'regular', priceUsd: 169 },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = ALLOWANCE_WINDOW_DAYS * DAY_MS;

/**
 * How many allowance windows a paid period holds.
 *
 * Whole windows only, with the remainder folded into the last one, so a
 * 365-day year holds exactly twelve monthly allowances rather than twelve and a
 * five-day thirteenth. A period shorter than two windows (a month, a trial, a
 * sandbox year measured in minutes) is one window. Zero for a malformed period.
 */
export function allowanceWindowCount(start: Date, end: Date): number {
  const s = start.getTime();
  const e = end.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return Math.max(1, Math.floor((e - s) / WINDOW_MS));
}

/**
 * The end of the allowance window that holds `now`, inside a paid period that
 * runs from `start` to `end`.
 *
 * Windows run ALLOWANCE_WINDOW_DAYS from the start of the period and the last
 * runs to the period's own end. A `now` a little before the start, a server
 * clock behind the store's, reads as the first window rather than as no window.
 * Null when the period is malformed or `now` is at or past its end: there is no
 * window left to grant into, and that is the store's lapse, not ours.
 */
export function allowanceWindowEnd(start: Date, end: Date, now: Date): Date | null {
  const windows = allowanceWindowCount(start, end);
  const n = now.getTime();
  if (windows === 0 || !Number.isFinite(n) || n >= end.getTime()) return null;
  const index = Math.min(windows - 1, Math.max(0, Math.floor((n - start.getTime()) / WINDOW_MS)));
  return index === windows - 1 ? new Date(end.getTime()) : new Date(start.getTime() + (index + 1) * WINDOW_MS);
}

export interface Entitlement {
  plan: Plan;
  /**
   * Seconds spent in the current period, plus any part of the plan's allowance
   * the current window does not grant: a store trial records the rest of the
   * month as spent (F733). Remaining time is always allowance minus this.
   */
  secondsUsed: number;
  /**
   * When the paid period the store holds ends: a month, a store trial, or a
   * whole paid year. Undefined for the non-renewing trial. This is the instant
   * a plan lapses from, after LAPSE_GRACE_SEC, so it is never an allowance
   * window inside a year: a yearly learner whose window ended and was not yet
   * refilled still holds the year they paid for (F733 review, 2026-10-05).
   */
  periodEnd?: Date;
  /**
   * When the current allowance window ends, set only when that is before
   * `periodEnd`: a yearly product's 30-day window (`allowanceWindowEnd`).
   * Absent means the window is the whole period. Minutes are refilled when a
   * verified vendor read grants the next window; a read never refills them.
   */
  windowEnd?: Date;
  /**
   * When the store says the paid period on record began (its purchase date),
   * when known. Store answers are ordered by this before their end: an upgrade
   * Apple applies at once can end long before the plan it replaced, and is
   * still the newer answer (F733 second review, 2026-10-06).
   */
  periodStart?: Date;
  /**
   * How much of `secondsUsed` is the part of the allowance the current window
   * withholds rather than time spent (a store trial's ungranted weeks). Absent
   * means none. Kept so a fuller answer for the same window can give it back.
   */
  withheldSeconds?: number;
  /** The free plan here represents a former paid period, not a first claim. */
  lapsed?: boolean;
  /**
   * This free entitlement passed the device claim (or fell back from a paid
   * plan) and so refills (REV-001). Without it a trial row never refills,
   * which keeps an unclaimed install from minting a fresh allowance. This is
   * the refilling free allowance; named in D24, the column is weekly_taste,
   * and it no longer refills weekly. Here `periodEnd` means "refills at":
   * absent until the first debit, then that debit plus TASTE_REFILL_HOURS.
   * See `refillTaste`.
   */
  weeklyTaste?: boolean;
}

/**
 * The free allowance refills this many hours after the first debit of its
 * window (REV-001): "one free conversation every other day", 44 h not 48 so a
 * same-time-every-other-day learner is not blocked by drift.
 */
export const TASTE_REFILL_HOURS = 44;

const HOUR_MS = 60 * 60 * 1000;

const toMs = (t: Date | number): number => (typeof t === 'number' ? t : t.getTime());

/**
 * Refill a free allowance whose window has passed. Pure, and the only path by
 * which the free plan gets minutes back.
 *
 * Returns `e` unchanged unless it is a trial, marked weeklyTaste, with a
 * periodEnd at or before `now`. Then the window is over: secondsUsed returns to
 * 0 and periodEnd is cleared, so the next window starts at the next debit, not
 * now (a rolling window from first use). A clock that runs backwards refills
 * nothing. Paid plans never pass through here; their renewal is a receipt.
 */
export function refillTaste(e: Entitlement, now: Date | number): Entitlement {
  if (e.plan !== 'trial' || e.weeklyTaste !== true || !e.periodEnd) return e;
  const n = toMs(now);
  if (!Number.isFinite(n) || n < e.periodEnd.getTime()) return e;
  const { periodEnd: _ended, ...rest } = e;
  return { ...rest, secondsUsed: 0 };
}

/** Per-minute vendor costs, in USD. Overridable so pricing experiments are cheap. */
export interface CostModel {
  sttPerMin: number;
  llmPerMin: number;
  /** Charged only for the share of the session the tutor is actually speaking. */
  ttsPerMin: number;
  /** Pronunciation assessment, charged per scored utterance. */
  assessmentPerUtterance: number;
  /** Fraction of wall-clock the tutor speaks. The rest is the learner or silence. */
  tutorSpeakingShare: number;
}

export const DEFAULT_COST_MODEL: CostModel = {
  // Corrected to measured vendor rates 2026-10-23 (DECISIONS.md VOICE-008,
  // founder approved; evidence in docs/cogs-evidence/rates.md). Priced as an
  // uncached mission minute, the worst case: lessons are authored and cached.
  // Deepgram Nova-3 Monolingual streaming at its regular $0.0077/min (the
  // $0.0048 shown is an open-ended promo) plus Keyterm Prompting at about
  // $0.0013/min (third-party figure, unverified). Was 0.0043, a batch-era rate.
  sttPerMin: 0.009,
  // 2026-10-23, rates.md and session-llm-*.json: live turns on gpt-6-luna at
  // $0.00034 a turn x ~4 turns/min = $0.0014/min, plus post-session curate,
  // extract and drills ($0.0213 a session) over a 5-minute session =
  // $0.0043/min. $0.0057, rounded up. Was 0.025, which priced a Claude talker.
  llmPerMin: 0.006,
  // 2026-10-23, rates.md: eleven_multilingual_v2 list $0.08 per 1k chars at a
  // measured 17.0 chars/s (1,020 chars a minute of tutor speech) = $0.0816 on
  // a 1x voice; emilie and sarah bill 2x, so the roster mean is 1.333x. Was 0.045.
  ttsPerMin: 0.109,
  assessmentPerUtterance: 0.002,
  // 2026-10-23, rates.md: a measured mission turn speaks ~56 chars at ~4 turns
  // a minute = 13 s of tutor speech a minute (0.22), plus an allowance for
  // openers, narration and rescues. Was 0.5, the lesson Echo-rung assumption;
  // lessons now replay authored lines from cache (VOICE-002).
  tutorSpeakingShare: 0.25,
};

/**
 * Shortest session worth starting.
 *
 * Starting a five-minute lesson with forty seconds left produces a session that
 * dies mid-sentence, which is a worse experience than being told up front. We
 * refuse rather than deliver a broken one.
 */
export const MIN_VIABLE_SESSION_SEC = 120;

export function secondsRemaining(e: Entitlement): number {
  return Math.max(0, PLANS[e.plan].secondsPerPeriod - e.secondsUsed);
}

export type StartRefusal = 'exhausted' | 'insufficient-for-session' | 'subscription-lapsed';

export type StartDecision =
  | { allowed: true; secondsRemaining: number }
  | {
      allowed: false;
      reason: StartRefusal;
      secondsRemaining: number;
      /**
       * A server-built fallback. Its weekday and time are in the server's
       * clock zone, which is not the learner's: the app should format
       * `refillsAt` on the device and use this only when it cannot.
       */
      message: string;
      /** When a spent free allowance comes back, if its window has started. */
      refillsAt?: Date;
    };

/**
 * Can this learner start a session right now?
 *
 * A lapsed learner holds the free allowance like any free learner and may spend it;
 * 'subscription-lapsed' is the answer only once that taste is spent too. Pass
 * the entitlement after `refillTaste`, or a passed window reads as spent.
 */
export function canStartSession(e: Entitlement, minSessionSec: number = MIN_VIABLE_SESSION_SEC): StartDecision {
  const remaining = secondsRemaining(e);

  if (remaining <= 0) {
    const refillsAt = e.plan === 'trial' && e.periodEnd ? new Date(e.periodEnd.getTime()) : undefined;
    const used = refillsAt ? `Your next free conversation is ready ${refillWhen(refillsAt)}.` : 'Your free conversation is used.';
    return {
      allowed: false,
      reason: e.lapsed === true ? 'subscription-lapsed' : 'exhausted',
      secondsRemaining: 0,
      message:
        e.lapsed === true
          ? `Your subscription has ended.${refillsAt ? ` ${used}` : ''}`
          : e.plan === 'trial'
            ? used
            : 'You have used all your minutes for now.',
      ...(refillsAt ? { refillsAt } : {}),
    };
  }

  if (remaining < minSessionSec) {
    return {
      allowed: false,
      reason: 'insufficient-for-session',
      secondsRemaining: remaining,
      message: `Only ${Math.floor(remaining / 60)} min ${remaining % 60}s left. Not quite enough for a full session.`,
    };
  }

  return { allowed: true, secondsRemaining: remaining };
}

/**
 * "on Thursday at 4:10 pm": when a refill lands. Formatted in the clock zone
 * of whoever runs this, so on the server it is a fallback only (see
 * StartDecision.refillsAt).
 */
export function refillWhen(d: Date, timeZone?: string): string {
  const day = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone });
  const time = d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
    .replace(/\u202f|\s/g, ' ')
    .replace('AM', 'am')
    .replace('PM', 'pm');
  return `on ${day} at ${time}`;
}

/**
 * Record a completed session. Never allows usage to exceed the allowance.
 *
 * The first debit of a free allowance starts its window: periodEnd becomes
 * `now` + TASTE_REFILL_HOURS. Zero seconds is not a debit and starts nothing.
 * Every other entitlement keeps its periodEnd untouched. `now` defaults to the
 * wall clock; pass it wherever the caller already holds one.
 */
export function recordUsage(e: Entitlement, seconds: number, now: Date | number = Date.now()): Entitlement {
  if (seconds < 0) throw new RangeError('seconds must not be negative');
  const cap = PLANS[e.plan].secondsPerPeriod;
  const next: Entitlement = { ...e, secondsUsed: Math.min(cap, e.secondsUsed + seconds) };
  if (e.plan === 'trial' && e.weeklyTaste === true && !e.periodEnd && seconds > 0) {
    next.periodEnd = new Date(toMs(now) + TASTE_REFILL_HOURS * HOUR_MS);
  }
  return next;
}

/**
 * How long a paid period stands after its end date before it lapses.
 *
 * A renewal receipt does not always arrive the instant the period ends: the
 * store's webhook is queued, our clock and theirs disagree by seconds, and a
 * retry can take minutes. Lapsing on the stroke of midnight would lock out
 * paying subscribers over plumbing. Twenty-four hours is the slack, and it is
 * the same twenty-four hours the database uses - if the two ever disagree, a
 * learner's balance depends on which of them read the row.
 */
export const LAPSE_GRACE_SEC = 24 * 60 * 60;

/**
 * Where a paid plan lands when its period ends and nothing renewed it (D24).
 *
 * A fresh free allowance, like any free learner's. Cancelling cannot farm it:
 * every free learner on a claimed device already gets the same conversation
 * every other day, so the lapse door opens onto nothing a learner did not already have.
 * The window starts at the first debit, so it carries no periodEnd. A learner
 * here has not done anything wrong; they are simply back on the free plan.
 */
export function lapsedEntitlement(): Entitlement {
  return { plan: 'trial', secondsUsed: 0, lapsed: true, weeklyTaste: true };
}

/**
 * Bring an entitlement up to date at read time. Nothing here ever grants minutes.
 *
 * This used to renew: any read of a paid row whose period had ended cleared the
 * counter and added thirty days, which is a free month, on every read, forever,
 * for every subscriber who cancelled. Renewal is something a verified receipt
 * does, through save(), on the server. The only thing a lazy read may do is take
 * an expired plan away.
 *
 * So there are exactly three outcomes: the free plan is untouched (its refill is
 * `refillTaste`, which only gives back a taste already claimed), a paid period
 * still inside its dates or its slack is untouched, and a paid period past both
 * lapses. A paid row with no period end at all is malformed rather than expired,
 * and is left alone - taking someone's plan away over a missing timestamp is the
 * opposite mistake, and just as expensive.
 *
 * Only the paid period counts here, never an allowance window inside it. A
 * yearly window that ended without a refill leaves the learner holding the
 * year, with the minutes the last window left them, until a vendor read grants
 * the next window: short of minutes for a while, never stripped of the plan.
 */
export function rollPeriod(e: Entitlement, now: Date): Entitlement {
  // A free entitlement's periodEnd is when its allowance refills, never a paid
  // period to lapse from; refillTaste owns it.
  if (e.plan === 'trial') return e;
  if (!e.periodEnd) return e;
  if (now.getTime() <= e.periodEnd.getTime() + LAPSE_GRACE_SEC * 1000) return e;
  return lapsedEntitlement();
}

export interface SessionUsage {
  wallClockSec: number;
  utterancesScored: number;
}

export interface SessionCost {
  stt: number;
  llm: number;
  tts: number;
  assessment: number;
  total: number;
}

/** What one session actually cost us to serve. */
export function estimateSessionCost(usage: SessionUsage, model: CostModel = DEFAULT_COST_MODEL): SessionCost {
  const minutes = usage.wallClockSec / 60;
  const stt = minutes * model.sttPerMin;
  const llm = minutes * model.llmPerMin;
  const tts = minutes * model.tutorSpeakingShare * model.ttsPerMin;
  const assessment = usage.utterancesScored * model.assessmentPerUtterance;
  return { stt, llm, tts, assessment, total: stt + llm + tts + assessment };
}

export interface Margin {
  plan: Plan;
  /** The sticker price. What the learner pays, not what we receive. */
  priceUsd: number;
  /** The store's share of the sticker price, as a fraction. 0 is a direct sale. */
  storeFeeRate: number;
  /** What the store keeps. */
  storeFeeUsd: number;
  /** What actually reaches us. Every margin below is measured against this. */
  netRevenueUsd: number;
  /** Cost if the learner burns every granted minute. */
  worstCaseCostUsd: number;
  /** Cost at the given utilisation. */
  expectedCostUsd: number;
  worstCaseMargin: number;
  expectedMargin: number;
}

/**
 * Gross margin for a plan at a given utilisation, after the store's cut.
 *
 * Worth running whenever pricing, the voice vendor, or the store rate changes.
 * If worstCaseMargin goes negative, the plan is a liability on its heaviest
 * users — which is exactly the position Issen's unlimited tier occupies.
 *
 * `storeFeeRate` defaults to 0, which means a direct sale with no store in the
 * path. Nothing ships that way: pass a rate from STORE_FEE_RATES for any
 * decision about a real price, or the number you get back is the one the store
 * has not taken its share of yet.
 *
 * The fee is taken off revenue rather than added to cost, because that is what
 * it is, and it therefore divides as well as subtracts: at full use a 15% fee
 * takes Core from 3.4% to -13.6%, and 30% takes Max from -15.8% to -65.5%.
 *
 * Currency: a margin is a ratio, so this holds in any single currency provided
 * the price and the cost model are quoted in the same one. Both are USD today.
 */
export function planMargin(
  plan: Plan,
  utilisation = 0.5,
  model: CostModel = DEFAULT_COST_MODEL,
  storeFeeRate = 0,
): Margin {
  const spec = PLANS[plan];
  return marginOn(plan, spec.priceUsd, spec.secondsPerPeriod, utilisation, model, storeFeeRate);
}

/**
 * Margin on a yearly product: every allowance window of a 365-day paid year
 * against the one yearly price, after the store's cut.
 *
 * The same arithmetic as `planMargin`, with the year's windows as the
 * allowance. REV-001 (2026-10-23) prices the year for expected use, not the
 * heaviest learner: at $0.04825 a minute twelve full windows cost $173.70 on
 * Core against $84.15 received at the 15% rate (-106%) and $347.40 on Max
 * against $143.65 (-142%). At 40% utilisation Core leaves 17.4% and Max 3.3%
 * at 15%; at the 30% rate both go under (-0.3% and -17.5%), so Small Business
 * enrolment is load-bearing. meter.test.ts holds the expected floors.
 */
export function yearlyPlanMargin(
  plan: PaidTier,
  utilisation = 0.5,
  model: CostModel = DEFAULT_COST_MODEL,
  storeFeeRate = 0,
): Margin {
  const year = allowanceWindowCount(new Date(0), new Date(365 * DAY_MS));
  return marginOn(plan, YEARLY_PLANS[plan].priceUsd, PLANS[plan].secondsPerPeriod * year, utilisation, model, storeFeeRate);
}

/** Vendor cost of a store free trial used to its last second: what a trialist who never pays costs. */
export function storeTrialCostUsd(plan: PaidTier, model: CostModel = DEFAULT_COST_MODEL): number {
  const seconds = storeTrialSeconds(plan);
  return estimateSessionCost({ wallClockSec: seconds, utterancesScored: seconds / 20 }, model).total;
}

function marginOn(
  plan: Plan,
  priceUsd: number,
  allowanceSec: number,
  utilisation: number,
  model: CostModel,
  storeFeeRate: number,
): Margin {
  // Assume roughly one scored utterance per 20 seconds of session.
  const utterances = (n: number) => n / 20;

  const worst = estimateSessionCost({ wallClockSec: allowanceSec, utterancesScored: utterances(allowanceSec) }, model);
  const usedSec = allowanceSec * utilisation;
  const expected = estimateSessionCost({ wallClockSec: usedSec, utterancesScored: utterances(usedSec) }, model);

  const storeFeeUsd = priceUsd * storeFeeRate;
  const netRevenueUsd = priceUsd - storeFeeUsd;

  return {
    plan,
    priceUsd,
    storeFeeRate,
    storeFeeUsd,
    netRevenueUsd,
    worstCaseCostUsd: worst.total,
    expectedCostUsd: expected.total,
    worstCaseMargin: netRevenueUsd === 0 ? 0 : (netRevenueUsd - worst.total) / netRevenueUsd,
    expectedMargin: netRevenueUsd === 0 ? 0 : (netRevenueUsd - expected.total) / netRevenueUsd,
  };
}
