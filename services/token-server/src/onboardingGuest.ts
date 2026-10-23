import type { GuestLiveRecord } from './guestLive.ts';
import type { GuestScene, GuestSceneTurnId } from '@luvani/core';
import type { GuestMetricValue } from './guestMetrics.ts';
/** Guest capabilities only open the bounded starter, never ordinary authenticated routes. Live guests retain a bounded acknowledged learning summary for at most 30 days, and a scene keeps only its acknowledged turn ids; no raw audio. Once claimed, a record shrinks to `claimedRecord` with at most 48 hours to live. */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  starterTasks,
  checkStarter,
  type StarterGoal,
  type StarterDrink,
  type StarterFeedback,
} from '@luvani/core';
export interface GuestRecord {
  live?: GuestLiveRecord;
  id: string;
  installation: string;
  expiresAt: number;
  createdAt: number;
  goal: StarterGoal;
  drink: StarterDrink;
  minutes: 5 | 10 | 15 | 'none';
  attempts: Record<string, number>;
  seconds: number;
  owner?: string;
  analyticsAllowed: boolean;
  variant: 'full' | 'five';
  /** Set only on a guest first scene capability (UI-011). */
  scene?: GuestScene;
  /** Kept on a claimed record so a lost claim response can be retried with the same answer. */
  sceneTurns?: GuestSceneTurnId[];
  /** The tutor the guest chose before a scene, signed into the scene grant. Shape-checked by `grantSession`. */
  tutorVoice?: string;
}
/** What a claimed record keeps for an idempotent same-owner retry: no brief, room or pack. */
export const CLAIMED_RETENTION_SEC = 48 * 3600;
export function claimedRecord(row: GuestRecord): GuestRecord {
  return { id: row.id, owner: row.owner, installation: row.installation, expiresAt: row.expiresAt,
    ...(row.scene ? { scene: row.scene, sceneTurns: row.live?.sceneTurns ?? row.sceneTurns ?? [] } : {}),
    analyticsAllowed: row.analyticsAllowed } as GuestRecord;
}
export interface GuestStore {
  metric(event: GuestMetricValue, variant: 'full' | 'five', now?: number): Promise<void>;
  create(key: string, row: GuestRecord): Promise<boolean>;
  get(key: string): Promise<GuestRecord | null>;
  update<T>(key: string, change: (row: GuestRecord) => T): Promise<T>;
  /** After a claim: shrink the owner's record to `claimedRecord` and cap its life at 48 hours. */
  shrinkClaimed(key: string, owner: string): Promise<void>;
}
export class MemoryGuestStore implements GuestStore {
  metrics = new Map<string, number>();
  async metric(event: GuestMetricValue, variant: 'full' | 'five', now = Date.now()): Promise<void> {
    const key = `${new Date(now).toISOString().slice(0, 10)}:${variant}:${event.name}:${event.evidence}`;
    this.metrics.set(key, (this.metrics.get(key) ?? 0) + 1);
  }
  rows = new Map<string, GuestRecord>();
  /** Absolute expiry per key, set only by `shrinkClaimed`. */
  ttlUntil = new Map<string, number>();
  private clock: () => number;
  constructor(clock: () => number = Date.now) { this.clock = clock; }
  private chain: Promise<unknown> = Promise.resolve();
  async create(key: string, row: GuestRecord): Promise<boolean> {
    if (
      [...this.rows.values()].some(
        (r) => r.installation === row.installation && r.expiresAt > Date.now(),
      )
    )
      return false;
    this.rows.set(key, row);
    return true;
  }
  async get(key: string): Promise<GuestRecord | null> {
    const until = this.ttlUntil.get(key);
    if (until !== undefined && until <= this.clock()) { this.rows.delete(key); this.ttlUntil.delete(key); }
    return this.rows.get(key) ?? null;
  }
  async shrinkClaimed(key: string, owner: string): Promise<void> {
    const work = this.chain.then(async () => {
      const row = await this.get(key);
      if (!row || row.owner !== owner) return;
      this.rows.set(key, claimedRecord(row));
      const until = this.clock() + CLAIMED_RETENTION_SEC * 1000;
      this.ttlUntil.set(key, Math.min(this.ttlUntil.get(key) ?? until, until));
    });
    this.chain = work.catch(() => {});
    return work;
  }
  async update<T>(key: string, change: (row: GuestRecord) => T): Promise<T> {
    const work = this.chain.then(async () => {
      const row = await this.get(key);
      if (!row) throw new Error('expired');
      const next = structuredClone(row);
      const result = change(next);
      this.rows.set(key, next);
      return result;
    });
    this.chain = work.catch(() => {});
    return work;
  }
}
/** Redis optimistic transaction: versioned compare-and-set prevents concurrent retry or claim from spending twice. */
export class RedisGuestStore implements GuestStore {
  async metric(event: GuestMetricValue, variant: 'full' | 'five', now = Date.now()): Promise<void> {
    const key = `luvani:starter-metric:${new Date(now).toISOString().slice(0, 10)}:${variant}:${event.name}:${event.evidence}`;
    await this.command([
      'EVAL',
      "redis.call('INCR', KEYS[1]) redis.call('EXPIRE', KEYS[1], 7776000) return 1",
      '1',
      key,
    ]);
  }
  private url: string;
  private token: string;
  private request: typeof fetch;
  constructor(url: string, token: string, request: typeof fetch = fetch) {
    this.url = url;
    this.token = token;
    this.request = request;
  }
  private async command(command: unknown[]): Promise<unknown> {
    const response = await this.request(this.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error('guest store unavailable');
    const body = (await response.json()) as {
      result?: unknown;
      error?: unknown;
    };
    if (body.error) throw new Error('guest store unavailable');
    return body.result;
  }
  async create(key: string, row: GuestRecord): Promise<boolean> {
    const result = await this.command([
      'EVAL',
      "if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end redis.call('SET', KEYS[1], ARGV[1], 'EX', 2592000) redis.call('SET', KEYS[2], '1', 'EX', 86400) return 1",
      '2',
      `luvani:guest:${key}`,
      `luvani:guest-install:${row.installation}`,
      JSON.stringify(row),
    ]);
    return result === 1;
  }
  async get(key: string): Promise<GuestRecord | null> {
    const raw = await this.command(['GET', `luvani:guest:${key}`]);
    return typeof raw === 'string' ? (JSON.parse(raw) as GuestRecord) : null;
  }
  async update<T>(key: string, change: (row: GuestRecord) => T): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const before = await this.get(key);
      if (!before) throw new Error('expired');
      const row = structuredClone(before);
      const result = change(row);
      const done = await this.command([
        'EVAL',
        "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL') return 1",
        '1',
        `luvani:guest:${key}`,
        JSON.stringify(before),
        JSON.stringify(row),
      ]);
      if (done === 1) return result;
    }
    throw new Error('guest update conflict');
  }
  async shrinkClaimed(key: string, owner: string): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const before = await this.get(key);
      if (!before || before.owner !== owner) return;
      const done = await this.command([
        'EVAL',
        SHRINK_SCRIPT,
        '1',
        `luvani:guest:${key}`,
        JSON.stringify(before),
        JSON.stringify(claimedRecord(before)),
        String(CLAIMED_RETENTION_SEC),
      ]);
      if (done === 1) return;
    }
    throw new Error('guest update conflict');
  }
}
/** Compare-and-set the shrunk record; its TTL becomes the shorter of what is left and 48 hours. */
export const SHRINK_SCRIPT =
  "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end local ttl = redis.call('TTL', KEYS[1]) if ttl < 0 or ttl > tonumber(ARGV[3]) then redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) else redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL') end return 1";
export const guestKey = (token: string): string =>
  createHash('sha256').update(token).digest('base64url');
export async function createGuest(
  store: GuestStore,
  input: {
    installation: string;
    eligible: boolean;
    goal: StarterGoal;
    drink: StarterDrink;
    minutes: GuestRecord['minutes'];
    analyticsAllowed?: boolean;
    variant?: 'full' | 'five';
    scene?: GuestScene;
    tutorVoice?: string;
  },
  now = Date.now(),
) {
  if (input.eligible !== true) throw new Error('eligibility required');
  const token = randomBytes(32).toString('base64url');
  const row: GuestRecord = {
    id: randomUUID(),
    installation: input.installation,
    expiresAt: now + 86400000,
    createdAt: now,
    goal: input.goal,
    drink: input.drink,
    minutes: input.minutes,
    analyticsAllowed: input.analyticsAllowed === true,
    variant: input.variant === 'five' ? 'five' : 'full',
    attempts: {},
    seconds: 0,
    ...(input.scene ? { scene: input.scene } : {}),
    ...(input.scene && input.tutorVoice ? { tutorVoice: input.tutorVoice } : {}),
  };
  if (!(await store.create(guestKey(token), row))) throw new Error('starter already used');
  return { token, expiresAt: row.expiresAt, id: row.id };
}
export async function guestAttempt(
  store: GuestStore,
  token: string,
  taskId: string,
  reply: string,
  evidence: 'typed' | 'spoken',
  now = Date.now(),
  activeSeconds = 0,
): Promise<StarterFeedback & { secondsUsed: number }> {
  if (!reply.trim() || reply.length > 600) throw new Error('reply required');
  return store.update(guestKey(token), (row) => {
    if (row.expiresAt <= now || row.owner) throw new Error('expired');
    const task = starterTasks(row.goal, row.drink, row.minutes).find((t) => t.id === taskId);
    if (!task) throw new Error('unknown task');
    if ((row.attempts[taskId] ?? 0) >= 2) throw new Error('practice complete');
    row.attempts[taskId] = (row.attempts[taskId] ?? 0) + 1;
    // The client pauses its active-task clock in the background. Never charge
    // wall-clock time from installation, permission dialogs or a suspended app.
    const elapsed = Math.max(0, Math.floor((now - row.createdAt) / 1000));
    const reported = Number.isFinite(activeSeconds)
      ? Math.max(0, Math.min(120, Math.round(activeSeconds)))
      : 0;
    row.seconds = Math.min(
      elapsed,
      starterTasks(row.goal, row.drink, row.minutes).length * 120,
      row.seconds + reported,
    );
    return { ...checkStarter(task, reply, evidence), secondsUsed: row.seconds };
  });
}
/** Ownership sticks before entitlement debit; failed retries can finish only for the same account. */
export async function claimGuest(
  store: GuestStore,
  token: string,
  userId: string,
  now = Date.now(),
): Promise<GuestRecord> {
  return store.update(guestKey(token), (row) => {
    if (row.owner && row.owner !== userId) throw new Error('already claimed');
    // A shrunk claimed record has no createdAt; its own 48-hour TTL bounds it instead.
    if (row.createdAt + 30 * 86400000 <= now) throw new Error('expired');
    if (row.live?.fence && !row.live.endedAt && (row.live.leaseUntil ?? 0) > now) throw new Error('session still active');
    if (row.live?.fence && !row.live.endedAt) {
      row.live.endedAt = now; row.live.outcome = 'interrupted';
      row.seconds = row.live.serviceFailure || !row.live.learnerTurns ? 0 : row.live.seconds;
    }
    row.owner = userId;
    return structuredClone(row);
  });
}
