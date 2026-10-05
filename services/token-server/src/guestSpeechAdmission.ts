/**
 * Anonymous guest speech admission.
 *
 * A guest capability is not an account, so it cannot use the authenticated
 * quote and budget boundary in `shared/paidAdmission.ts`. This is its own,
 * smaller boundary with the same shape: seconds are reserved before any
 * transcription, a refusal names the budget that refused, and the reservation
 * settles to what actually reached the vendor and never below it.
 *
 * Four budgets are booked together or not at all: the guest capability's total,
 * and the installation's, the address's and the whole service's for the UTC day.
 * Only counters are kept, under hashed signals. No audio, text, address or
 * installation value is stored here.
 */

export interface GuestSpeechLimits {
  /** Reserved per take: the native capture stops at twenty seconds. */
  attemptSeconds: number;
  /** In total, for one guest capability. */
  guestSeconds: number;
  /** Per installation per UTC day. One capability per installation per day already applies. */
  installationDailySeconds: number;
  /** Per address per UTC day. Five starts per address per day, at the guest total each. */
  addressDailySeconds: number;
  /** For every guest together per UTC day, so a flood cannot run up cost. */
  globalDailySeconds: number;
}

export const GUEST_SPEECH_LIMITS: Readonly<GuestSpeechLimits> = Object.freeze({
  attemptSeconds: 20,
  guestSeconds: 60,
  installationDailySeconds: 60,
  addressDailySeconds: 300,
  globalDailySeconds: 3600,
});

export type GuestSpeechScope = 'guest' | 'installation' | 'address' | 'global';
const SCOPES: readonly GuestSpeechScope[] = ['guest', 'installation', 'address', 'global'];

/** Every key segment is a fixed literal, a UTC day or a 43-character hash. */
export interface GuestSpeechKeys {
  guest: string;
  installation: string;
  address: string;
  global: string;
}

export interface GuestSpeechLedger {
  /** Books `seconds` on all four keys atomically, or refuses with the first full scope. */
  reserve(keys: GuestSpeechKeys, seconds: number, limits: Record<GuestSpeechScope, number>): Promise<GuestSpeechScope | null>;
  /** Moves all four keys by `delta` seconds, never below zero. */
  adjust(keys: GuestSpeechKeys, delta: number): Promise<void>;
  /** Seconds already booked on each key. */
  used(keys: GuestSpeechKeys): Promise<Record<GuestSpeechScope, number>>;
}

const HASH = /^[A-Za-z0-9_-]{43}$/;
const DAY_TTL_SEC = 2 * 86400;

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function guestSpeechKeys(signals: { guest: string; installation: string; address: string }, now: number): GuestSpeechKeys {
  for (const value of [signals.guest, signals.installation, signals.address]) {
    if (!HASH.test(value)) throw new Error('guest speech signals must be hashed');
  }
  const day = utcDay(now);
  return {
    guest: `luvani:guest-speech:guest:${signals.guest}`,
    installation: `luvani:guest-speech:installation:${day}:${signals.installation}`,
    address: `luvani:guest-speech:address:${day}:${signals.address}`,
    global: `luvani:guest-speech:global:${day}`,
  };
}

export class MemoryGuestSpeechLedger implements GuestSpeechLedger {
  private readonly counters = new Map<string, { used: number; expiresAt: number }>();
  private readonly now: () => number;
  constructor(now: () => number = Date.now) {
    this.now = now;
  }
  private read(key: string): number {
    const counter = this.counters.get(key);
    return counter && counter.expiresAt > this.now() ? counter.used : 0;
  }
  // Each method runs to completion without awaiting, so no two reservations interleave.
  async reserve(keys: GuestSpeechKeys, seconds: number, limits: Record<GuestSpeechScope, number>): Promise<GuestSpeechScope | null> {
    const full = SCOPES.find((scope) => this.read(keys[scope]) + seconds > limits[scope]);
    if (full) return full;
    for (const scope of SCOPES) {
      this.counters.set(keys[scope], { used: this.read(keys[scope]) + seconds, expiresAt: this.now() + DAY_TTL_SEC * 1000 });
    }
    return null;
  }
  async adjust(keys: GuestSpeechKeys, delta: number): Promise<void> {
    for (const scope of SCOPES) {
      const counter = this.counters.get(keys[scope]);
      if (counter && counter.expiresAt > this.now()) counter.used = Math.max(0, counter.used + delta);
    }
  }
  async used(keys: GuestSpeechKeys): Promise<Record<GuestSpeechScope, number>> {
    return Object.fromEntries(SCOPES.map((scope) => [scope, this.read(keys[scope])])) as Record<GuestSpeechScope, number>;
  }
}

/** KEYS: guest, installation, address, global. ARGV: seconds, the four limits, ttl. Returns 0 or the full scope's 1-based index. */
export const RESERVE_SCRIPT = [
  'local need = tonumber(ARGV[1])',
  'for i = 1, 4 do',
  "  local used = tonumber(redis.call('GET', KEYS[i]) or '0')",
  '  if used + need > tonumber(ARGV[i + 1]) then return i end',
  'end',
  'for i = 1, 4 do',
  "  redis.call('INCRBY', KEYS[i], need)",
  "  redis.call('EXPIRE', KEYS[i], ARGV[6])",
  'end',
  'return 0',
].join('\n');

/** Moves each existing key by ARGV[1], never below zero. INCRBY keeps the key's TTL. */
export const ADJUST_SCRIPT = [
  'local delta = tonumber(ARGV[1])',
  'for i = 1, #KEYS do',
  "  local used = redis.call('GET', KEYS[i])",
  '  if used then',
  '    local change = delta',
  '    if tonumber(used) + change < 0 then change = -tonumber(used) end',
  "    redis.call('INCRBY', KEYS[i], change)",
  '  end',
  'end',
  'return 1',
].join('\n');

/** Durable and shared across instances, through the same Upstash REST service as the guest store. */
export class RedisGuestSpeechLedger implements GuestSpeechLedger {
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
    if (!response.ok) throw new Error('guest speech ledger unavailable');
    const body = (await response.json()) as { result?: unknown; error?: unknown };
    if (body.error) throw new Error('guest speech ledger unavailable');
    return body.result;
  }
  private ordered(keys: GuestSpeechKeys): string[] {
    return SCOPES.map((scope) => keys[scope]);
  }
  async reserve(keys: GuestSpeechKeys, seconds: number, limits: Record<GuestSpeechScope, number>): Promise<GuestSpeechScope | null> {
    const result = Number(await this.command([
      'EVAL', RESERVE_SCRIPT, '4', ...this.ordered(keys),
      String(seconds), ...SCOPES.map((scope) => String(limits[scope])), String(DAY_TTL_SEC),
    ]));
    if (result === 0) return null;
    const scope = SCOPES[result - 1];
    if (!scope) throw new Error('guest speech ledger returned an invalid decision');
    return scope;
  }
  async adjust(keys: GuestSpeechKeys, delta: number): Promise<void> {
    if (!Number.isSafeInteger(delta) || delta === 0) return;
    await this.command(['EVAL', ADJUST_SCRIPT, '4', ...this.ordered(keys), String(delta)]);
  }
  async used(keys: GuestSpeechKeys): Promise<Record<GuestSpeechScope, number>> {
    const values = await this.command(['MGET', ...this.ordered(keys)]);
    if (!Array.isArray(values) || values.length !== SCOPES.length) throw new Error('guest speech ledger returned an invalid read');
    return Object.fromEntries(SCOPES.map((scope, i) => {
      const used = values[i] === null ? 0 : Number(values[i]);
      if (!Number.isSafeInteger(used) || used < 0) throw new Error('guest speech ledger returned an invalid read');
      return [scope, used];
    })) as Record<GuestSpeechScope, number>;
  }
}

/** Proof that seconds were booked. Settle exactly once; later settles are ignored. */
export interface GuestSpeechReservation {
  readonly seconds: number;
  settle(usedSeconds: number): Promise<void>;
}

export type GuestSpeechDecision =
  | { kind: 'reserved'; reservation: GuestSpeechReservation }
  | { kind: 'refused'; reason: `${GuestSpeechScope}-budget` };

interface Live { seconds: number; claimed: boolean }
const issued = new WeakMap<GuestSpeechReservation, Live>();

/**
 * The one transcription a reservation pays for. A reservation that this module
 * did not issue, or one already claimed, returns null and must send nothing.
 */
export function claimGuestSpeech(reservation: GuestSpeechReservation): number | null {
  const live = issued.get(reservation);
  if (!live || live.claimed) return null;
  live.claimed = true;
  return live.seconds;
}

export function guestSpeechAdmission(ledger: GuestSpeechLedger, limits: Readonly<GuestSpeechLimits> = GUEST_SPEECH_LIMITS) {
  const caps: Record<GuestSpeechScope, number> = {
    guest: limits.guestSeconds,
    installation: limits.installationDailySeconds,
    address: limits.addressDailySeconds,
    global: limits.globalDailySeconds,
  };
  return {
    /** Books one take's worth of seconds on all four budgets before any audio is read or sent. */
    async reserve(signals: { guest: string; installation: string; address: string }, now = Date.now()): Promise<GuestSpeechDecision> {
      const keys = guestSpeechKeys(signals, now);
      const seconds = limits.attemptSeconds;
      const full = await ledger.reserve(keys, seconds, caps);
      if (full) return { kind: 'refused', reason: `${full}-budget` };
      let settled = false;
      const reservation: GuestSpeechReservation = Object.freeze({
        seconds,
        async settle(usedSeconds: number) {
          if (settled) return;
          settled = true;
          // Unknown use keeps the whole reservation. Known use is rounded up, so a
          // settlement can return what was not sent but never less than what was.
          const spent = Number.isFinite(usedSeconds) ? Math.max(0, Math.ceil(usedSeconds)) : seconds;
          try { await ledger.adjust(keys, spent - seconds); } catch { /* An unreturned reservation only errs towards less speech. */ }
        },
      });
      issued.set(reservation, { seconds, claimed: false });
      return { kind: 'reserved', reservation };
    },
    /** Whether a fresh guest from this installation and address could take one turn now. Reads only. */
    async open(signals: { guest: string; installation: string; address: string }, now = Date.now()): Promise<boolean> {
      const used = await ledger.used(guestSpeechKeys(signals, now));
      return SCOPES.every((scope) => used[scope] + limits.attemptSeconds <= caps[scope]);
    },
  };
}

export type GuestSpeechAdmission = ReturnType<typeof guestSpeechAdmission>;
