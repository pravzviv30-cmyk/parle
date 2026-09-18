/**
 * The token server.
 *
 * The narrow trust boundary for LiveKit grants, entitlement/session metering,
 * drill scoring, account deletion, and privacy-filtered product events.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import 'dotenv/config';

import { PLANS, buildReport, secondsRemaining } from '@luvani/core';
import { brainClientFromEnv, type LlmClient } from '@luvani/brain/llm';
import { scoreUtterance } from '../../shared/speechace.ts';
import {
  DevelopmentEntitlementStore,
  FileEntitlementStore,
  InMemoryEntitlementStore,
  SupabaseEntitlementStore,
  developmentEntitlementsEnabled,
  type EntitlementStore,
} from './store.ts';
import { grantSession, type TokenConfig } from './tokens.ts';
import { createUserResolver } from './auth.ts';
import { agentDebitAllowed } from './agentAuth.ts';
import { productionConfigurationProblems } from './config.ts';
import { deleteSupabaseUser, signedInRecently } from './accountDeletion.ts';
import { exportSupabaseAccountData } from './accountExport.ts';
import { billingStatusFor } from './billingStatus.ts';
import { insertProductEvent, parseProductEvent } from './productEvents.ts';
import { handleDrillJudge } from './drillJudge.ts';
import {
  deleteAllConversationPacks,
  deleteConversationPack,
  listConversationPacks,
  saveConversationPack,
  validConversationPackFor,
} from './conversationPacks.ts';
import { applyHttpSecurity, createOriginPolicy } from './httpSecurity.ts';
import {
  refreshSubscriber,
  revenueCatConfiguration,
  webhookAuthorised,
} from './billing/revenuecat.ts';
import {
  RATE_LIMITS,
  clientIp,
  createRateLimiter,
  createSessionLeaseStore,
  installationSignal,
  privateSignal,
  type RateLimitRule,
} from './rateLimit.ts';

const PORT = Number(process.env.PORT ?? 8787);
const originPolicy = createOriginPolicy(process.env);
const rateLimiter = createRateLimiter(process.env);
const sessionLeases = createSessionLeaseStore(process.env);
const trustProxy = process.env.LUVANI_TRUST_PROXY === '1';
const rateLimitSalt = process.env.LUVANI_RATE_LIMIT_SALT ?? 'luvani-local-development-rate-limit-salt';
const ACTIVE_SESSION_LEASE_SEC = 30 * 60;
/**
 * The shape a session id has to have before it is allowed to match a lease.
 *
 * One definition, because two endpoints now decide something on the strength of
 * this value and a session id that is only checked on one of them is not
 * checked at all. Validate before you act on it, the same habit
 * `validStartRung()` keeps on the way in.
 */
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const productionProblems = productionConfigurationProblems(process.env);
if (productionProblems.length > 0) {
  console.error(`[luvani] Refusing unsafe production configuration: ${productionProblems.join(', ')}.`);
  process.exit(1);
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(
      `\n[luvani] Missing ${name}.\n` +
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
 * /session/end. Production boot refuses an unset secret; explicit local
 * development retains a noisy compatibility path.
 */
const AGENT_SECRET = process.env.LUVANI_AGENT_SECRET;
if (!AGENT_SECRET) {
  console.warn(
    '[luvani] LUVANI_AGENT_SECRET is not set: /session/end will accept a debit from anyone who can reach this port. ' +
      'Fine locally, not fine anywhere else.',
  );
}

/**
 * Production configuration validation requires Supabase before this selection.
 * File and memory branches are explicit local-development fixtures.
 *
 * In memory, a restart hands every learner their minutes back — which is
 * generous until the day it is not, and either way means the balance shown to a
 * learner is a property of the server's uptime rather than of what they bought.
 */
const developmentMinutes = developmentEntitlementsEnabled(process.env);
if (process.env.LUVANI_DEV_UNLIMITED_MINUTES === '1' && !developmentMinutes) {
  console.warn('[luvani] LUVANI_DEV_UNLIMITED_MINUTES was ignored because NODE_ENV=production.');
}
if (developmentMinutes) {
  console.warn('[luvani] development minutes are enabled: local testing sessions are not debited.');
}

const store: EntitlementStore = developmentMinutes
  ? new DevelopmentEntitlementStore()
  : process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseEntitlementStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : process.env.ENTITLEMENT_STORE_PATH
      ? new FileEntitlementStore(process.env.ENTITLEMENT_STORE_PATH)
      : new InMemoryEntitlementStore();

// Production requires Supabase JWKS verification. The explicit local mode may
// trust the mock app's asserted identity even when a developer's .env also
// names Supabase; auth.ts keeps that exception out of production and refuses
// to fall back to it when a bearer was supplied but could not be verified.
const users = createUserResolver({
  jwtSecret: process.env.SUPABASE_JWT_SECRET,
  supabaseUrl: process.env.SUPABASE_URL,
  nodeEnv: process.env.NODE_ENV,
  localDevelopment: process.env.LUVANI_LOCAL_DEVELOPMENT,
});
const billing = revenueCatConfiguration(process.env);
const userIdPattern = sessionIdPattern;

/**
 * The brain behind /drill/judge, built on the first judged attempt and not
 * before.
 *
 * Lazily on purpose: constructing a client reads a vendor key, and a token
 * server with no key must still boot and still start sessions, grant minutes
 * and delete accounts. A learner whose judge is unconfigured meets a 503 and is
 * shown the line — never a server that refused to start.
 */
let brain: LlmClient | null = null;
function judgeBrain(): LlmClient {
  brain ??= brainClientFromEnv(process.env);
  return brain;
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

async function withinLimits(
  req: IncomingMessage,
  res: ServerResponse,
  checks: readonly (readonly [RateLimitRule, 'ip' | 'user' | 'installation', string])[],
): Promise<boolean> {
  const decisions = await Promise.all(
    checks.map(([rule, kind, signal]) => rateLimiter.consume(rule, privateSignal(rateLimitSalt, kind, signal))),
  );
  const refused = decisions.find((decision) => !decision.allowed);
  if (!refused) return true;
  json(
    res,
    429,
    { error: 'request limit reached', message: 'That needs a short pause. Try again soon.' },
    { 'retry-after': String(refused.retryAfterSec) },
  );
  return false;
}

function ipCheck(req: IncomingMessage, rule: RateLimitRule): readonly [RateLimitRule, 'ip', string] {
  return [rule, 'ip', clientIp(req, trustProxy)];
}

function installationChecks(req: IncomingMessage, rule: RateLimitRule): readonly (readonly [RateLimitRule, 'installation', string])[] {
  const installation = installationSignal(req);
  return installation ? [[rule, 'installation', installation]] : [];
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

const server = createServer(async (req, res) => {
  if (!applyHttpSecurity(req, res, originPolicy)) {
    return json(res, 403, { error: 'origin not allowed' });
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type, authorization, x-luvani-installation',
      'access-control-max-age': '600',
    });
    return res.end();
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, livekitUrl });
    }

    // RevenueCat's event is a doorbell, not authority. Authenticate and dedupe
    // before reading current subscriber state from the vendor.
    if (req.method === 'POST' && url.pathname === '/billing/webhook') {
      if (!billing) return json(res, 503, { error: 'billing is not configured' });
      const authorisation = Array.isArray(req.headers.authorization)
        ? req.headers.authorization[0]
        : req.headers.authorization;
      if (!webhookAuthorised(authorisation, billing.webhookSecret)) {
        return json(res, 401, { error: 'billing webhook authentication failed' });
      }
      const body = await readJson(req);
      const event = typeof body.event === 'object' && body.event !== null
        ? (body.event as Record<string, unknown>)
        : null;
      const eventId = typeof event?.id === 'string' ? event.id : '';
      const userId = typeof event?.app_user_id === 'string' ? event.app_user_id : '';
      if (!eventId || !userIdPattern.test(userId)) {
        return json(res, 400, { error: 'invalid billing event' });
      }
      const first = await store.recordBillingEvent(userId, eventId);
      if (!first) return json(res, 200, { received: true, replay: true });
      await refreshSubscriber(userId, store, billing);
      return json(res, 200, { received: true });
    }

    // Learner-triggered recovery for restore and for a webhook delayed or lost.
    if (req.method === 'POST' && url.pathname === '/billing/refresh') {
      if (!billing) return json(res, 503, { error: 'billing is not configured' });
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.billingRefreshIp)]))) return;
      const resolved = await users.resolve(req.headers.authorization, null);
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.billingRefreshUser, 'user', resolved.userId]]))) return;
      // What it did, not merely that it ran (F265). `refreshed: true` unconditionally
      // told a learner who owned nothing that their speaking time was ready, and the
      // paywall then hid the buy and restore buttons behind that sentence. Only an
      // `active` projection moved anything; the plan is what the learner now holds
      // either way, so the client can stop guessing from an HTTP status.
      const projection = await refreshSubscriber(resolved.userId, store, billing);
      return json(res, 200, { refreshed: projection.kind === 'active', plan: projection.entitlement.plan });
    }

    // What the app calls to begin. Returns credentials, or 402 with the reason.
    if (req.method === 'POST' && url.pathname === '/session/start') {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.sessionIp)]))) return;
      const startedAt = performance.now();
      const body = await readJson(req);
      const parsedAt = performance.now();
      const asserted = typeof body.userId === 'string' && body.userId ? body.userId : null;
      const lessonId = typeof body.lessonId === 'string' && body.lessonId ? body.lessonId : 'cafe-01';
      const resolved = await users.resolve(req.headers.authorization, asserted);
      const authorisedAt = performance.now();
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      const userId = resolved.userId;
      const installation = installationSignal(req);
      if (process.env.NODE_ENV === 'production' && installation === null) {
        return json(res, 400, { error: 'installation proof required' });
      }
      if (!(await withinLimits(req, res, [
        [RATE_LIMITS.sessionUser, 'user', userId],
        ...installationChecks(req, RATE_LIMITS.sessionInstallation),
      ]))) return;

      // Session-shape hints the app may send. All optional, all validated: an
      // invalid startRung is dropped (grantSession checks integer 1–4), anything
      // but the conversation modes means the scripted lesson, and the snapshot
      // passes through opaquely — the 64KB body cap already bounds its size.
      // seedTopic — a topic the learner wants to talk about again — rides the same
      // channel: shape-checked here, validated in grantSession, and dropped there
      // if it does not hold two sane strings. Never a 400, because a bad hint
      // must not refuse a session; it simply starts generic, as it does today.
      // missionId is the second passenger on that same channel and obeys the
      // same rules: a loose string here, validated and signed in grantSession,
      // resolved against the catalogue by the agent and nowhere else. It has no
      // say in entitlement, in metered minutes, or in whether a session starts.
      // tutorVoice is the third, and the same sentence describes it: read loosely
      // here, shape-checked and signed in grantSession, resolved to a real voice
      // by the agent, which is the only process holding the vendor key. This
      // server deliberately does not know which voices exist. Knowing would mean
      // a second copy of the catalogue that could disagree with the one the
      // agent actually bills against.
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
      const missionId = typeof body.missionId === 'string' && body.missionId ? body.missionId : undefined;
      const tutorVoice = typeof body.tutorVoice === 'string' && body.tutorVoice ? body.tutorVoice : undefined;

      if (
        installation !== null &&
        !(await store.claimTrial(
          userId,
          privateSignal(rateLimitSalt, 'installation', installation),
          privateSignal(rateLimitSalt, 'user', userId),
        ))
      ) {
        return json(res, 402, {
          error: 'trial already claimed',
          message: 'The introductory minutes for this installation have already been used by another account.',
          plans: PLANS,
        });
      }
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
        ...(missionId !== undefined ? { missionId } : {}),
        ...(tutorVoice !== undefined ? { tutorVoice } : {}),
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
      const leaseSignal = privateSignal(rateLimitSalt, 'user', userId);
      if (!(await sessionLeases.acquire(leaseSignal, result.grant.sessionId, ACTIVE_SESSION_LEASE_SEC))) {
        return json(
          res,
          409,
          { error: 'session already active', message: 'Your other French session is still active. End it before starting another.' },
          { 'server-timing': serverTiming },
        );
      }
      // The catalogue rides the grant as well as the 402. It was attached only to the
      // refusal, so a learner had to be turned away once before the app knew what a
      // plan costs in minutes, and any screen wanting it sooner would have had to
      // compile its own copy — which is F266 with extra steps.
      return json(res, 200, { ...result.grant, livekitUrl, plans: PLANS }, { 'server-timing': serverTiming });
    }

    // What the learner holds, read and never changed (F540). The meter is
    // server-side, and the app could learn its own plan only as the answer to
    // a refresh, which needs RevenueCat configured. This reads the entitlement
    // store and nothing else: it works with billing dark, asks no vendor, moves
    // no minutes and claims no trial boundary (the Supabase read is a zero
    // second debit that creates a missing default row and rolls an expired
    // period, which is what every read there does). Identity is resolved
    // exactly as the start resolves it, so a local mock account can still see
    // its plan; the asserted id is honoured only under the non-production,
    // local-development opt-in, by construction of `users`, and a bearer
    // decides everywhere else.
    if (req.method === 'POST' && url.pathname === '/billing/status') {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.billingStatusIp)]))) return;
      const body = await readJson(req);
      const asserted = typeof body.userId === 'string' && body.userId ? body.userId : null;
      const resolved = await users.resolve(req.headers.authorization, asserted);
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.billingStatusUser, 'user', resolved.userId]]))) return;
      return json(res, 200, billingStatusFor(await store.get(resolved.userId)));
    }

    // Drill mode's pronunciation check: raw utterance audio in the body, the
    // reference text in the query — no multipart, no base64 bloat, and the
    // known reference is exactly what makes the score trustworthy. Returns
    // the phoneme observations plus the ONE focus core selects; the app must
    // never turn this into eleven red bars.
    if (req.method === 'POST' && url.pathname === '/drill/score') {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.scoringIp)]))) return;
      const reference = url.searchParams.get('reference');
      if (!reference) return json(res, 400, { error: 'reference is required' });
      const resolved = await users.resolve(req.headers.authorization, url.searchParams.get('userId'));
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      const userId = resolved.userId;
      if (!(await withinLimits(req, res, [
        [RATE_LIMITS.scoringUser, 'user', userId],
        ...installationChecks(req, RATE_LIMITS.scoringInstallation),
      ]))) return;

      const audio = await readAudio(req);
      if (audio.length === 0) return json(res, 400, { error: 'audio body is required' });

      const observations = await scoreUtterance({ reference, audio });
      // No key, vendor down, or unscorable audio: an empty result, never an
      // invented penalty. The app treats it as "no verdict". The report is
      // core's — one focus point at most, and only when the evidence earns it.
      const report = buildReport(observations);
      return json(res, 200, { observations, report });
    }

    // The own-words drill's verdict: the learner's own French, read by the
    // brain because nothing deterministic can grade a paraphrase. It shares
    // the scoring limits with /drill/score above, stores nothing at all, and
    // answers 503 rather than inventing a verdict — see drillJudge.ts. The
    // brain is built once, lazily, so a server with no key still boots and
    // still serves every other endpoint.
    if (req.method === 'POST' && url.pathname === '/drill/judge') {
      return handleDrillJudge(req, res, {
        users,
        limits: (request, response, userId) =>
          userId === null
            ? withinLimits(request, response, [ipCheck(request, RATE_LIMITS.scoringIp)])
            : withinLimits(request, response, [
                [RATE_LIMITS.scoringUser, 'user', userId],
                ...installationChecks(request, RATE_LIMITS.scoringInstallation),
              ]),
        client: judgeBrain(),
      });
    }

    // Delete the verified caller, never a user id supplied by the client. The
    // foreign keys in the migration cascade learner state, events and minutes.
    if (req.method === 'POST' && url.pathname === '/account/delete') {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.deletionIp)]))) return;
      const resolved = await users.resolve(req.headers.authorization, null);
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.deletionUser, 'user', resolved.userId]]))) return;
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        return json(res, 503, { error: 'account deletion is not configured' });
      }
      if (!(await signedInRecently(supabaseUrl, serviceRoleKey, resolved.userId))) {
        return json(res, 403, {
          error: 'recent authentication required',
          message: 'Sign in again to confirm it is you, then delete the account within five minutes.',
        });
      }
      await deleteSupabaseUser(supabaseUrl, serviceRoleKey, resolved.userId);
      return json(res, 200, { deleted: true });
    }

    // A portable copy of the verified caller's account and server rows. There
    // is no user id in the URL or body: the bearer chooses exactly one owner.
    if (req.method === 'GET' && url.pathname === '/account/export') {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.exportIp)]))) return;
      const resolved = await users.resolve(req.headers.authorization, null);
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.exportUser, 'user', resolved.userId]]))) return;
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        return json(res, 503, { error: 'account export is not configured' });
      }
      const exported = await exportSupabaseAccountData(supabaseUrl, serviceRoleKey, resolved.userId);
      return json(res, 200, exported, {
        'content-disposition': 'attachment; filename="luvani-account-data.json"',
      });
    }

    if (req.method === 'POST' && url.pathname === '/events') {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.eventsIp)]))) return;
      const body = await readJson(req);
      const resolved = await users.resolve(
        req.headers.authorization,
        typeof body.userId === 'string' ? body.userId : null,
      );
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.eventsUser, 'user', resolved.userId]]))) return;
      const event = parseProductEvent(body);
      if (!event) return json(res, 400, { error: 'unsupported product event' });
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      // Local mock development has no database sink and reports that honestly.
      if (!supabaseUrl || !serviceRoleKey) return json(res, 200, { accepted: false });
      await insertProductEvent(supabaseUrl, serviceRoleKey, resolved.userId, event);
      return json(res, 200, { accepted: true });
    }

    // The tutor agent writes a completed Pack after curation and drill
    // generation. The pack is keyed by the signed session id, so retries are
    // an update to one earned lesson, never a duplicate. This endpoint accepts
    // curated learning data only; core rejects raw audio and transcripts.
    if (req.method === 'POST' && url.pathname === '/conversation-packs/complete') {
      if (!agentDebitAllowed(AGENT_SECRET, req.headers['x-luvani-agent'])) {
        return json(res, 401, { error: 'agent authentication required' });
      }
      const body = await readJson(req);
      const userId = typeof body.userId === 'string' ? body.userId : null;
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
      if (!userId || !sessionId || !sessionIdPattern.test(sessionId) || !validConversationPackFor(body.pack, userId, sessionId)) {
        return json(res, 400, { error: 'a valid, audio-free Conversation Pack for this session is required' });
      }
      if (!(await withinLimits(req, res, [
        ipCheck(req, RATE_LIMITS.conversationPackIp),
        [RATE_LIMITS.conversationPackUser, 'user', userId],
      ]))) return;
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Conversation Pack storage is not configured' });
      await saveConversationPack(supabaseUrl, serviceRoleKey, body.pack);
      return json(res, 200, { saved: true, id: body.pack.id, state: body.pack.state });
    }

    // Packs are read and deleted through the authenticated caller, never a
    // user id supplied by the device. The service role still filters on that
    // resolved id, so an identifier alone cannot become cross-account access.
    if (req.method === 'GET' && url.pathname === '/conversation-packs') {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.conversationPackIp)]))) return;
      const resolved = await users.resolve(req.headers.authorization, null);
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.conversationPackUser, 'user', resolved.userId]]))) return;
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Conversation Pack storage is not configured' });
      const packs = await listConversationPacks(supabaseUrl, serviceRoleKey, resolved.userId);
      return json(res, 200, { packs });
    }

    if (req.method === 'DELETE' && url.pathname === '/conversation-packs') {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.conversationPackIp)]))) return;
      const resolved = await users.resolve(req.headers.authorization, null);
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.conversationPackUser, 'user', resolved.userId]]))) return;
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Conversation Pack storage is not configured' });
      await deleteAllConversationPacks(supabaseUrl, serviceRoleKey, resolved.userId);
      return json(res, 200, { deleted: true });
    }

    const packDelete = url.pathname.match(/^\/conversation-packs\/([0-9a-f-]{36})$/i);
    if (req.method === 'DELETE' && packDelete) {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.conversationPackIp)]))) return;
      const resolved = await users.resolve(req.headers.authorization, null);
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.conversationPackUser, 'user', resolved.userId]]))) return;
      const packId = packDelete[1];
      if (!packId || !sessionIdPattern.test(packId)) return json(res, 400, { error: 'invalid Conversation Pack id' });
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Conversation Pack storage is not configured' });
      await deleteConversationPack(supabaseUrl, serviceRoleKey, resolved.userId, packId);
      return json(res, 200, { deleted: true });
    }

    // Called when a session ends. Metered seconds are debited here. This one
    // stays body-trusted on purpose: the caller is the tutor agent, server
    // side, using the identity it read out of the signed join token — there is
    // no learner bearer token in that path. The shared agent secret authenticates
    // this service-to-service call outside explicit local development.
    if (req.method === 'POST' && url.pathname === '/session/end') {
      // The caller is the tutor agent, server side, using the identity it read
      // out of the signed join token. A shared secret is what separates that
      // from anyone else on the network draining a stranger's minutes.
      if (!agentDebitAllowed(AGENT_SECRET, req.headers['x-luvani-agent'])) {
        return json(res, 401, { error: 'agent authentication required' });
      }
      const body = await readJson(req);
      const userId = typeof body.userId === 'string' ? body.userId : null;
      const seconds = typeof body.seconds === 'number' ? body.seconds : NaN;
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
      if (
        !userId ||
        !Number.isInteger(seconds) ||
        seconds < 0 ||
        seconds > 900 ||
        !sessionId ||
        !sessionIdPattern.test(sessionId)
      ) {
        return json(res, 400, { error: 'userId, sessionId and whole seconds from 0 to 900 are required' });
      }
      if (!(await withinLimits(req, res, [
        ipCheck(req, RATE_LIMITS.debitIp),
        [RATE_LIMITS.debitUser, 'user', userId],
      ]))) return;
      const updated = await store.consume(userId, seconds, sessionId);
      await sessionLeases.release(privateSignal(rateLimitSalt, 'user', userId), sessionId);
      return json(res, 200, { secondsRemaining: secondsRemaining(updated), plan: updated.plan });
    }

    // The other way a session ends: the tutor never turned up.
    //
    // A grant takes a thirty-minute lease so one account cannot run two sessions
    // at once, and until now only /session/end gave it back. Only the agent
    // calls that, so an agent that never joins leaves the lease standing, and
    // the learner is refused their own next attempt for half an hour by a
    // session that never happened. They are told nothing was counted against
    // their minutes, which is true, and then locked out anyway. That is a
    // strand, and the way out of it has to be something the app can do itself.
    //
    // So this is the one lease call a learner makes, and it is authenticated as
    // the account rather than with the shared agent secret: agentAuth is the
    // wrong door for a caller who has no agent identity to prove, and handing
    // the app that secret would be handing it the debit endpoint too.
    //
    // It releases and does nothing else. It never debits, never extends a lease,
    // never mints a token and never reads or writes entitlement. That narrowness
    // is the whole reason it is safe to expose to a client.
    //
    // The named risk, accepted: a caller holding an account's own bearer token
    // and a sessionId from that account's own grant can free that lease while an
    // agent is still alive and start again. The cost is one account making its
    // own concurrency worse, and defending it further would mean asking the
    // agent, which is the thing that is missing in the case this exists for.
    // What is not accepted is freeing somebody else's lease, and two things stop
    // that: the key is derived from the caller the auth layer verified and never
    // from the body, and the store's release is a compare-and-delete on the
    // sessionId, so a lease held by any other session survives untouched.
    if (req.method === 'POST' && url.pathname === '/session/abandon') {
      // The session budget rather than a new rule, and not the debit one either.
      // An abandon can only follow a start, so no caller can reach this more
      // often than it can begin a session, which is the bound that matters.
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.sessionIp)]))) return;
      const body = await readJson(req);
      // In explicit local development the asserted id is trusted exactly as it
      // is for a start, so the mock app can release its own failed start even
      // when this server's .env also names Supabase. The sessionId match below
      // is what still stands between one caller and another's lease.
      const asserted = typeof body.userId === 'string' && body.userId ? body.userId : null;
      const resolved = await users.resolve(req.headers.authorization, asserted);
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      const userId = resolved.userId;
      if (!(await withinLimits(req, res, [[RATE_LIMITS.sessionUser, 'user', userId]]))) return;

      const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
      if (!sessionId || !sessionIdPattern.test(sessionId)) {
        return json(res, 400, { error: 'sessionId is required' });
      }
      await sessionLeases.release(privateSignal(rateLimitSalt, 'user', userId), sessionId);
      // The same answer whatever the store found, and deliberately not a report
      // of whether a lease was there. A learner tapping Back twice, or one whose
      // agent did arrive and already ended the session, is not looking at an
      // error: the lease is gone either way and the next start will work. An
      // honest 200 also refuses to become an oracle for whether some account has
      // a session open, which a 404 here would quietly be.
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: 'not found' });
  } catch (err) {
    console.error('[luvani] request failed', err);
    return json(res, 500, { error: 'internal error' });
  }
});

server.listen(PORT, () => {
  console.log(`[luvani] token server on http://localhost:${PORT} → ${livekitUrl}`);
});
