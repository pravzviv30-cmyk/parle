import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { isServiceFailure, secondsRemaining } from '@luvani/core';
import { agentDebitAllowed } from './agentAuth.ts';
import { privateSignal, RATE_LIMITS } from './rateLimit.ts';
import { InMemoryEntitlementStore, SupabaseEntitlementStore, SessionReconciliationRequired } from './store.ts';

// Execute the entire production HTTP branch with real auth/store adapters and
// controlled HTTP edges. This is not a hosted server/socket or deployment test.
const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
const start = source.indexOf("    if (req.method === 'POST' && url.pathname === '/session/end') {");
const end = source.indexOf('\n    // The authenticated owner may cancel', start);
assert.ok(start >= 0 && end > start);
const stripped = stripTypeScriptTypes(`async function branch() { ${source.slice(start, end)} }`);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const names = ['req','url','res','AGENT_SECRET','agentDebitAllowed','readJson','json','sessionIdPattern','withinLimits','ipCheck','RATE_LIMITS','store','sessionLeases','privateSignal','rateLimitSalt','isServiceFailure','secondsRemaining','SessionReconciliationRequired'];
const run = new AsyncFunction(...names, stripped.slice(stripped.indexOf('{') + 1, stripped.lastIndexOf('}')));
const id = '22222222-2222-4222-8222-222222222222';
const body = { userId: 'learner', sessionId: id, seconds: 90, utterancesScored: 0, serviceFailure: 'tts_error' };
async function request(store: InMemoryEntitlementStore | SupabaseEntitlementStore, input: unknown = body, secret = 'test-agent-secret', allowed = true) {
  const reply: { status?: number; body?: unknown; releases: number } = { releases: 0 };
  const values = [{ method: 'POST', headers: { 'x-luvani-agent': secret } }, { pathname: '/session/end' }, {}, 'test-agent-secret', agentDebitAllowed, async () => input, (_res: unknown, status: number, value: unknown) => { reply.status = status; reply.body = value; }, /^[a-f0-9-]{36}$/, async () => allowed, () => ['ip'], RATE_LIMITS, store, { release: async () => { reply.releases++; } }, privateSignal, 'isolated-test-salt', isServiceFailure, secondsRemaining, SessionReconciliationRequired];
  await run(...values);
  return reply;
}

test('the agent-authenticated settlement route distinguishes reconciliation from retryable failure', async () => {
  let calls = 0;
  let status = 409, response = { code: 'PT409', message: 'synthetic missing proof' };
  const store = new SupabaseEntitlementStore('https://isolated.invalid', 'isolated-test-key', (async () => { calls++; return new Response(JSON.stringify(response), { status }); }) as typeof fetch);
  const legacy = await request(store);
  assert.equal(legacy.status, 409);assert.deepEqual(legacy.body, { kind: 'reconciliation' });assert.equal(legacy.releases, 1);
  status = 503;
  await assert.rejects(request(store), error => !(error instanceof SessionReconciliationRequired));
  status = 409;response = { code: 'different', message: 'synthetic other failure' };
  await assert.rejects(request(store), error => !(error instanceof SessionReconciliationRequired));
  const before = calls;
  assert.equal((await request(store, body, 'wrong')).status, 401);assert.equal(calls, before);
  assert.equal((await request(store, { ...body, serviceFailure: 'learner-disconnect' })).status, 400);assert.equal(calls, before);
  assert.equal((await request(store, body, 'test-agent-secret', false)).releases, 0);assert.equal(calls, before);
});

test('the settlement route acknowledges actual refund once and keeps normal exits charged', async () => {
  const store = new InMemoryEntitlementStore();
  await store.save('learner', { plan: 'trial', secondsUsed: 1790 });
  await store.recordSessionGrant('learner', id, await store.get('learner'));
  const { serviceFailure: _failure, ...normal } = body;
  assert.equal((await request(store, normal)).status, 200);
  assert.equal((await store.get('learner')).secondsUsed, 1800);
  const ack = await request(store);
  assert.deepEqual(ack.body, { kind: 'restored-current-period', refundedSeconds: 10, secondsRemaining: 10, plan: 'trial' });
  assert.deepEqual((await request(store)).body, ack.body);
  assert.equal((await store.get('learner')).secondsUsed, 1790);
});
