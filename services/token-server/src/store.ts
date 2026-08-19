/**
 * Entitlement storage.
 *
 * In-memory today, behind an interface, because the shape of the calls matters more
 * right now than where the rows live. Everything here is `async` precisely so that
 * swapping in Postgres is a one-file change rather than a refactor of every caller.
 *
 * What must NOT move to the client when that swap happens: the entitlement check
 * itself. Metered minutes enforced in the app are a suggestion; enforced at token
 * issuance they are a fact, because without a token there is no room to join.
 */

import { readFileSync, renameSync, writeFileSync } from 'node:fs';

import { PLANS, rollPeriod, type Entitlement, type Plan } from '@parle/core';

export interface EntitlementStore {
  get(userId: string): Promise<Entitlement>;
  save(userId: string, entitlement: Entitlement): Promise<void>;
  /** Record consumed seconds after a session ends. */
  consume(userId: string, seconds: number): Promise<Entitlement>;
}

export class InMemoryEntitlementStore implements EntitlementStore {
  private readonly rows = new Map<string, Entitlement>();
  // Written out longhand rather than as a constructor parameter property: Node runs
  // this file by stripping types, and parameter properties emit runtime code, so
  // they are rejected outright. Same reason in services/tutor-agent/src/agent.ts.
  private readonly defaultPlan: Plan;

  constructor(defaultPlan: Plan = 'trial') {
    this.defaultPlan = defaultPlan;
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

  async consume(userId: string, seconds: number): Promise<Entitlement> {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new RangeError('seconds must be a non-negative number');
    }
    const current = await this.get(userId);
    const cap = PLANS[current.plan].secondsPerPeriod;
    const next: Entitlement = { ...current, secondsUsed: Math.min(cap, current.secondsUsed + seconds) };
    this.rows.set(userId, next);
    return next;
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

  constructor(path: string, defaultPlan: Plan = 'trial') {
    this.path = path;
    this.defaultPlan = defaultPlan;
    this.rows = new Map(Object.entries(this.#read()));
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

  async consume(userId: string, seconds: number): Promise<Entitlement> {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new RangeError('seconds must be a non-negative number');
    }
    const current = await this.get(userId);
    const cap = PLANS[current.plan].secondsPerPeriod;
    const next: Entitlement = { ...current, secondsUsed: Math.min(cap, current.secondsUsed + seconds) };
    await this.save(userId, next);
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
}
