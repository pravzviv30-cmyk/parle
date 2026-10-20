/**
 * Entitlement storage.
 *
 * Production uses the Supabase implementation; in-memory and file variants are
 * explicit local fixtures behind the same async interface.
 *
 * What must NOT move to the client when that swap happens: the entitlement check
 * itself. Metered minutes enforced in the app are a suggestion; enforced at token
 * issuance they are a fact, because without a token there is no room to join.
 */

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { safeError } from '../../shared/safeError.ts';

import { applyBillingSnapshot, type BillingSnapshot, type BillingProjection } from './billing/state.ts';
import { PLANS, rollPeriod, refillTaste, recordUsage, secondsRemaining, readSessionSettlement, isServiceFailure, type Entitlement, type Plan, type ServiceFailure, type SessionSettlement } from '@luvani/core';

export class SessionReconciliationRequired extends Error {
  constructor() { super('Session settlement needs reconciliation'); }
}

export interface EntitlementStore {
  /** Claim the one-time trial boundary before a first entitlement is read. */
  claimTrial(userId: string, installationHash: string, userHash: string): Promise<boolean>;
  get(userId: string): Promise<Entitlement>;
  save(userId: string, entitlement: Entitlement): Promise<void>;
  /** Record consumed seconds after a session ends. A session id makes retries idempotent. */
  consume(userId: string, seconds: number, sessionId?: string): Promise<Entitlement>;
  recordSessionGrant(userId: string, sessionId: string, expected: Entitlement): Promise<boolean>;
  refundSession(userId: string, sessionId: string, failure: ServiceFailure): Promise<SessionSettlement>;
  /**
   * Claim a billing event id, answering whether this is the **first** sighting.
   *
   * The webhook is a doorbell rather than a source of state: it asks this before
   * it fetches anything from the vendor, so a redelivery costs one question to
   * our own database and no outbound request at all. Reading an ambiguous answer
   * as `true` is the client half of F73 and F74 — it would send a fresh
   * subscriber fetch on every retry of an event we have already acted on.
   */
  recordBillingEvent(userId: string, eventId: string): Promise<boolean>;
  billingEventComplete(eventId: string): Promise<boolean>;
  beginBillingRefresh(userId: string): Promise<number>;
  applyBilling(userId: string, ticket: number, snapshot: BillingSnapshot, eventId?: string): Promise<BillingProjection>;
}

/** Local fixtures only. Production uses one database transaction below. */
interface LocalSessionRecord { userId: string; epoch: string; charged?: number; refunded?: boolean; failure?: ServiceFailure }
/** A yearly window is its own usage period (F733), exactly as the database's usage epoch treats it. */
function periodKey(row: Entitlement): string {
  return `${row.periodEnd ? new Date(row.periodEnd).toISOString() : 'trial'}:${row.windowEnd ? new Date(row.windowEnd).toISOString() : ''}:${row.lapsed === true}`;
}

abstract class LocalBillingSupport {
  abstract get(userId: string): Promise<Entitlement>;
  abstract save(userId: string, entitlement: Entitlement): Promise<void>;
  protected sessionLedger = new Map<string, LocalSessionRecord>();
  protected usageEpochs = new Map<string, string>();
  private sessionWork: Promise<unknown> = Promise.resolve();
  protected serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.sessionWork.then(operation, operation);
    this.sessionWork = next.catch(() => {});
    return next;
  }
  protected noteEpoch(userId: string, before: Entitlement | undefined, after: Entitlement): void {
    // A weekly taste's first debit only stamps when its window ends (D24); that is
    // the same usage period, so a refund in it restores rather than reverses.
    const tasteOpened = before !== undefined && before.plan === 'trial' && after.plan === 'trial'
      && !before.periodEnd && after.periodEnd !== undefined
      && periodKey({ ...after, periodEnd: undefined }) === periodKey(before);
    if (tasteOpened && this.usageEpochs.has(userId)) return;
    if (!this.usageEpochs.has(userId) || !before || periodKey(before) !== periodKey(after)) this.usageEpochs.set(userId, randomUUID());
  }
  protected async persistSessionLedger(): Promise<void> {}
  protected async saveSession(userId: string, row: Entitlement): Promise<void> { await this.save(userId, row); }
  async recordSessionGrant(userId: string, sessionId: string, expected: Entitlement): Promise<boolean> {
    return this.serial(async () => {
      const current = await this.get(userId);
      if (current.plan !== expected.plan || current.secondsUsed !== expected.secondsUsed || periodKey(current) !== periodKey(expected)) return false;
      const old = this.sessionLedger.get(sessionId);
      if (old) {
        if (old.userId !== userId) throw new Error('session belongs to another account');
        return old.epoch === this.usageEpochs.get(userId);
      }
      this.sessionLedger.set(sessionId, { userId, epoch: this.usageEpochs.get(userId)! });
      try { await this.persistSessionLedger(); }
      catch (error) { this.sessionLedger.delete(sessionId); throw error; }
      return true;
    });
  }
  protected async consumeLocal(userId: string, seconds: number, sessionId?: string): Promise<Entitlement> {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('seconds must be a non-negative number');
    if (sessionId && (!Number.isInteger(seconds) || seconds > 900)) throw new RangeError('session seconds must be whole and at most 900');
    return this.serial(async () => {
      const current = await this.get(userId);
      const old = sessionId ? this.sessionLedger.get(sessionId) : undefined;
      if (sessionId && (!old || old.userId !== userId)) throw new Error('session grant owner is missing or belongs to another account');
      if (old?.charged !== undefined || old?.refunded) return current;
      const charged = old && old.epoch !== this.usageEpochs.get(userId) ? 0
        : Math.max(0, Math.min(PLANS[current.plan].secondsPerPeriod, current.secondsUsed + seconds) - current.secondsUsed);
      if (old && sessionId) this.sessionLedger.set(sessionId, { ...old, charged });
      const next = charged > 0 ? recordUsage(current, charged, Date.now()) : current;
      try { await this.saveSession(userId, next); }
      catch (error) { if (old && sessionId) this.sessionLedger.set(sessionId, old); throw error; }
      return next;
    });
  }
  async refundSession(userId: string, sessionId: string, failure: ServiceFailure): Promise<SessionSettlement> {
    return this.serial(async () => {
      const current = await this.get(userId);
      const old = this.sessionLedger.get(sessionId);
      if (!old || old.userId !== userId) throw new Error('session grant owner is missing or belongs to another account');
      const charged = old.charged ?? 0;
      const sameEpoch = old.epoch === this.usageEpochs.get(userId);
      const next = old.refunded || !sameEpoch ? current : { ...current, secondsUsed: Math.max(0, current.secondsUsed - charged) };
      this.sessionLedger.set(sessionId, { ...old, charged, refunded: true, failure: old.failure ?? failure });
      try { await this.saveSession(userId, next); }
      catch (error) { this.sessionLedger.set(sessionId, old); throw error; }
      return { kind: charged === 0 ? 'not-charged' : sameEpoch ? 'restored-current-period' : 'historical-reversal',
        refundedSeconds: charged, secondsRemaining: secondsRemaining(next), plan: next.plan };
    });
  }
  private readonly tickets = new Map<string, number>();
  private readonly applied = new Map<string, number>();
  private readonly completed = new Set<string>();
  async billingEventComplete(eventId: string): Promise<boolean> { return this.completed.has(eventId); }
  async beginBillingRefresh(userId: string): Promise<number> {
    const ticket = (this.tickets.get(userId) ?? 0) + 1;
    this.tickets.set(userId, ticket);
    return ticket;
  }
  async applyBilling(userId: string, ticket: number, snapshot: BillingSnapshot, eventId?: string): Promise<BillingProjection> {
    const current = await this.get(userId);
    if ((eventId && this.completed.has(eventId)) || ticket <= (this.applied.get(userId) ?? 0)) {
      if (eventId) this.completed.add(eventId);
      return { kind: 'unchanged', reason: 'superseded', entitlement: current };
    }
    const result = applyBillingSnapshot(current, snapshot);
    if (result.kind !== 'unchanged') await this.save(userId, result.entitlement);
    this.applied.set(userId, ticket);
    if (eventId) this.completed.add(eventId);
    return result;
  }
}

/**
 * Whether the deliberately non-metering local store may be used.
 *
 * The second condition is load-bearing. A copied development env file must not
 * be able to turn production metering off, even when it still contains the
 * opt-in flag.
 */
export function developmentEntitlementsEnabled(env: Record<string, string | undefined>): boolean {
  return env.LUVANI_DEV_UNLIMITED_MINUTES === '1' && env.NODE_ENV !== 'production';
}

/**
 * A local testing allowance that never runs down.
 *
 * It presents the existing Regular allowance rather than inventing an
 * "unlimited" production plan. Every read and debit returns a fresh allowance,
 * so repeated voice testing cannot strand the developer behind the paywall.
 * The server only selects this store through developmentEntitlementsEnabled.
 */
export class DevelopmentEntitlementStore extends LocalBillingSupport implements EntitlementStore {
  override async recordSessionGrant(_userId: string, _sessionId: string, _expected: Entitlement): Promise<boolean> { return true; }
  override async refundSession(userId: string, _sessionId: string, _failure: ServiceFailure): Promise<SessionSettlement> {
    const row = await this.get(userId);
    return { kind: 'not-charged', refundedSeconds: 0, secondsRemaining: secondsRemaining(row), plan: row.plan };
  }
  async claimTrial(_userId: string, _installationHash: string, _userHash: string): Promise<boolean> {
    return true;
  }

  async get(_userId: string): Promise<Entitlement> {
    return { plan: 'regular', secondsUsed: 0 };
  }

  /** Every delivery is a first sighting, so a replayed fixture still exercises the path. */
  async recordBillingEvent(_userId: string, _eventId: string): Promise<boolean> {
    return true;
  }

  async save(_userId: string, _entitlement: Entitlement): Promise<void> {}

  async consume(_userId: string, seconds: number, _sessionId?: string): Promise<Entitlement> {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new RangeError('seconds must be a non-negative number');
    }
    return { plan: 'regular', secondsUsed: 0 };
  }
}

export class InMemoryEntitlementStore extends LocalBillingSupport implements EntitlementStore {
  private readonly rows = new Map<string, Entitlement>();
  private readonly billingEvents = new Set<string>();
  // Written out longhand rather than as a constructor parameter property: Node runs
  // this file by stripping types, and parameter properties emit runtime code, so
  // they are rejected outright. Same reason in services/tutor-agent/src/agent.ts.
  private readonly defaultPlan: Plan;

  constructor(defaultPlan: Plan = 'trial') {
    super();
    this.defaultPlan = defaultPlan;
  }

  async claimTrial(_userId: string, _installationHash: string, _userHash: string): Promise<boolean> {
    return true;
  }

  async get(userId: string): Promise<Entitlement> {
    const existing = this.rows.get(userId);
    if (existing) {
      // Roll the period lazily on read rather than running a cron. A learner who
      // returns after their month ends gets their allowance back on arrival.
      const now = new Date();
      const rolled = refillTaste(rollPeriod(existing, now), now);
      if (rolled !== existing) await this.save(userId, rolled);
      return rolled;
    }

    // A claimed free row is a weekly taste (D24); its window opens at the first debit.
    const fresh: Entitlement = this.defaultPlan === 'trial'
      ? { plan: 'trial', secondsUsed: 0, weeklyTaste: true } : { plan: this.defaultPlan, secondsUsed: 0 };
    this.noteEpoch(userId, undefined, fresh);
    this.rows.set(userId, fresh);
    return fresh;
  }

  async save(userId: string, entitlement: Entitlement): Promise<void> {
    this.noteEpoch(userId, this.rows.get(userId), entitlement);
    this.rows.set(userId, entitlement);
  }

  async consume(userId: string, seconds: number, sessionId?: string): Promise<Entitlement> {
    return this.consumeLocal(userId, seconds, sessionId);
  }

  /** Keyed on the event id alone, exactly as billing_events' primary key is. */
  async recordBillingEvent(userId: string, eventId: string): Promise<boolean> {
    if (!eventId) throw new Error('a billing event id is required');
    if (!userId) throw new Error('a billing event needs an account');
    if (this.billingEvents.has(eventId)) return false;
    this.billingEvents.add(eventId);
    return true;
  }
}

/**
 * The same store, on disk.
 *
 * The in-memory one hands every learner their minutes back whenever the process
 * restarts, which makes a balance a property of the server's uptime rather than
 * of what someone paid for. This is not the database — it is the smallest thing
 * that stops a deploy being a refund, and it implements the identical interface
 * so the database, when it arrives, is still a one-file change.
 *
 * Writes go to a sibling file and are renamed over the target, because rename is
 * atomic on every filesystem this will run on and a half-written balance file is
 * worse than a slightly stale one.
 */
export class FileEntitlementStore extends LocalBillingSupport implements EntitlementStore {
  private readonly path: string;
  private readonly defaultPlan: Plan;
  private readonly rows: Map<string, Entitlement>;
  private readonly billingEvents = new Set<string>();

  constructor(path: string, defaultPlan: Plan = 'trial') {
    super();
    this.path = path;
    this.defaultPlan = defaultPlan;
    this.rows = new Map(Object.entries(this.#read()));
  }

  async claimTrial(_userId: string, _installationHash: string, _userHash: string): Promise<boolean> {
    return true;
  }

  async get(userId: string): Promise<Entitlement> {
    const existing = this.rows.get(userId);
    if (existing) {
      const now = new Date();
      const rolled = refillTaste(rollPeriod(existing, now), now);
      if (rolled !== existing) await this.save(userId, rolled);
      return rolled;
    }
    // A claimed free row is a weekly taste (D24); its window opens at the first debit.
    const fresh: Entitlement = this.defaultPlan === 'trial'
      ? { plan: 'trial', secondsUsed: 0, weeklyTaste: true } : { plan: this.defaultPlan, secondsUsed: 0 };
    await this.save(userId, fresh);
    return fresh;
  }

  async save(userId: string, entitlement: Entitlement): Promise<void> {
    this.noteEpoch(userId, this.rows.get(userId), entitlement);
    this.rows.set(userId, entitlement);
    this.#write();
  }

  async consume(userId: string, seconds: number, sessionId?: string): Promise<Entitlement> {
    return this.consumeLocal(userId, seconds, sessionId);
  }

  protected override async persistSessionLedger(): Promise<void> { this.#write(true); }
  protected override async saveSession(userId: string, row: Entitlement): Promise<void> {
    const old = this.rows.get(userId);
    this.rows.set(userId, row);
    try { this.#write(true); }
    catch (error) { if (old) this.rows.set(userId, old); else this.rows.delete(userId); throw error; }
  }

  #read(): Record<string, Entitlement> {
    let text: string;
    try { text = readFileSync(this.path, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw new Error('Entitlement ledger could not be read', { cause: error });
    }
    const parsed: unknown = JSON.parse(text);
    const record = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!record(parsed)) throw new Error('Invalid entitlement ledger');
    const versioned = parsed.version === 2;
    if ('version' in parsed && !versioned) throw new Error('Unknown entitlement ledger version');
    const rawRows = versioned ? parsed.entitlements : parsed;
    if (!record(rawRows)) throw new Error('Invalid entitlement ledger rows');
    const rows: Record<string, Entitlement> = Object.create(null);
    for (const [id, row] of Object.entries(rawRows)) {
      if (!record(row) || !['trial','starter','regular'].includes(String(row.plan))
        || typeof row.secondsUsed !== 'number' || !Number.isFinite(row.secondsUsed) || row.secondsUsed < 0
        || (row.periodEnd !== undefined && (typeof row.periodEnd !== 'string' || !Number.isFinite(Date.parse(row.periodEnd))))
        || (row.windowEnd !== undefined && (typeof row.windowEnd !== 'string' || !Number.isFinite(Date.parse(row.windowEnd))))
        || (row.periodStart !== undefined && (typeof row.periodStart !== 'string' || !Number.isFinite(Date.parse(row.periodStart))))
        || (row.withheldSeconds !== undefined && (!Number.isInteger(row.withheldSeconds) || Number(row.withheldSeconds) < 0))
        || (row.weeklyTaste !== undefined && typeof row.weeklyTaste !== 'boolean')) {
        throw new Error('Invalid entitlement ledger balance');
      }
      rows[id] = { ...row, ...(row.periodEnd ? { periodEnd: new Date(row.periodEnd as string) } : {}),
        ...(row.windowEnd ? { windowEnd: new Date(row.windowEnd as string) } : {}),
        ...(row.periodStart ? { periodStart: new Date(row.periodStart as string) } : {}) } as Entitlement;
    }
    if (versioned) {
      if (!record(parsed.epochs) || !record(parsed.sessions)) throw new Error('Invalid entitlement ledger proof');
      const epochs = new Map<string, string>();
      const sessions = new Map<string, LocalSessionRecord>();
      for (const [id, epoch] of Object.entries(parsed.epochs)) {
        if (typeof epoch !== 'string' || !epoch || !rows[id]) throw new Error('Invalid entitlement ledger epoch');
        epochs.set(id, epoch);
      }
      for (const [id, row] of Object.entries(parsed.sessions)) {
        if (!record(row) || typeof row.userId !== 'string' || !rows[row.userId]
          || typeof row.epoch !== 'string' || !row.epoch || !epochs.has(row.userId)
          || (row.charged !== undefined && (!Number.isInteger(row.charged) || Number(row.charged) < 0 || Number(row.charged) > 900))
          || (row.refunded !== undefined && typeof row.refunded !== 'boolean')
          || (row.refunded === true && (row.charged === undefined || !isServiceFailure(row.failure)))
          || (row.failure !== undefined && !isServiceFailure(row.failure))) throw new Error('Invalid entitlement ledger session');
        sessions.set(id, row as unknown as LocalSessionRecord);
      }
      for (const id of Object.keys(rows)) if (!epochs.has(id)) throw new Error('Missing entitlement ledger epoch');
      this.usageEpochs = epochs;
      this.sessionLedger = sessions;
    }
    return rows;
  }

  #write(strict = false): void {
    const temporary = `${this.path}.writing`;
    try {
      writeFileSync(temporary, JSON.stringify({ version: 2, entitlements: Object.fromEntries(this.rows),
        epochs: Object.fromEntries(this.usageEpochs), sessions: Object.fromEntries(this.sessionLedger) }, null, 2), { mode: 0o600 });
      renameSync(temporary, this.path);
    } catch (err) {
      // A balance that could not be persisted is still correct in memory for
      // this process. Loud, because the next restart will forget it.
      console.error('[luvani] ENTITLEMENT_NOT_PERSISTED', safeError(err));
      if (strict) throw err;
    }
  }

  /** Keyed on the event id alone, exactly as billing_events' primary key is. */
  async recordBillingEvent(userId: string, eventId: string): Promise<boolean> {
    if (!eventId) throw new Error('a billing event id is required');
    if (!userId) throw new Error('a billing event needs an account');
    if (this.billingEvents.has(eventId)) return false;
    this.billingEvents.add(eventId);
    return true;
  }
}

interface SupabaseEntitlementRow {
  user_id: string;
  plan: Plan;
  seconds_used: number;
  period_end: string | null;
  /** A yearly product's current allowance window, when it ends before the paid year (F733). */
  allowance_window_end?: string | null;
  /** When the store says the period on record began, and how much of seconds_used a window withholds (F733 second review). */
  period_start?: string | null;
  withheld_seconds?: number | null;
  lapsed_from_paid?: boolean;
  /** D24: a claimed (or lapsed) free row whose five minutes refill a rolling week from first use. */
  weekly_taste?: boolean;
}

function entitlementFrom(row: SupabaseEntitlementRow): Entitlement {
  return {
    plan: row.plan,
    secondsUsed: row.seconds_used,
    ...(row.period_start ? { periodStart: new Date(row.period_start) } : {}),
    ...(row.period_end ? { periodEnd: new Date(row.period_end) } : {}),
    ...(row.allowance_window_end ? { windowEnd: new Date(row.allowance_window_end) } : {}),
    ...(typeof row.withheld_seconds === 'number' && row.withheld_seconds > 0 ? { withheldSeconds: row.withheld_seconds } : {}),
    ...(row.lapsed_from_paid === true ? { lapsed: true } : {}),
    ...(row.weekly_taste === true ? { weeklyTaste: true } : {}),
  };
}

/** Durable, atomic production entitlements through Supabase's REST boundary. */
export class SupabaseEntitlementStore implements EntitlementStore {
  private readonly baseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly request: typeof fetch;

  constructor(baseUrl: string, serviceRoleKey: string, request: typeof fetch = fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.serviceRoleKey = serviceRoleKey;
    this.request = request;
  }

  #headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      authorization: `Bearer ${this.serviceRoleKey}`,
      'content-type': 'application/json',
      ...extra,
    };
  }

  async claimTrial(userId: string, installationHash: string, userHash: string): Promise<boolean> {
    const response = await this.request(`${this.baseUrl}/rest/v1/rpc/claim_trial`, {
      method: 'POST',
      headers: this.#headers(),
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({
        p_user_id: userId,
        p_installation_hash: installationHash,
        p_user_hash: userHash,
      }),
    });
    if (!response.ok) throw new Error(`trial claim failed (${response.status})`);
    return (await response.json()) === true;
  }

  async get(userId: string): Promise<Entitlement> {
    // A zero-second atomic debit is also the authoritative read: the database
    // function creates a missing trial and rolls an expired paid period before
    // returning it. A plain SELECT left an exhausted paid learner exhausted
    // forever because the roll only used to happen after a session ended.
    return this.consume(userId, 0);
  }

  async save(userId: string, entitlement: Entitlement): Promise<void> {
    const response = await this.request(`${this.baseUrl}/rest/v1/entitlements?on_conflict=user_id`, {
      method: 'POST',
      headers: this.#headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({
        user_id: userId,
        plan: entitlement.plan,
        seconds_used: entitlement.secondsUsed,
        period_end: entitlement.periodEnd?.toISOString() ?? null,
        allowance_window_end: entitlement.windowEnd?.toISOString() ?? null,
        lapsed_from_paid: entitlement.lapsed === true,
        weekly_taste: entitlement.weeklyTaste === true,
      }),
    });
    if (!response.ok) throw new Error(`entitlement write failed (${response.status})`);
  }

  async consume(userId: string, seconds: number, sessionId?: string): Promise<Entitlement> {
    if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('seconds must be a non-negative number');
    const response = await this.request(`${this.baseUrl}/rest/v1/rpc/consume_entitlement`, {
      method: 'POST',
      headers: this.#headers(),
      signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({ p_user_id: userId, p_seconds: Math.round(seconds), p_session_id: sessionId ?? null }),
    });
    if (!response.ok) throw new Error(`entitlement debit failed (${response.status})`);
    const body = (await response.json()) as SupabaseEntitlementRow | SupabaseEntitlementRow[];
    const row = Array.isArray(body) ? body[0] : body;
    if (!row) throw new Error('entitlement debit returned no row');
    return entitlementFrom(row);
  }

  async recordSessionGrant(userId: string, sessionId: string, expected: Entitlement): Promise<boolean> {
    const response = await this.request(`${this.baseUrl}/rest/v1/rpc/record_session_grant`, {
      method: 'POST', headers: this.#headers(), signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({ p_user_id: userId, p_session_id: sessionId, p_plan: expected.plan,
        p_seconds_used: expected.secondsUsed, p_period_end: expected.periodEnd?.toISOString() ?? null }),
    });
    if (!response.ok) throw new Error(`session grant proof failed (${response.status})`);
    const result: unknown = await response.json();
    if (typeof result !== 'boolean') throw new Error('session grant proof returned an invalid result');
    return result;
  }

  async refundSession(userId: string, sessionId: string, failure: ServiceFailure): Promise<SessionSettlement> {
    const response = await this.request(`${this.baseUrl}/rest/v1/rpc/refund_failed_session`, {
      method: 'POST', headers: this.#headers(), signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({ p_user_id: userId, p_session_id: sessionId, p_failure: failure }),
    });
    if (!response.ok) {
      const error: unknown = await response.json().catch(() => null);
      if (response.status === 409 && error !== null && typeof error === 'object'
        && (error as Record<string, unknown>).code === 'PT409') throw new SessionReconciliationRequired();
      throw new Error(`failed session settlement unavailable (${response.status})`);
    }
    const result = readSessionSettlement(await response.json());
    if (!result || result.kind === 'charged') throw new Error('refund settlement returned an invalid result');
    return result;
  }

  /** Version 2 is the projection that grants store trials and yearly windows (F733); 1 would grant a trial the month. */
  async billingProjectionReady(): Promise<boolean> {
    const response = await this.request(`${this.baseUrl}/rest/v1/rpc/billing_projection_version`, {
      method: 'POST', headers: this.#headers(), signal: AbortSignal.timeout(5_000), body: '{}',
    });
    return response.ok && await response.json() === 2;
  }
  async billingEventComplete(eventId: string): Promise<boolean> {
    const response = await this.request(`${this.baseUrl}/rest/v1/billing_events?event_id=eq.${encodeURIComponent(eventId)}&processed_at=not.is.null&select=event_id&limit=1`, {
      headers: this.#headers(), signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`billing replay lookup failed (${response.status})`);
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error('billing replay lookup returned invalid rows');
    return rows.length > 0;
  }
  async beginBillingRefresh(userId: string): Promise<number> {
    const response = await this.request(`${this.baseUrl}/rest/v1/rpc/begin_billing_refresh`, {
      method: 'POST', headers: this.#headers(), signal: AbortSignal.timeout(5_000), body: JSON.stringify({ p_user_id: userId }),
    });
    if (!response.ok) throw new Error(`billing refresh ticket failed (${response.status})`);
    const ticket: unknown = await response.json();
    if (typeof ticket !== 'number' || !Number.isSafeInteger(ticket) || ticket < 1) throw new Error('billing refresh ticket is invalid');
    return ticket;
  }
  async applyBilling(userId: string, ticket: number, snapshot: BillingSnapshot, eventId?: string): Promise<BillingProjection> {
    const response = await this.request(`${this.baseUrl}/rest/v1/rpc/apply_billing_projection_v2`, {
      method: 'POST', headers: this.#headers(), signal: AbortSignal.timeout(5_000),
      body: JSON.stringify({ p_user_id: userId, p_ticket: ticket, p_kind: snapshot.kind,
        p_plan: snapshot.kind === 'active' ? snapshot.plan : null,
        p_period_end: snapshot.kind === 'active' ? snapshot.periodEnd.toISOString() : null, p_event_id: eventId ?? null,
        p_grant_seconds: snapshot.kind === 'active' ? snapshot.grantSeconds : null,
        p_window_end: snapshot.kind === 'active' && snapshot.windowEnd ? snapshot.windowEnd.toISOString() : null,
        p_period_start: snapshot.kind === 'active' && snapshot.periodStart ? snapshot.periodStart.toISOString() : null }),
    });
    if (!response.ok) throw new Error(`billing projection failed (${response.status})`);
    const body = await response.json() as { kind?: unknown; reason?: unknown; entitlement?: SupabaseEntitlementRow };
    if (!body.entitlement || !['active', 'lapsed', 'unchanged'].includes(String(body.kind))) throw new Error('billing projection returned invalid state');
    const entitlement = entitlementFrom(body.entitlement);
    if (body.kind === 'unchanged') {
      if (!['unknown-product', 'not-paid', 'superseded'].includes(String(body.reason))) throw new Error('billing projection returned invalid reason');
      return { kind: 'unchanged', reason: body.reason as 'unknown-product' | 'not-paid' | 'superseded', entitlement };
    }
    return { kind: body.kind as 'active' | 'lapsed', entitlement };
  }

  async recordBillingEvent(userId: string, eventId: string): Promise<boolean> {
    if (!eventId) throw new Error('a billing event id is required');
    if (!userId) throw new Error('a billing event needs an account');
    const response = await this.request(`${this.baseUrl}/rest/v1/rpc/record_billing_event`, {
      method: 'POST',
      headers: this.#headers(),
      signal: AbortSignal.timeout(5_000),
      // The argument names are the migration's, not ours. PostgREST matches an
      // overload by argument name, so a typo here is a 404 in production.
      body: JSON.stringify({ p_event_id: eventId, p_user_id: userId }),
    });
    // A raise means neither replay nor first sighting — another transaction holds
    // this id uncommitted. Throwing sends the vendor away to redeliver, and costs
    // nothing outbound because the dedupe runs before the subscriber fetch.
    if (!response.ok) throw new Error(`billing event record failed (${response.status})`);
    const body: unknown = await response.json();
    // Only a literal true is a first sighting. null, {}, [], "true" and 1 are all
    // ambiguous, and reading any of them as true would re-fetch the subscriber on
    // every redelivery of an event we have already acted on.
    return body === true;
  }
}
