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

import { PLANS, rollPeriod, type Entitlement, type Plan } from '@parle/core';

export interface EntitlementStore {
  /** Claim the one-time trial boundary before a first entitlement is read. */
  claimTrial(userId: string, installationHash: string, userHash: string): Promise<boolean>;
  get(userId: string): Promise<Entitlement>;
  save(userId: string, entitlement: Entitlement): Promise<void>;
  /** Record consumed seconds after a session ends. A session id makes retries idempotent. */
  consume(userId: string, seconds: number, sessionId?: string): Promise<Entitlement>;
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
}

/**
 * Whether the deliberately non-metering local store may be used.
 *
 * The second condition is load-bearing. A copied development env file must not
 * be able to turn production metering off, even when it still contains the
 * opt-in flag.
 */
export function developmentEntitlementsEnabled(env: Record<string, string | undefined>): boolean {
  return env.PARLE_DEV_UNLIMITED_MINUTES === '1' && env.NODE_ENV !== 'production';
}

/**
 * A local testing allowance that never runs down.
 *
 * It presents the existing Regular allowance rather than inventing an
 * "unlimited" production plan. Every read and debit returns a fresh allowance,
 * so repeated voice testing cannot strand the developer behind the paywall.
 * The server only selects this store through developmentEntitlementsEnabled.
 */
export class DevelopmentEntitlementStore implements EntitlementStore {
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

export class InMemoryEntitlementStore implements EntitlementStore {
  private readonly rows = new Map<string, Entitlement>();
  private readonly consumedSessions = new Set<string>();
  private readonly billingEvents = new Set<string>();
  // Written out longhand rather than as a constructor parameter property: Node runs
  // this file by stripping types, and parameter properties emit runtime code, so
  // they are rejected outright. Same reason in services/tutor-agent/src/agent.ts.
  private readonly defaultPlan: Plan;

  constructor(defaultPlan: Plan = 'trial') {
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
      const rolled = rollPeriod(existing, new Date());
      if (rolled !== existing) this.rows.set(userId, rolled);
      return rolled;
    }

    const fresh: Entitlement = { plan: this.defaultPlan, secondsUsed: 0 };
    this.rows.set(userId, fresh);
    return fresh;
  }

  async save(userId: string, entitlement: Entitlement): Promise<void> {
    this.rows.set(userId, entitlement);
  }

  async consume(userId: string, seconds: number, sessionId?: string): Promise<Entitlement> {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new RangeError('seconds must be a non-negative number');
    }
    const consumptionKey = sessionId ? `${userId}:${sessionId}` : null;
    if (consumptionKey && this.consumedSessions.has(consumptionKey)) return this.get(userId);
    const current = await this.get(userId);
    const cap = PLANS[current.plan].secondsPerPeriod;
    const next: Entitlement = { ...current, secondsUsed: Math.min(cap, current.secondsUsed + seconds) };
    this.rows.set(userId, next);
    if (consumptionKey) this.consumedSessions.add(consumptionKey);
    return next;
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
export class FileEntitlementStore implements EntitlementStore {
  private readonly path: string;
  private readonly defaultPlan: Plan;
  private readonly rows: Map<string, Entitlement>;
  private readonly consumedSessions = new Set<string>();
  private readonly billingEvents = new Set<string>();

  constructor(path: string, defaultPlan: Plan = 'trial') {
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
      const rolled = rollPeriod(existing, new Date());
      if (rolled !== existing) await this.save(userId, rolled);
      return rolled;
    }
    const fresh: Entitlement = { plan: this.defaultPlan, secondsUsed: 0 };
    await this.save(userId, fresh);
    return fresh;
  }

  async save(userId: string, entitlement: Entitlement): Promise<void> {
    this.rows.set(userId, entitlement);
    this.#write();
  }

  async consume(userId: string, seconds: number, sessionId?: string): Promise<Entitlement> {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new RangeError('seconds must be a non-negative number');
    }
    const consumptionKey = sessionId ? `${userId}:${sessionId}` : null;
    if (consumptionKey && this.consumedSessions.has(consumptionKey)) return this.get(userId);
    const current = await this.get(userId);
    const cap = PLANS[current.plan].secondsPerPeriod;
    const next: Entitlement = { ...current, secondsUsed: Math.min(cap, current.secondsUsed + seconds) };
    await this.save(userId, next);
    if (consumptionKey) this.consumedSessions.add(consumptionKey);
    return next;
  }

  #read(): Record<string, Entitlement> {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, 'utf8'));
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, Entitlement>) : {};
    } catch {
      // No file yet, or an unreadable one. Starting empty is the same position
      // the in-memory store starts from, and never a reason not to serve.
      return {};
    }
  }

  #write(): void {
    const temporary = `${this.path}.writing`;
    try {
      writeFileSync(temporary, JSON.stringify(Object.fromEntries(this.rows), null, 2));
      renameSync(temporary, this.path);
    } catch (err) {
      // A balance that could not be persisted is still correct in memory for
      // this process. Loud, because the next restart will forget it.
      console.error('[parle] ENTITLEMENT_NOT_PERSISTED', err);
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
  lapsed_from_paid?: boolean;
}

function entitlementFrom(row: SupabaseEntitlementRow): Entitlement {
  return {
    plan: row.plan,
    secondsUsed: row.seconds_used,
    ...(row.period_end ? { periodEnd: new Date(row.period_end) } : {}),
    ...(row.lapsed_from_paid === true ? { lapsed: true } : {}),
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
        lapsed_from_paid: entitlement.lapsed === true,
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
