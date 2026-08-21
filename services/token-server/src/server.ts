/**
 * The token server.
 *
 * Two jobs: mint LiveKit room credentials, and refuse to mint them when a learner
 * has run out of minutes. Deliberately small — it holds the API secret and the
 * entitlement gate, and nothing else, so there is very little here to get wrong.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import 'dotenv/config';

import { PLANS, buildReport, secondsRemaining } from '@parle/core';
import { scoreUtterance } from '../../shared/speechace.ts';
import {
  DevelopmentEntitlementStore,
  FileEntitlementStore,
  InMemoryEntitlementStore,
  developmentEntitlementsEnabled,
  type EntitlementStore,
} from './store.ts';
import { grantSession, type TokenConfig } from './tokens.ts';
import { createUserResolver } from './auth.ts';
import { agentDebitAllowed } from './agentAuth.ts';

const PORT = Number(process.env.PORT ?? 8787);

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `\n[parle] Missing ${name}.\n` +
        `        Copy services/token-server/.env.example to .env and fill it in.\n` +
        `        Values come from your LiveKit Cloud project under Settings → Keys.\n`,
    );
    process.exit(1);
  }
  return v;
}

const config: TokenConfig = {
  apiKey: requiredEnv('LIVEKIT_API_KEY'),
  apiSecret: requiredEnv('LIVEKIT_API_SECRET'),
};
const livekitUrl = requiredEnv('LIVEKIT_URL');
/**
 * Shared with the tutor agent, which is the only legitimate caller of
 * /session/end. Unset, the endpoint behaves exactly as it always has — the
 * keyless dev path stays keyless — but it says so at boot, once, rather than
 * leaving the hole undocumented in a running process.
 */
const AGENT_SECRET = process.env.PARLE_AGENT_SECRET;
if (!AGENT_SECRET) {
  console.warn(
    '[parle] PARLE_AGENT_SECRET is not set: /session/end will accept a debit from anyone who can reach this port. ' +
      'Fine locally, not fine anywhere else.',
  );
}

/**
 * File-backed when ENTITLEMENT_STORE_PATH says where, in memory otherwise.
 *
 * In memory, a restart hands every learner their minutes back — which is
 * generous until the day it is not, and either way means the balance shown to a
 * learner is a property of the server's uptime rather than of what they bought.
 */
const developmentMinutes = developmentEntitlementsEnabled(process.env);
if (process.env.PARLE_DEV_UNLIMITED_MINUTES === '1' && !developmentMinutes) {
  console.warn('[parle] PARLE_DEV_UNLIMITED_MINUTES was ignored because NODE_ENV=production.');
}
if (developmentMinutes) {
  console.warn('[parle] development minutes are enabled: local testing sessions are not debited.');
}

const store: EntitlementStore = developmentMinutes
  ? new DevelopmentEntitlementStore()
  : process.env.ENTITLEMENT_STORE_PATH
    ? new FileEntitlementStore(process.env.ENTITLEMENT_STORE_PATH)
    : new InMemoryEntitlementStore();

// Optional Supabase verification. Absent, the server trusts asserted userIds
// exactly as it always has — the keyless dev path.
const users = createUserResolver({
  jwtSecret: process.env.SUPABASE_JWT_SECRET,
  supabaseUrl: process.env.SUPABASE_URL,
});

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    // The Expo web build runs on a different origin in development.
    'access-control-allow-origin': '*',
    'timing-allow-origin': '*',
    ...headers,
  });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('payload too large');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

/** Raw utterance audio. A drill rep is a few seconds of WAV; 2MB is generous. */
async function readAudio(req: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error('payload too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * The scoring budget: per-utterance vendor spend is tiny but not zero, and an
 * unmetered endpoint with a key behind it is an invitation. Generous enough
 * that no honest learner ever meets it. In-memory like the entitlement store,
 * and reset the same way — by a restart, honestly documented as such.
 */
const SCORE_BUDGET_PER_DAY = 300;
const scoreCounts = new Map<string, { day: string; used: number }>();

function underScoreBudget(userId: string, now = new Date()): boolean {
  const day = now.toISOString().slice(0, 10);
  const entry = scoreCounts.get(userId);
  if (entry === undefined || entry.day !== day) {
    scoreCounts.set(userId, { day, used: 1 });
    return true;
  }
  if (entry.used >= SCORE_BUDGET_PER_DAY) return false;
  entry.used += 1;
  return true;
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
    });
    return res.end();
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, livekitUrl });
    }

    // What the app calls to begin. Returns credentials, or 402 with the reason.
    if (req.method === 'POST' && url.pathname === '/session/start') {
      const startedAt = performance.now();
      const body = await readJson(req);
      const parsedAt = performance.now();
      const asserted = typeof body.userId === 'string' && body.userId ? body.userId : null;
      const lessonId = typeof body.lessonId === 'string' && body.lessonId ? body.lessonId : 'cafe-01';
      const resolved = await users.resolve(req.headers.authorization, asserted);
      const authorisedAt = performance.now();
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      const userId = resolved.userId;

      // Session-shape hints the app may send. All optional, all validated: an
      // invalid startRung is dropped (grantSession checks integer 1–4), anything
      // but the conversation modes means the scripted lesson, and the snapshot
      // passes through opaquely — the 64KB body cap already bounds its size.
      // seedTopic — a topic the learner wants to talk about again — rides the same
      // channel: shape-checked here, validated in grantSession, and dropped there
      // if it does not hold two sane strings. Never a 400, because a bad hint
      // must not refuse a session; it simply starts generic, as it does today.
      const startRung = typeof body.startRung === 'number' ? body.startRung : undefined;
      const mode =
        body.mode === 'convo'
          ? ('convo' as const)
          : body.mode === 'convo-text'
            ? ('convo-text' as const)
            : body.mode === 'lesson-text'
              ? ('lesson-text' as const)
              : ('lesson' as const);
      const snapshot = typeof body.snapshot === 'object' && body.snapshot !== null ? body.snapshot : undefined;
      const seedTopic = typeof body.seedTopic === 'object' && body.seedTopic !== null ? body.seedTopic : undefined;

      const entitlement = await store.get(userId);
      const entitledAt = performance.now();
      const result = await grantSession({
        userId,
        lessonId,
        entitlement,
        config,
        mode,
        ...(startRung !== undefined ? { startRung } : {}),
        ...(snapshot !== undefined ? { snapshot } : {}),
        ...(seedTopic !== undefined ? { seedTopic } : {}),
      });
      const grantedAt = performance.now();
      const serverTiming = [
        `parse;dur=${(parsedAt - startedAt).toFixed(1)}`,
        `auth;dur=${(authorisedAt - parsedAt).toFixed(1)}`,
        `entitlement;dur=${(entitledAt - authorisedAt).toFixed(1)}`,
        `token;dur=${(grantedAt - entitledAt).toFixed(1)}`,
      ].join(', ');

      if (!result.ok) {
        return json(res, result.status, { error: result.reason, message: result.message, plans: PLANS }, { 'server-timing': serverTiming });
      }
      return json(res, 200, { ...result.grant, livekitUrl }, { 'server-timing': serverTiming });
    }

    // Drill mode's pronunciation check: raw utterance audio in the body, the
    // reference text in the query — no multipart, no base64 bloat, and the
    // known reference is exactly what makes the score trustworthy. Returns
    // the phoneme observations plus the ONE focus core selects; the app must
    // never turn this into eleven red bars.
    if (req.method === 'POST' && url.pathname === '/drill/score') {
      const reference = url.searchParams.get('reference');
      if (!reference) return json(res, 400, { error: 'reference is required' });
      const resolved = await users.resolve(req.headers.authorization, url.searchParams.get('userId'));
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      const userId = resolved.userId;
      if (!underScoreBudget(userId)) {
        return json(res, 429, { error: 'scoring budget reached', message: 'Enough speaking for today. The drills still listen tomorrow.' });
      }

      const audio = await readAudio(req);
      if (audio.length === 0) return json(res, 400, { error: 'audio body is required' });

      const observations = await scoreUtterance({ reference, audio });
      // No key, vendor down, or unscorable audio: an empty result, never an
      // invented penalty. The app treats it as "no verdict". The report is
      // core's — one focus point at most, and only when the evidence earns it.
      const report = buildReport(observations);
      return json(res, 200, { observations, report });
    }

    // Called when a session ends. Metered seconds are debited here. This one
    // stays body-trusted on purpose: the caller is the tutor agent, server
    // side, using the identity it read out of the signed join token — there is
    // no learner bearer token in that path. Follow-up: a shared agent secret
    // would close the debit-a-stranger griefing hole.
    if (req.method === 'POST' && url.pathname === '/session/end') {
      // The caller is the tutor agent, server side, using the identity it read
      // out of the signed join token. A shared secret is what separates that
      // from anyone else on the network draining a stranger's minutes.
      if (!agentDebitAllowed(AGENT_SECRET, req.headers['x-parle-agent'])) {
        return json(res, 401, { error: 'agent authentication required' });
      }
      const body = await readJson(req);
      const userId = typeof body.userId === 'string' ? body.userId : null;
      const seconds = typeof body.seconds === 'number' ? body.seconds : NaN;
      if (!userId || !Number.isFinite(seconds) || seconds < 0) {
        return json(res, 400, { error: 'userId and a non-negative seconds value are required' });
      }
      const updated = await store.consume(userId, seconds);
      return json(res, 200, { secondsRemaining: secondsRemaining(updated), plan: updated.plan });
    }

    return json(res, 404, { error: 'not found' });
  } catch (err) {
    console.error('[parle] request failed', err);
    return json(res, 500, { error: 'internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`[parle] token server on http://localhost:${PORT} → ${livekitUrl}`);
});
