/**
 * Anonymous guest first scene admission (UI-011).
 *
 * The scene is one scripted café exchange of at most 180 seconds, with no
 * language model. Two limits bound it, both in the same Upstash store as the
 * guest capability and guest speech:
 *
 * - One scene per installation per 30 days: a marker reserved with SET NX before
 *   a capability is created. The installation id is a forgeable courtesy limit,
 *   not the money limit.
 * - The service-wide daily ceiling, `LUVANI_GUEST_SCENE_DAILY` scenes per UTC
 *   day. This is the money limit (ceiling × 180 s). It is booked when a worker
 *   first claims a room, idempotently per worker fence, so a learner whose
 *   connection fails before the tutor joins spends nothing.
 *
 * Only counters and markers are kept, under hashed keys. No address,
 * installation value or learner content is stored here.
 */
import { createHash } from 'node:crypto';

export const GUEST_SCENE_DEFAULT_DAILY = 24;
export const GUEST_SCENE_MAX_DAILY = 2000;
const INSTALLATION_TTL_SEC = 30 * 86400;
const DAY_TTL_SEC = 2 * 86400;
const HASH = /^[A-Za-z0-9_-]{43}$/;

export interface GuestSceneEnvironment {
  NODE_ENV?: string;
  LUVANI_LOCAL_DEVELOPMENT?: string;
  LUVANI_GUEST_SCENE?: string;
  LUVANI_GUEST_SCENE_DAILY?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  LUVANI_AGENT_SECRET?: string;
}

/** A whole number from 1 to 2,000, default 24. Anything else is null and keeps scenes off. */
export function guestSceneDaily(env: GuestSceneEnvironment): number | null {
  const raw = env.LUVANI_GUEST_SCENE_DAILY;
  if (raw === undefined || raw.trim() === '') return GUEST_SCENE_DEFAULT_DAILY;
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) && value >= 1 && value <= GUEST_SCENE_MAX_DAILY ? value : null;
}

/**
 * What the guest scene still lacks, by name. Empty means it is open.
 *
 * Production needs the explicit switch, the durable store that holds the
 * installation marker and the ceiling, the agent secret the worker claims
 * with, the LiveKit keys and a valid ceiling. `LUVANI_LOCAL_DEVELOPMENT` never
 * opens production; locally it is what opens it, as for the guest convo path.
 */
export function guestSceneGaps(env: GuestSceneEnvironment, agentSecret: string | undefined = env.LUVANI_AGENT_SECRET): string[] {
  const gaps: string[] = [];
  if (!agentSecret?.trim()) gaps.push('LUVANI_AGENT_SECRET');
  if (!env.LIVEKIT_API_KEY?.trim() || !env.LIVEKIT_API_SECRET?.trim()) gaps.push('LIVEKIT_API_KEY and LIVEKIT_API_SECRET');
  if (guestSceneDaily(env) === null) gaps.push('LUVANI_GUEST_SCENE_DAILY');
  if (env.NODE_ENV !== 'production') {
    if (env.LUVANI_LOCAL_DEVELOPMENT !== '1' && env.LUVANI_GUEST_SCENE !== '1') gaps.push('LUVANI_GUEST_SCENE');
    return gaps;
  }
  if (env.LUVANI_LOCAL_DEVELOPMENT === '1') gaps.push('production without LUVANI_LOCAL_DEVELOPMENT');
  if (env.LUVANI_GUEST_SCENE !== '1') gaps.push('LUVANI_GUEST_SCENE');
  if (!env.UPSTASH_REDIS_REST_URL?.trim() || !env.UPSTASH_REDIS_REST_TOKEN?.trim()) gaps.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
  return gaps;
}

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

const hashed = (value: string): string => createHash('sha256').update(value).digest('base64url');

export interface GuestSceneKeys {
  installation: (installHash: string) => string;
  day: (now: number) => string;
  fence: (fence: string, now: number) => string;
}

export const guestSceneKeys: GuestSceneKeys = {
  installation: (installHash) => {
    if (!HASH.test(installHash)) throw new Error('guest scene installation must be hashed');
    return `luvani:guest-scene:installation:${installHash}`;
  },
  day: (now) => `luvani:guest-scene:day:${utcDay(now)}`,
  fence: (fence, now) => `luvani:guest-scene:fence:${utcDay(now)}:${hashed(fence)}`,
};

export interface GuestSceneLedger {
  /** SET NX with a 30-day TTL. True when this call reserved the marker. */
  reserveInstallation(key: string, value: string): Promise<boolean>;
  /** Deletes the marker only while it still holds `value`. */
  releaseInstallation(key: string, value: string): Promise<void>;
  /** Books one slot of the day once per fence. True when booked now or earlier for this fence. */
  book(dayKey: string, fenceKey: string, ceiling: number): Promise<boolean>;
  /** Scenes already booked today. */
  used(dayKey: string): Promise<number>;
}

export class MemoryGuestSceneLedger implements GuestSceneLedger {
  private readonly values = new Map<string, { value: string; expiresAt: number }>();
  private readonly now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
  }
  private read(key: string): string | null {
    const row = this.values.get(key);
    return row && row.expiresAt > this.now() ? row.value : null;
  }
  // Each method runs to completion without awaiting, so no two calls interleave.
  async reserveInstallation(key: string, value: string): Promise<boolean> {
    if (this.read(key) !== null) return false;
    this.values.set(key, { value, expiresAt: this.now() + INSTALLATION_TTL_SEC * 1000 });
    return true;
  }
  async releaseInstallation(key: string, value: string): Promise<void> {
    if (this.read(key) === value) this.values.delete(key);
  }
  async book(dayKey: string, fenceKey: string, ceiling: number): Promise<boolean> {
    if (this.read(fenceKey) !== null) return true;
    const used = Number(this.read(dayKey) ?? '0');
    if (used >= ceiling) return false;
    const expiresAt = this.now() + DAY_TTL_SEC * 1000;
    this.values.set(dayKey, { value: String(used + 1), expiresAt });
    this.values.set(fenceKey, { value: '1', expiresAt });
    return true;
  }
  async used(dayKey: string): Promise<number> {
    return Number(this.read(dayKey) ?? '0');
  }
  /** Test helper: the TTL left on a key, in seconds, or null when absent. */
  ttl(key: string): number | null {
    const row = this.values.get(key);
    return row && row.expiresAt > this.now() ? Math.ceil((row.expiresAt - this.now()) / 1000) : null;
  }
}

/** KEYS: installation marker. ARGV: value, ttl. */
export const RESERVE_INSTALLATION_SCRIPT =
  "if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then return 1 end return 0";
/** KEYS: installation marker. ARGV: value. */
export const RELEASE_INSTALLATION_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('DEL', KEYS[1]) end return 1";
/** KEYS: day counter, fence marker. ARGV: ceiling, ttl. 1 booked (now or before), 0 refused. */
export const BOOK_SCRIPT = [
  "if redis.call('EXISTS', KEYS[2]) == 1 then return 1 end",
  "local used = tonumber(redis.call('GET', KEYS[1]) or '0')",
  'if used >= tonumber(ARGV[1]) then return 0 end',
  "redis.call('INCR', KEYS[1])",
  "redis.call('EXPIRE', KEYS[1], ARGV[2])",
  "redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])",
  'return 1',
].join('\n');

export class RedisGuestSceneLedger implements GuestSceneLedger {
  private readonly url: string;
  private readonly token: string;
  private readonly request: typeof fetch;
  constructor(url: string, token: string, request: typeof fetch = fetch) {
    this.url = url.replace(/\/+$/, '');
    this.token = token;
    this.request = request;
  }
  private async command(command: readonly string[]): Promise<unknown> {
    const response = await this.request(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error('guest scene ledger unavailable');
    const body = (await response.json()) as { result?: unknown; error?: unknown };
    if (body.error) throw new Error('guest scene ledger unavailable');
    return body.result;
  }
  async reserveInstallation(key: string, value: string): Promise<boolean> {
    return Number(await this.command(['EVAL', RESERVE_INSTALLATION_SCRIPT, '1', key, value, String(INSTALLATION_TTL_SEC)])) === 1;
  }
  async releaseInstallation(key: string, value: string): Promise<void> {
    await this.command(['EVAL', RELEASE_INSTALLATION_SCRIPT, '1', key, value]);
  }
  async book(dayKey: string, fenceKey: string, ceiling: number): Promise<boolean> {
    return Number(await this.command(['EVAL', BOOK_SCRIPT, '2', dayKey, fenceKey, String(ceiling), String(DAY_TTL_SEC)])) === 1;
  }
  async used(dayKey: string): Promise<number> {
    const raw = await this.command(['GET', dayKey]);
    const used = raw === null || raw === undefined ? 0 : Number(raw);
    if (!Number.isSafeInteger(used) || used < 0) throw new Error('guest scene ledger returned an invalid read');
    return used;
  }
}

export function guestSceneAdmission(ledger: GuestSceneLedger, ceiling: number) {
  // The operator hears once per UTC day per process that the ceiling refused a
  // scene. Only the ceiling and the day are logged: never a guest, installation or address.
  let ceilingLoggedOn: string | null = null;
  const ceilingRefused = (now: number) => {
    const day = utcDay(now);
    if (ceilingLoggedOn === day) return;
    ceilingLoggedOn = day;
    console.warn(`[luvani] guest scene: the service-wide daily ceiling of ${ceiling} is spent for ${day}; guests create an account to practise until the UTC day turns.`);
  };
  return {
    ceiling,
    /** Whether today's ceiling has a slot left. Reads only; a claim may still find it spent. */
    async open(now = Date.now()): Promise<boolean> {
      return (await ledger.used(guestSceneKeys.day(now))) < ceiling;
    },
    /** One scene per installation per 30 days. Returns a release handle, or null when used. */
    async reserveInstallation(installHash: string, value: string): Promise<null | (() => Promise<void>)> {
      const key = guestSceneKeys.installation(installHash);
      if (!(await ledger.reserveInstallation(key, value))) return null;
      return () => ledger.releaseInstallation(key, value);
    },
    /** Books one slot of today's ceiling for this worker fence, at most once. */
    async book(fence: string, now = Date.now()): Promise<boolean> {
      const booked = await ledger.book(guestSceneKeys.day(now), guestSceneKeys.fence(fence, now), ceiling);
      if (!booked) ceilingRefused(now);
      return booked;
    },
  };
}

export type GuestSceneAdmission = ReturnType<typeof guestSceneAdmission>;
