/**
 * The renewal sweep: a paid period that has ended is re-read from the vendor
 * before anybody is told it is over (F733, founder decision D16, 2026-10-05).
 *
 * A yearly product is granted one 30-day allowance window at a time inside its
 * paid year, so the next window has to be granted when the last one ends.
 * Nothing the store sends arrives then: RevenueCat fires a webhook when the
 * year renews, not when a month inside it does. A lazy read cannot grant it
 * either, because a read that renews is the free month for every cancelled
 * subscriber that F245 took out. So the maintenance worker asks. Every few
 * minutes it reads the paid rows whose period or window has ended, re-reads
 * each subscriber from RevenueCat, and lets `renewSubscriber` project only what
 * the vendor verifies, through the same ticketed projection a webhook uses. A
 * monthly renewal whose webhook went missing is recovered the same way.
 *
 * A sweep that is late, down, or configured differently from the API costs a
 * yearly learner minutes until it catches up or they restore, and never the
 * plan: the paid year is the period on record, and only it lapses (F733 review).
 *
 * The sweep runs beside room-stop reconciliation and never holds it up: `tick`
 * starts a sweep and returns, and a slow vendor delays only the next sweep.
 */

import { LAPSE_GRACE_SEC } from '@luvani/core';

import type { RenewalOutcome } from './revenuecat.ts';

export interface DueRenewal {
  userId: string;
  /**
   * The end on record that has passed: a monthly period, a trial, or a yearly
   * product's allowance window (whose paid year is still running).
   */
  periodEnd: Date;
}

export interface RenewalSweepDependencies {
  due(limit: number): Promise<readonly DueRenewal[]>;
  renew(row: DueRenewal): Promise<RenewalOutcome>;
  logger?: Pick<Console, 'error' | 'log'>;
}

export interface RenewalSweepOptions {
  /** How often a sweep starts. */
  everyMs: number;
  /** Rows read per sweep. The SQL caps this at 100. */
  read: number;
  /** Vendor reads per sweep, so one sweep is a bounded number of outbound calls. */
  batch: number;
  /** How long a row that is still waiting on the store is left before it is asked about again. */
  quietMs: number;
}

export const RENEWAL_SWEEP: RenewalSweepOptions = { everyMs: 5 * 60_000, read: 100, batch: 10, quietMs: 30 * 60_000 };

export interface RenewalSweep {
  /** Start a sweep when one is due and none is running; the promise is for tests and shutdown, never awaited by the loop. */
  tick(now?: number): Promise<void> | null;
}

/** How long a row may stay due before the sweep calls it stuck: the same day a lazy read would wait. */
const STUCK_MS = LAPSE_GRACE_SEC * 1000;

export function renewalSweep(deps: RenewalSweepDependencies, options: RenewalSweepOptions = RENEWAL_SWEEP): RenewalSweep {
  const logger = deps.logger ?? console;
  const quiet = new Map<string, number>();
  /** When each row on the due page was last asked about, so the batch goes to whoever has waited longest. */
  const lastAsked = new Map<string, number>();
  let nextAt = 0;
  let running: Promise<void> | null = null;

  async function sweep(now: number): Promise<void> {
    for (const [userId, until] of quiet) if (until <= now) quiet.delete(userId);
    const due = await deps.due(options.read);
    const onPage = new Set(due.map(row => row.userId));
    for (const userId of lastAsked.keys()) if (!onPage.has(userId)) lastAsked.delete(userId);
    const counts = { due: due.length, renewed: 0, lapsed: 0, waiting: 0, failed: 0, quiet: 0 };
    // Never asked first, in the page's own order (newest end first); then the
    // row asked longest ago. Ordering by the page alone let rows coming out of
    // their quiet be asked again ahead of rows never asked, so a page holding
    // sixty rows stuck on the store never reached the rest (F733 second review).
    const order = due.map((row, index) => ({ row, index, asked: lastAsked.get(row.userId) ?? -Infinity }))
      .sort((a, b) => a.asked - b.asked || a.index - b.index);
    let asked = 0;
    for (const { row } of order) {
      if (asked >= options.batch) break;
      if ((quiet.get(row.userId) ?? 0) > now) { counts.quiet += 1; continue; }
      asked += 1;
      lastAsked.set(row.userId, now);
      try {
        const outcome = await deps.renew(row);
        if (outcome === 'waiting') {
          quiet.set(row.userId, now + options.quietMs);
          counts.waiting += 1;
        } else {
          quiet.delete(row.userId);
          counts[outcome] += 1;
        }
      } catch {
        // Nothing moved: the projection is one transaction. Ask again later.
        quiet.set(row.userId, now + options.quietMs);
        counts.failed += 1;
      }
    }
    logger.log(JSON.stringify({ event: 'billing_renewals', ...counts }));
    // A full page means rows beyond it were not even read this time. At ten
    // vendor reads a sweep that is a launch-scale bound, not a forever one, so
    // it is said on the error stream where an alert can find it.
    if (due.length >= options.read) logger.error(JSON.stringify({ event: 'billing_renewals_backlog', due: due.length, read: options.read }));
    // A row still due a day after its end was not renewed, lapsed or refilled
    // by anything: a product nobody configured, a grace period, a store that
    // keeps answering with something this server will not act on. Counted
    // from the row's own end, so a restart does not forget it, and said on the
    // error stream where an alert can find it.
    const stuck = due.filter(row => now - row.periodEnd.getTime() > STUCK_MS);
    if (stuck.length > 0) {
      const oldestHours = Math.floor(Math.max(...stuck.map(row => now - row.periodEnd.getTime())) / 3_600_000);
      logger.error(JSON.stringify({ event: 'billing_renewals_stuck', stuck: stuck.length, oldestHours }));
    }
  }

  return {
    tick(now = Date.now()) {
      if (running !== null || now < nextAt) return null;
      nextAt = now + options.everyMs;
      const started = sweep(now)
        .catch(() => { logger.error(JSON.stringify({ event: 'billing_renewals_failure' })); })
        .finally(() => { running = null; });
      running = started;
      return started;
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The due rows, read through the service-only SQL function.
 *
 * Validated rather than trusted: a body that is not exactly the list the
 * function builds reads as an error, and the sweep asks nobody about it.
 */
export function supabaseRenewalsDue(baseUrl: string, serviceRoleKey: string, request: typeof fetch = fetch) {
  return async (limit: number): Promise<readonly DueRenewal[]> => {
    const response = await request(`${baseUrl.replace(/\/+$/, '')}/rest/v1/rpc/billing_renewals_due_v1`, {
      method: 'POST',
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({ p_limit: limit }),
    });
    if (!response.ok) throw new Error(`billing renewals read failed (${response.status})`);
    const body: unknown = await response.json();
    const rows = typeof body === 'object' && body !== null ? (body as { renewals?: unknown }).renewals : undefined;
    if (!Array.isArray(rows) || rows.length > Math.max(0, limit)) throw new Error('billing renewals read returned an invalid list');
    return rows.map((row: unknown): DueRenewal => {
      const { userId, periodEnd } = (typeof row === 'object' && row !== null ? row : {}) as Record<string, unknown>;
      const end = typeof periodEnd === 'string' ? new Date(periodEnd) : null;
      if (typeof userId !== 'string' || !UUID.test(userId) || end === null || !Number.isFinite(end.getTime())) {
        throw new Error('billing renewals read returned an invalid row');
      }
      return { userId, periodEnd: end };
    });
  };
}
