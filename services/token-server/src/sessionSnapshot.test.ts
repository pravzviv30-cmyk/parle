import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createProfile } from '@luvani/brain/profile';
import { SNAPSHOT_MAX_BYTES, snapshotBytes } from '@luvani/brain/profile/snapshotBudget';
import { grantSession, type TokenConfig } from './tokens.ts';
import { SESSION_START_BODY_LIMIT, sessionSnapshot } from './sessionSnapshot.ts';

const config: TokenConfig = { apiKey: 'devkey', apiSecret: 'a-secret-long-enough-for-hmac-signing-0123456789' };

/** What an older app build sends for a heavy learner: 200 phrases with long text. */
function oversized() {
  const p = createProfile();
  for (let i = 0; i < 200; i++) {
    p.phrases[`phrase ${i}`] = { fr: `Est-ce que vous pourriez répéter plus lentement ? ${i} ${'é'.repeat(150)}`, frWritten: null, en: 'Could you repeat more slowly?'.padEnd(180, '.'), register: 'courant', introducedAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), timesUsedWell: 1, timesAssisted: 0, mastered: i % 2 === 0 };
  }
  p.memory.name = 'Sam';
  return p;
}

test('an oversized snapshot from /session/start is signed in its fitted form', async () => {
  const raw = oversized();
  assert.ok(snapshotBytes(raw) > SNAPSHOT_MAX_BYTES, `fixture ${snapshotBytes(raw)} bytes`);
  assert.ok(Buffer.byteLength(JSON.stringify({ snapshot: raw })) > 64 * 1024, 'the old 64 KB body limit would have refused it');
  assert.ok(Buffer.byteLength(JSON.stringify({ snapshot: raw })) < SESSION_START_BODY_LIMIT);
  const fitted = sessionSnapshot(raw);
  assert.ok(fitted.ok);
  if (!fitted.ok) return;
  const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: { plan: 'starter', secondsUsed: 0 }, config, mode: 'convo', snapshot: fitted.snapshot });
  assert.ok(result.ok);
  if (!result.ok) return;
  const claims = JSON.parse(Buffer.from(result.grant.token.split('.')[1]!, 'base64url').toString('utf8'));
  const signed = JSON.parse(claims.metadata).snapshot;
  assert.ok(snapshotBytes(signed) <= SNAPSHOT_MAX_BYTES);
  assert.deepEqual(signed.memory, raw.memory, 'memory rides whole');
  assert.ok(Object.keys(signed.phrases).length > 0 && Object.keys(signed.phrases).length < 200);
});

test('a small malformed snapshot still passes through untouched, and a non-object is absent', () => {
  for (const junk of [{ cefr: 'A1', watchFor: ['x'], sessions: 4 }, { phrases: 'nope', errorPatterns: [1, 2] }, ['a', 'b']]) {
    assert.deepEqual(sessionSnapshot(junk), { ok: true, snapshot: junk });
  }
  assert.deepEqual(sessionSnapshot('text'), { ok: true, snapshot: undefined });
  assert.deepEqual(sessionSnapshot(null), { ok: true, snapshot: undefined });
});

test('a huge junk snapshot is refused, not a crash', () => {
  assert.deepEqual(sessionSnapshot({ pad: 'x'.repeat(100 * 1024) }), { ok: false });
  assert.deepEqual(sessionSnapshot({ phrases: { a: { introducedAt: 3 } }, memory: { facts: ['x'.repeat(60_000)] } }), { ok: false });
});

test('/session/start reads 160 KB, fits the snapshot, and answers 413 when it cannot', () => {
  const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
  const route = source.slice(source.indexOf("url.pathname === '/session/start'"), source.indexOf('const result = await grantSession({\n        userId,'));
  assert.match(route, /readJson\(req, SESSION_START_BODY_LIMIT\)/);
  assert.match(route, /const fitted = sessionSnapshot\(body\.snapshot\);\n\s+if \(!fitted\.ok\) return json\(res, 413,/);
  assert.match(route, /const snapshot = fitted\.snapshot;/);
  assert.equal(SESSION_START_BODY_LIMIT, 160 * 1024);
});
