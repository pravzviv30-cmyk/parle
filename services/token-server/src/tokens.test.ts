import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FIRST_MISSION, PLANS, TUTOR_VOICES, type Entitlement } from '@luvani/core';
import { ROOM_LIFECYCLE, grantSession, roomNameFor, type TokenConfig } from './tokens.ts';
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
    assert.match(name, /^luvani-[a-zA-Z0-9_-]+$/, `unsafe room name: ${name}`);
  });

  test('empty identifiers still produce a valid room', () => {
    assert.match(roomNameFor('', '', 1), /^luvani-lesson-anon-/);
  });
});

describe('the entitlement gate', () => {
  test('a fresh learner is granted a token', async () => {
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: { plan: 'trial', secondsUsed: 0 }, config });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.grant.token.length > 40);
      assert.match(result.grant.sessionId, /^[0-9a-f-]{36}$/);
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

  test('a spent free conversation carries refillsAt as the ISO of the period end, so the app words it locally', async () => {
    const periodEnd = new Date('2026-10-22T05:00:00.000Z');
    const spent: Entitlement = { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod, periodEnd };
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: spent, config });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 402);
      assert.equal(result.refillsAt, periodEnd.toISOString());
      assert.match(result.message, /^Your next free conversation is ready /);
    }
  });

  test('a refusal with no known refill omits refillsAt rather than sending an empty one', async () => {
    for (const entitlement of [
      { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod },
      { plan: 'starter', secondsUsed: PLANS.starter.secondsPerPeriod, periodEnd: new Date('2026-11-01T00:00:00.000Z') },
      { plan: 'trial', secondsUsed: PLANS.trial.secondsPerPeriod - 30, periodEnd: new Date('2026-10-22T05:00:00.000Z') },
    ] as Entitlement[]) {
      const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement, config });
      assert.equal(result.ok, false);
      if (!result.ok) assert.ok(!('refillsAt' in result), `${entitlement.plan} refusal leaked a refillsAt`);
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
    const metadata = JSON.parse(claims.metadata);
    assert.equal(metadata.lessonId, 'cafe-01');
    assert.equal(metadata.sessionId, result.grant.sessionId);
    assert.equal(claims.video.room, result.grant.roomName);
    assert.equal(claims.video.roomJoin, true);
  });

  test('the learner may publish audio and data, but is granted nothing else', async () => {
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: { plan: 'starter', secondsUsed: 0 }, config });
    assert.ok(result.ok);
    if (!result.ok) return;
    const claims = JSON.parse(Buffer.from(result.grant.token.split('.')[1]!, 'base64url').toString('utf8'));
    assert.equal(claims.video.canPublish, true);
    assert.deepEqual(claims.video.canPublishSources, ['microphone']);
    assert.equal(claims.video.canPublishData, true);
    assert.notEqual(claims.video.roomAdmin, true, 'a learner must never hold admin rights on the room');
    assert.notEqual(claims.video.roomCreate, true);
    assert.equal(claims.roomConfig.maxParticipants, 2);
    assert.equal(claims.roomConfig.emptyTimeout, 30);
  });

  /**
   * F78, filed as a capacity note rather than a defect and closed the way a
   * capacity note should be: the numbers are written down with what they cost,
   * so the next person to change one has to change the cost with it — and the
   * cost is the measured one, not the one the ledger assumed.
   */
  test('the production empty-room timeout is recorded with its worker-occupancy cost', async () => {
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: { plan: 'starter', secondsUsed: 0 }, config });
    assert.ok(result.ok);
    if (!result.ok) return;
    const claims = JSON.parse(Buffer.from(result.grant.token.split('.')[1]!, 'base64url').toString('utf8'));

    // What ships and what is written down are the same numbers. A grant that
    // quietly stopped agreeing with the record is the first thing this catches.
    assert.equal(claims.roomConfig.emptyTimeout, ROOM_LIFECYCLE.emptyTimeoutSec);
    assert.equal(claims.roomConfig.departureTimeout, ROOM_LIFECYCLE.departureTimeoutSec);
    assert.equal(claims.roomConfig.maxParticipants, ROOM_LIFECYCLE.maxParticipants);
    assert.equal(ROOM_LIFECYCLE.emptyTimeoutSec, 30, 'production keeps an empty room for half a minute');

    const { emptyRoom, departedRoom } = ROOM_LIFECYCLE.measured;

    // The empty-room hold tracks its configured timeout, so the 30 above really
    // does mean thirty seconds of room and not some shorter number.
    assert.ok(emptyRoom.heldSec >= emptyRoom.emptyTimeoutSec, 'a room that closed early would make the timeout meaningless');
    assert.ok(emptyRoom.heldSec < emptyRoom.emptyTimeoutSec + 5, 'and one that overran it by much would mean the record is wrong');

    // The cost of that hold is zero worker seconds, and this is the assertion
    // that keeps the two halves honest: dispatch follows a participant, so a
    // room nobody joined holds no tutor. If a future measurement ever sees a
    // tutor in an empty room, this pair stops agreeing and the run fails.
    assert.equal(emptyRoom.tutorDispatched, false, 'no tutor is dispatched into a room nobody joined');
    assert.equal(
      ROOM_LIFECYCLE.workerOccupancySecPerAbandonedRoom,
      0,
      'an abandoned room costs no worker time, because nothing was dispatched into it',
    );

    // The timeout that does hold a worker is the departure one, and its cost is
    // the whole window: the tutor stays in the room until LiveKit closes it.
    assert.ok(departedRoom.roomGoneAfterSec >= departedRoom.departureTimeoutSec, 'the room outlives the learner by the departure window');
    assert.equal(
      ROOM_LIFECYCLE.workerOccupancySecPerFinishedSession,
      ROOM_LIFECYCLE.departureTimeoutSec,
      'raising the departure timeout raises worker occupancy per session by exactly as much, and the record has to say so',
    );

    // No vendor minutes either way, which is why this is a capacity note and
    // not a money defect: nothing to recognise, speak or think about.
    assert.equal(claims.video.canPublishSources.length, 1, 'nothing but a microphone can ever be published into one of these rooms');
  });

  test('the join credential expires after five minutes', async () => {
    const result = await grantSession({ userId: 'u1', lessonId: 'cafe-01', entitlement: { plan: 'starter', secondsUsed: 0 }, config });
    assert.ok(result.ok);
    if (!result.ok) return;
    const claims = JSON.parse(Buffer.from(result.grant.token.split('.')[1]!, 'base64url').toString('utf8'));
    assert.ok(claims.exp - claims.nbf <= 300, 'a captured join token must have only a short replay window');
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

  test('server-owned revision is allowlisted into the signed metadata', async () => {
    const revision = { packId: 'saved', title: 'At a cafe', summary: 'Ordered coffee.', phrases: [{ fr: 'Un café', en: 'A coffee' }], correction: null };
    const meta = await metadataFor({ revision });
    assert.deepEqual(meta.revision, revision);
    assert.equal((await metadataFor({ revision: { ...revision, phrases: [{}] } as never })).revision, undefined);
    assert.equal((await metadataFor({})).revision, undefined);
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

  test('the onboarding goal in memory survives the token, locked or not', async () => {
    const snapshot = { cefr: 'A1', memory: { facts: [], opener: null, name: 'Sam', goal: 'moving' } };
    assert.deepEqual((await metadataFor({ snapshot })).snapshot, snapshot);
    const locked = await metadataFor({ snapshot, entitlement: { plan: 'trial', secondsUsed: 0 }, memoryLocked: true });
    assert.deepEqual(locked.snapshot, snapshot);
  });

  test('free, lapsed and guest sessions sign memoryLocked; paid sessions carry no key at all', async () => {
    const snapshot = { cefr: 'A1', sessions: 4 };
    const free = await metadataFor({ snapshot, entitlement: { plan: 'trial', secondsUsed: 0 }, memoryLocked: true });
    assert.equal(free.memoryLocked, true);
    assert.deepEqual(free.snapshot, snapshot, 'the snapshot is unchanged by the lock');
    const lapsed = await metadataFor({ snapshot, entitlement: { plan: 'trial', secondsUsed: 0, lapsed: true }, memoryLocked: true });
    assert.equal(lapsed.memoryLocked, true);
    assert.deepEqual(lapsed.snapshot, snapshot);
    for (const plan of ['starter', 'regular'] as const) {
      const paid = await metadataFor({ snapshot, entitlement: { plan, secondsUsed: 0 }, memoryLocked: false });
      assert.equal('memoryLocked' in paid, false, 'the key never appears as false');
      assert.deepEqual(paid.snapshot, snapshot);
    }
    assert.equal('memoryLocked' in (await metadataFor({})), false);
  });

  test('/session/start derives memoryLocked from the loaded entitlement on every admission path', () => {
    const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
    const call = source.slice(source.indexOf('const result = await grantSession({\n        userId,'));
    const body = call.slice(0, call.indexOf('});'));
    assert.match(body, /memoryLocked: entitlement\.plan === 'trial' \|\| entitlement\.lapsed === true,/);
    assert.ok(source.indexOf('const entitlement = await store.get(userId);') < source.indexOf(call.slice(0, 40)));
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

  test('the token server signs the mission id into the join metadata', async () => {
    const chosen = await metadataFor({ missionId: FIRST_MISSION, mode: 'convo' });
    assert.equal(chosen.missionId, FIRST_MISSION, 'the mission the learner chose has to reach the agent');

    const padded = await metadataFor({ missionId: `  ${FIRST_MISSION}  ` });
    assert.equal(padded.missionId, FIRST_MISSION, 'the trimmed key is what gets signed');

    // The catalogue is not this server's to hold. An id it has never heard of
    // is signed anyway; the agent resolves it and degrades to the ordinary
    // choosing question when it cannot. A copy of the list here would be a
    // second thing to keep in step.
    const unknown = await metadataFor({ missionId: 'mission:not-a-real-one' });
    assert.equal(unknown.missionId, 'mission:not-a-real-one');

    const malformed: unknown[] = [
      '',
      '   ',
      'a'.repeat(65),
      'mission:cafe droite', // a key has no spaces in it
      'mission:<script>',
      { id: FIRST_MISSION },
      42,
      [],
      null,
    ];
    for (const bad of malformed) {
      // metadataFor asserts the grant succeeded, which is the point: a bad
      // hint costs the learner their opening scene, never their session.
      const meta = await metadataFor({ missionId: bad });
      assert.equal('missionId' in meta, false, `missionId ${JSON.stringify(bad)} should have been dropped, not signed`);
      assert.equal(meta.mode, 'lesson', 'and the session still starts');
      assert.equal(meta.secondsRemaining, PLANS.starter.secondsPerPeriod, 'and nothing about the minutes changed');
    }

    const absent = await metadataFor({});
    assert.equal('missionId' in absent, false, 'no mission means no mission key at all');
  });

  test('the token server signs the tutor voice into the join metadata', async () => {
    const chosen = await metadataFor({ tutorVoice: 'celine', mode: 'convo' });
    assert.equal(chosen.tutorVoice, 'celine', 'the voice the learner chose has to reach the agent, because the agent is the only process that can turn it into a vendor id');

    const padded = await metadataFor({ tutorVoice: '  celine  ' });
    assert.equal(padded.tutorVoice, 'celine', 'the trimmed key is what gets signed, because the trimmed key is what the agent will look up');

    // Every catalogue key survives the trip. A voice the chooser offers and the
    // signer quietly drops is a preference that reverts to the default with no
    // sign that anything went wrong, which is the worst version of this bug.
    for (const key of Object.keys(TUTOR_VOICES)) {
      const meta = await metadataFor({ tutorVoice: key });
      assert.equal(meta.tutorVoice, key, `${key} is in the catalogue but never reaches the agent`);
    }

    const atTheCap = await metadataFor({ tutorVoice: 'a'.repeat(32) });
    assert.equal(atTheCap.tutorVoice, 'a'.repeat(32), 'a key exactly at the cap is a key');

    // Deliberately NOT checked against the catalogue, for the same reason the
    // mission id is not: the agent is the last hop before the billed vendor URL
    // and resolves the key there, so a second strict copy here would be a
    // second thing to keep in step and a way for the two to give different
    // answers about the same learner.
    const unknown = await metadataFor({ tutorVoice: 'someone-not-in-the-catalogue' });
    assert.equal(unknown.tutorVoice, 'someone-not-in-the-catalogue');

    const absent = await metadataFor({});
    assert.equal('tutorVoice' in absent, false, 'never having chosen means no key at all, and the agent opens on the default');

    // The hop before this one. The endpoint reads the field loosely and hands
    // it straight on; it decides nothing about it. Pinned against the source
    // because a passenger that is validated perfectly and then never forwarded
    // is exactly the bug this row of plumbing invites, and no unit of
    // grantSession can see it.
    const server = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
    assert.match(server, /const tutorVoice = typeof body\.tutorVoice === 'string'/, 'the endpoint no longer reads the tutor voice off the body');
    assert.match(server, /\.\.\.\(tutorVoice !== undefined \? \{ tutorVoice \} : \{\}\),/, 'the endpoint reads the tutor voice and then never hands it to grantSession');
  });

  test('a tutor voice that is not shaped like a key is dropped, never refused', async () => {
    const malformed: unknown[] = [
      '',
      '   ',
      'a'.repeat(33),
      'Celine', // a key is lowercase, and a stored preference differing only in case is not a second voice
      'céline', // the key is ASCII on purpose; the accent lives on the persona name, which is never signed
      '9lives', // a key starts with a letter
      'celine voice', // a key has no spaces in it
      'celine_2',
      'celine/../admin',
      '<script>',
      { key: 'celine' },
      42,
      true,
      [],
      null,
    ];
    for (const bad of malformed) {
      // metadataFor asserts the grant succeeded, which is the whole point: a
      // voice this server cannot read costs the learner their chosen tutor for
      // one session, never the session itself. They get the default and can
      // still speak French, which is what they came for.
      const meta = await metadataFor({ tutorVoice: bad });
      assert.equal('tutorVoice' in meta, false, `tutorVoice ${JSON.stringify(bad)} should have been dropped, not signed`);
      assert.equal(meta.mode, 'lesson', 'and the session still starts');
      assert.equal(meta.secondsRemaining, PLANS.starter.secondsPerPeriod, 'and nothing about the minutes changed');
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

  test('the same session report is consumed only once', async () => {
    const store = new InMemoryEntitlementStore();
    const sessionId = '123e4567-e89b-42d3-a456-426614174000';
    assert.equal(await store.recordSessionGrant('u1', sessionId, await store.get('u1')), true);
    await store.consume('u1', 300, sessionId);
    const duplicate = await store.consume('u1', 300, sessionId);
    assert.equal(duplicate.secondsUsed, 300);
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
    assert.equal(developmentEntitlementsEnabled({ LUVANI_DEV_UNLIMITED_MINUTES: '1' }), true);
    assert.equal(
      developmentEntitlementsEnabled({ LUVANI_DEV_UNLIMITED_MINUTES: '1', NODE_ENV: 'production' }),
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

test('guest grant signs one admitted room, actual tutor choice and complete brief without changing account allowance', async () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  for (const tutorVoice of ['emilie','alexandre'] as const) {
    const brief = {version:1,goals:['food','trip'],level:'zero',confidence:'hesitant',focus:'speaking',minutes:20,tutorVoice};
    const result = await grantSession({userId:'22222222-2222-4222-8222-222222222222',lessonId:'convo-01',mode:'convo',config,
      entitlement:{plan:'trial',secondsUsed:0},tutorVoice,firstPractice:brief,
      guest:{key:'a'.repeat(43),sessionId,roomName:`luvani-${sessionId}`,maxSeconds:1260}});
    assert.ok(result.ok); if (!result.ok) continue;
    const claims = JSON.parse(Buffer.from(result.grant.token.split('.')[1]!, 'base64url').toString());
    const meta = JSON.parse(claims.metadata); assert.deepEqual(meta.firstPractice,brief); assert.equal(meta.tutorVoice,tutorVoice);
    assert.equal(meta.secondsRemaining,1260); assert.equal(meta.guestLifecycleKey,'a'.repeat(43)); assert.equal(meta.lifecycleVersion,1);
    assert.equal(result.grant.sessionId,sessionId); assert.equal(claims.video.room,`luvani-${sessionId}`);
  }
});
