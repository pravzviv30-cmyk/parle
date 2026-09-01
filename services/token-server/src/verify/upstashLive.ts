/**
 * The two-instance Upstash proof.
 *
 * The token server is only safe horizontally if its request budgets and its
 * one-session-per-learner lease are held *outside* the process. A single
 * instance proves nothing: memory counters look identical from the outside
 * until the day a second instance exists and every limit silently doubles.
 *
 * So this harness spawns TWO token servers on two ports against ONE Redis and
 * asks the questions that only that arrangement can answer:
 *
 *   1. a per-IP budget spent on instance A is refused by instance B
 *   2. a session lease taken on A makes B answer 409, not a second room
 *   3. only the matching session id clears the lease; a stranger id cannot
 *   4. an abandoned lease carries a TTL and lets the next session through
 *   5. every `luvani:*` key in the shared Redis is a hashed signal, never a
 *      raw address, account or installation id
 *
 * Two rules govern the output, and they are the reason this file exists at all
 * rather than a claim in a document:
 *
 *   - **No credential is ever printed.** Not the token, not the REST URL, not
 *     the generated agent secret. Child process output is redacted before it
 *     is shown, and `luvani:*` keys are described by shape rather than quoted —
 *     an unhashed key would *be* somebody's identity.
 *   - **Blocked is not passed.** With the credentials absent this prints
 *     `BLOCKED:` naming the exact environment variables and exits non-zero. A
 *     check that did not run counts as a failure, never as a silence.
 *
 *   npm run verify:upstash   (or)
 *   node --experimental-strip-types services/token-server/src/verify/upstashLive.ts
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnvFile } from 'dotenv';

import {
  RATE_LIMITS,
  UpstashSessionLeaseStore,
  privateSignal,
} from '../rateLimit.ts';

export interface UpstashCheck {
  id: string;
  what: string;
}

/** The complete inventory. Anything not `passed` at the end fails the run. */
export const UPSTASH_CHECKS: readonly UpstashCheck[] = [
  {
    id: 'cross-instance-rate-limit',
    what: 'a per-IP budget spent on one instance is refused by the other',
  },
  {
    id: 'cross-instance-session-lease',
    what: 'a live session on one instance makes the other answer 409, not a second room',
  },
  {
    id: 'matched-release-only',
    what: 'only the matching session id clears the lease, and ending a session frees it',
  },
  {
    id: 'lease-expiry',
    what: 'an abandoned lease carries a TTL and lets the next session through when it lapses',
  },
  {
    id: 'key-hygiene-scan',
    what: 'every luvani:* key segment is a known literal or a 43-character base64url hmac',
  },
] as const;

/** What the harness cannot run without. Named exactly, so a blocked run is actionable. */
export const REQUIRED_ENV = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'LIVEKIT_URL',
] as const;

export type CheckStatus = 'passed' | 'failed' | 'skipped' | 'blocked';

export interface CheckResult {
  id: string;
  status: CheckStatus;
  /** Human detail. Written by this file only, and never from a credential. */
  detail: string;
  ms: number;
}

export function missingCredentials(env: Record<string, string | undefined>): string[] {
  return REQUIRED_ENV.filter((name) => {
    const value = env[name];
    return typeof value !== 'string' || value.trim() === '';
  });
}

export function blockedReport(missing: readonly string[]): string[] {
  const lines = [
    `BLOCKED: the Upstash verification cannot run. Missing ${missing.length} environment value${missing.length === 1 ? '' : 's'}:`,
  ];
  for (const name of missing) lines.push(`  - ${name}`);
  lines.push('');
  lines.push('Nothing below was proven. The full inventory this run would have covered:');
  for (const check of UPSTASH_CHECKS) lines.push(`  [blocked] ${check.id} — ${check.what}`);
  lines.push('');
  lines.push('Set the values in services/token-server/.env and run again.');
  return lines;
}

/** A `privateSignal` output: sha256 as base64url is always 43 characters. */
export function isHashedSegment(segment: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(segment);
}

const RULE_NAMES: readonly string[] = Object.values(RATE_LIMITS).map((rule) => rule.name);

/**
 * Describes what is wrong with a key without ever quoting it. A key that failed
 * this check is, by definition, somebody's raw identity — reprinting it in a
 * report would be the leak the check exists to find.
 */
export function keyShapeProblem(key: string): string | null {
  const segments = key.split(':');
  if (segments[0] !== 'luvani') return 'key is outside the luvani namespace';
  if (segments[1] === 'limit') {
    if (segments.length !== 4) return 'luvani:limit key does not have exactly four segments';
    if (!RULE_NAMES.includes(segments[2] ?? '')) return 'luvani:limit rule segment is not a known rule name';
    return isHashedSegment(segments[3] ?? '')
      ? null
      : 'luvani:limit identity segment is not a 43-character base64url hmac';
  }
  if (segments[1] === 'active-session') {
    if (segments.length !== 3) return 'luvani:active-session key does not have exactly three segments';
    return isHashedSegment(segments[2] ?? '')
      ? null
      : 'luvani:active-session identity segment is not a 43-character base64url hmac';
  }
  return 'key uses an unknown luvani namespace';
}

export function summarise(results: readonly CheckResult[]): { ok: boolean; exitCode: number; lines: string[] } {
  const byId = new Map(results.map((result) => [result.id, result]));
  const lines: string[] = [];
  let ok = true;
  for (const check of UPSTASH_CHECKS) {
    const result = byId.get(check.id) ?? { id: check.id, status: 'skipped' as const, detail: 'never ran', ms: 0 };
    if (result.status !== 'passed') ok = false;
    lines.push(`  [${result.status}] ${check.id} — ${check.what}`);
    lines.push(`            ${result.detail} (${result.ms}ms)`);
  }
  lines.push('');
  lines.push(
    ok
      ? `upstash verification: ${UPSTASH_CHECKS.length} of ${UPSTASH_CHECKS.length} proofs passed against the live database`
      : 'upstash verification: FAILED — a proof that did not pass is not a proof',
  );
  return { ok, exitCode: ok ? 0 : 1, lines };
}

/** Last-resort guard for anything that came from a child process. */
export function redact(text: string, secrets: readonly string[]): string {
  let safe = text;
  for (const secret of secrets) {
    if (secret.length < 4) continue;
    safe = safe.split(secret).join('<redacted>');
  }
  return safe;
}

// ---------------------------------------------------------------------------
// The live run
// ---------------------------------------------------------------------------

const TOKEN_SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error('no free port'))));
    });
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Instance {
  name: string;
  port: number;
  child: ChildProcess;
  output: string[];
}

async function startInstance(name: string, env: Record<string, string>, secrets: readonly string[]): Promise<Instance> {
  const port = await freePort();
  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', path.join(TOKEN_SERVER_DIR, 'src', 'server.ts')],
    {
      cwd: TOKEN_SERVER_DIR,
      env: { ...env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const output: string[] = [];
  const collect = (chunk: Buffer) => output.push(redact(chunk.toString('utf8'), secrets));
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${name} exited with code ${child.exitCode}:\n${output.join('')}`);
    }
    try {
      const health = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1_000) });
      if (health.ok) return { name, port, child, output };
    } catch {
      // Not listening yet.
    }
    await sleep(150);
  }
  child.kill('SIGKILL');
  throw new Error(`${name} never became healthy on port ${port}:\n${output.join('')}`);
}

async function redisCommand(url: string, restToken: string, command: readonly string[]): Promise<unknown> {
  const response = await fetch(url.replace(/\/+$/, ''), {
    method: 'POST',
    headers: { authorization: `Bearer ${restToken}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(8_000),
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`upstash returned ${response.status}`);
  return ((await response.json()) as { result?: unknown }).result;
}

async function scanKeys(url: string, restToken: string, match: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const page = (await redisCommand(url, restToken, ['SCAN', cursor, 'MATCH', match, 'COUNT', '500'])) as [
      string,
      string[],
    ];
    cursor = String(page?.[0] ?? '0');
    for (const key of page?.[1] ?? []) keys.push(String(key));
  } while (cursor !== '0');
  return keys;
}

async function timed(id: string, run: () => Promise<string>): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const detail = await run();
    return { id, status: 'passed', detail, ms: Date.now() - startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { id, status: 'failed', detail: message, ms: Date.now() - startedAt };
  }
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export async function runUpstashVerification(env: Record<string, string | undefined>): Promise<{
  results: CheckResult[];
  createdKeys: string[];
}> {
  const url = env.UPSTASH_REDIS_REST_URL as string;
  const restToken = env.UPSTASH_REDIS_REST_TOKEN as string;
  const secrets = [restToken, url];

  // A salt unique to this run means every key it touches is its own, so a
  // shared database is never disturbed and cleanup is exact.
  const runSalt = `luvani-upstash-verify-${randomBytes(24).toString('base64url')}`;
  const agentSecret = randomBytes(24).toString('base64url');
  const learner = `upstash-verify-${randomBytes(8).toString('hex')}`;

  const childEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: 'development',
    LUVANI_LOCAL_DEVELOPMENT: '1',
    LUVANI_DEV_UNLIMITED_MINUTES: '1',
    LUVANI_RATE_LIMIT_SALT: runSalt,
    LUVANI_AGENT_SECRET: agentSecret,
    LUVANI_TRUST_PROXY: '',
    UPSTASH_REDIS_REST_URL: url,
    UPSTASH_REDIS_REST_TOKEN: restToken,
    // The point of this run is Redis, not Postgres: the local development
    // stores keep Supabase out of the picture entirely.
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    SUPABASE_JWT_SECRET: '',
    ENTITLEMENT_STORE_PATH: '',
  };

  const results: CheckResult[] = [];
  const createdKeys = new Set<string>();
  let alpha: Instance | null = null;
  let beta: Instance | null = null;

  try {
    alpha = await startInstance('instance-a', childEnv, secrets);
    beta = await startInstance('instance-b', childEnv, secrets);
    console.log(`  two token servers up on ports ${alpha.port} and ${beta.port}, one shared Redis`);

    // Loopback reaches the server as one of three spellings depending on the
    // stack; all of them are this run's own keys and all of them get cleaned up.
    const userSignal = privateSignal(runSalt, 'user', learner);
    for (const loopback of ['127.0.0.1', '::ffff:127.0.0.1', '::1']) {
      const ipSignal = privateSignal(runSalt, 'ip', loopback);
      createdKeys.add(`luvani:limit:${RATE_LIMITS.deletionIp.name}:${ipSignal}`);
      createdKeys.add(`luvani:limit:${RATE_LIMITS.sessionIp.name}:${ipSignal}`);
    }
    createdKeys.add(`luvani:limit:${RATE_LIMITS.sessionUser.name}:${userSignal}`);
    createdKeys.add(`luvani:active-session:${userSignal}`);

    // ---------------------------------------------------------------- 1
    results.push(
      await timed('cross-instance-rate-limit', async () => {
        const budget = RATE_LIMITS.deletionIp.limit;
        const statuses: number[] = [];
        for (let attempt = 0; attempt < budget; attempt += 1) {
          const target = attempt % 2 === 0 ? alpha! : beta!;
          const response = await fetch(`http://127.0.0.1:${target.port}/account/delete`, {
            method: 'POST',
            signal: AbortSignal.timeout(8_000),
          });
          statuses.push(response.status);
        }
        expect(!statuses.includes(429), `a request inside the budget was refused: ${statuses.join(',')}`);

        const afterA = await fetch(`http://127.0.0.1:${alpha!.port}/account/delete`, {
          method: 'POST',
          signal: AbortSignal.timeout(8_000),
        });
        const afterB = await fetch(`http://127.0.0.1:${beta!.port}/account/delete`, {
          method: 'POST',
          signal: AbortSignal.timeout(8_000),
        });
        expect(afterA.status === 429, `instance A allowed request ${budget + 1} (${afterA.status})`);
        expect(afterB.status === 429, `instance B allowed request ${budget + 2} (${afterB.status})`);
        expect(Number(afterB.headers.get('retry-after')) > 0, 'a refusal must say when to come back');
        const body = (await afterB.json()) as { message?: string };
        expect(typeof body.message === 'string' && body.message.length > 0, 'a refusal must carry learner copy');
        expect(
          !/too many|abuse|blocked|violation/i.test(body.message ?? ''),
          'rate-limit copy must not scold the learner',
        );
        return `${budget} requests split across both instances, then both refused the next one`;
      }),
    );

    // ---------------------------------------------------------------- 2
    let sessionId = '';
    results.push(
      await timed('cross-instance-session-lease', async () => {
        const start = async (instance: Instance) =>
          fetch(`http://127.0.0.1:${instance.port}/session/start`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ userId: learner, lessonId: 'cafe-01', mode: 'convo-text' }),
            signal: AbortSignal.timeout(10_000),
          });

        const first = await start(alpha!);
        expect(first.status === 200, `instance A refused the first session (${first.status})`);
        const grant = (await first.json()) as { sessionId?: string };
        expect(typeof grant.sessionId === 'string', 'a granted session must carry a session id');
        sessionId = grant.sessionId as string;

        const second = await start(beta!);
        expect(second.status === 409, `instance B granted a second room (${second.status})`);
        const refusal = (await second.json()) as { error?: string; message?: string };
        expect(refusal.error === 'session already active', `unexpected refusal: ${refusal.error}`);
        expect(
          !/too many|abuse|blocked|violation/i.test(refusal.message ?? ''),
          'a lease refusal must not scold the learner',
        );
        return 'instance A granted the room; instance B answered 409 from the shared lease';
      }),
    );

    // ---------------------------------------------------------------- 3
    results.push(
      await timed('matched-release-only', async () => {
        const end = async (instance: Instance, id: string) =>
          fetch(`http://127.0.0.1:${instance.port}/session/end`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-luvani-agent': agentSecret },
            body: JSON.stringify({ userId: learner, sessionId: id, seconds: 0 }),
            signal: AbortSignal.timeout(10_000),
          });

        // A stranger session id must not be able to free somebody else's lease.
        const stranger = '11111111-2222-4333-8444-555555555555';
        const strangerEnd = await end(beta!, stranger);
        expect(strangerEnd.status === 200, `the debit path itself failed (${strangerEnd.status})`);
        const stillHeld = await fetch(`http://127.0.0.1:${beta!.port}/session/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: learner, lessonId: 'cafe-01', mode: 'convo-text' }),
          signal: AbortSignal.timeout(10_000),
        });
        expect(stillHeld.status === 409, `a stranger session id cleared the lease (${stillHeld.status})`);

        const matchedEnd = await end(beta!, sessionId);
        expect(matchedEnd.status === 200, `the matching debit failed (${matchedEnd.status})`);
        const reopened = await fetch(`http://127.0.0.1:${beta!.port}/session/start`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: learner, lessonId: 'cafe-01', mode: 'convo-text' }),
          signal: AbortSignal.timeout(10_000),
        });
        expect(reopened.status === 200, `the learner was locked out after ending a session (${reopened.status})`);
        const next = (await reopened.json()) as { sessionId?: string };
        await end(alpha!, next.sessionId ?? sessionId);
        return 'a stranger id left the lease held; the matching id freed it on the other instance';
      }),
    );

    // ---------------------------------------------------------------- 4
    results.push(
      await timed('lease-expiry', async () => {
        const leases = new UpstashSessionLeaseStore(url, restToken);
        const probeSignal = privateSignal(runSalt, 'user', `${learner}-expiry`);
        createdKeys.add(`luvani:active-session:${probeSignal}`);
        expect(await leases.acquire(probeSignal, 'session-expiring', 2), 'the probe lease was not acquired');
        const ttl = Number(await redisCommand(url, restToken, ['TTL', `luvani:active-session:${probeSignal}`]));
        expect(ttl > 0 && ttl <= 2, `an abandoned lease must carry a TTL, got ${ttl}`);
        expect(
          !(await leases.acquire(probeSignal, 'session-blocked', 2)),
          'a live lease must refuse a second session',
        );
        await sleep((ttl + 1) * 1_000);
        expect(
          await leases.acquire(probeSignal, 'session-after-expiry', 5),
          'an expired lease must let the next session through',
        );
        await leases.release(probeSignal, 'session-after-expiry');
        return `TTL observed at ${ttl}s; the next session was granted after it lapsed`;
      }),
    );

    // ---------------------------------------------------------------- 5
    results.push(
      await timed('key-hygiene-scan', async () => {
        const keys = await scanKeys(url, restToken, 'luvani:*');
        expect(keys.length > 0, 'the scan found no luvani keys at all, so it proved nothing');
        const problems = new Map<string, number>();
        for (const key of keys) {
          const problem = keyShapeProblem(key);
          if (problem) problems.set(problem, (problems.get(problem) ?? 0) + 1);
        }
        expect(
          problems.size === 0,
          `raw identifiers found in redis keys: ${[...problems].map(([p, n]) => `${n}x ${p}`).join('; ')}`,
        );
        const ours = keys.filter((key) => createdKeys.has(key));
        expect(ours.length > 0, 'this run wrote no keys the scan could see');
        return `${keys.length} luvani:* keys scanned, all hashed; ${ours.length} written by this run`;
      }),
    );

    return { results, createdKeys: [...createdKeys] };
  } finally {
    // Leave the shared database as it was found.
    try {
      const keys = [...createdKeys];
      if (keys.length > 0) await redisCommand(url, restToken, ['DEL', ...keys]);
    } catch {
      console.error('  note: some keys from this run were not deleted; they carry their own TTL');
    }
    alpha?.child.kill('SIGTERM');
    beta?.child.kill('SIGTERM');
  }
}

async function main(): Promise<number> {
  loadEnvFile({ path: path.join(TOKEN_SERVER_DIR, '.env'), quiet: true });

  // Every line this command prints goes through one pair of helpers, so there
  // is exactly one place where a credential could escape and it redacts.
  const secrets = [process.env.UPSTASH_REDIS_REST_TOKEN ?? '', process.env.UPSTASH_REDIS_REST_URL ?? ''];
  const say = (line: string) => console.log(redact(line, secrets));
  const warn = (line: string) => console.error(redact(line, secrets));

  const missing = missingCredentials(process.env);
  if (missing.length > 0) {
    for (const blockedLine of blockedReport(missing)) warn(blockedLine);
    return 1;
  }

  say('upstash verification: two token servers, one shared Redis');
  for (const check of UPSTASH_CHECKS) say(`  - ${check.id}: ${check.what}`);
  say('');

  let results: CheckResult[] = [];
  try {
    ({ results } = await runUpstashVerification(process.env));
  } catch (error) {
    warn(`  the run could not complete: ${error instanceof Error ? error.message : String(error)}`);
  }
  const summary = summarise(results);
  for (const summaryLine of summary.lines) say(summaryLine);
  return summary.exitCode;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exit(await main());
