/**
 * The live voice-lifecycle proof (F65).
 *
 * Everything else in the phase-1 security work is blocked on a credential. This
 * one is not: LiveKit, Deepgram, ElevenLabs and OpenAI all answer from this
 * machine today, so the session lifecycle can be *measured* rather than
 * asserted about.
 *
 * What it refuses to do is measure somebody else's process. Stale dev servers
 * on this machine have produced green runs against code that was not the code
 * under test, so this harness opens every port it talks to:
 *
 *   - its own `livekit-server` on a random port with its own API key pair,
 *     which also means the forged-identity tokens below are signed with a
 *     secret that exists for the duration of one run;
 *   - its own token server on a random port with `ENTITLEMENT_STORE_PATH`
 *     pointing at a temp file it seeds and reads back;
 *   - its own tutor-agent worker, pointed at both of the above.
 *
 * If it finds a tutor-agent worker it did not start, it refuses, because a
 * second worker registered against the same LiveKit is a coin toss over which
 * process serves the room and which token server gets the debit.
 *
 * Run it:
 *   node --experimental-strip-types services/tutor-agent/src/verify/voiceLifecycle.ts
 *   node --experimental-strip-types services/tutor-agent/src/verify/voiceLifecycle.ts --agent none
 *
 * Two kinds of check live here and the difference is deliberate. An `assert`
 * check states what Parle promises and fails the run when the promise breaks.
 * A `record` check measures something LiveKit decides — how a rejoin inside the
 * token TTL is treated, how long an empty room holds a waiting agent — and
 * prints the number without pretending we chose it. Anything ugly a `record`
 * check turns up becomes a ledger entry, not a silently relaxed assertion.
 *
 * Nothing in this file prints a key, a secret, or a signed token.
 */

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createTcpServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AccessToken, RoomConfiguration, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { Room, RoomEvent, dispose } from '@livekit/rtc-node';
import {
  DEFAULT_COST_MODEL,
  MIN_VIABLE_SESSION_SEC,
  PLANS,
  decodeServerMessage,
  TOPIC_SERVER,
  type CostModel,
  type Entitlement,
} from '@parle/core';

// ---------------------------------------------------------------------------
// The inventory
// ---------------------------------------------------------------------------

/** What a check cannot run without. */
export type CheckNeeds = 'token-server' | 'livekit' | 'agent';

/**
 * `assert` — Parle's own promise. A wrong answer fails the run.
 * `record` — LiveKit's behaviour. The number is printed, never asserted.
 */
export type CheckKind = 'assert' | 'record';

export interface LifecycleCheck {
  id: string;
  /** One plain sentence: what this check would catch if it broke. */
  title: string;
  needs: CheckNeeds;
  kind: CheckKind;
}

export const LIFECYCLE_CHECKS: readonly LifecycleCheck[] = [
  {
    id: 'insecure-livekit-url-refused-in-production',
    title: 'a production boot with a ws:// LiveKit URL is refused, and the same boot on wss:// is not',
    needs: 'token-server',
    kind: 'assert',
  },
  {
    id: 'join-token-expiry',
    title: 'a join credential is minted with a five minute ttl and LiveKit refuses it once it has expired',
    needs: 'livekit',
    kind: 'assert',
  },
  {
    id: 'room-participant-cap',
    title: 'the room caps at two participants, so a third forged identity cannot join a learner and their tutor',
    needs: 'livekit',
    kind: 'assert',
  },
  {
    id: 'concurrent-session-start-conflict',
    title: 'two concurrent session starts for one learner return exactly one grant and one 409',
    needs: 'token-server',
    kind: 'assert',
  },
  {
    id: 'lease-released-after-debit',
    title: 'the active-session lease is released by the debit, so the next session starts',
    needs: 'token-server',
    kind: 'assert',
  },
  {
    id: 'agent-secret-guards-the-debit',
    title: 'a debit without the shared agent secret is refused',
    needs: 'token-server',
    kind: 'assert',
  },
  {
    id: 'used-room-debits-exactly-once',
    title: 'a used room debits exactly once in the store file, however many times the end is replayed',
    needs: 'livekit',
    kind: 'assert',
  },
  {
    id: 'never-joined-room-debits-nothing',
    title: 'a grant nobody joins holds no room and debits zero seconds',
    needs: 'livekit',
    kind: 'assert',
  },
  {
    id: 'learner-departure-closes-the-room',
    title: 'the room disappears from listRooms after the learner leaves, which is the vendor-cost boundary',
    needs: 'livekit',
    kind: 'assert',
  },
  {
    id: 'hard-stop-closes-a-live-session',
    title: 'a seeded near-exhausted allowance stops a live session on the clock and closes the room',
    needs: 'agent',
    kind: 'assert',
  },
  {
    id: 'unusable-room-is-not-charged',
    title: 'a room the learner never took a turn in reaches the store with zero seconds debited',
    needs: 'agent',
    kind: 'assert',
  },
  {
    id: 'bearer-token-rejoin-inside-ttl',
    title: 'what LiveKit does when a still-valid join token is presented again after the room closed',
    needs: 'livekit',
    kind: 'record',
  },
  {
    id: 'empty-room-holds-the-agent',
    title: 'how long an empty room holds a waiting tutor before LiveKit closes it',
    needs: 'agent',
    kind: 'record',
  },
] as const;

/**
 * Vendor error strings are not safe to print.
 *
 * LiveKit's rejection for an expired credential quotes the whole credential
 * back — `invalid token: eyJhbGciOi...` — so a harness that prints the reason a
 * join was refused prints a signed token with it. Everything this file reports
 * goes through here first.
 */
export function redactCredentials(text: string): string {
  return text
    .replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g, '<redacted signed token>')
    .replace(/\beyJ[A-Za-z0-9_-]{20,}/g, '<redacted signed token>');
}

export type CheckStatus = 'pass' | 'fail' | 'skipped' | 'recorded';

export interface CheckResult {
  id: string;
  status: CheckStatus;
  /** Wall clock spent inside the check. */
  ms: number;
  /** What was actually observed. Never a credential. */
  detail: string;
}

export interface RunSummary {
  ok: boolean;
  /** One line per reason the run is not clean. Empty when ok. */
  reasons: string[];
  passed: number;
  recorded: number;
  failed: number;
  skipped: number;
}

/**
 * The honesty rule, in one function.
 *
 * A check that did not run is not a check that passed. A run is clean only when
 * every id in the inventory reported, no assertion failed, and nothing was
 * skipped — which is what stops "we ran out of time" from reading as green. It
 * also refuses the quieter lie: an `assert` check that came back with a
 * measurement instead of a verdict.
 */
export function summariseRun(results: readonly CheckResult[]): RunSummary {
  const reasons: string[] = [];
  const byId = new Map<string, CheckResult[]>();
  for (const result of results) {
    const bucket = byId.get(result.id);
    if (bucket) bucket.push(result);
    else byId.set(result.id, [result]);
  }

  let passed = 0;
  let recorded = 0;
  let failed = 0;
  let skipped = 0;

  for (const check of LIFECYCLE_CHECKS) {
    const reported = byId.get(check.id) ?? [];
    if (reported.length === 0) {
      reasons.push(`${check.id} never ran`);
      skipped += 1;
      continue;
    }
    if (reported.length > 1) reasons.push(`${check.id} reported ${reported.length} times`);
    const result = reported[0]!;
    if (result.status === 'skipped') {
      reasons.push(`${check.id} was skipped: ${result.detail}`);
      skipped += 1;
      continue;
    }
    if (result.status === 'fail') {
      reasons.push(`${check.id} failed: ${result.detail}`);
      failed += 1;
      continue;
    }
    if (check.kind === 'assert' && result.status !== 'pass') {
      reasons.push(`${check.id} is an assertion and reported "${result.status}" instead of a verdict`);
      failed += 1;
      continue;
    }
    if (check.kind === 'record' && result.status !== 'recorded') {
      reasons.push(`${check.id} is a measurement and must not claim "${result.status}"`);
      failed += 1;
      continue;
    }
    if (result.status === 'pass') passed += 1;
    else recorded += 1;
  }

  for (const id of byId.keys()) {
    if (!LIFECYCLE_CHECKS.some((check) => check.id === id)) reasons.push(`${id} is not in the inventory`);
  }

  return { ok: reasons.length === 0, reasons, passed, recorded, failed, skipped };
}

// ---------------------------------------------------------------------------
// Seeding the hard stop
// ---------------------------------------------------------------------------

/**
 * The ceiling in agent.ts:155 — `Math.min(15 * 60, allowanceRemaining)`.
 * Pinned there by serverSecurityContract.test.ts and re-checked from this
 * harness's own test, because a harness that seeds against a stale constant
 * measures the wrong timer.
 */
export const HARD_STOP_CEILING_SEC = 15 * 60;

/** Live seconds a run may spend with a tutor attached. Vendors bill these. */
export const LIVE_BUDGET_SEC = 90;

/**
 * Seconds the room needs after the hard stop fires to publish the summary,
 * debit, and disconnect. Kept out of the seeded allowance so the whole
 * scenario lands inside the budget.
 */
const HARD_STOP_TEARDOWN_SEC = 25;

/** Short enough to measure in one run, long enough that an early close is a bug. */
const HARD_STOP_FLOOR_SEC = 60;

export interface HardStopSeed {
  /** Seconds to sign into the join metadata as `secondsRemaining`. */
  allowanceSec: number;
  /** What agent.ts will compute from it. This is the timer being measured. */
  maximumSessionSec: number;
}

/**
 * An allowance small enough that the real hard stop fires inside one run.
 *
 * It cannot come from `/session/start`: `canStartSession` refuses anything
 * under MIN_VIABLE_SESSION_SEC (120), on the good grounds that a session which
 * dies mid-sentence is worse than being told up front. So the shortest hard
 * stop a *granted* session can have is two minutes, and to measure the timer
 * itself inside a ninety second budget the harness signs the metadata directly
 * with the run's own API secret — the same forging it already does for the
 * participant-cap check. The floor is recorded either way; see
 * `grantedHardStopFloorSec`.
 */
export function seedForHardStop(budgetSec: number = LIVE_BUDGET_SEC): HardStopSeed {
  const headroom = Math.floor(budgetSec) - HARD_STOP_TEARDOWN_SEC;
  const allowanceSec = Math.max(1, Math.min(HARD_STOP_FLOOR_SEC, headroom));
  return { allowanceSec, maximumSessionSec: Math.min(HARD_STOP_CEILING_SEC, allowanceSec) };
}

/** The shortest hard stop a real `/session/start` grant can carry. */
export function grantedHardStopFloorSec(): number {
  return Math.min(HARD_STOP_CEILING_SEC, MIN_VIABLE_SESSION_SEC);
}

// ---------------------------------------------------------------------------
// The vendor-cost record
// ---------------------------------------------------------------------------

export interface SpendInput {
  /** Room seconds with a tutor attached. These are the seconds vendors bill. */
  agentRoomSec: number;
  /** Room seconds with only this harness's synthetic learner in them. */
  learnerOnlyRoomSec: number;
  /** 'self-hosted' costs nothing; 'cloud' is priced as an estimate and said to be one. */
  transport: 'self-hosted' | 'cloud';
  /** How many worker processes ran their vendor reachability probe at boot. */
  vendorProbes: number;
  costs?: CostModel;
}

export interface SpendEstimate {
  usd: number;
  lines: string[];
}

/** LiveKit Cloud connection minutes. An estimate, and labelled as one. */
const CLOUD_TRANSPORT_USD_PER_PARTICIPANT_MIN = 0.0005;

/** One reachability call per worker process: a handful of tokens against each vendor. */
const VENDOR_PROBE_USD = 0.0004;

/**
 * An upper bound, not a bill.
 *
 * It prices every agent-attended second at the full cascaded rate — recogniser,
 * brain and voice — which is what a session with a learner actually talking
 * costs. This harness never publishes audio and runs the tutor voiceless by
 * default, so the true spend is well under the number printed. A ceiling is the
 * useful thing to record: it is the figure that would appear if the run were a
 * real lesson, and it is the figure a cost budget has to survive.
 */
export function estimateVendorSpend(input: SpendInput): SpendEstimate {
  const costs = input.costs ?? DEFAULT_COST_MODEL;
  const agentMin = Math.max(0, input.agentRoomSec) / 60;
  const learnerMin = Math.max(0, input.learnerOnlyRoomSec) / 60;
  const pipeline = agentMin * (costs.sttPerMin + costs.llmPerMin + costs.ttsPerMin * costs.tutorSpeakingShare);
  const transportRate = input.transport === 'cloud' ? CLOUD_TRANSPORT_USD_PER_PARTICIPANT_MIN : 0;
  // Two participants in an agent room, one in a learner-only room.
  const transport = transportRate * (agentMin * 2 + learnerMin);
  const probes = Math.max(0, input.vendorProbes) * VENDOR_PROBE_USD;
  const usd = pipeline + transport + probes;
  return {
    usd,
    lines: [
      `tutor-attended room seconds: ${input.agentRoomSec.toFixed(1)}s (modelled ceiling $${pipeline.toFixed(4)})`,
      `learner-only room seconds:   ${input.learnerOnlyRoomSec.toFixed(1)}s`,
      `transport:                   ${input.transport}${input.transport === 'self-hosted' ? ' ($0.0000)' : ` (estimated $${transport.toFixed(4)})`}`,
      `worker vendor probes:        ${input.vendorProbes} ($${probes.toFixed(4)})`,
      `estimated vendor spend:      $${usd.toFixed(4)} (upper bound: prices every attended second as a full spoken minute)`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface HarnessOptions {
  /** 'spawn' runs this harness's own tutor worker; 'none' skips the agent checks. */
  agent: 'spawn' | 'none';
  /** 'spawn' runs this harness's own livekit-server; 'env' uses LIVEKIT_URL. */
  transport: 'spawn' | 'env';
  /** Run the tutor voiceless (near-zero vendor spend) or with the full audio pipeline. */
  mode: 'lesson-text' | 'lesson';
  /** Proceed even when another tutor worker is already registered. Lies are possible. */
  allowForeignAgent: boolean;
  budgetSec: number;
}

export function parseOptions(argv: readonly string[]): HarnessOptions {
  const value = (name: string): string | undefined => {
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (inline) return inline.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    if (index >= 0 && argv[index + 1] && !argv[index + 1]!.startsWith('--')) return argv[index + 1];
    return undefined;
  };
  const budget = Number(value('budget'));
  return {
    agent: value('agent') === 'none' ? 'none' : 'spawn',
    transport: value('transport') === 'env' ? 'env' : 'spawn',
    mode: value('mode') === 'lesson' ? 'lesson' : 'lesson-text',
    allowForeignAgent: argv.includes('--allow-foreign-agent'),
    budgetSec: Number.isFinite(budget) && budget > 0 ? budget : LIVE_BUDGET_SEC,
  };
}

// ---------------------------------------------------------------------------
// Process and port plumbing
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..');
const TOKEN_SERVER_DIR = join(REPO_ROOT, 'services', 'token-server');
const TUTOR_AGENT_DIR = join(REPO_ROOT, 'services', 'tutor-agent');

/** A pid and command line for every tutor worker already running on this box. */
export function foreignAgentWorkers(psOutput: string, ownPids: readonly number[] = []): string[] {
  const found: string[] = [];
  for (const line of psOutput.split('\n')) {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (!match) continue;
    const pid = Number(match[1]);
    const command = match[2]!;
    if (!/tutor-agent[/\\]src[/\\]agent\.ts|(?:^|\s)src[/\\]agent\.ts(?:\s|$)/.test(command)) continue;
    if (ownPids.includes(pid)) continue;
    found.push(`pid ${pid}`);
  }
  return found;
}

/**
 * Whether a worker this harness did not start can steal this run's rooms.
 *
 * Only when the run shares a LiveKit with it. Automatic dispatch is per-server:
 * a worker registered against the developer's `livekit-server --dev` cannot see
 * a room on the private server this harness starts with its own key pair, so
 * the usual answer here is "no, carry on" — and that isolation is the reason
 * `--transport spawn` is the default rather than a convenience.
 */
export function refuseForeignWorker(
  options: Pick<HarnessOptions, 'agent' | 'transport' | 'allowForeignAgent'>,
  foreign: readonly string[],
): string | null {
  if (foreign.length === 0) return null;
  if (options.agent === 'none') return null;
  if (options.transport === 'spawn') return null;
  if (options.allowForeignAgent) return null;
  return (
    `a tutor worker this harness did not start is registered against the shared LiveKit (${foreign.join(', ')}). ` +
    'Two workers on one server is a coin toss over which one serves the room and which token server gets the debit, ' +
    'so a green run would not mean anything. Stop the dev stack, drop --transport env, or pass --allow-foreign-agent.'
  );
}

function freePort(): Promise<number> {
  return new Promise((ok, no) => {
    const probe = createTcpServer();
    probe.once('error', no);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => (port > 0 ? ok(port) : no(new Error('could not reserve a port'))));
    });
  });
}

const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

async function waitForHttp(url: string, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (response.status < 500) return;
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.name : 'network error';
    }
    await sleep(150);
  }
  throw new Error(`${label} did not come up within ${timeoutMs}ms (${lastError})`);
}

interface Spawned {
  child: ChildProcess;
  log: string[];
}

function spawnLogged(command: string, args: readonly string[], options: { cwd: string; env: NodeJS.ProcessEnv }): Spawned {
  const child = spawn(command, [...args], { cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const log: string[] = [];
  const keep = (chunk: Buffer): void => {
    for (const line of chunk.toString('utf8').split('\n')) if (line.trim()) log.push(line);
    while (log.length > 400) log.shift();
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  return { child, log };
}

async function stop(spawned: Spawned | null): Promise<void> {
  if (!spawned || spawned.child.exitCode !== null || spawned.child.killed) return;
  spawned.child.kill('SIGTERM');
  for (let i = 0; i < 40 && spawned.child.exitCode === null; i += 1) await sleep(50);
  if (spawned.child.exitCode === null) spawned.child.kill('SIGKILL');
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

interface RoomWindow {
  name: string;
  openedAt: number;
  closedAt: number;
  agentAttended: boolean;
}

interface Live {
  options: HarnessOptions;
  wsUrl: string;
  httpUrl: string;
  apiKey: string;
  apiSecret: string;
  tokenServer: string;
  agentSecret: string;
  storePath: string;
  rooms: RoomServiceClient;
  windows: RoomWindow[];
  records: string[];
}

function readStore(path: string): Record<string, Entitlement> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, Entitlement>) : {};
  } catch {
    return {};
  }
}

/**
 * A join credential minted by this run, for this run's LiveKit.
 *
 * The identity and the metadata are both arguments, which is the point: the
 * participant-cap check needs a second and third identity for a room that was
 * granted to one learner, and the hard-stop check needs an allowance smaller
 * than any real grant can carry. Both are forgeries against a key pair that
 * exists for one run and never leaves this process.
 */
async function mintToken(
  live: Live,
  opts: { identity: string; room: string; ttlSeconds: number; metadata?: object; roomConfig?: boolean },
): Promise<string> {
  const at = new AccessToken(live.apiKey, live.apiSecret, {
    identity: opts.identity,
    ttl: opts.ttlSeconds,
    ...(opts.metadata ? { metadata: JSON.stringify(opts.metadata) } : {}),
  });
  at.addGrant({
    room: opts.room,
    roomJoin: true,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canSubscribe: true,
    canPublishData: true,
  });
  if (opts.roomConfig !== false) {
    at.roomConfig = new RoomConfiguration({
      name: opts.room,
      maxParticipants: 2,
      emptyTimeout: 30,
      departureTimeout: 20,
    });
  }
  return at.toJwt();
}

/** Seconds until a token expires, read from the JWT payload. Never logs the token. */
export function ttlSecondsOf(token: string, nowMs: number = Date.now()): number {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('not a signed token');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number; nbf?: number };
  if (typeof claims.exp !== 'number') throw new Error('token carries no expiry');
  return Math.round(claims.exp - nowMs / 1_000);
}

async function connectRoom(live: Live, token: string, name: string, agentAttended = false): Promise<{ room: Room; window: RoomWindow }> {
  const room = new Room();
  await room.connect(live.wsUrl, token, { autoSubscribe: true, dynacast: false });
  const window: RoomWindow = { name, openedAt: Date.now(), closedAt: 0, agentAttended };
  live.windows.push(window);
  return { room, window };
}

async function leaveRoom(room: Room, window: RoomWindow): Promise<void> {
  if (window.closedAt === 0) window.closedAt = Date.now();
  try {
    if (room.isConnected) await room.disconnect();
  } catch {
    // A room that already went away is the outcome we wanted anyway.
  }
}

/** Poll listRooms until the named room is gone. Returns the wall-clock seconds. */
async function secondsUntilRoomGone(live: Live, name: string, timeoutMs: number): Promise<number | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const rooms = await live.rooms.listRooms([name]);
    if (rooms.length === 0) return (Date.now() - startedAt) / 1_000;
    await sleep(500);
  }
  return null;
}

async function startSession(
  live: Live,
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${live.tokenServer}/session/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body: parsed };
}

async function endSession(
  live: Live,
  body: Record<string, unknown>,
  secret: string | null = live.agentSecret,
): Promise<number> {
  const response = await fetch(`${live.tokenServer}/session/end`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret === null ? {} : { 'x-parle-agent': secret }) },
    body: JSON.stringify(body),
  });
  await response.text();
  return response.status;
}

/** The one way a measurement reaches the output, redaction included. */
function note(live: Live, line: string): void {
  live.records.push(redactCredentials(line));
}

type Check = () => Promise<CheckResult>;

function timed(id: string, run: () => Promise<Omit<CheckResult, 'id' | 'ms'>>): Check {
  return async () => {
    const startedAt = Date.now();
    try {
      const outcome = await run();
      return { id, ms: Date.now() - startedAt, ...outcome, detail: redactCredentials(outcome.detail) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { id, ms: Date.now() - startedAt, status: 'fail', detail: redactCredentials(message) };
    }
  };
}

// --- the checks -------------------------------------------------------------

/**
 * Boot the token server twice under production rules, once on ws:// and once on
 * wss://, and read the refusal it prints. The rest of the production
 * configuration is deliberately left incomplete: both boots fail, and the
 * difference between the two refusal lists is the proof.
 */
function checkInsecureUrlRefused(live: Live): Check {
  return timed('insecure-livekit-url-refused-in-production', async () => {
    const bootRefusal = async (url: string): Promise<string> => {
      const port = await freePort();
      const spawned = spawnLogged('node', ['--experimental-strip-types', 'src/server.ts'], {
        cwd: TOKEN_SERVER_DIR,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PARLE_LOCAL_DEVELOPMENT: '0',
          PORT: String(port),
          LIVEKIT_URL: url,
          LIVEKIT_API_KEY: live.apiKey,
          LIVEKIT_API_SECRET: live.apiSecret,
          // Guarantees at least one other problem, so both boots exit fast and
          // the only thing that differs between them is the transport line.
          PARLE_ALLOWED_ORIGINS: '',
        },
      });
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline && spawned.child.exitCode === null) await sleep(100);
      await stop(spawned);
      return spawned.log.join('\n');
    };

    const insecure = await bootRefusal(live.wsUrl);
    const secure = await bootRefusal('wss://parle-verify.invalid');
    const marker = /secure WSS LiveKit URL/;
    if (!marker.test(insecure)) {
      return { status: 'fail', detail: `a ws:// production boot was not refused for its transport: ${insecure.slice(-200)}` };
    }
    if (marker.test(secure)) {
      return { status: 'fail', detail: 'a wss:// production boot was still refused for its transport' };
    }
    return {
      status: 'pass',
      detail: 'production boot names "secure WSS LiveKit URL" on ws:// and drops that problem on wss://',
    };
  });
}

/**
 * Two separate questions, because the first answer surprised this harness.
 *
 * Parle's question is whether a captured join credential stops working. LiveKit's
 * question is *when*, and the answer is not "at `exp`": the server validates the
 * claim with leeway, so a credential a few seconds past its expiry still opens a
 * room. The assertion is on the property that matters — a credential replayed
 * well after its five minute life is refused — and the slack is measured with a
 * ladder of back-dated tokens and written down rather than assumed.
 */
function checkJoinTokenExpiry(live: Live): Check {
  return timed('join-token-expiry', async () => {
    const granted = await startSession(live, { userId: `verify-ttl-${randomUUID()}`, lessonId: 'cafe-01', mode: 'lesson-text' });
    if (granted.status !== 200) return { status: 'fail', detail: `session start returned ${granted.status}` };
    const defaultTtl = ttlSecondsOf(String(granted.body.token));
    if (defaultTtl < 280 || defaultTtl > 320) {
      return { status: 'fail', detail: `a server grant should live five minutes; this one lives ${defaultTtl}s` };
    }

    const roomName = `parle-verify-ttl-${randomBytes(4).toString('hex')}`;
    const ladder = [3, 30, 90, 900];
    const accepted: number[] = [];
    const refused: number[] = [];
    let lastRefusal = '';
    for (const secondsPastExpiry of ladder) {
      const stale = await mintToken(live, { identity: 'verify-learner', room: roomName, ttlSeconds: -secondsPastExpiry });
      const attempt = new Room();
      try {
        await attempt.connect(live.wsUrl, stale, { autoSubscribe: false, dynacast: false });
        accepted.push(secondsPastExpiry);
        const window: RoomWindow = { name: roomName, openedAt: Date.now(), closedAt: 0, agentAttended: false };
        live.windows.push(window);
        await attempt.disconnect();
        window.closedAt = Date.now();
      } catch (error) {
        refused.push(secondsPastExpiry);
        lastRefusal = error instanceof Error ? error.message : String(error);
      }
    }
    await live.rooms.deleteRoom(roomName).catch(() => undefined);

    // A control, so a refusal above cannot be the server simply being unwell.
    const control = await mintToken(live, { identity: 'verify-learner', room: roomName, ttlSeconds: 60 });
    const opened = await connectRoom(live, control, roomName);
    await leaveRoom(opened.room, opened.window);
    await live.rooms.deleteRoom(roomName).catch(() => undefined);

    const firstRefused = refused.length > 0 ? Math.min(...refused) : null;
    note(
      live,
      `join-token-expiry: LiveKit accepted credentials ${accepted.length > 0 ? accepted.join('s, ') + 's' : 'never'} past ` +
        `expiry and refused ${refused.length > 0 ? refused.join('s, ') + 's' : 'none'} past it, so the server validates exp ` +
        `with roughly ${firstRefused === null ? 'unbounded' : `${firstRefused}s`} of leeway. ` +
        'The five minute ttl in tokens.ts is therefore a floor on the replay window, not a ceiling. ' +
        'LiveKit answers an expired credential with a 401 that quotes the whole credential back, which is why every ' +
        'string this harness prints goes through redactCredentials first.',
    );

    if (!refused.includes(900)) {
      return { status: 'fail', detail: 'LiveKit accepted a credential fifteen minutes past its expiry' };
    }
    return {
      status: 'pass',
      detail:
        `server grants live ${defaultTtl}s; a credential ${firstRefused}s past expiry is refused ("${lastRefusal}") ` +
        'and a fresh one for the same room is not',
    };
  });
}

function checkParticipantCap(live: Live): Check {
  return timed('room-participant-cap', async () => {
    const userId = `verify-cap-${randomUUID()}`;
    const granted = await startSession(live, { userId, lessonId: 'cafe-01', mode: 'lesson-text' });
    if (granted.status !== 200) return { status: 'fail', detail: `session start returned ${granted.status}` };
    const roomName = String(granted.body.roomName);

    const learner = await connectRoom(live, String(granted.body.token), roomName);
    const second = await connectRoom(
      live,
      await mintToken(live, { identity: 'verify-second-identity', room: roomName, ttlSeconds: 120 }),
      roomName,
    );
    const onServer = await live.rooms.listRooms([roomName]);
    const cap = onServer[0]?.maxParticipants;
    let thirdRefused = '';
    const third = new Room();
    try {
      await third.connect(
        live.wsUrl,
        await mintToken(live, { identity: 'verify-third-identity', room: roomName, ttlSeconds: 120 }),
        { autoSubscribe: false, dynacast: false },
      );
      await third.disconnect();
      await leaveRoom(learner.room, learner.window);
      await leaveRoom(second.room, second.window);
      return { status: 'fail', detail: 'a third identity joined a room configured for two' };
    } catch (error) {
      thirdRefused = error instanceof Error ? error.message : String(error);
    }
    await leaveRoom(learner.room, learner.window);
    await leaveRoom(second.room, second.window);
    await endSession(live, { userId, sessionId: granted.body.sessionId, seconds: 0, utterancesScored: 0 });

    if (cap !== 2) return { status: 'fail', detail: `the room reports maxParticipants=${String(cap)}, not 2` };
    return { status: 'pass', detail: `maxParticipants=2 held: a forged third identity was refused ("${thirdRefused}")` };
  });
}

function checkConcurrentStart(live: Live, held: { sessionId: string; userId: string }): Check {
  return timed('concurrent-session-start-conflict', async () => {
    const userId = `verify-lease-${randomUUID()}`;
    const body = { userId, lessonId: 'cafe-01', mode: 'lesson-text' };
    const [a, b] = await Promise.all([startSession(live, body), startSession(live, body)]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    if (statuses[0] !== 200 || statuses[1] !== 409) {
      return { status: 'fail', detail: `two concurrent starts returned ${statuses.join(' and ')}, not 200 and 409` };
    }
    const winner = a.status === 200 ? a : b;
    held.sessionId = String(winner.body.sessionId);
    held.userId = userId;
    return { status: 'pass', detail: 'one grant, one 409 from the active-session lease' };
  });
}

function checkLeaseReleased(live: Live, held: { sessionId: string; userId: string }): Check {
  return timed('lease-released-after-debit', async () => {
    if (!held.sessionId) return { status: 'fail', detail: 'the lease check did not leave a held session to release' };
    const blocked = await startSession(live, { userId: held.userId, lessonId: 'cafe-01', mode: 'lesson-text' });
    if (blocked.status !== 409) return { status: 'fail', detail: `a held lease returned ${blocked.status}, not 409` };
    const debit = await endSession(live, { userId: held.userId, sessionId: held.sessionId, seconds: 0, utterancesScored: 0 });
    if (debit !== 200) return { status: 'fail', detail: `the debit returned ${debit}` };
    const after = await startSession(live, { userId: held.userId, lessonId: 'cafe-01', mode: 'lesson-text' });
    if (after.status !== 200) return { status: 'fail', detail: `the next start returned ${after.status} after the debit` };
    await endSession(live, { userId: held.userId, sessionId: after.body.sessionId, seconds: 0, utterancesScored: 0 });
    return { status: 'pass', detail: 'held 409, released by the debit, next start 200' };
  });
}

function checkAgentSecret(live: Live): Check {
  return timed('agent-secret-guards-the-debit', async () => {
    const userId = `verify-secret-${randomUUID()}`;
    const granted = await startSession(live, { userId, lessonId: 'cafe-01', mode: 'lesson-text' });
    if (granted.status !== 200) return { status: 'fail', detail: `session start returned ${granted.status}` };
    const body = { userId, sessionId: granted.body.sessionId, seconds: 11, utterancesScored: 0 };
    const none = await endSession(live, body, null);
    const wrong = await endSession(live, body, 'not-the-agent-secret');
    const right = await endSession(live, body);
    if (none !== 401 || wrong !== 401) {
      return { status: 'fail', detail: `an unauthenticated debit returned ${none} and a wrong secret returned ${wrong}` };
    }
    if (right !== 200) return { status: 'fail', detail: `the authenticated debit returned ${right}` };
    const stored = readStore(live.storePath)[userId];
    if (stored?.secondsUsed !== 11) {
      return { status: 'fail', detail: `the refused debits still moved the balance: secondsUsed=${String(stored?.secondsUsed)}` };
    }
    return { status: 'pass', detail: 'no header 401, wrong secret 401, correct secret 200 and exactly 11s debited' };
  });
}

/**
 * The billing spine: join a room, leave it, debit once, then replay the debit
 * twice more the way a retrying agent would, and read the answer out of the
 * store file rather than the response body.
 */
function checkExactlyOnceDebit(live: Live, carry: { token: string; roomName: string; window: RoomWindow | null }): Check {
  return timed('used-room-debits-exactly-once', async () => {
    const userId = `verify-debit-${randomUUID()}`;
    const granted = await startSession(live, { userId, lessonId: 'cafe-01', mode: 'lesson-text' });
    if (granted.status !== 200) return { status: 'fail', detail: `session start returned ${granted.status}` };
    const roomName = String(granted.body.roomName);
    const token = String(granted.body.token);
    const joined = await connectRoom(live, token, roomName);
    await sleep(1_000);
    await leaveRoom(joined.room, joined.window);

    carry.token = token;
    carry.roomName = roomName;
    carry.window = joined.window;

    const body = { userId, sessionId: granted.body.sessionId, seconds: 37, utterancesScored: 0 };
    const statuses = [await endSession(live, body), await endSession(live, body), await endSession(live, body)];
    if (statuses.some((status) => status !== 200)) {
      return { status: 'fail', detail: `replayed debits returned ${statuses.join(', ')}` };
    }
    const stored = readStore(live.storePath)[userId];
    if (stored?.secondsUsed !== 37) {
      return { status: 'fail', detail: `three debits of 37s left secondsUsed=${String(stored?.secondsUsed)} in the store file` };
    }
    return { status: 'pass', detail: 'three identical /session/end calls, 37s in the store file, plan trial' };
  });
}

function checkNeverJoinedRoom(live: Live): Check {
  return timed('never-joined-room-debits-nothing', async () => {
    const userId = `verify-unjoined-${randomUUID()}`;
    const granted = await startSession(live, { userId, lessonId: 'cafe-01', mode: 'lesson-text' });
    if (granted.status !== 200) return { status: 'fail', detail: `session start returned ${granted.status}` };
    const roomName = String(granted.body.roomName);
    await sleep(5_000);
    const rooms = await live.rooms.listRooms([roomName]);
    if (rooms.length !== 0) {
      return { status: 'fail', detail: `a grant nobody joined created a room with ${rooms[0]?.numParticipants ?? '?'} participants` };
    }
    const stored = readStore(live.storePath)[userId];
    if (stored === undefined) return { status: 'fail', detail: 'the grant left no row in the store file to check' };
    if (stored.secondsUsed !== 0) return { status: 'fail', detail: `an unjoined grant debited ${stored.secondsUsed}s` };
    return { status: 'pass', detail: 'five seconds after the grant: no room on the server, zero seconds debited' };
  });
}

function checkDepartureClosesRoom(live: Live, carry: { roomName: string; window: RoomWindow | null }): Check {
  return timed('learner-departure-closes-the-room', async () => {
    if (!carry.roomName) return { status: 'fail', detail: 'no room was left open by the debit check' };
    const seconds = await secondsUntilRoomGone(live, carry.roomName, 60_000);
    if (carry.window) carry.window.closedAt = Date.now();
    if (seconds === null) return { status: 'fail', detail: 'the room was still on the server 60s after the learner left' };
    if (seconds > 40) return { status: 'fail', detail: `the room outlived departureTimeout=20 by a long way: ${seconds.toFixed(1)}s` };
    note(live, `learner-departure-closes-the-room: measured ${seconds.toFixed(1)}s against departureTimeout=20`);
    return { status: 'pass', detail: `room gone from listRooms ${seconds.toFixed(1)}s after the learner left (departureTimeout=20)` };
  });
}

function recordRejoinInsideTtl(live: Live, carry: { token: string; roomName: string }): Check {
  return timed('bearer-token-rejoin-inside-ttl', async () => {
    if (!carry.token) return { status: 'fail', detail: 'no grant was carried into the rejoin measurement' };
    const remaining = ttlSecondsOf(carry.token);
    if (remaining <= 0) {
      note(live, 'bearer-token-rejoin-inside-ttl: the carried credential had already expired, so nothing was measured');
      return { status: 'recorded', detail: 'the carried credential expired before the room closed' };
    }
    let outcome: string;
    const rejoin = new Room();
    try {
      await rejoin.connect(live.wsUrl, carry.token, { autoSubscribe: false, dynacast: false });
      const window: RoomWindow = { name: carry.roomName, openedAt: Date.now(), closedAt: 0, agentAttended: false };
      live.windows.push(window);
      await rejoin.disconnect();
      window.closedAt = Date.now();
      outcome = `accepted: the same credential re-created the closed room with ${remaining}s of ttl left`;
    } catch (error) {
      outcome = `refused: ${error instanceof Error ? error.message : String(error)}`;
    }
    note(
      live,
      `bearer-token-rejoin-inside-ttl: ${outcome}. A join credential is a five minute bearer token; ` +
        'the session ends when the room closes, but a captured token still opens a new room in its name until it expires.',
    );
    return { status: 'recorded', detail: outcome };
  });
}

/**
 * The hard stop, on a real clock.
 *
 * The metadata is forged rather than granted because `/session/start` will not
 * issue anything under MIN_VIABLE_SESSION_SEC. Everything else is the real
 * path: the tutor worker reads the signed metadata, computes
 * `Math.min(15 * 60, allowanceRemaining)`, arms its timer, publishes the
 * time-limit line to the learner, debits, and disconnects.
 */
function checkHardStop(live: Live, seed: HardStopSeed, carry: { userId: string }): Check {
  return timed('hard-stop-closes-a-live-session', async () => {
    const userId = `verify-hardstop-${randomUUID()}`;
    carry.userId = userId;
    const roomName = `parle-verify-hardstop-${randomBytes(4).toString('hex')}`;
    const token = await mintToken(live, {
      identity: userId,
      room: roomName,
      ttlSeconds: 300,
      metadata: {
        sessionId: randomUUID(),
        lessonId: 'cafe-01',
        secondsRemaining: seed.allowanceSec,
        mode: live.options.mode,
      },
    });

    const joined = await connectRoom(live, token, roomName, true);
    let tutorJoinedAt = 0;
    let stoppedAt = 0;
    let stopLine = '';
    joined.room.on(RoomEvent.ParticipantConnected, () => {
      if (tutorJoinedAt === 0) tutorJoinedAt = Date.now();
    });
    joined.room.on(RoomEvent.DataReceived, (payload: Uint8Array, _participant, _kind, topic?: string) => {
      if (topic !== TOPIC_SERVER || stoppedAt !== 0) return;
      const message = decodeServerMessage(payload);
      if (message && message.t === 'error' && /time limit/i.test(message.message)) {
        stoppedAt = Date.now();
        stopLine = message.message;
      }
    });

    const joinDeadline = Date.now() + 30_000;
    while (tutorJoinedAt === 0 && Date.now() < joinDeadline) {
      // The event is the precise signal; the roster is the belt for the case
      // where the tutor was already in the room before the listener attached.
      if (joined.room.remoteParticipants.size > 0) tutorJoinedAt = Date.now();
      else await sleep(200);
    }
    if (tutorJoinedAt === 0) {
      await leaveRoom(joined.room, joined.window);
      return { status: 'fail', detail: 'no tutor joined the room within 30s' };
    }

    const stopDeadline = tutorJoinedAt + (seed.maximumSessionSec + 25) * 1_000;
    while (stoppedAt === 0 && Date.now() < stopDeadline) await sleep(200);
    const elapsed = stoppedAt === 0 ? null : (stoppedAt - tutorJoinedAt) / 1_000;
    await leaveRoom(joined.room, joined.window);

    if (elapsed === null) {
      return {
        status: 'fail',
        detail: `no time-limit message arrived within ${seed.maximumSessionSec + 25}s of the tutor joining`,
      };
    }
    if (elapsed < seed.maximumSessionSec - 8 || elapsed > seed.maximumSessionSec + 15) {
      return { status: 'fail', detail: `hard stop fired at ${elapsed.toFixed(1)}s, not near the seeded ${seed.maximumSessionSec}s` };
    }
    const gone = await secondsUntilRoomGone(live, roomName, 60_000);
    if (gone === null) return { status: 'fail', detail: `the room outlived the hard stop by more than 60s` };
    note(
      live,
      `hard-stop-closes-a-live-session: seeded ${seed.allowanceSec}s allowance, fired at ${elapsed.toFixed(1)}s, ` +
        `room gone ${gone.toFixed(1)}s later. A real /session/start grant cannot go below ` +
        `${grantedHardStopFloorSec()}s because canStartSession refuses under MIN_VIABLE_SESSION_SEC=${MIN_VIABLE_SESSION_SEC}.`,
    );
    return {
      status: 'pass',
      detail: `fired at ${elapsed.toFixed(1)}s against a seeded ${seed.maximumSessionSec}s, said "${stopLine}", room gone ${gone.toFixed(1)}s later`,
    };
  });
}

/**
 * The room ran for a full minute and taught nobody, because this harness has no
 * microphone. `finish()` bills that at zero. The proof that the call happened at
 * all is the row itself: FileEntitlementStore only writes a learner into the
 * file when something reads or debits them.
 */
function checkUnusableRoomNotCharged(live: Live, carry: { userId: string }): Check {
  return timed('unusable-room-is-not-charged', async () => {
    if (!carry.userId) return { status: 'fail', detail: 'the hard-stop check left no learner to read back' };
    const deadline = Date.now() + 20_000;
    let stored = readStore(live.storePath)[carry.userId];
    while (stored === undefined && Date.now() < deadline) {
      await sleep(500);
      stored = readStore(live.storePath)[carry.userId];
    }
    if (stored === undefined) {
      return { status: 'fail', detail: 'the tutor never reported the session to the token server' };
    }
    if (stored.secondsUsed !== 0) {
      note(
        live,
        `unusable-room-is-not-charged: a room this harness never spoke in debited ${stored.secondsUsed}s. ` +
          'Billing keys off `learnerTurns` in tutor.ts and convo.ts: every input except the silence rescue, which ' +
          'is the one the agent applies on the learner\'s behalf. A debit here means something is counting a turn ' +
          'the learner did not take — check `applyInput` (tutor.ts) and the two `learnerTurns` sites in convo.ts ' +
          'before suspecting the store. This is the regression F76 was: the old guard read `summary.turnsCompleted`, ' +
          'which is the ladder turn index, and the silence rescue advances it.',
      );
      return {
        status: 'fail',
        detail:
          `a room with no learner turn debited ${stored.secondsUsed}s: something is counting a turn the learner ` +
          'never took, so the zero-billing guard in finish() did not fire',
      };
    }
    return {
      status: 'pass',
      detail: `the tutor reported the session and debited 0s for a room with no learner turn (plan ${stored.plan}, cap ${PLANS[stored.plan].secondsPerPeriod}s)`,
    };
  });
}

/** How long LiveKit keeps a tutor waiting in a room nobody joined. */
function recordEmptyRoomHold(live: Live): Check {
  return timed('empty-room-holds-the-agent', async () => {
    const roomName = `parle-verify-empty-${randomBytes(4).toString('hex')}`;
    const emptyTimeout = 20;
    const createdAt = Date.now();
    await live.rooms.createRoom({ name: roomName, emptyTimeout, maxParticipants: 2 });
    const window: RoomWindow = { name: roomName, openedAt: createdAt, closedAt: 0, agentAttended: false };
    live.windows.push(window);

    let tutorSeenAt = 0;
    const watchUntil = createdAt + (emptyTimeout + 25) * 1_000;
    let gone = 0;
    while (Date.now() < watchUntil) {
      const rooms = await live.rooms.listRooms([roomName]);
      if (rooms.length === 0) {
        gone = Date.now();
        break;
      }
      if (tutorSeenAt === 0 && (rooms[0]?.numParticipants ?? 0) > 0) {
        tutorSeenAt = Date.now();
        window.agentAttended = true;
      }
      await sleep(500);
    }
    window.closedAt = gone === 0 ? Date.now() : gone;
    const heldSec = (window.closedAt - createdAt) / 1_000;
    const joinNote =
      tutorSeenAt === 0
        ? 'no tutor was dispatched into it'
        : `a tutor was dispatched ${((tutorSeenAt - createdAt) / 1_000).toFixed(1)}s after creation and waited there`;
    note(
      live,
      `empty-room-holds-the-agent: emptyTimeout=${emptyTimeout}, held ${heldSec.toFixed(1)}s, ${joinNote}. ` +
        'The production RoomConfiguration uses emptyTimeout=30, so an empty room survives half a minute — but the ' +
        'worker-occupancy cost of that is what this line measures, not what it assumes. Dispatch follows a ' +
        'PARTICIPANT, so a room with nobody in it holds no tutor, and Parle never creates one any other way: a ' +
        'grant nobody joins leaves no room at all (never-joined-room-debits-nothing). The tutor-holding timeout is ' +
        'departureTimeout, measured separately at 20s by learner-departure-closes-the-room. ROOM_LIFECYCLE in ' +
        'tokens.ts carries both numbers.',
    );
    return { status: 'recorded', detail: `held ${heldSec.toFixed(1)}s with emptyTimeout=${emptyTimeout}; ${joinNote}` };
  });
}

function skip(id: string, reason: string): CheckResult {
  return { id, status: 'skipped', ms: 0, detail: reason };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const options = parseOptions(argv);
  const seed = seedForHardStop(options.budgetSec);
  const results: CheckResult[] = [];
  const startedAt = Date.now();

  let livekit: Spawned | null = null;
  let tokenServer: Spawned | null = null;
  let agent: Spawned | null = null;
  let workspace: string | null = null;

  try {
    console.log('[parle:voice] inventory');
    for (const check of LIFECYCLE_CHECKS) console.log(`  ${check.kind === 'assert' ? 'assert' : 'record'}  ${check.id}`);
    console.log('');

    const foreign = foreignAgentWorkers(execFileSync('ps', ['-Ao', 'pid=,command='], { encoding: 'utf8' }));
    const refusal = refuseForeignWorker(options, foreign);
    if (refusal !== null) {
      console.error(`[parle:voice] REFUSING: ${refusal}`);
      return 2;
    }
    if (foreign.length > 0) {
      console.log(
        `[parle:voice] note: ${foreign.join(', ')} is a tutor worker this harness did not start. ` +
          'It is registered against a different LiveKit, so it cannot be dispatched into this run.',
      );
    }

    workspace = mkdtempSync(join(tmpdir(), 'parle-voice-verify-'));
    const storePath = join(workspace, 'entitlements.json');
    writeFileSync(storePath, '{}');

    // --- transport ---------------------------------------------------------
    let wsUrl: string;
    let httpUrl: string;
    let apiKey: string;
    let apiSecret: string;

    if (options.transport === 'spawn') {
      const signalPort = await freePort();
      const tcpPort = await freePort();
      apiKey = `pv${randomBytes(6).toString('hex')}`;
      apiSecret = randomBytes(24).toString('base64url');
      const configPath = join(workspace, 'livekit.yaml');
      writeFileSync(
        configPath,
        [
          `port: ${signalPort}`,
          'rtc:',
          `  tcp_port: ${tcpPort}`,
          '  port_range_start: 51200',
          '  port_range_end: 51260',
          '  use_external_ip: false',
          'keys:',
          `  ${apiKey}: ${apiSecret}`,
          'logging:',
          '  level: error',
          '',
        ].join('\n'),
      );
      livekit = spawnLogged('livekit-server', ['--config', configPath], { cwd: workspace, env: { ...process.env } });
      httpUrl = `http://127.0.0.1:${signalPort}`;
      wsUrl = `ws://127.0.0.1:${signalPort}`;
      await waitForHttp(`${httpUrl}/`, 20_000, 'the harness livekit-server');
      console.log(`[parle:voice] livekit-server on ${wsUrl} (this run's own key pair, self-hosted, $0 transport)`);
    } else {
      const envUrl = process.env.LIVEKIT_URL ?? '';
      apiKey = process.env.LIVEKIT_API_KEY ?? '';
      apiSecret = process.env.LIVEKIT_API_SECRET ?? '';
      if (!envUrl || !apiKey || !apiSecret) {
        console.error('[parle:voice] BLOCKED: --transport env needs LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.');
        return 2;
      }
      wsUrl = envUrl;
      httpUrl = envUrl.replace(/^ws/, 'http');
      console.log(`[parle:voice] using the configured LiveKit at ${new URL(envUrl).protocol}//${new URL(envUrl).host}`);
    }

    // --- token server ------------------------------------------------------
    const tokenPort = await freePort();
    const agentSecret = randomBytes(24).toString('base64url');
    const tokenServerUrl = `http://127.0.0.1:${tokenPort}`;
    tokenServer = spawnLogged('node', ['--experimental-strip-types', 'src/server.ts'], {
      cwd: TOKEN_SERVER_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PARLE_LOCAL_DEVELOPMENT: '1',
        PORT: String(tokenPort),
        // The measured store. Empty strings rather than deletions: dotenv only
        // fills names that are absent, so an empty value is how a .env line is
        // overridden without editing anybody's file.
        ENTITLEMENT_STORE_PATH: storePath,
        PARLE_DEV_UNLIMITED_MINUTES: '0',
        SUPABASE_URL: '',
        SUPABASE_SERVICE_ROLE_KEY: '',
        SUPABASE_JWT_SECRET: '',
        UPSTASH_REDIS_REST_URL: '',
        UPSTASH_REDIS_REST_TOKEN: '',
        PARLE_RATE_LIMIT_SALT: randomBytes(36).toString('base64url'),
        PARLE_AGENT_SECRET: agentSecret,
        LIVEKIT_URL: wsUrl,
        LIVEKIT_API_KEY: apiKey,
        LIVEKIT_API_SECRET: apiSecret,
      },
    });
    await waitForHttp(`${tokenServerUrl}/health`, 25_000, 'the harness token server');

    // A port this harness did not open is a port that can lie about the code
    // under test. The health payload has to name the LiveKit we just started.
    const health = (await (await fetch(`${tokenServerUrl}/health`)).json()) as { livekitUrl?: string };
    if (health.livekitUrl !== wsUrl) {
      console.error(`[parle:voice] REFUSING: ${tokenServerUrl} answered for a different LiveKit than this run started.`);
      return 2;
    }
    console.log(`[parle:voice] token server on ${tokenServerUrl} with a seeded file store`);

    const live: Live = {
      options,
      wsUrl,
      httpUrl,
      apiKey,
      apiSecret,
      tokenServer: tokenServerUrl,
      agentSecret,
      storePath,
      rooms: new RoomServiceClient(httpUrl, apiKey, apiSecret),
      windows: [],
      records: [],
    };

    // --- phase one: no tutor worker is registered yet -----------------------
    // Deliberately before the agent starts. Automatic dispatch puts a tutor in
    // every room on the server, and a tutor in the participant-cap room would
    // fill the second seat and make the third refusal mean nothing.
    const held = { sessionId: '', userId: '' };
    const debitCarry = { token: '', roomName: '', window: null as RoomWindow | null };

    console.log('[parle:voice] phase one — token server and transport, no tutor registered');
    const phaseOne = await Promise.all([
      (async () => {
        const first = await checkConcurrentStart(live, held)();
        const second = await checkLeaseReleased(live, held)();
        return [first, second];
      })(),
      (async () => {
        const debit = await checkExactlyOnceDebit(live, debitCarry)();
        const departure = await checkDepartureClosesRoom(live, debitCarry)();
        const rejoin = await recordRejoinInsideTtl(live, debitCarry)();
        return [debit, departure, rejoin];
      })(),
      checkParticipantCap(live)().then((r) => [r]),
      checkJoinTokenExpiry(live)().then((r) => [r]),
      checkNeverJoinedRoom(live)().then((r) => [r]),
      checkAgentSecret(live)().then((r) => [r]),
      checkInsecureUrlRefused(live)().then((r) => [r]),
    ]);
    for (const group of phaseOne) results.push(...group);

    // --- phase two: the tutor worker ---------------------------------------
    const agentChecks = LIFECYCLE_CHECKS.filter((check) => check.needs === 'agent').map((check) => check.id);
    if (options.agent === 'none') {
      for (const id of agentChecks) results.push(skip(id, 'the run was started with --agent none'));
    } else {
      console.log(`[parle:voice] phase two — spawning this run's own tutor worker (mode ${options.mode})`);
      agent = spawnLogged('node', ['--experimental-strip-types', 'src/agent.ts', 'start', '--simulation'], {
        cwd: TUTOR_AGENT_DIR,
        env: {
          ...process.env,
          LIVEKIT_URL: wsUrl,
          LIVEKIT_API_KEY: apiKey,
          LIVEKIT_API_SECRET: apiSecret,
          TOKEN_SERVER_URL: tokenServerUrl,
          PARLE_AGENT_SECRET: agentSecret,
        },
      });
      const registeredBy = Date.now() + 60_000;
      while (Date.now() < registeredBy && !agent.log.some((line) => line.includes('registered worker'))) {
        if (agent.child.exitCode !== null) break;
        await sleep(250);
      }
      if (!agent.log.some((line) => line.includes('registered worker'))) {
        const why = agent.log.slice(-6).join(' | ');
        for (const id of agentChecks) results.push(skip(id, `the tutor worker never registered: ${why}`));
      } else {
        const hardStopCarry = { userId: '' };
        const phaseTwo = await Promise.all([
          (async () => {
            const stop_ = await checkHardStop(live, seed, hardStopCarry)();
            const unusable = await checkUnusableRoomNotCharged(live, hardStopCarry)();
            return [stop_, unusable];
          })(),
          recordEmptyRoomHold(live)().then((r) => [r]),
        ]);
        for (const group of phaseTwo) results.push(...group);
      }
    }

    // --- the record --------------------------------------------------------
    const now = Date.now();
    let agentRoomSec = 0;
    let learnerOnlyRoomSec = 0;
    for (const window of live.windows) {
      const closedAt = window.closedAt === 0 ? now : window.closedAt;
      const seconds = Math.max(0, (closedAt - window.openedAt) / 1_000);
      if (window.agentAttended) agentRoomSec += seconds;
      else learnerOnlyRoomSec += seconds;
    }
    const spend = estimateVendorSpend({
      agentRoomSec,
      learnerOnlyRoomSec,
      transport: options.transport === 'spawn' ? 'self-hosted' : 'cloud',
      // The worker prewarms a pool; each job process re-runs the reachability probe.
      vendorProbes: options.agent === 'spawn' ? 5 : 0,
    });

    console.log('\n[parle:voice] results');
    for (const check of LIFECYCLE_CHECKS) {
      const result = results.find((r) => r.id === check.id);
      const badge = result === undefined ? 'MISSING ' : result.status.toUpperCase().padEnd(8);
      const ms = result === undefined ? '' : `${String(result.ms).padStart(6)}ms`;
      console.log(`  ${badge} ${ms}  ${check.id}`);
      if (result) console.log(`             ${result.detail}`);
    }

    if (live.records.length > 0) {
      console.log('\n[parle:voice] measured, not asserted');
      for (const record of live.records) console.log(`  - ${record}`);
    }

    console.log('\n[parle:voice] vendor cost record');
    for (const line of spend.lines) console.log(`  ${line}`);
    console.log(`  live budget:                 ${agentRoomSec.toFixed(1)}s of ${options.budgetSec}s tutor-attended`);
    console.log(`  wall clock:                  ${((Date.now() - startedAt) / 1_000).toFixed(1)}s`);
    if (agentRoomSec > options.budgetSec) {
      console.warn(`  OVER BUDGET by ${(agentRoomSec - options.budgetSec).toFixed(1)}s of tutor-attended room time.`);
    }

    const summary = summariseRun(results);
    console.log('');
    if (summary.ok) {
      console.log(`[parle:voice] PASS — ${summary.passed} assertions held, ${summary.recorded} measurements recorded.`);
      return 0;
    }
    console.error(`[parle:voice] FAIL — ${summary.failed} failed, ${summary.skipped} skipped.`);
    for (const reason of summary.reasons) console.error(`  - ${reason}`);
    return 1;
  } catch (error) {
    console.error('[parle:voice] the harness itself failed:', error instanceof Error ? error.message : error);
    return 1;
  } finally {
    await stop(agent);
    await stop(tokenServer);
    await stop(livekit);
    try {
      dispose();
    } catch {
      // rtc-node is already gone when the run never opened a room.
    }
    if (workspace) rmSync(workspace, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(await main());
}
