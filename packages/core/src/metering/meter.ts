/**
 * Usage metering and cost modelling.
 *
 * This exists in v1 not because we are charging yet, but because we cannot
 * retrofit it. Entitlement checks touch session start, session end, the paywall,
 * and every analytics question worth asking; bolting them on later means
 * rewriting all four.
 *
 * The numbers below come from the plan's unit-economic model. At premium voice
 * quality a conversation minute costs roughly $0.04–0.06, which means a learner
 * talking twenty minutes a day costs about $30/month to serve. Issen sells
 * "unlimited" at $29. That is the trap this module exists to keep us out of.
 *
 * The business works the way a gym works: on unused allowance. Sell 180 minutes,
 * expect 40–60% utilisation, and the margin lives in the gap. That is fine and
 * normal — but only if the allowance is finite and measured from day one.
 */

export type Plan = 'trial' | 'starter' | 'regular';

export interface PlanSpec {
  id: Plan;
  label: string;
  /** Total seconds granted per period. */
  secondsPerPeriod: number;
  /** null for the one-off trial — it does not renew. */
  periodDays: number | null;
  priceUsd: number;
}

/**
 * Free tier is a *finite trial*, not a daily allowance.
 *
 * A 10-minute daily free tier costs roughly $15/month per freeloader at premium
 * voice — more than the paid plan earns. Thirty minutes once is enough to feel
 * the product work and cannot be farmed.
 */
export const PLANS: Record<Plan, PlanSpec> = {
  trial: { id: 'trial', label: 'Trial', secondsPerPeriod: 30 * 60, periodDays: null, priceUsd: 0 },
  starter: { id: 'starter', label: 'Starter', secondsPerPeriod: 180 * 60, periodDays: 30, priceUsd: 19 },
  regular: { id: 'regular', label: 'Regular', secondsPerPeriod: 450 * 60, periodDays: 30, priceUsd: 39 },
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

export interface Entitlement {
  plan: Plan;
  secondsUsed: number;
  /** When the current period ends. Undefined for the non-renewing trial. */
  periodEnd?: Date;
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
  sttPerMin: 0.0043, //  Deepgram streaming
  // The Claude talker at sticker prices: ~2 structured turns/min, each ~650
  // output tokens at $15/MTok with the prompt prefix served from cache, plus
  // the per-session background calls (scene design, extraction, drill
  // authoring) amortised over a typical session. The old $0.01 figure priced
  // a free-tier brain; this line now rivals the voice line, and the margin
  // tests below were re-baselined to that reality.
  llmPerMin: 0.025,
  ttsPerMin: 0.045, //   premium French voice (~$50–60 per 1M chars at ~750 chars/min)
  assessmentPerUtterance: 0.002,
  // Beginners speak far less than the tutor does — at the Echo rung the tutor
  // says every line first and the learner only repeats it. Modelling this at the
  // 40% typical of a symmetric voice agent would understate our largest cost line.
  tutorSpeakingShare: 0.5,
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

export type StartRefusal = 'exhausted' | 'insufficient-for-session';

export type StartDecision =
  | { allowed: true; secondsRemaining: number }
  | { allowed: false; reason: StartRefusal; secondsRemaining: number; message: string };

/** Can this learner start a session right now? */
export function canStartSession(e: Entitlement, minSessionSec: number = MIN_VIABLE_SESSION_SEC): StartDecision {
  const remaining = secondsRemaining(e);

  if (remaining <= 0) {
    return {
      allowed: false,
      reason: 'exhausted',
      secondsRemaining: 0,
      message: e.plan === 'trial' ? 'Your free trial is finished.' : 'You have used all your minutes this month.',
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

/** Record a completed session. Never allows usage to exceed the allowance. */
export function recordUsage(e: Entitlement, seconds: number): Entitlement {
  if (seconds < 0) throw new RangeError('seconds must not be negative');
  const cap = PLANS[e.plan].secondsPerPeriod;
  return { ...e, secondsUsed: Math.min(cap, e.secondsUsed + seconds) };
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
 * Where a paid plan lands when its period ends and nothing renewed it.
 *
 * An *exhausted* trial, not a fresh one. The thirty free minutes are a one-time
 * grant, and letting them back in through the lapse door would make cancelling
 * a way to farm them. A learner here has not done anything wrong; they simply
 * have no minutes, and the paywall is how they get more.
 */
export function lapsedEntitlement(): Entitlement {
  return { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod };
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
 * So there are exactly three outcomes: the trial is untouched, a paid period
 * still inside its dates or its slack is untouched, and a paid period past both
 * lapses. A paid row with no period end at all is malformed rather than expired,
 * and is left alone - taking someone's plan away over a missing timestamp is the
 * opposite mistake, and just as expensive.
 */
export function rollPeriod(e: Entitlement, now: Date): Entitlement {
  const spec = PLANS[e.plan];
  if (spec.periodDays === null) return e;
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
 * it is, and it therefore divides as well as subtracts: at 15% it costs starter
 * about ten points of margin, and at 30% it costs regular about twenty-nine.
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
  // Assume roughly one scored utterance per 20 seconds of session.
  const utterances = (n: number) => n / 20;

  const worst = estimateSessionCost({ wallClockSec: spec.secondsPerPeriod, utterancesScored: utterances(spec.secondsPerPeriod) }, model);
  const usedSec = spec.secondsPerPeriod * utilisation;
  const expected = estimateSessionCost({ wallClockSec: usedSec, utterancesScored: utterances(usedSec) }, model);

  const storeFeeUsd = spec.priceUsd * storeFeeRate;
  const netRevenueUsd = spec.priceUsd - storeFeeUsd;

  return {
    plan,
    priceUsd: spec.priceUsd,
    storeFeeRate,
    storeFeeUsd,
    netRevenueUsd,
    worstCaseCostUsd: worst.total,
    expectedCostUsd: expected.total,
    worstCaseMargin: netRevenueUsd === 0 ? 0 : (netRevenueUsd - worst.total) / netRevenueUsd,
    expectedMargin: netRevenueUsd === 0 ? 0 : (netRevenueUsd - expected.total) / netRevenueUsd,
  };
}
