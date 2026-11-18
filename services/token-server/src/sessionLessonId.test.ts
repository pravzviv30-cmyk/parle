/**
 * F968 — the token server signs only a lesson the worker can run.
 *
 * Executes the real /session/start branch of server.ts with stubbed stores, as
 * guestSceneRoute.test.ts does for /onboarding/. The stub reservation refuses
 * with session-active, so a request that reaches it stops there with a 409.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { getLesson } from '@luvani/core';
import { HttpInputError } from './requestBoundary.ts';
import { sessionSnapshot, SESSION_START_BODY_LIMIT } from './sessionSnapshot.ts';
import { recordMinutesRefusal } from './sessionEvents.ts';

const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
const start = source.indexOf("    if (req.method === 'POST' && url.pathname === '/session/start') {");
const end = source.indexOf('\n    if (req.method', start + 10);
assert.ok(start > 0 && end > start);
const js = stripTypeScriptTypes(`async function branch() {${source.slice(start, end)}\n}`);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

async function startSession(body: Record<string, unknown>, refusal = 'session-active') {
  const calls = { reserve: [] as Record<string, unknown>[], trial: 0, events: [] as unknown[], recording: [] as Promise<void>[] };
  const sink: typeof fetch = async (_url, init) => { calls.events.push(JSON.parse(String(init?.body))); return new Response(null, { status: 201 }); };
  const response = { status: 0, body: {} as Record<string, unknown> };
  const json = (_res: unknown, status: number, value: Record<string, unknown>) => { response.status = status; response.body = value; };
  const world = {
    req: { method: 'POST', headers: { authorization: 'Bearer fixture' }, socket: {} }, res: {}, url: { pathname: '/session/start' }, json,
    withinLimits: async () => true, ipCheck: () => [], installationChecks: () => [], RATE_LIMITS: {},
    process: { env: { NODE_ENV: 'test' } }, readiness: { state: async () => ({ ready: true }) },
    readJson: async () => body, SESSION_START_BODY_LIMIT, sessionSnapshot,
    users: { resolve: async () => ({ ok: true, userId: 'learner-a', authSessionId: 'auth-a' }) },
    installationSignal: () => 'installation-0000001', privateSignal: () => 'signal', rateLimitSalt: 'salt',
    supportsSessionMode: () => true, supportedSessionModes: () => ['lesson', 'convo', 'lesson-text', 'convo-text'],
    claimTrialWithEvidence: async () => { calls.trial += 1; return true; },
    store: { get: async () => ({ plan: 'starter', secondsUsed: 0 }) }, SupabaseEntitlementStore: class {}, eventSink: { baseUrl: 'https://db.test', serviceRoleKey: 'private' },
    tutorSessions: { reserve: async (input: Record<string, unknown>) => { calls.reserve.push(input); return { kind: 'refused', reason: refusal }; } },
    recordMinutesRefusal: (...[eventSink, userId, allowed, entitlement, reason]: Parameters<typeof recordMinutesRefusal>) => {
      const recording = recordMinutesRefusal(eventSink, userId, allowed, entitlement, reason, sink); calls.recording.push(recording); return recording;
    },
    randomUUID, PLANS: [], refusalRefillsAt: () => undefined, refusalMessage: () => 'busy',
    HttpInputError, getLesson,
  };
  try {
    await new AsyncFunction(...Object.keys(world), js.slice(js.indexOf('{') + 1, js.lastIndexOf('}')))(...Object.values(world));
  } catch (error) {
    if (!(error instanceof HttpInputError)) throw error;
    response.status = error.status; response.body = { error: error.message };
  }
  return { response, calls };
}

test('the token server refuses an unknown lesson id in a lesson mode before reserving', async () => {
  for (const mode of ['lesson', 'lesson-text', undefined]) {
    const { response, calls } = await startSession({ lessonId: 'not-a-lesson', ...(mode ? { mode } : {}) });
    assert.equal(response.status, 400, `mode ${mode}`);
    assert.deepEqual(response.body, { error: 'unknown lesson' });
    assert.equal(calls.reserve.length, 0, 'no reservation is taken');
    assert.equal(calls.trial, 0, 'no trial is claimed');
  }
  // A known lesson, or none (which means cafe-01), still reaches the reservation.
  for (const body of [{ lessonId: 'cafe-01', mode: 'lesson' }, { mode: 'lesson-text' }]) {
    const { calls } = await startSession(body);
    assert.equal(calls.reserve.length, 1);
    assert.equal((calls.reserve[0]!.request as { lessonId: string }).lessonId, 'cafe-01');
  }
  // Conversations sign the label convo-01, which is not a lesson; they are unaffected.
  for (const mode of ['convo', 'convo-text']) {
    const { response, calls } = await startSession({ lessonId: 'convo-01', mode });
    assert.equal(response.status, 409, `mode ${mode} reaches the reservation`);
    assert.equal(calls.reserve.length, 1);
    assert.equal((calls.reserve[0]!.request as { lessonId: string }).lessonId, 'convo-01');
  }
});

test('a refused reservation records minutes_refused when analytics is allowed', async () => {
  const run = async (refusal: string, analyticsAllowed: unknown) => {
    const { response, calls } = await startSession({ mode: 'convo', analyticsAllowed }, refusal);
    await Promise.all(calls.recording);
    return { status: response.status, events: calls.events };
  };
  assert.deepEqual(await run('exhausted', true), { status: 402, events: [
    { user_id: 'learner-a', name: 'minutes_refused', properties: { plan: 'starter', reason: 'exhausted' } },
  ] });
  assert.deepEqual(await run('session-active', true), { status: 409, events: [] }, 'a busy learner is not out of minutes');
  assert.deepEqual(await run('exhausted', false), { status: 402, events: [] }, 'analytics off records nothing');
});
