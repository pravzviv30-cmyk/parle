import { randomUUID } from 'node:crypto';
import { GUEST_SCENE_MAX_SECONDS, isConversationPack, isServiceFailure, parseGuestSceneTurnIds, readSessionSettlement, type SettlementResult } from '@luvani/core';
import { canonicalJson, tutorDigest, TutorRpcError, type TutorSessionReport } from '../../shared/tutorLifecycle.ts';

type Operation = 'claim' | 'checkpoint' | 'complete' | 'receipt';
type Row = Record<string, unknown>;
export interface TutorSessionIdentity { userId: string; sessionId: string; roomName: string; mode: 'lesson' | 'lesson-text' | 'convo' | 'convo-text' }
export type RuntimeReport = Omit<TutorSessionReport, 'seconds'> & { firstPracticeComplete?: boolean; firstPracticeStopped?: boolean;
  /** Guest scene rooms only: scene turn ids answered acceptably. Merged, so it never shrinks. */
  sceneTurns?: readonly string[] };
export interface RuntimeLifecycle {
  readonly maxSeconds: number;
  readonly signal: AbortSignal;
  elapsedSeconds(): number;
  freezeBillingCutoff?(): void;
  assertActive(): void;
  checkpoint(report: RuntimeReport, acknowledged?: () => void): Promise<void>;
  complete(report: RuntimeReport): Promise<SettlementResult>;
  onStop(callback: () => void): void;
}
export interface LifecycleOptions {
  /** A signed guest capability hash selects the separate guest lease endpoint. */
  guestKey?: string;
  /** A signed guest scene: needs guestKey and a lesson mode, caps maxSeconds at 180 and reports sceneTurns. */
  scene?: boolean;
  call?: (operation: Operation, payload: Row, signal: AbortSignal) => Promise<Row>;
  request?: typeof fetch;
  tokenServer?: string;
  agentSecret?: string;
  now?: () => number;
  nonce?: string;
  /** Disposable test clocks only. Production always schedules both timers. */
  automaticTimers?: boolean;
  timeoutMs?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STOP_MARGIN_MS = 1_000;
const date = (value: unknown): number => typeof value === 'string' ? Date.parse(value) : NaN;
const integer = (value: unknown, lower: number, upper: number): value is number => Number.isSafeInteger(value) && Number(value) >= lower && Number(value) <= upper;
export class SessionLifecycleError extends Error {
  constructor() { super('authoritative tutor session unavailable'); this.name = 'SessionLifecycleError'; }
}

/** Worker credentials reach only the service endpoints, never Supabase directly. */
function httpCall(options: LifecycleOptions): NonNullable<LifecycleOptions['call']> {
  const base = options.tokenServer ?? process.env.TOKEN_SERVER_URL;
  const secret = options.agentSecret ?? process.env.LUVANI_AGENT_SECRET;
  if (!base || !secret) throw new SessionLifecycleError();
  const url = new URL(base);
  if (url.username || url.password || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new SessionLifecycleError();
  const request = options.request ?? fetch;
  return async (operation, payload, signal) => {
    const response = await request(`${base.replace(/\/+$/, '')}/agent/${options.guestKey ? `guest/${options.guestKey}` : 'tutor'}/${operation}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-luvani-agent': secret },
      body: JSON.stringify(payload), signal, redirect: 'error',
    });
    if (!response.ok) { await response.body?.cancel(); throw new TutorRpcError(response.status); }
    const reader = response.body?.getReader();
    if (!reader) throw new SessionLifecycleError();
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.length;
        if (bytes > 160 * 1024) { await reader.cancel(); throw new SessionLifecycleError(); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SessionLifecycleError();
    return value as Row;
  };
}

/** No provider may be constructed until this claim and its conservative deadlines are accepted. */
export async function claimSessionLifecycle(identity: TutorSessionIdentity, options: LifecycleOptions = {}): Promise<SessionLifecycle> {
  if (!UUID.test(identity.userId) || !UUID.test(identity.sessionId) || !identity.roomName || identity.roomName.length > 128
    || !['lesson', 'lesson-text', 'convo', 'convo-text'].includes(identity.mode)) throw new SessionLifecycleError();
  if (options.scene && (!options.guestKey || !identity.mode.startsWith('lesson'))) throw new SessionLifecycleError();
  const lifecycle = new SessionLifecycle(identity, options);
  await lifecycle.claim();
  return lifecycle;
}

export class SessionLifecycle implements RuntimeLifecycle {
  readonly signal: AbortSignal;
  readonly #abort = new AbortController();
  readonly #identity: TutorSessionIdentity;
  readonly #options: LifecycleOptions;
  readonly #call: NonNullable<LifecycleOptions['call']>;
  readonly #now: () => number;
  readonly #nonce: string;
  #maximum = 0;
  #started = 0;
  #billingCutoff: number | undefined;
  #leaseStop = 0;
  #hardStop = 0;
  #revision = 0;
  #ack: Row = { revision: 0, seconds: 0, learnerTurns: 0, serviceFailure: null, baseline: null };
  #uncertain: Row | undefined;
  #uncertainAcknowledged: (() => void) | undefined;
  #tail: Promise<unknown> = Promise.resolve();
  #completion: Promise<SettlementResult> | undefined;
  #failed = false;
  #closing = false;
  #onStop: (() => void) | undefined;
  #stopTimer: ReturnType<typeof setTimeout> | undefined;
  #heartbeatTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(identity: TutorSessionIdentity, options: LifecycleOptions) {
    this.#identity = { ...identity }; this.#options = options; this.#call = options.call ?? httpCall(options);
    this.#now = options.now ?? (() => performance.now()); this.#nonce = options.nonce ?? randomUUID();
    if (!UUID.test(this.#nonce) || (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0 || options.timeoutMs > 5_000))) throw new SessionLifecycleError();
    this.signal = this.#abort.signal;
    if (options.guestKey) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(options.guestKey)) throw new SessionLifecycleError();
      this.#ack.firstPracticeComplete = false;
      if (options.scene) this.#ack.sceneTurns = [];
    } else if (options.scene) throw new SessionLifecycleError();
  }
  paidIdentity():Readonly<{userId:string;sessionId:string;claimNonce:string}> {this.assertActive();return Object.freeze({userId:this.#identity.userId,sessionId:this.#identity.sessionId,claimNonce:this.#nonce});}
  get maxSeconds(): number { return this.#maximum; }
  freezeBillingCutoff(): void { this.#billingCutoff ??= this.elapsedSeconds(); }
  elapsedSeconds(): number {
    if (this.#billingCutoff !== undefined) return this.#billingCutoff; return Math.min(this.#maximum, Math.max(0, Math.floor((this.#now() - this.#started) / 1_000))); }
  onStop(callback: () => void): void { this.#onStop = callback; if (this.#failed) this.notifyStop(); }
  private notifyStop(): void { try { this.#onStop?.(); } catch { /* A cleanup callback cannot escape a timer. */ } }
  assertActive(): void {
    if (this.#failed || this.#closing || this.#now() >= Math.min(this.#leaseStop, this.#hardStop)) {
      if (!this.#closing) this.fail();
      throw new SessionLifecycleError();
    }
  }
  private stop(): void {
    if (this.#stopTimer) clearTimeout(this.#stopTimer);
    if (this.#heartbeatTimer) clearTimeout(this.#heartbeatTimer);
    this.#stopTimer = this.#heartbeatTimer = undefined;
    this.#abort.abort();
  }
  private fail(): void { if (this.#failed || this.#closing) return; this.#failed = true; this.stop(); this.notifyStop(); }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(work, work); this.#tail = result.catch(() => {}); return result;
  }
  private async invoke(operation: Operation, payload: Row, attempts = 2): Promise<{ result: Row; sent: number; received: number }> {
    // Frozen serialized contents, including explicit nulls, survive every retry.
    const immutable = canonicalJson(payload);
    for (let attempt = 0; attempt < attempts; attempt++) {
      const sent = this.#now();
      const available = operation === 'checkpoint' ? Math.min(this.#leaseStop, this.#hardStop) - sent : Infinity;
      const timeout = Math.min(this.#options.timeoutMs ?? 3_000, available);
      if (timeout <= 0) throw new SessionLifecycleError();
      const controller = new AbortController();
      let rejectStop: (error: unknown) => void = () => {};
      const interrupted = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
      const timer = setTimeout(() => { controller.abort(); rejectStop(new SessionLifecycleError()); }, timeout);
      try {
        const result = await Promise.race([this.#call(operation, JSON.parse(immutable), controller.signal), interrupted]);
        return { result, sent, received: this.#now() };
      } catch (error) {
        if (error instanceof TutorRpcError && error.status < 500 && error.status !== 429) throw error;
        if (attempt + 1 === attempts) throw new SessionLifecycleError();
      } finally { clearTimeout(timer); }
    }
    throw new SessionLifecycleError();
  }
  private deadlines(result: Row, sent: number): void {
    const server = date(result.serverNow), lease = date(result.leaseUntil), hard = date(result.hardDeadline);
    if (!Number.isFinite(server) || !Number.isFinite(lease) || !Number.isFinite(hard) || lease <= server || hard <= server
      || lease > hard || hard - server > this.#maximum * 1_000 + 1_000) throw new SessionLifecycleError();
    const hardStop = sent + hard - server - STOP_MARGIN_MS;
    this.#hardStop = this.#hardStop > 0 ? Math.min(this.#hardStop, hardStop) : hardStop;
    this.#leaseStop = Math.min(sent + lease - server - STOP_MARGIN_MS, this.#hardStop);
    if (this.#now() >= this.#leaseStop) throw new SessionLifecycleError();
    this.schedule();
  }
  private schedule(): void {
    if (this.#options.automaticTimers === false || this.#closing || this.#failed) return;
    if (this.#stopTimer) clearTimeout(this.#stopTimer);
    if (this.#heartbeatTimer) clearTimeout(this.#heartbeatTimer);
    const remaining = Math.min(this.#leaseStop, this.#hardStop) - this.#now();
    this.#stopTimer = setTimeout(() => this.fail(), Math.max(1, remaining)); this.#stopTimer.unref();
    this.#heartbeatTimer = setTimeout(() => { void this.heartbeat().catch(() => {}); }, Math.max(1, Math.min(5_000, remaining / 3)));
    this.#heartbeatTimer.unref();
  }
  async claim(): Promise<void> {
    const { result, sent, received } = await this.invoke('claim', { ...this.#identity, claimNonce: this.#nonce });
    if (result.kind !== 'claimed' || result.version !== 1 || result.sessionId !== this.#identity.sessionId || result.fence !== this.#nonce
      || !integer(result.maxSeconds, 120, this.#options.scene ? GUEST_SCENE_MAX_SECONDS : this.#options.guestKey ? 1260 : 900) || result.checkpointRevision !== 0 || !Number.isFinite(date(result.startedAt))) throw new SessionLifecycleError();
    this.#maximum = result.maxSeconds;
    // Response-end anchoring undercounts network latency rather than reporting
    // elapsed time the database cannot yet have observed.
    this.#started = received + date(result.startedAt) - date(result.serverNow);
    this.deadlines(result, sent);
  }
  private payload(report: RuntimeReport, revision: number): Row {
    if (!integer(report.learnerTurns, Number(this.#ack.learnerTurns), 1_000)
      || (report.serviceFailure !== undefined && !isServiceFailure(report.serviceFailure))) throw new SessionLifecycleError();
    const baseline = report.baseline ?? null;
    if (baseline !== null && (!isConversationPack(baseline) || baseline.state !== 'ready' || baseline.id !== this.#identity.sessionId
      || baseline.sessionId !== this.#identity.sessionId || baseline.learnerId !== this.#identity.userId
      || Buffer.byteLength(canonicalJson(baseline)) > 128 * 1024)) throw new SessionLifecycleError();
    if (this.#identity.mode.startsWith('convo') && report.learnerTurns > 0 && baseline === null) throw new SessionLifecycleError();
    if (this.#ack.baseline !== null && baseline === null) throw new SessionLifecycleError();
    if (this.#ack.serviceFailure !== null && (report.serviceFailure ?? null) !== this.#ack.serviceFailure) throw new SessionLifecycleError();
    // A scene is a lesson: learner turns with a null baseline are its normal shape.
    let sceneTurns: string[] | undefined;
    if (this.#options.scene) {
      const reported = parseGuestSceneTurnIds(report.sceneTurns ?? []);
      const merged = reported && parseGuestSceneTurnIds([...new Set([...(this.#ack.sceneTurns as string[]), ...reported])]);
      if (!merged) throw new SessionLifecycleError();
      sceneTurns = merged;
    }
    return JSON.parse(canonicalJson({ revision, seconds: Math.max(Number(this.#ack.seconds), this.elapsedSeconds()),
      learnerTurns: report.learnerTurns, serviceFailure: report.serviceFailure ?? null, baseline,
      ...(this.#options.guestKey ? { firstPracticeComplete: this.#ack.firstPracticeComplete === true || report.firstPracticeComplete === true } : {}),
      ...(sceneTurns ? { sceneTurns } : {}) }));
  }
  private wire(payload: Row): Row { return { userId: this.#identity.userId, sessionId: this.#identity.sessionId, fence: this.#nonce,
    ...payload, digest: tutorDigest(payload) }; }
  async heartbeat(): Promise<void> {
    return this.enqueue(async () => {
      try { this.assertActive(); await this.sendCheckpoint(this.#ack); }
      catch { this.fail(); throw new SessionLifecycleError(); }
    });
  }
  checkpoint(report: RuntimeReport, acknowledged?: () => void): Promise<void> {
    // Clone before queuing, so a later turn cannot mutate this revision's pack.
    const frozen: RuntimeReport = JSON.parse(canonicalJson(report));
    return this.enqueue(async () => {
      try { this.assertActive(); await this.sendCheckpoint(this.payload(frozen, this.#revision + 1), acknowledged); }
      catch { this.fail(); throw new SessionLifecycleError(); }
    });
  }
  private async sendCheckpoint(payload: Row, acknowledged?: () => void): Promise<void> {
    this.#uncertain = payload; this.#uncertainAcknowledged = acknowledged;
    const { result, sent } = await this.invoke('checkpoint', this.wire(payload));
    if (result.kind !== 'checkpointed' || result.sessionId !== this.#identity.sessionId || result.revision !== payload.revision) throw new SessionLifecycleError();
    this.deadlines(result, sent);
    this.#revision = Number(payload.revision); this.#ack = payload; this.#uncertain = undefined;
    this.#uncertainAcknowledged = undefined; acknowledged?.();
  }
  private settlement(result: Row): SettlementResult | null {
    const receipt = result.receipt;
    if (result.kind !== 'completed' || result.sessionId !== this.#identity.sessionId || !receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return null;
    const row = receipt as Row;
    if (row.version !== 1 || row.sessionId !== this.#identity.sessionId || !integer(row.chargedSeconds, 0, this.#maximum)
      || !integer(row.releasedReservedSeconds, 0, this.#maximum) || !integer(row.checkpointRevision, 0, 10_000)
      || !['settled', 'cancelled', 'expired', 'interrupted'].includes(String(row.state))
      || !['none', 'saved', 'deleted'].includes(String(row.baselineStatus)) || !Number.isFinite(date(row.completedAt))) return null;
    return readSessionSettlement(row.settlement);
  }
  complete(report: RuntimeReport): Promise<SettlementResult> {
    if (this.#completion) return this.#completion;
    const frozen: RuntimeReport = JSON.parse(canonicalJson(report));
    const stoppedSeconds = this.elapsedSeconds();
    this.#closing = true; this.stop();
    this.#completion = this.enqueue(async () => {
      try {
        if (this.#uncertain) {
          // A lost checkpoint ACK can already have advanced SQL. Resolve that
          // revision before constructing one immutable terminal payload.
          const { result } = await this.invoke('receipt', { userId: this.#identity.userId, sessionId: this.#identity.sessionId });
          const settled = this.settlement(result);
          if (settled) {
            const receipt = result.receipt as Row;
            if (receipt.checkpointRevision === this.#uncertain.revision) this.#uncertainAcknowledged?.();
            this.#uncertainAcknowledged = undefined;
            return settled;
          }
          if (result.kind !== 'pending' || result.sessionId !== this.#identity.sessionId) return { kind: 'pending' };
          if (result.revision === this.#uncertain.revision) {
            this.#revision = Number(result.revision); this.#ack = this.#uncertain;
            this.#uncertainAcknowledged?.(); this.#uncertainAcknowledged = undefined;
          }
          else if (result.revision !== this.#revision) return { kind: 'pending' };
        }
        // Finish never promotes tentative state from an interrupted turn. The
        // acknowledged clean checkpoint is the only learning proof; elapsed
        // time and a terminal provider failure can advance independently.
        const failure = frozen.serviceFailure ?? this.#ack.serviceFailure;
        if (failure !== null && !isServiceFailure(failure)) return { kind: 'pending' };
        if (this.#ack.serviceFailure !== null && failure !== this.#ack.serviceFailure) return { kind: 'pending' };
        const payload = { ...this.#ack, revision: this.#revision + 1,
          seconds: Math.max(Number(this.#ack.seconds), stoppedSeconds), serviceFailure: failure,
          ...(this.#options.guestKey && frozen.firstPracticeStopped === true ? {firstPracticeStopped: true} : {}) };
        const immutable = this.wire(payload);
        let result: Row;
        try { result = (await this.invoke('complete', immutable, 3)).result; }
        catch { result = (await this.invoke('receipt', { userId: this.#identity.userId, sessionId: this.#identity.sessionId })).result; }
        const settlement = this.settlement(result);
        if (payload.serviceFailure !== null && settlement?.kind === 'charged') return { kind: 'reconciliation' };
        return settlement ?? { kind: 'pending' };
      } catch { return { kind: 'pending' }; }
    });
    return this.#completion;
  }
}

/** The real worker can opt out only in an explicitly local, nonproduction run. */
export function legacyRuntimeFixture(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== 'production' && env.LUVANI_LOCAL_DEVELOPMENT === '1';
}

/** Registered/connected SDK health, not a promise of spare capacity or latency. */
export function tutorSupervisorHeartbeat(options: {
  port: number; tokenServer?: string; agentSecret?: string; request?: typeof fetch;
  workerId?: string; automaticTimers?: boolean; timeoutMs?: number;
}): { poll(): Promise<boolean>; drain(): Promise<boolean> } {
  const base = options.tokenServer ?? process.env.TOKEN_SERVER_URL;
  const secret = options.agentSecret ?? process.env.LUVANI_AGENT_SECRET;
  const workerId = options.workerId ?? randomUUID();
  if (!base || !secret || !UUID.test(workerId) || !integer(options.port, 1, 65535)) throw new SessionLifecycleError();
  const url = new URL(base);
  if (url.username || url.password || (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) throw new SessionLifecycleError();
  const request = options.request ?? fetch;
  const timeoutMs = options.timeoutMs ?? 2_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 5_000) throw new SessionLifecycleError();
  let draining = false, timer: ReturnType<typeof setTimeout> | undefined;
  let tail: Promise<unknown> = Promise.resolve();
  const bounded = async (target: string, init: RequestInit): Promise<boolean> => {
    const controller = new AbortController();
    let rejectTimeout: (error: unknown) => void = () => {};
    const timeout = new Promise<never>((_resolve, reject) => { rejectTimeout = reject; });
    const stop = setTimeout(() => { controller.abort(); rejectTimeout(new SessionLifecycleError()); }, timeoutMs);
    try {
      const response = await Promise.race([request(target, { ...init, signal: controller.signal, redirect: 'error' }), timeout]);
      void response.body?.cancel().catch(() => {}); return response.ok;
    } catch { return false; }
    finally { clearTimeout(stop); controller.abort(); }
  };
  const poll = (): Promise<boolean> => {
    const result = tail.then(async () => {
      const registered = !draining && await bounded(`http://127.0.0.1:${options.port}/`, { method: 'GET' });
      const ready = registered && !draining;
      const accepted = await bounded(`${base.replace(/\/+$/, '')}/agent/heartbeat`, { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-luvani-agent': secret },
        body: JSON.stringify({ role: 'tutor', workerId, ready }),
      });
      if (options.automaticTimers !== false && !draining) {
        timer = setTimeout(() => { void poll(); }, 10_000); timer.unref();
      }
      return ready && accepted;
    });
    tail = result.catch(() => {}); return result;
  };
  return { poll, drain: () => { draining = true; if (timer) clearTimeout(timer); return poll(); } };
}
