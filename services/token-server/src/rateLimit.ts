import { createHmac } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { isIP } from 'node:net';

export interface RateLimitRule {
  name: string;
  limit: number;
  windowSec: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export interface RateLimiter {
  consume(rule: RateLimitRule, signal: string): Promise<RateLimitDecision>;
}

export interface SessionLeaseStore {
  acquire(userSignal: string, sessionId: string, ttlSec: number): Promise<boolean>;
  release(userSignal: string, sessionId: string): Promise<void>;
}

interface Counter {
  used: number;
  expiresAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly counters = new Map<string, Counter>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async consume(rule: RateLimitRule, signal: string): Promise<RateLimitDecision> {
    const now = this.now();
    const key = `${rule.name}:${signal}`;
    const existing = this.counters.get(key);
    const counter = existing && existing.expiresAt > now
      ? existing
      : { used: 0, expiresAt: now + rule.windowSec * 1_000 };
    counter.used += 1;
    this.counters.set(key, counter);
    const retryAfterSec = Math.max(1, Math.ceil((counter.expiresAt - now) / 1_000));
    return {
      allowed: counter.used <= rule.limit,
      remaining: Math.max(0, rule.limit - counter.used),
      retryAfterSec,
    };
  }
}

export class MemorySessionLeaseStore implements SessionLeaseStore {
  private readonly leases = new Map<string, { sessionId: string; expiresAt: number }>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  async acquire(userSignal: string, sessionId: string, ttlSec: number): Promise<boolean> {
    const existing = this.leases.get(userSignal);
    if (existing && existing.expiresAt > this.now()) return false;
    this.leases.set(userSignal, { sessionId, expiresAt: this.now() + ttlSec * 1_000 });
    return true;
  }

  async release(userSignal: string, sessionId: string): Promise<void> {
    if (this.leases.get(userSignal)?.sessionId === sessionId) this.leases.delete(userSignal);
  }
}

type FetchLike = typeof fetch;

const CONSUME_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('TTL', KEYS[1])",
  'return {current, ttl}',
].join('\n');

const RELEASE_LEASE_SCRIPT = [
  "if redis.call('GET', KEYS[1]) == ARGV[1] then",
  "  return redis.call('DEL', KEYS[1])",
  'end',
  'return 0',
].join('\n');

/** Shared fixed-window protection through the Upstash Redis REST command API. */
export class UpstashRateLimiter implements RateLimiter {
  private readonly url: string;
  private readonly token: string;
  private readonly fetcher: FetchLike;

  constructor(url: string, token: string, fetcher: FetchLike = fetch) {
    this.url = url.replace(/\/+$/, '');
    this.token = token;
    this.fetcher = fetcher;
  }

  async consume(rule: RateLimitRule, signal: string): Promise<RateLimitDecision> {
    const response = await this.fetcher(this.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(3_000),
      body: JSON.stringify(['EVAL', CONSUME_SCRIPT, '1', `luvani:limit:${rule.name}:${signal}`, String(rule.windowSec)]),
    });
    if (!response.ok) throw new Error(`distributed rate limiter returned ${response.status}`);
    const body = (await response.json()) as { result?: unknown };
    if (!Array.isArray(body.result) || body.result.length !== 2) {
      throw new Error('distributed rate limiter returned an invalid decision');
    }
    const used = Number(body.result[0]);
    const ttl = Number(body.result[1]);
    if (!Number.isFinite(used) || !Number.isFinite(ttl)) {
      throw new Error('distributed rate limiter returned a non-numeric decision');
    }
    return {
      allowed: used <= rule.limit,
      remaining: Math.max(0, rule.limit - used),
      retryAfterSec: Math.max(1, ttl),
    };
  }
}

export class UpstashSessionLeaseStore implements SessionLeaseStore {
  private readonly url: string;
  private readonly token: string;
  private readonly fetcher: FetchLike;

  constructor(url: string, token: string, fetcher: FetchLike = fetch) {
    this.url = url.replace(/\/+$/, '');
    this.token = token;
    this.fetcher = fetcher;
  }

  async #command(command: readonly string[]): Promise<unknown> {
    const response = await this.fetcher(this.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(3_000),
      body: JSON.stringify(command),
    });
    if (!response.ok) throw new Error(`distributed session lease returned ${response.status}`);
    return ((await response.json()) as { result?: unknown }).result;
  }

  async acquire(userSignal: string, sessionId: string, ttlSec: number): Promise<boolean> {
    const result = await this.#command([
      'SET',
      `luvani:active-session:${userSignal}`,
      sessionId,
      'NX',
      'EX',
      String(ttlSec),
    ]);
    return result === 'OK';
  }

  async release(userSignal: string, sessionId: string): Promise<void> {
    await this.#command([
      'EVAL',
      RELEASE_LEASE_SCRIPT,
      '1',
      `luvani:active-session:${userSignal}`,
      sessionId,
    ]);
  }
}

export function createRateLimiter(env: {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}): RateLimiter {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashRateLimiter(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  }
  return new MemoryRateLimiter();
}

export function createSessionLeaseStore(env: {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}): SessionLeaseStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashSessionLeaseStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  }
  return new MemorySessionLeaseStore();
}

/** Hash network and account signals before they leave the server boundary. */
export function privateSignal(salt: string, kind: 'ip' | 'user' | 'installation', value: string): string {
  return createHmac('sha256', salt).update(`${kind}\0${value}`).digest('base64url');
}

/**
 * The address a request is budgeted against.
 *
 * `x-forwarded-for` is a client-writable header that each proxy **appends** to,
 * so under one trusted proxy the real peer is the LAST entry and everything to
 * its left is whatever the caller typed. Reading the first entry — which this
 * did until F59 — let anyone rotate the header and get a fresh per-IP budget on
 * every request, which is every per-IP limit in RATE_LIMITS at once.
 *
 * Two assumptions come with the fix, and both are deployment facts rather than
 * code facts:
 *
 *   - **Exactly one trusted hop.** A CDN in front of a load balancer appends
 *     twice, so the last entry is the LB and the learner's address is the
 *     second from the end. That topology needs a hop count, not this function.
 *   - **`LUVANI_TRUST_PROXY=1` with no proxy in front is a misconfiguration.**
 *     There is nothing appending, so the last entry is again attacker-chosen
 *     and the per-IP budget is spoofable. Leave the flag unset unless a proxy
 *     really is terminating the connection; the socket peer is the honest
 *     source in that topology and is what this returns.
 *
 * An IPv6 peer is budgeted by its /64, see `addressBucket`.
 */
export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    // Node folds a repeated header into one string, but the type admits an
    // array; in both shapes the nearest hop is the final entry.
    const chain = (Array.isArray(forwarded) ? forwarded.join(',') : (forwarded ?? ''))
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry.length <= 64);
    const nearestHop = chain.at(-1);
    if (nearestHop) return addressBucket(nearestHop);
  }
  return addressBucket(req.socket.remoteAddress ?? 'unknown');
}

/**
 * One network's share of a per-address budget.
 *
 * A home or mobile network is given a whole IPv6 /64 and picks the low half of
 * each address itself, so a full IPv6 address would let one network rotate into
 * a fresh budget on every request. IPv6 is therefore cut to its /64. IPv4 is
 * returned exactly as given, including an IPv4 address carried inside IPv6 (the
 * mapped `::ffff:0:0/96` form a dual-stack socket reports and the NAT64
 * `64:ff9b::/96` prefix), which would otherwise put every IPv4 learner in one
 * bucket. Anything that is not an address is returned as given.
 */
function addressBucket(address: string): string {
  if (isIP(address) !== 6) return address;
  const bare = address.split('%')[0] ?? address;
  const [head = '', tail] = bare.split('::');
  const groupsOf = (part: string) => (part ? part.split(':') : []);
  // A dotted IPv4 tail fills the last two groups; it never reaches the first four.
  const width = (groups: string[]) => groups.reduce((sum, group) => sum + (group.includes('.') ? 2 : 1), 0);
  const left = groupsOf(head);
  const right = tail === undefined ? [] : groupsOf(tail);
  const groups = [...left, ...Array<string>(tail === undefined ? 0 : 8 - width(left) - width(right)).fill('0'), ...right]
    .map((group) => (group.includes('.') ? group : Number.parseInt(group, 16).toString(16)));
  const zero = (from: number, to: number) => groups.slice(from, to).every((group) => group === '0');
  if (zero(0, 5) && groups[5] === 'ffff') return address;
  if (groups[0] === '64' && groups[1] === 'ff9b' && zero(2, 6)) return address;
  return `${groups.slice(0, 4).join(':')}::/64`;
}

export function installationSignal(req: IncomingMessage): string | null {
  const value = req.headers['x-luvani-installation'];
  if (typeof value !== 'string') return null;
  return /^[a-zA-Z0-9-]{16,80}$/.test(value) ? value : null;
}

export const RATE_LIMITS = {
  heartbeatIp: { name: 'worker-heartbeat-ip', limit: 1000, windowSec: 60 },
  tutorWorkIp: { name: 'tutor-work-ip', limit: 30000, windowSec: 60 },
  tutorWorkUser: { name: 'tutor-work-user', limit: 240, windowSec: 60 },
  phraseAudioIp: { name: 'phrase-audio-ip', limit: 180, windowSec: 86_400 },
  phraseAudioUser: { name: 'phrase-audio-user', limit: 90, windowSec: 86_400 },
  sessionIp: { name: 'session-ip', limit: 30, windowSec: 60 },
  sessionUser: { name: 'session-user', limit: 10, windowSec: 60 },
  sessionInstallation: { name: 'session-installation', limit: 15, windowSec: 60 },
  scoringIp: { name: 'scoring-ip', limit: 600, windowSec: 86_400 },
  scoringUser: { name: 'scoring-user', limit: 300, windowSec: 86_400 },
  scoringInstallation: { name: 'scoring-installation', limit: 360, windowSec: 86_400 },
  eventsIp: { name: 'events-ip', limit: 600, windowSec: 60 },
  eventsUser: { name: 'events-user', limit: 120, windowSec: 60 },
  deletionIp: { name: 'deletion-ip', limit: 20, windowSec: 86_400 },
  deletionUser: { name: 'deletion-user', limit: 3, windowSec: 86_400 },
  exportIp: { name: 'export-ip', limit: 30, windowSec: 86_400 },
  exportUser: { name: 'export-user', limit: 5, windowSec: 86_400 },
  exportPageIp: { name: 'export-page-ip', limit: 1200, windowSec: 60 },
  exportPageUser: { name: 'export-page-user', limit: 240, windowSec: 60 },
  billingReadinessIp: { name: 'billing-readiness-ip', limit: 120, windowSec: 60 },
  billingReadinessUser: { name: 'billing-readiness-user', limit: 30, windowSec: 60 },
  billingWebhookIp: { name: 'billing-webhook-ip', limit: 240, windowSec: 60 },
  billingRefreshIp: { name: 'billing-refresh-ip', limit: 60, windowSec: 60 },
  billingRefreshUser: { name: 'billing-refresh-user', limit: 10, windowSec: 60 },
  billingStatusIp: { name: 'billing-status-ip', limit: 60, windowSec: 60 },
  billingStatusUser: { name: 'billing-status-user', limit: 20, windowSec: 60 },
  debitIp: { name: 'debit-ip', limit: 120, windowSec: 60 },
  debitUser: { name: 'debit-user', limit: 30, windowSec: 60 },
  conversationPackIp: { name: 'conversation-pack-ip', limit: 120, windowSec: 60 },
  conversationPackUser: { name: 'conversation-pack-user', limit: 60, windowSec: 60 },
} as const satisfies Record<string, RateLimitRule>;
