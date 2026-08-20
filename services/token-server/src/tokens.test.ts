import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PLANS, type Entitlement } from '@parle/core';
import { grantSession, roomNameFor, type TokenConfig } from './tokens.ts';
import { DevelopmentEntitlementStore, InMemoryEntitlementStore, developmentEntitlementsEnabled } from './store.ts';

const config: TokenConfig = { apiKey: 'devkey', apiSecret: 'a-secret-long-enough-for-hmac-signing-0123456789' };

describe('room naming', () => {
  test('rooms are unique per user, lesson and start time', () => {
    const a = roomNameFor('u1', 'cafe-01', 1);
    const b = roomNameFor('u2', 'cafe-01', 1);
    const c = roomNameFor('u1', 'cafe-01', 2);
    assert.notEqual(a, b, 'two learners must never share a tutor');
    assert.notEqual(a, c);
  });

  test('hostile identifiers cannot escape the room namespace', () => {
    const name = roomNameFor('../../admin room!', 'cafe/../01', 1);
    assert.match(name, /^parle-[a-zA-Z0-9_-]+$/, `unsafe room name: ${name}`);
  });

  test('empty identifiers still produce a valid room', () => {
    assert.match(roomNameFor('', '', 1), /^parle-lesson-anon-/);
  });
});

describe('the entitlement gate', () => {
  test('a fresh learner is granted a token', async () => {
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: { plan: 'trial', secondsUsed: 0 }, config });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.grant.token.length > 40);
      assert.equal(result.grant.secondsRemaining, PLANS.trial.secondsPerPeriod);
    }
  });

  test('an exhausted learner is refused, and no token is minted at all', async () => {
    const spent: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod };
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: spent, config });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 402);
      assert.equal(result.reason, 'exhausted');
      assert.ok(!('token' in result), 'a refusal must not leak a usable credential');
    }
  });

  test('a learner with too little left to finish is refused before starting', async () => {
    const nearlyOut: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod - 30 };
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: nearlyOut, config });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'insufficient-for-session');
  });

  test('the token is a real signed JWT carrying the lesson', async () => {
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: { plan: 'starter', secondsUsed: 0 }, config });
    assert.ok(result.ok);
    if (!result.ok) return;

    const [header, payload, signature] = result.grant.token.split('.');
    assert.ok(header && payload && signature, 'expected three JWT segments');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    assert.equal(claims.sub, 'u1');
    assert.equal(JSON.parse(claims.metadata).lessonId, 'cafe-01');
    assert.equal(claims.video.room, result.grant.roomName);
    assert.equal(claims.video.roomJoin, true);
  });

  test('the learner may publish audio and data, but is granted nothing else', async () => {
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: { plan: 'starter', secondsUsed: 0 }, config });
    assert.ok(result.ok);
    if (!result.ok) return;
    const claims = JSON.parse(Buffer.from(result.grant.token.split('.')[1]!, 'base64url').toString('utf8'));
    assert.equal(claims.video.canPublish, true);
    assert.equal(claims.video.canPublishData, true);
    assert.notEqual(claims.video.roomAdmin, true, 'a learner must never hold admin rights on the room');
    assert.notEqual(claims.video.roomCreate, true);
  });
});

describe('session shape in token metadata', () => {
  const fresh: Entitlement = { plan: 'starter', secondsUsed: 0 };

  async function metadataFor(extra: Partial<Parameters<typeof grantSession>[0]>): Promise<Record<string, unknown>> {
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: fresh, config, ...extra });
    assert.ok(result.ok, 'expected a grant');
    if (!result.ok) throw new Error('unreachable');
    const claims = JSON.parse(Buffer.from(result.grant.token.split('.')[1]!, 'base64url').toString('utf8'));
    return JSON.parse(claims.metadata) as Record<string, unknown>;
  }

  test('a valid startRung is signed into the metadata', async () => {
    const meta = await metadataFor({ startRung: 3 });
    assert.equal(meta.startRung, 3);
  });

  test('invalid startRung values are dropped rather than signed', async () => {
    for (const bad of [0, 5, 3.5, 'x' as unknown as number]) {
      const meta = await metadataFor({ startRung: bad });
      assert.equal('startRung' in meta, false, `startRung ${String(bad)} should have been dropped`);
    }
  });

  test('mode defaults to the scripted lesson when the app asks for nothing', async () => {
    const meta = await metadataFor({});
    assert.equal(meta.mode, 'lesson');
  });

  test('a convo request is signed as convo', async () => {
    const meta = await metadataFor({ mode: 'convo' });
    assert.equal(meta.mode, 'convo');
  });

  test('a text conversation is signed as convo-text — metered like any session', async () => {
    const meta = await metadataFor({ mode: 'convo-text' });
    assert.equal(meta.mode, 'convo-text');
  });

  test('a learner snapshot passes through the token opaquely', async () => {
    const snapshot = { cefr: 'A1', watchFor: ['gender-agreement'], sessions: 4 };
    const meta = await metadataFor({ snapshot });
    assert.deepEqual(meta.snapshot, snapshot);
  });

  test('no snapshot means no snapshot key at all', async () => {
    const meta = await metadataFor({});
    assert.equal('snapshot' in meta, false);
  });

  test('a seeded topic rides the join token and a malformed one is dropped without refusing the session', async () => {
    const good = await metadataFor({ seedTopic: { fr: '  Commander un café  ', en: '  Ordering coffee  ' } });
    assert.deepEqual(
      good.seedTopic,
      { fr: 'Commander un café', en: 'Ordering coffee' },
      'the trimmed pair is what gets signed, because the trimmed pair is what the tutor will say',
    );

    const atTheCap = await metadataFor({ seedTopic: { fr: 'é'.repeat(120), en: 'a'.repeat(120) } });
    assert.deepEqual(atTheCap.seedTopic, { fr: 'é'.repeat(120), en: 'a'.repeat(120) }, 'a title exactly at the cap is a title');

    const malformed: unknown[] = [
      { fr: 'Commander un café' }, // half a seed names the topic in one language only
      { en: 'Ordering coffee' },
      { fr: 'Commander un café', en: '' },
      { fr: '   ', en: 'Ordering coffee' },
      { fr: 'Commander un café', en: 'a'.repeat(121) },
      { fr: 'é'.repeat(121), en: 'Ordering coffee' },
      { fr: 5, en: 'Ordering coffee' },
      { fr: 'Commander un café', en: { en: 'Ordering coffee' } },
      'Ordering coffee',
      42,
      [],
      null,
    ];
    for (const bad of malformed) {
      // metadataFor asserts the grant succeeded, which is the whole point: a
      // bad hint costs the learner their seeded topic, never their session.
      const meta = await metadataFor({ seedTopic: bad });
      assert.equal('seedTopic' in meta, false, `seedTopic ${JSON.stringify(bad)} should have been dropped, not signed`);
      assert.equal(meta.mode, 'lesson', 'and the session still starts, generic');
    }
  });
});

describe('entitlement store', () => {
  test('an unknown learner starts on the trial', async () => {
    const store = new InMemoryEntitlementStore();
    const e = await store.get('new-user');
    assert.equal(e.plan, 'trial');
    assert.equal(e.secondsUsed, 0);
  });

  test('consumption accumulates and is capped at the allowance', async () => {
    const store = new InMemoryEntitlementStore();
    await store.consume('u1', 300);
    const after = await store.consume('u1', 999_999);
    assert.equal(after.secondsUsed, PLANS.trial.secondsPerPeriod);
  });

  test('negative consumption is rejected rather than silently crediting minutes', async () => {
    const store = new InMemoryEntitlementStore();
    await assert.rejects(() => store.consume('u1', -60), RangeError);
  });

  test('a spent trial still refuses a session on the next request', async () => {
    const store = new InMemoryEntitlementStore();
    await store.consume('u1', PLANS.trial.secondsPerPeriod);
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: await store.get('u1'), config });
    assert.equal(result.ok, false);
  });

  test('development minutes have to be explicitly enabled and can never activate in production', () => {
    assert.equal(developmentEntitlementsEnabled({}), false);
    assert.equal(developmentEntitlementsEnabled({ PARLE_DEV_UNLIMITED_MINUTES: '1' }), true);
    assert.equal(
      developmentEntitlementsEnabled({ PARLE_DEV_UNLIMITED_MINUTES: '1', NODE_ENV: 'production' }),
      false,
    );
  });

  test('local testing minutes do not run down between tutor sessions', async () => {
    const store = new DevelopmentEntitlementStore();
    const before = await store.get('test-user');
    const after = await store.consume('test-user', PLANS.regular.secondsPerPeriod);

    assert.deepEqual(before, { plan: 'regular', secondsUsed: 0 });
    assert.deepEqual(after, before, 'even a full-period debit leaves the local test allowance fresh');
    const grant = await grantSession({ userId: 'test-user', lessonId: 'cafe-01', entitlement: after, config });
    assert.equal(grant.ok, true, 'the next test session still starts');
  });

  test('the development store still rejects an invalid debit', async () => {
    const store = new DevelopmentEntitlementStore();
    await assert.rejects(() => store.consume('test-user', -1), RangeError);
  });
});
