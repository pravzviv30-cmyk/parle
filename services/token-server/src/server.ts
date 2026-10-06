import { guestSpeechAvailable, guestSpeechGaps, guestSpeechLimits, transcribeGuestTake } from './onboardingSpeech.ts';
import { MemoryGuestSpeechLedger, RedisGuestSpeechLedger, guestSpeechAdmission, releaseUnclaimed, type GuestSpeechReservation } from './guestSpeechAdmission.ts';
import { parseGuestMetric } from './guestMetrics.ts';
/**
 * The token server.
 *
 * The narrow trust boundary for LiveKit grants, entitlement/session metering,
 * drill scoring, account deletion, and privacy-filtered product events.
 */

import { MemoryGuestStore, RedisGuestStore, createGuest, guestKey, guestAttempt, claimGuest } from './onboardingGuest.ts';
import { STARTER_GOALS, starterTasks, checkStarter, type StarterGoal, type StarterDrink } from '@luvani/core';
import { readAudio } from './drillScore.ts';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import {paidService,validatePaidTutorCall} from './paidService.ts';
import {decodeAudio} from '../../shared/audioDecode.ts';
import { cachedReadiness } from './readiness.ts';
import { observeRequest, requestMetrics } from './telemetry.ts';
import 'dotenv/config';
import { supportedSessionModes, supportsSessionMode } from '../../shared/sessionCapabilities.ts';

import {
  authenticationIsRecent,
  conversationTextCursor,
  isConversationText,
  PLANS,
  secondsRemaining,
  revisionFromPack,
  withoutRevisionSource,
  withVerifiedRevisionSource,
  type TutorRevision,
} from '@luvani/core';
import { brainClientFromEnv, type LlmClient } from '@luvani/brain/llm';
import { scoreUtterance } from '../../shared/pronunciation.ts';
import {
  SessionReconciliationRequired,
  DevelopmentEntitlementStore,
  FileEntitlementStore,
  InMemoryEntitlementStore,
  SupabaseEntitlementStore,
  developmentEntitlementsEnabled,
  type EntitlementStore,
} from './store.ts';
import { grantSession, type TokenConfig } from './tokens.ts';
import { TutorSessionRepository, type ReservedTutorSession } from './tutorSessions.ts';
import { TUTOR_OPERATIONS, tutorSessionOperation, type TutorOperation } from './tutorSessionRoutes.ts';
import { createUserResolver } from './auth.ts';
import { liveIdentityVerifier } from './identity.ts';
import { agentDebitAllowed } from './agentAuth.ts';
import { practiceJobs } from './practiceJobs.ts';
import { productionConfigurationProblems } from './config.ts';
import { signedInRecently } from './accountDeletion.ts';
import { exportRecentlyAuthenticatedAccountData } from './accountExport.ts';
import { accountExports } from './accountExportV2.ts';
import { privacyJobs } from './privacyJobs.ts';
import { conversationPackById, conversationPackPage } from './conversationPackPages.ts';
import { saveConversationText, deleteConversationText, listConversationText } from './conversationText.ts';
import { billingStatusFor } from './billingStatus.ts';
import { claimTrialWithEvidence, recordMinutesRefusal } from './sessionEvents.ts';
import { insertProductEvent, parseProductEvent } from './productEvents.ts';
import { handleDrillJudge, judgeUsageLine } from './drillJudge.ts';
import { fixLineObserverFromEnv } from './fixLineObserver.ts';
import { handleFixLineJudge } from './fixLineJudge.ts';
import { isServiceFailure } from '@luvani/core';
import { handlePhraseAudio } from './phraseAudioRoute.ts';
import { DRILL_REFERENCE_HEADER, DRILL_USER_HEADER, handleDrillScore } from './drillScore.ts';
import { handleDrillTranscribe } from './drillTranscribe.ts';
import { transcribeFrenchTake } from '../../shared/transcription.ts';
import {
  deleteAllConversationPacks,
  deleteConversationPack,
  getConversationPack,
  saveConversationPack,
  validConversationPackFor,
} from './conversationPacks.ts';
import { applyHttpSecurity, createOriginPolicy } from './httpSecurity.ts';
import { answerRequestError, protectHttpHandler, readRequestJson, requestUrl, withRequestSignal } from './requestBoundary.ts';
import {
  refreshSubscriber,
  revenueCatConfiguration,
  fetchSubscriber,
  projectSubscriber,
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

const guestStore = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new RedisGuestStore(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN) : new MemoryGuestStore();
// Guest speech books its seconds in the same durable store, or in memory locally.
const guestSpeech = guestSpeechAdmission(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new RedisGuestSpeechLedger(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN) : new MemoryGuestSpeechLedger(), guestSpeechLimits(process.env));
if (process.env.LUVANI_GUEST_SPEECH === '1' && !guestSpeechAvailable(process.env)) {
  console.warn(`[luvani] LUVANI_GUEST_SPEECH=1 is not in effect. Guests type until these are set: ${guestSpeechGaps(process.env).join(', ')}.`);
}
const GUEST_START_LIMIT = { name: 'guest-start', limit: 5, windowSec: 86400 };
const GUEST_EVENT_LIMIT = { name: 'guest-evidence', limit: 80, windowSec: 3600 };
const GUEST_REPLY_LIMIT = { name: 'guest-reply', limit: 20, windowSec: 3600 };

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
}, process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? {
  isIdentityActive: liveIdentityVerifier(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY),
} : {});
const billing = revenueCatConfiguration(process.env);
const eventSink = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? { baseUrl: process.env.SUPABASE_URL, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY } : null;
const userIdPattern = sessionIdPattern;
const tutorSessions = eventSink ? new TutorSessionRepository(eventSink.baseUrl, eventSink.serviceRoleKey) : null;
const paid=process.env.NODE_ENV==='production' ? paidService(process.env) : null;
let privacyConfigured = false;
const readiness = cachedReadiness(async signal => {
  if (!tutorSessions || !eventSink) throw new Error('backend-unconfigured');
  if (!privacyConfigured) {
    await privacyJobs(eventSink.baseUrl, eventSink.serviceRoleKey, process.env.REVENUECAT_SECRET_API_KEY).configure();
    privacyConfigured = true;
  }
  const [schema, workers, limiter, paidSchema] = await Promise.all([
    tutorSessions.rpc('tutor_session_schema_v1', {}, signal),
    tutorSessions.rpc('backend_status_v1', {}, signal),
    rateLimiter.consume({ name: 'readiness', limit: 10000, windowSec: 60 }, privateSignal(rateLimitSalt, 'installation', 'backend-readiness')),
    paid ? paid.rpc('paid_admission_schema_v1',{},signal) : Promise.resolve({version:1,enabled:true}),
  ]);
  return { schema: schema.version === 1 && workers.version === 1, redis: limiter.allowed,
    tutor: workers.tutor === true, practice: workers.practice === true, maintenance: workers.maintenance === true,
    admission: schema.enabled === true && (paidSchema as {enabled?:boolean}).enabled === true };
});
const activeResponses = new Set<ServerResponse>();
let draining = false;


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
  if (res.destroyed || res.writableEnded) return;
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

/** What guest speech is budgeted against, all hashed: the capability, the installation and the address. */
function guestSpeechSignals(req: IncomingMessage, token: string, installHash: string): { guest: string; installation: string; address: string } {
  return { guest: guestKey(token), installation: installHash, address: privateSignal(rateLimitSalt, 'ip', clientIp(req, trustProxy)) };
}

function installationChecks(req: IncomingMessage, rule: RateLimitRule): readonly (readonly [RateLimitRule, 'installation', string])[] {
  const installation = installationSignal(req);
  return installation ? [[rule, 'installation', installation]] : [];
}

const readJson = readRequestJson;

const server = createServer(protectHttpHandler(async (req, res) => {
  observeRequest(req, res);
  if (draining && req.url !== '/health') return json(res, 503, { error: 'service draining' });
  if (activeResponses.size >= 128 && req.url !== '/health' && req.url !== '/ready') return json(res, 503, { error: 'service busy' });
  activeResponses.add(res);
  const finished = () => activeResponses.delete(res);
  res.once('finish', finished); res.once('close', finished);
  if (!applyHttpSecurity(req, res, originPolicy)) {
    return json(res, 403, { error: 'origin not allowed' });
  }
  if (req.method === 'OPTIONS') {
    // The two scoring headers are listed because a browser refuses to send an
    // unlisted one, and a web drill that cannot send its line is never scored.
    res.writeHead(204, {
      'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
      'access-control-allow-headers': `content-type, authorization, x-luvani-installation, x-luvani-guest, x-luvani-task, x-luvani-active-seconds, ${DRILL_USER_HEADER}, ${DRILL_REFERENCE_HEADER}`,
      'access-control-max-age': '600',
    });
    return res.end();
  }

  try {
    const url = requestUrl(req);
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, livekitUrl, supportedModes: supportedSessionModes(), durablePractice: process.env.LUVANI_DURABLE_PRACTICE === '1' });
    }

    if (req.method === 'GET' && url.pathname === '/ready') {
      const status = await readiness.state();
      return json(res, status.ready ? 200 : 503, status);
    }
    if (req.method === 'GET' && url.pathname === '/internal/metrics') {
      const secret = process.env.LUVANI_METRICS_SECRET;
      if (!secret || !agentDebitAllowed(secret, req.headers['x-luvani-metrics'])) return json(res, 401, { error: 'metrics authentication required' });
      const operations = tutorSessions ? await tutorSessions.rpc('backend_status_v1', {}) : {};
      return json(res, 200, { http: requestMetrics(), operations });
    }
    if (req.method === 'POST' && url.pathname === '/agent/heartbeat') {
      if (!AGENT_SECRET || !agentDebitAllowed(AGENT_SECRET, req.headers['x-luvani-agent'])) return json(res, 401, { error: 'agent authentication required' });
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.heartbeatIp)]))) return;
      const body = await readJson(req, 1024);
      if (!tutorSessions || body.role !== 'tutor' || typeof body.workerId !== 'string' || !sessionIdPattern.test(body.workerId)
        || typeof body.ready !== 'boolean' || Object.keys(body).some(key => !['role','workerId','ready'].includes(key))) return json(res, 400, { error: 'invalid worker heartbeat' });
      return json(res, 200, await tutorSessions.rpc('publish_backend_heartbeat_v1', { p_role: body.role, p_worker_id: body.workerId, p_ready: body.ready }));
    }

    if(req.method==='POST' && url.pathname==='/agent/paid') {
      if(!AGENT_SECRET || !agentDebitAllowed(AGENT_SECRET,req.headers['x-luvani-agent']))return json(res,401,{error:'agent authentication required'});
      if(!paid)return json(res,503,{error:'paid admission unavailable'});
      if(!await withinLimits(req,res,[ipCheck(req,RATE_LIMITS.tutorWorkIp)]))return;
      const call=validatePaidTutorCall(await readJson(req,8192));
      if(!await withinLimits(req,res,[[RATE_LIMITS.tutorWorkUser,'user',call.userId]]))return;
      return json(res,200,await withRequestSignal(req,res,signal=>paid.rpc(call.name,call.args,signal),10000));
    }

    const tutorOperation = url.pathname.match(/^\/agent\/tutor\/(claim|checkpoint|complete|receipt)$/)?.[1];
    if (req.method === 'POST' && tutorOperation && TUTOR_OPERATIONS.includes(tutorOperation as TutorOperation)) {
      if (!AGENT_SECRET || !agentDebitAllowed(AGENT_SECRET, req.headers['x-luvani-agent'])) return json(res, 401, { error: 'agent authentication required' });
      if (!tutorSessions) return json(res, 503, { error: 'session service unavailable' });
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.tutorWorkIp)]))) return;
      const body = await readJson(req, 160 * 1024);
      if (typeof body.userId !== 'string' || !userIdPattern.test(body.userId)) return json(res, 400, { error: 'invalid session owner' });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.tutorWorkUser, 'user', body.userId]]))) return;
      const result = await tutorSessionOperation(tutorSessions, tutorOperation as TutorOperation, body);
      return json(res, 200, result);
    }

    if (req.method === 'POST' && url.pathname.startsWith('/onboarding/')) {
      if (url.search) return json(res, 400, { error: 'query parameters are not accepted' });
      const installation = installationSignal(req);
      if (!installation) return json(res, 400, { error: 'installation is required' });
      const installHash = privateSignal(rateLimitSalt, 'installation', installation);
      if (!(await withinLimits(req, res, [ipCheck(req, url.pathname === '/onboarding/start' ? GUEST_START_LIMIT : ['/onboarding/event', '/onboarding/account-event'].includes(url.pathname) ? GUEST_EVENT_LIMIT : GUEST_REPLY_LIMIT)]))) return;
      if (url.pathname === '/onboarding/start') {
        const body = await readJson(req, 2048);
        if (body.eligible !== true || !STARTER_GOALS.includes(body.goal as StarterGoal) || !['coffee', 'tea'].includes(String(body.drink)) || ![5, 10, 15, 'none'].includes(body.minutes as number)) return json(res, 400, { error: 'valid eligibility and plan required' });
        let started;
        try { started = await createGuest(guestStore, { installation: installHash, eligible: true, goal: body.goal as StarterGoal, drink: body.drink as StarterDrink, minutes: body.minutes as 5 | 10 | 15 | 'none', analyticsAllowed: body.analyticsAllowed === true, variant: body.variant === 'five' ? 'five' : 'full' }); }
        catch { return json(res, 409, { error: 'starter already used', message: 'This device has already started its guest practice today. Your saved practice is still available offline.' }); }
        // Speech is offered only while every guest speech budget still has a turn left; a store failure offers typing.
        const speechAvailable = guestSpeechAvailable(process.env)
          && await guestSpeech.open(guestSpeechSignals(req, started.token, installHash)).catch(() => false);
        return json(res, 200, { ...started, speechAvailable });
      }
      if (url.pathname === '/onboarding/account-event') {
        const body = await readJson(req, 512);
        const identity = await users.resolve(req.headers.authorization, process.env.LUVANI_LOCAL_DEVELOPMENT === '1' ? String(body.userId ?? '') : null);
        if (!identity.ok) return json(res, identity.status, { error: identity.message });
        if (Object.keys(body).some(key => !['name', 'evidence', 'analyticsAllowed', ...(process.env.LUVANI_LOCAL_DEVELOPMENT === '1' ? ['userId'] : [])].includes(key))) return json(res, 400, { error: 'unexpected metric fields' });
        const event = parseGuestMetric({ name: body.name, evidence: body.evidence });
        if (!event) return json(res, 400, { error: 'unknown starter metric' });
        if (body.analyticsAllowed === true) {
          try { await guestStore.metric(event, 'full'); } catch { /* Optional aggregate evidence. */ }
        }
        return json(res, 200, { ok: true });
      }
      const token = req.headers['x-luvani-guest'];
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return json(res, 401, { error: 'guest capability required' });
      const guest = await guestStore.get(guestKey(token));
      if (!guest || guest.installation !== installHash) return json(res, 401, { error: 'guest capability invalid' });
      if (url.pathname === '/onboarding/event') {
        const event = parseGuestMetric(await readJson(req, 512));
        if (!event) return json(res, 400, { error: 'unknown starter metric' });
        if (guest.analyticsAllowed && guest.createdAt + 86400000 > Date.now() && !guest.owner) {
          try { await guestStore.metric(event, guest.variant); } catch { /* Optional aggregate evidence never blocks learning. */ }
        }
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/onboarding/claim') {
        const claimBody = await readJson(req, 1024);
        const identity = await users.resolve(req.headers.authorization, process.env.LUVANI_LOCAL_DEVELOPMENT === '1' ? String(claimBody.userId ?? '') : null);
        if (!identity.ok) return json(res, identity.status, { error: identity.message });
        let claimed;
        try { claimed = await claimGuest(guestStore, token, identity.userId); } catch { return json(res, 409, { error: 'guest practice already claimed or expired' }); }
        // The existing one-time installation/account boundary grants the trial, not this route.
        const trial = await claimTrialWithEvidence(store, eventSink, identity.userId, claimed.installation, privateSignal(rateLimitSalt, 'user', identity.userId), false);
        if (!trial) return json(res, 200, { secondsRemaining: 0, trialEligible: false });
        const entitlement = await store.get(identity.userId);
        if (entitlement.plan === 'trial' && claimed.seconds > 0) {
          if (!(await store.recordSessionGrant(identity.userId, claimed.id, entitlement))) return json(res, 409, { error: 'usage changed, retry saving' });
          await store.consume(identity.userId, claimed.seconds, claimed.id);
        }
        return json(res, 200, { secondsRemaining: secondsRemaining(await store.get(identity.userId)) });
      }
      if (url.pathname === '/onboarding/attempt' || url.pathname === '/onboarding/audio') {
        if (guest.expiresAt <= Date.now() || guest.owner) return json(res, 410, { error: 'guest practice expired' });
        const audio = url.pathname === '/onboarding/audio';
        // A guest capability is not an authenticated paid-admission context. Speech
        // needs its own anonymous admission: the configuration here, then a
        // reservation per take. A key alone, or a local flag in production, opens nothing.
        if (audio && !guestSpeechAvailable(process.env)) return json(res, 503, { error: 'guest speech unavailable; type instead' });
        const body = audio ? {} : await readJson(req, 4096);
        const taskId = audio ? req.headers['x-luvani-task'] : body.taskId;
        const task = starterTasks(guest.goal, guest.drink, guest.minutes).find(task => task.id === taskId);
        if (!task) return json(res, 400, { error: 'unknown starter task' });
        if (!audio && (typeof body.reply !== 'string' || !body.reply.trim() || body.reply.length > 600)) return json(res, 400, { error: 'reply required' });
        // Speech seconds are booked before the attempt, so a full budget never spends one of the learner's attempts.
        let speech: GuestSpeechReservation | null = null;
        if (audio) {
          const decision = await guestSpeech.reserve(guestSpeechSignals(req, token, installHash)).catch(() => null);
          if (decision?.kind !== 'reserved') return json(res, 503, { error: 'guest speech unavailable; type instead' });
          speech = decision.reservation;
        }
        // Reserve before vendor work. Parallel audio calls and failures cannot buy unbounded transcription.
        let feedback;
        try { feedback = await guestAttempt(guestStore, token, task.id, audio ? 'pending transcription' : body.reply as string, audio ? 'spoken' : 'typed', Date.now(), audio ? Number(req.headers['x-luvani-active-seconds']) : Number(body.activeSeconds)); }
        catch { await speech?.settle(0); return json(res, 409, { error: 'starter attempt limit reached' }); }
        if (!speech) return json(res, 200, { ...feedback, reply: body.reply });
        let take;
        try { take = await readAudio(req); } catch { await speech.settle(0); return json(res, 413, { error: 'recording exceeds its limit' }); }
        if (!take.length) { await speech.settle(0); return json(res, 400, { error: 'recording required' }); }
        const admitted = speech;
        let transcript: string | null = null;
        try { transcript = await withRequestSignal(req, res, signal => transcribeGuestTake(take, admitted, signal), 12000); } catch { /* no transcript or audio in logs */ }
        // A request that ended before the work began never claimed its take; return those seconds. A claimed take settles itself.
        finally { await releaseUnclaimed(admitted); }
        if (!transcript || transcript.length > 600) return json(res, 503, { error: 'transcription unavailable' });
        return json(res, 200, { ...checkStarter(task, transcript, 'spoken'), secondsUsed: feedback.secondsUsed, reply: transcript });
      }
      return json(res, 404, { error: 'unknown starter route' });
    }

    // RevenueCat's event is a doorbell, not authority. Authenticate and dedupe
    // before reading current subscriber state from the vendor.
    if (req.method === 'POST' && url.pathname === '/billing/webhook') {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.billingWebhookIp)]))) return;
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
      if (!/^[a-zA-Z0-9:._-]{1,128}$/.test(eventId) || !userIdPattern.test(userId)) {
        return json(res, 400, { error: 'invalid billing event' });
      }
      const complete = await store.billingEventComplete(eventId);
      if (complete) return json(res, 200, { received: true, replay: true });
      await refreshSubscriber(userId, store, billing, { eventId });
      return json(res, 200, { received: true });
    }

    // Purchases stay closed until configuration and the atomic DB schema agree.
    if (req.method === 'POST' && url.pathname === '/billing/readiness') {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.billingReadinessIp)]))) return;
      const resolved = await users.resolve(req.headers.authorization, null);
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.billingReadinessUser, 'user', resolved.userId]]))) return;
      if (!billing || !(store instanceof SupabaseEntitlementStore) || !await store.billingProjectionReady()) {
        return json(res, 503, { ready: false });
      }
      // Validate vendor credentials and response shape without granting time.
      const subscriber = await fetchSubscriber(resolved.userId, billing);
      projectSubscriber(subscriber, { plan: 'trial', secondsUsed: 0 }, billing);
      // projectionVersion is the wire contract with the app and stays 1; the
      // database version the store checks above is the projection's own (F733).
      // yearlyProducts lets a build that sells a yearly product refuse to when
      // this server would not recognise the purchase.
      return json(res, 200, { ready: true, entitlementId: billing.entitlementId, products: billing.products,
        yearlyProducts: billing.yearlyProducts ?? {}, projectionVersion: 1 });
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
      if (process.env.NODE_ENV === 'production' && !(await readiness.state()).ready) return json(res, 503, { error: 'session service unavailable', message: 'Your tutor is not ready. Please try again.' });
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
      if (!supportsSessionMode(mode)) return json(res, 503, { error: 'voice-unavailable', message: 'Voice is unavailable here. You can start a typed conversation.', supportedModes: supportedSessionModes() });
      const snapshot = typeof body.snapshot === 'object' && body.snapshot !== null ? body.snapshot : undefined;
      let seedTopic = typeof body.seedTopic === 'object' && body.seedTopic !== null ? body.seedTopic : undefined;
      const missionId = typeof body.missionId === 'string' && body.missionId ? body.missionId : undefined;
      const tutorVoice = typeof body.tutorVoice === 'string' && body.tutorVoice ? body.tutorVoice : undefined;

      // Only an identifier comes from the app. Saved learning context is loaded
      // under the authenticated user's ownership, never trusted from the body.
      let revision: TutorRevision | undefined;
      if (body.continuationPackId !== undefined) {
        if ((mode !== 'convo' && mode !== 'convo-text') || missionId !== undefined) {
          return json(res, 400, { error: 'Choose either a conversation to continue or a guided mission.' });
        }
        if (typeof body.continuationPackId !== 'string' || !sessionIdPattern.test(body.continuationPackId)) {
          return json(res, 400, { error: 'invalid conversation reference' });
        }
        const db = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!db || !key) return json(res, 503, { error: 'Conversation memory is unavailable. Please try again.' });
        const pack = await getConversationPack(db, key, userId, body.continuationPackId);
        if (!pack) return json(res, 404, { error: 'This conversation is not available to continue.' });
        revision = revisionFromPack(pack);
        seedTopic = { fr: pack.continuationSeed.titleFr, en: pack.continuationSeed.titleEn };
      }

      if (
        installation !== null &&
        !(await claimTrialWithEvidence(
          store, store instanceof SupabaseEntitlementStore ? eventSink : null,
          userId,
          privateSignal(rateLimitSalt, 'installation', installation),
          privateSignal(rateLimitSalt, 'user', userId),
          body.analyticsAllowed,
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
      let admitted: ReservedTutorSession | undefined;
      if (tutorSessions && resolved.authSessionId) {
        const sessionId = randomUUID();
        const reservation = await tutorSessions.reserve({ userId, authSessionId: resolved.authSessionId,
          sessionId, roomName: `luvani-${sessionId}`, mode,
          request: { lessonId, mode, revision, startRung, snapshot, seedTopic, missionId, tutorVoice } });
        if (reservation.kind === 'refused') {
          const status = ['exhausted', 'insufficient-for-session', 'subscription-lapsed'].includes(reservation.reason)
            ? 402 : reservation.reason === 'session-active' ? 409 : 503;
          return json(res, status, { error: reservation.reason, message: 'Your session could not be prepared. Please try again.', plans: PLANS });
        }
        admitted = reservation;
        if(paid)try {
          await withRequestSignal(req,res,signal=>paid.admission.reserve({userId,operationId:sessionId,activity:mode,context:{kind:'tutor',sessionId},requestDigest:sessionId.replace(/-/g,'').repeat(2),signal}),10000);
        } catch {
          await tutorSessions.abandon(userId,sessionId);
          return json(res,503,{error:'paid admission unavailable',message:'Your session could not be prepared. Please try again.'});
        }
      } else if (process.env.NODE_ENV === 'production') {
        return json(res, 503, { error: 'session admission unavailable' });
      }
      const result = await grantSession({
        userId,
        lessonId,
        entitlement,
        config,
        mode,
        ...(admitted ? { admitted } : {}),
        ...(revision ? { revision } : {}),
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
        void recordMinutesRefusal(eventSink, userId, body.analyticsAllowed, entitlement, result.reason);
        return json(res, result.status, { error: result.reason, message: result.message, plans: PLANS }, { 'server-timing': serverTiming });
      }
      const leaseSignal = privateSignal(rateLimitSalt, 'user', userId);
      if (!admitted && !(await sessionLeases.acquire(leaseSignal, result.grant.sessionId, ACTIVE_SESSION_LEASE_SEC))) {
        return json(
          res,
          409,
          { error: 'session already active', message: 'Your other French session is still active. End it before starting another.' },
          { 'server-timing': serverTiming },
        );
      }
      // The token stays private until its issued allowance is durably fenced.
      // A concurrent billing change cannot turn this into a grant for old minutes.
      try {
        if (!admitted && !(await store.recordSessionGrant(userId, result.grant.sessionId, entitlement))) {
          await sessionLeases.release(leaseSignal, result.grant.sessionId);
          return json(res, 409, { error: 'allowance changed', message: 'Your allowance changed. Please try again.' });
        }
      } catch {
        await sessionLeases.release(leaseSignal, result.grant.sessionId);
        return json(res, 503, { error: 'session settlement unavailable', message: 'The session could not be prepared. Please try again.' });
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
    // learner and the reference text in headers, never in the URL (F626). The
    // handler, its header decoding and its refusal of the old query form live
    // in drillScore.ts, beside the judge, so they can be tested without a port.
    if (req.method === 'POST' && url.pathname === '/drill/score') {
      return await handleDrillScore(req, res, {
        users,
        limits: (request, response, userId) =>
          userId === null
            ? withinLimits(request, response, [ipCheck(request, RATE_LIMITS.scoringIp)])
            : withinLimits(request, response, [
                [RATE_LIMITS.scoringUser, 'user', userId],
                ...installationChecks(request, RATE_LIMITS.scoringInstallation),
              ]),
        // Ten seconds, not the live turn's five: a drill learner is waiting for
        // a verdict, not sitting in a conversation that has to keep moving.
        score: async (request, signal,user) => {
          if(!paid)return scoreUtterance(request,{timeoutMs:10000,signal});
          if(!user || !signal)return [];
          try{const decoded=await decodeAudio(request.audio,{signal});return await scoreUtterance({...request,audio:decoded.wav},{timeoutMs:10000,signal,fetchFn:paid.apiTransport(user,'api-score',signal)});}catch{return [];}
        },
      });
    }

    if (req.method === 'POST' && url.pathname === '/drill/transcribe') {
      return await handleDrillTranscribe(req, res, {
        users,
        limits: (request, response, userId) => userId === null
          ? withinLimits(request, response, [ipCheck(request, RATE_LIMITS.scoringIp)])
          : withinLimits(request, response, [[RATE_LIMITS.scoringUser, 'user', userId],
            ...installationChecks(request, RATE_LIMITS.scoringInstallation)]),
        transcribe: async (audio, signal,user) => {
          if(!paid)return transcribeFrenchTake(audio,signal?{signal}:{});
          if(!user || !signal)return null;
          try{const decoded=await decodeAudio(audio,{signal});return await transcribeFrenchTake(decoded.wav,{signal,request:paid.apiTransport(user,'api-transcribe',signal)});}catch{return null;}
        },
      });
    }

    if (req.method === 'POST' && (url.pathname === '/phrase-audio/manifest' || url.pathname === '/phrase-audio/generate')) {
      return await handlePhraseAudio(req, res, url.pathname.endsWith('/generate'), {
        users, env: process.env,
        ...(paid?{requestFor:(user,signal)=>paid.apiTransport(user,'phrase-audio',signal)}:{}),
        limits: (request, response, userId) => userId === null
          ? withinLimits(request, response, [ipCheck(request, RATE_LIMITS.phraseAudioIp)])
          : withinLimits(request, response, [[RATE_LIMITS.phraseAudioUser, 'user', userId]]),
      });
    }

    // The own-words drill's verdict: the learner's own French, read by the
    // brain because nothing deterministic can grade a paraphrase. It shares
    // the scoring limits with /drill/score above, stores nothing at all, and
    // answers 503 rather than inventing a verdict — see drillJudge.ts. The
    // brain is built once, lazily, so a server with no key still boots and
    // still serves every other endpoint.
    if (req.method === 'POST' && (url.pathname === '/drill/judge' || url.pathname === '/drill/fix-line')) {
      const handler = url.pathname === '/drill/fix-line' ? handleFixLineJudge : handleDrillJudge;
      return await handler(req, res, {
        users,
        limits: (request, response, userId) =>
          userId === null
            ? withinLimits(request, response, [ipCheck(request, RATE_LIMITS.scoringIp)])
            : withinLimits(request, response, [
                [RATE_LIMITS.scoringUser, 'user', userId],
                ...installationChecks(request, RATE_LIMITS.scoringInstallation),
              ]),
        client: { judge: request => judgeBrain().judge(request) },
        ...(paid ? {clientFor:async (user,signal)=>brainClientFromEnv(process.env,paid.apiTransport(user,url.pathname==='/drill/fix-line'?'api-fix-judge':'api-judge',signal))} : {}),
        usage: (usage) => console.log(judgeUsageLine(usage)),
        ...(url.pathname === '/drill/fix-line' ? { fixLineObserver: fixLineObserverFromEnv() } : {}),
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
      if (!authenticationIsRecent(resolved.authenticatedAt) || !(await signedInRecently(supabaseUrl, serviceRoleKey, resolved.userId))) {
        return json(res, 403, {
          error: 'recent authentication required',
          message: 'Sign in again to confirm it is you, then delete the account within five minutes.',
        });
      }
      if (tutorSessions) {
        const result = await privacyJobs(supabaseUrl, serviceRoleKey, process.env.REVENUECAT_SECRET_API_KEY).begin(resolved.userId);
        if (result.kind !== 'pending' && result.kind !== 'completed' && result.kind !== 'gone') return json(res, 503, { error: 'account erasure unavailable' });
        return json(res, result.kind === 'pending' ? 202 : 200, { deletionAccepted: true, deleted: result.kind !== 'pending' });
      }
      return json(res, 503, { error: 'account erasure unavailable' });
    }

    if ((req.method === 'POST' && url.pathname === '/account/export-v2')
      || ((req.method === 'GET' || req.method === 'DELETE') && url.pathname.startsWith('/account/export-v2/'))) {
      const preparing = req.method === 'POST';
      if (!(await withinLimits(req,res,[ipCheck(req,preparing?RATE_LIMITS.exportIp:RATE_LIMITS.exportPageIp)]))) return;
      const resolved=await users.resolve(req.headers.authorization,null);
      if(!resolved.ok)return json(res,resolved.status,{error:resolved.message});
      if(!(await withinLimits(req,res,[[preparing?RATE_LIMITS.exportUser:RATE_LIMITS.exportPageUser,'user',resolved.userId]])))return;
      if(!eventSink || !resolved.authSessionId)return json(res,503,{error:'account export unavailable'});
      const exports=accountExports(eventSink.baseUrl,eventSink.serviceRoleKey);
      if(preparing) {
        const body=await readRequestJson(req,1024);
        if(Object.keys(body).length!==1 || typeof body.exportId!=='string' || !sessionIdPattern.test(body.exportId))return json(res,400,{error:'exportId required'});
        const result=await withRequestSignal(req,res,signal=>exports.prepare(resolved.userId,resolved.authSessionId!,body.exportId as string,resolved.authenticatedAt,signal),35_000);
        if(result===null)return json(res,403,{error:'recent authentication required'});
        return json(res,result.kind==='ready'?200:503,result);
      }
      const exportId=url.pathname.slice('/account/export-v2/'.length);
      if(!sessionIdPattern.test(exportId))return json(res,400,{error:'invalid export id'});
      if(req.method==='DELETE') {
        await withRequestSignal(req,res,signal=>exports.purge(resolved.userId,exportId,signal));
        return json(res,200,{ok:true});
      }
      const partText=url.searchParams.get('part');
      if([...url.searchParams.keys()].length!==1 || partText===null || !/^(0|[1-9][0-9]{0,3})$/.test(partText) || Number(partText)>2047)return json(res,400,{error:'invalid export part'});
      const part=await withRequestSignal(req,res,signal=>exports.part(resolved.userId,resolved.authSessionId!,exportId,Number(partText),signal));
      return json(res,part===null?404:200,part??{error:'export unavailable'});
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
      const exported = await exportRecentlyAuthenticatedAccountData(supabaseUrl, serviceRoleKey, resolved.userId, resolved.authenticatedAt);
      if (exported === null) return json(res, 403, {
        error: 'recent authentication required',
        message: 'Sign in again to confirm it is you, then download your data within five minutes.',
      });
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

    // Saving full readable text requires a deliberate learner action, never an agent report.
    const textDelete = url.pathname.match(/^\/conversation-text\/([0-9a-f-]{36})$/i);
    if ((url.pathname === '/conversation-text' && (req.method === 'GET' || req.method === 'POST')) || (textDelete && req.method === 'DELETE')) {
      if (!(await withinLimits(req, res, [ipCheck(req, RATE_LIMITS.conversationPackIp)]))) return;
      const resolved = await users.resolve(req.headers.authorization, null);
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.message });
      if (!(await withinLimits(req, res, [[RATE_LIMITS.conversationPackUser, 'user', resolved.userId]]))) return;
      const db = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!db || !key) return json(res, 503, { error: 'Saved conversation text is unavailable.' });
      if (req.method === 'GET') {
        const after = url.searchParams.get('after');
        if (after !== null && conversationTextCursor(after) === null) return json(res, 400, { error: 'invalid conversation cursor' });
        return json(res, 200, await listConversationText(db, key, resolved.userId, fetch, after));
      }
      if (req.method === 'DELETE' && textDelete) {
        if (!sessionIdPattern.test(textDelete[1]!)) return json(res, 400, { error: 'invalid conversation reference' });
        await deleteConversationText(db, key, resolved.userId, textDelete[1]!);
        return json(res, 200, { deleted: true });
      }
      const body = await readJson(req, 256 * 1024);
      if (body.consent !== true || !isConversationText(body.conversation)) return json(res, 400, { error: 'Choose to save a valid conversation text.' });
      const result = await saveConversationText(db, key, resolved.userId, body.conversation);
      return result === 'saved' ? json(res, 200, { saved: true }) : json(res, 409, { error: result });
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
      // A revisit link is a claim until the owner check below proves it. It is
      // taken off before validation so a bad link can never cost the learner
      // the practice itself, and so nothing unverified reaches storage.
      const { pack: incoming, claimedSource } = withoutRevisionSource(body.pack);
      if (!userId || !sessionId || !sessionIdPattern.test(sessionId) || !validConversationPackFor(incoming, userId, sessionId)) {
        return json(res, 400, { error: 'a valid, audio-free Conversation Pack for this session is required' });
      }
      if (!(await withinLimits(req, res, [
        ipCheck(req, RATE_LIMITS.conversationPackIp),
        [RATE_LIMITS.conversationPackUser, 'user', userId],
      ]))) return;
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) return json(res, 503, { error: 'Conversation Pack storage is not configured' });
      // Owner-scoped through the same lookup a continuation uses: a foreign,
      // deleted, unfinished or unreadable source links nothing and leaks nothing.
      const pack = await withVerifiedRevisionSource(incoming, claimedSource, async (sourceId) =>
        sessionIdPattern.test(sourceId) && (await getConversationPack(supabaseUrl, serviceRoleKey, userId, sourceId)) !== null);
      if (process.env.LUVANI_DURABLE_PRACTICE === '1') {
        await practiceJobs(supabaseUrl, serviceRoleKey).receive(pack, body.phase !== 'baseline');
      } else await saveConversationPack(supabaseUrl, serviceRoleKey, pack);
      return json(res, 200, { saved: true, id: pack.id, state: pack.state });
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
      return json(res, 200, await conversationPackPage(supabaseUrl, serviceRoleKey, resolved.userId, url.searchParams.get('after')));
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
    if(req.method==='GET' && packDelete) {
      if(url.search)return json(res,400,{error:'pack detail accepts no query parameters'});
      if(!await withinLimits(req,res,[ipCheck(req,RATE_LIMITS.conversationPackIp)]))return;
      const user=await users.resolve(req.headers.authorization,null);if(!user.ok)return json(res,user.status,{error:user.message});
      if(!await withinLimits(req,res,[[RATE_LIMITS.conversationPackUser,'user',user.userId]]))return;
      if(!eventSink)return json(res,503,{error:'saved practice unavailable'});
      const pack=await conversationPackById(eventSink.baseUrl,eventSink.serviceRoleKey,user.userId,packDelete[1]!);
      return pack ? json(res,200,{pack}) : json(res,404,{error:'practice not found'});
    }
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
        !sessionIdPattern.test(sessionId) ||
        (body.serviceFailure !== undefined && !isServiceFailure(body.serviceFailure))
      ) {
        return json(res, 400, { error: 'userId, sessionId and whole seconds from 0 to 900 are required' });
      }
      if (!(await withinLimits(req, res, [
        ipCheck(req, RATE_LIMITS.debitIp),
        [RATE_LIMITS.debitUser, 'user', userId],
      ]))) return;
      if (isServiceFailure(body.serviceFailure)) {
        try {
          const settled = await store.refundSession(userId, sessionId, body.serviceFailure);
          await sessionLeases.release(privateSignal(rateLimitSalt, 'user', userId), sessionId);
          return json(res, 200, settled);
        } catch (error) {
          if (!(error instanceof SessionReconciliationRequired)) throw error;
          await sessionLeases.release(privateSignal(rateLimitSalt, 'user', userId), sessionId);
          return json(res, 409, { kind: 'reconciliation' });
        }
      }
      const updated = await store.consume(userId, seconds, sessionId);
      await sessionLeases.release(privateSignal(rateLimitSalt, 'user', userId), sessionId);
      return json(res, 200, { kind: 'charged', refundedSeconds: 0, secondsRemaining: secondsRemaining(updated), plan: updated.plan });
    }

    // The authenticated owner may cancel a grant that never joined or a live
    // session. Authoritative SQL keeps a live cancellation in ownership until
    // room termination/lease grace is confirmed; it cannot admit a second tutor.
    // Explicit local fixtures retain the legacy Redis compare-and-delete path.
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
      if (tutorSessions && resolved.authSessionId) await tutorSessions.abandon(userId, sessionId);
      else await sessionLeases.release(privateSignal(rateLimitSalt, 'user', userId), sessionId);
      // Acknowledges the cancellation request. Room termination may still be
      // pending; the next admission remains blocked by the durable SQL state.
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: 'not found' });
  } catch (err) {
    return answerRequestError(req, res, err);
  }
}));

server.headersTimeout = 10_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 100;

server.listen(PORT, () => {
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : PORT;
  console.log(`[luvani] token server on http://localhost:${actualPort} → ${livekitUrl}`);
});

const drain = () => {
  if (draining) return;
  draining = true; readiness.drain();
  server.close(() => { clearTimeout(deadline); process.exitCode = 0; });
  server.closeIdleConnections();
  const deadline = setTimeout(() => { server.closeAllConnections(); process.exitCode = 1; }, 30_000);
  deadline.unref();
};
process.once('SIGTERM', drain);
process.once('SIGINT', drain);
