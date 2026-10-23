import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { buildConversationPack } from '@luvani/core';
import { MemoryGuestStore, claimGuest, createGuest, guestKey } from './onboardingGuest.ts';
import { endGuestLive, guestLiveOperation, guestLiveResult, prepareGuestLive, prepareGuestScene } from './guestLive.ts';
import { MemoryGuestSceneLedger, guestSceneAdmission, guestSceneKeys } from './guestSceneAdmission.ts';
import { tutorDigest } from '../../shared/tutorLifecycle.ts';

async function scene(mode: 'lesson' | 'lesson-text' = 'lesson', ceiling = 24) {
  let time = Date.now();
  const store = new MemoryGuestStore(() => time), ledger = new MemoryGuestSceneLedger(() => time);
  const admission = guestSceneAdmission(ledger, ceiling);
  const guest = await createGuest(store, { installation: `scene-${randomUUID()}`, eligible: true, goal: 'food', drink: 'coffee', minutes: 5, scene: 'guest-cafe' }, time);
  const key = guestKey(guest.token);
  const room = await prepareGuestScene(store, key, mode, time);
  const fence = randomUUID();
  const claimBody = { userId: guest.id, sessionId: room.sessionId, roomName: room.roomName, mode, claimNonce: fence };
  const op = (name: string, body: Record<string, unknown>) => guestLiveOperation(store, key, name, body, time, admission);
  const report = (revision: number, fields: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const payload = { revision, seconds: 5, learnerTurns: 1, serviceFailure: null, baseline: null, firstPracticeComplete: false, sceneTurns: ['t1-greet'], ...fields };
    return { userId: guest.id, sessionId: room.sessionId, fence, ...payload, digest: tutorDigest(payload), ...extra };
  };
  return { store, ledger, admission, guest, key, room, fence, claimBody, op, report, advance: (ms: number) => { time += ms; }, now: () => time,
    used: () => ledger.used(guestSceneKeys.day(time)) };
}

test('a scene claim requires the signed mode, books one slot, and a repeat with the same fence books nothing', async () => {
  for (const mode of ['lesson', 'lesson-text'] as const) {
    const f = await scene(mode);
    await assert.rejects(f.op('claim', { ...f.claimBody, mode: 'convo' }), 'a convo-mode claim on a scene room is refused');
    await assert.rejects(f.op('claim', { ...f.claimBody, mode: mode === 'lesson' ? 'lesson-text' : 'lesson' }));
    assert.equal(await f.used(), 0, 'a refused claim books nothing');
    const claimed = await f.op('claim', f.claimBody) as { maxSeconds: number };
    assert.equal(claimed.maxSeconds, 180);
    assert.equal(await f.used(), 1);
    await f.op('claim', f.claimBody);
    assert.equal(await f.used(), 1);
    await assert.rejects(f.op('claim', { ...f.claimBody, claimNonce: randomUUID() }), 'a second worker cannot take the room');
    assert.equal(await f.used(), 1);
  }
});

test('a spent ceiling refuses the claim and leaves the room unclaimed', async () => {
  const f = await scene('lesson', 1);
  await f.admission.book(randomUUID(), f.now());
  await assert.rejects(f.op('claim', f.claimBody), /guest session unavailable/);
  assert.equal((await f.store.get(f.key))!.live!.fence, undefined);
});

test('a convo room still requires convo and never touches the scene ceiling', async () => {
  const store = new MemoryGuestStore(), ledger = new MemoryGuestSceneLedger(), now = Date.now();
  const guest = await createGuest(store, { installation: 'convo', eligible: true, goal: 'food', drink: 'coffee', minutes: 5 }, now);
  const key = guestKey(guest.token);
  const brief = { version: 1, goals: ['food'], level: 'zero', confidence: 'hesitant', focus: 'speaking', minutes: 5, tutorVoice: 'emilie' };
  const room = await prepareGuestLive(store, key, brief, now);
  await assert.rejects(prepareGuestScene(store, key, 'lesson', now), 'a convo capability cannot mint a scene room');
  const body = { userId: guest.id, sessionId: room.sessionId, roomName: room.roomName, claimNonce: randomUUID() };
  await assert.rejects(guestLiveOperation(store, key, 'claim', { ...body, mode: 'lesson' }, now, guestSceneAdmission(ledger, 24)));
  await guestLiveOperation(store, key, 'claim', { ...body, mode: 'convo' }, now, guestSceneAdmission(ledger, 24));
  assert.equal(await ledger.used(guestSceneKeys.day(now)), 0);
});

test('scene room grant: a bad mode is 400, brief churn and retries keep one room, a claimed room is never reissued', async () => {
  const f = await scene();
  await assert.rejects(prepareGuestScene(f.store, f.key, 'convo'), (e: { status?: number }) => e.status === 400);
  await assert.rejects(prepareGuestLive(f.store, f.key, { version: 1, goals: ['trip'], level: 'zero', confidence: 'hesitant', focus: 'speaking', minutes: 5, tutorVoice: 'emilie' }));
  f.advance(130_000);
  const retry = await prepareGuestScene(f.store, f.key, 'lesson-text', f.now());
  assert.equal(retry.sessionId, f.room.sessionId);
  assert.equal(retry.maxSeconds, 180);
  assert.equal(retry.joinDeadline, f.now() + 120_000);
  await f.op('claim', { ...f.claimBody, mode: 'lesson-text' });
  await assert.rejects(prepareGuestScene(f.store, f.key, 'lesson-text', f.now()));
});

test('checkpoint: valid turns with a null baseline pass; off-list, duplicate, shrinking, baseline and digest mismatches fail', async () => {
  const f = await scene();
  await f.op('claim', f.claimBody);
  f.advance(10_000);
  for (const bad of [
    f.report(1, { sceneTurns: ['t4-pastry'] }),
    f.report(1, { sceneTurns: ['t1-greet', 't1-greet'] }),
    f.report(1, { sceneTurns: 't1-greet' }),
    f.report(1, { sceneTurns: undefined }),
    f.report(1, { baseline: buildConversationPack({ id: f.room.sessionId, sessionId: f.room.sessionId, learnerId: f.guest.id,
      createdAt: new Date().toISOString(), title: { fr: 'Café', en: 'Café' }, summary: 'A coffee.', keyPhrases: [] }) }),
    f.report(1, {}, { digest: 'tampered' }),
    f.report(1, {}, { sceneTurns: ['t1-greet', 't2-order'] }),
  ]) await assert.rejects(f.op('checkpoint', bad), (e: { status?: number }) => e.status === 400);
  assert.equal(((await f.op('checkpoint', f.report(1, { sceneTurns: ['t2-order', 't1-greet'], learnerTurns: 2 }))) as { revision: number }).revision, 1);
  assert.deepEqual((await f.store.get(f.key))!.live!.sceneTurns, ['t1-greet', 't2-order'], 'kept in scene order');
  await assert.rejects(f.op('checkpoint', f.report(2, { sceneTurns: ['t1-greet'], learnerTurns: 2 })), 'the list never shrinks');
  await f.op('checkpoint', f.report(2, { sceneTurns: ['t1-greet', 't2-order', 't3-sur-place'], learnerTurns: 3 }));
  assert.equal((await f.store.get(f.key))!.live!.sceneTurns!.length, 3);
});

test('an expired worker can settle time but cannot add scene turns', async () => {
  const f = await scene();
  await f.op('claim', f.claimBody);
  f.advance(5000);
  await f.op('checkpoint', f.report(1, { sceneTurns: ['t1-greet'] }));
  f.advance(25_000);
  await assert.rejects(f.op('checkpoint', f.report(2, { sceneTurns: ['t1-greet', 't2-order'], learnerTurns: 2, seconds: 25 })));
  await f.op('complete', f.report(2, { sceneTurns: ['t1-greet', 't2-order'], learnerTurns: 2, seconds: 25, firstPracticeComplete: true }));
  const live = (await f.store.get(f.key))!.live!;
  assert.deepEqual(live.sceneTurns, ['t1-greet']);
  assert.equal(live.learnerTurns, 1);
  assert.equal(live.seconds, 25);
  assert.equal(live.outcome, 'interrupted');
});

test('results carry the scene and its turns with no pack; claim returns them and shrinks the record to 48 hours', async () => {
  const f = await scene();
  await f.op('claim', f.claimBody);
  f.advance(15_000);
  const done = f.report(1, { sceneTurns: ['t1-greet', 't2-order', 't3-sur-place', 't9-thanks', 't12-goodbye'], learnerTurns: 5, seconds: 15, firstPracticeComplete: true });
  await f.op('complete', done);
  const result = guestLiveResult((await f.store.get(f.key))!.live!, f.now());
  assert.equal(result.outcome, 'completed');
  assert.equal(result.pack, null);
  assert.equal(result.scene, 'guest-cafe');
  assert.deepEqual(result.sceneTurns, ['t1-greet', 't2-order', 't3-sur-place', 't9-thanks', 't12-goodbye']);
  const ended = await endGuestLive(f.store, f.key, f.now());
  assert.equal(ended.scene, 'guest-cafe');
  assert.equal(ended.sceneTurns?.length, 5);
  await claimGuest(f.store, f.guest.token, 'account-a', f.now());
  await f.store.shrinkClaimed(f.key, 'account-a');
  const shrunk = (await f.store.get(f.key))!;
  assert.equal(shrunk.live, undefined, 'no room, brief or pack is kept');
  assert.deepEqual(shrunk.sceneTurns?.length, 5);
  assert.ok(f.store.ttlUntil.get(f.key)! - f.now() <= 48 * 3600_000);
  assert.equal((await claimGuest(f.store, f.guest.token, 'account-a', f.now())).owner, 'account-a');
  await assert.rejects(claimGuest(f.store, f.guest.token, 'account-b', f.now()), /already claimed/);
  f.advance(48 * 3600_000 + 1);
  assert.equal(await f.store.get(f.key), null);
});

test('a safety stop keeps no scene turns for adoption', async () => {
  const f = await scene();
  await f.op('claim', f.claimBody);
  f.advance(5000);
  await f.op('checkpoint', f.report(1, { sceneTurns: ['t1-greet'] }));
  await f.op('complete', f.report(2, { sceneTurns: ['t1-greet'], firstPracticeStopped: true }));
  const live = (await f.store.get(f.key))!.live!;
  assert.deepEqual(live.sceneTurns, []);
  assert.equal(live.outcome, 'interrupted');
});
