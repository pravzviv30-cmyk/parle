import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversationPack, DEFAULT_TUTOR_VOICE, type FirstPracticeBrief } from '@luvani/core';
import { MemoryGuestStore, createGuest, guestKey, claimGuest } from './onboardingGuest.ts';
import { guestLiveOperation, guestLiveResult, prepareGuestLive } from './guestLive.ts';
import { claimSessionLifecycle } from '../../tutor-agent/src/sessionLifecycle.ts';
import { tutorDigest } from '../../shared/tutorLifecycle.ts';
const brief: FirstPracticeBrief = { version: 1, goals: ['trip', 'food'], level: 'zero', confidence: 'hesitant', focus: 'speaking', minutes: 20, tutorVoice: DEFAULT_TUTOR_VOICE };
async function fixture() {
  let time = Date.now(); const start = time, store = new MemoryGuestStore();
  const guest = await createGuest(store, { installation: 'device', eligible: true, goal: 'food', drink: 'coffee', minutes: 15 }, time);
  const key = guestKey(guest.token), room = await prepareGuestLive(store, key, brief, time);
  const identity = { userId: guest.id, sessionId: room.sessionId, roomName: room.roomName, mode: 'convo' as const };
  const pack = buildConversationPack({ id: room.sessionId, sessionId: room.sessionId, learnerId: guest.id,
    createdAt: new Date(time).toISOString(), title: { fr: 'Au restaurant', en: 'At a restaurant' }, summary: 'You asked for a table.',
    keyPhrases: [{ fr: 'Une table pour deux.', frWritten: null, en: 'A table for two.' }] });
  const calls: {op: string; body: Record<string, unknown>}[] = [];
  const life = await claimSessionLifecycle(identity, { guestKey: key, now: () => time - start, automaticTimers: false,
    call: async (op, body) => { calls.push({op, body: structuredClone(body)}); return await guestLiveOperation(store, key, op, body, time); } });
  return { store, guest, key, room, identity, pack, life, calls, advance: (ms: number) => { time += ms; }, now: () => time,
    result: async () => guestLiveResult((await store.get(key))!.live!, time) };
}
test('real worker lifecycle settles a confirmed guest objective and one account can adopt it idempotently', async () => {
  const f = await fixture(); assert.equal(f.life.maxSeconds, 1260);
  f.advance(8000); await f.life.heartbeat();
  f.advance(4000); await f.life.checkpoint({ learnerTurns: 1, baseline: f.pack, firstPracticeComplete: true });
  assert.equal((await f.result()).outcome, 'active');
  await assert.rejects(claimGuest(f.store, f.guest.token, 'account-a', f.now()));
  const settled = await f.life.complete({ learnerTurns: 1 }); assert.equal(settled.kind, 'charged');
  const result = await f.result(); assert.equal(result.outcome, 'completed'); assert.equal(result.seconds, 12); assert.equal(result.pack?.sessionId, f.room.sessionId);
  assert.equal((await claimGuest(f.store, f.guest.token, 'account-a', f.now())).seconds, 12);
  assert.equal((await claimGuest(f.store, f.guest.token, 'account-a', f.now())).seconds, 12);
  await assert.rejects(claimGuest(f.store, f.guest.token, 'account-b', f.now()));
});
test('user ending without objective evidence is partial; zero participation spends nothing', async () => {
  const f = await fixture(); f.advance(5000);
  const settled = await f.life.complete({ learnerTurns: 0 }); assert.equal(settled.kind, 'not-charged');
  assert.equal((await f.result()).outcome, 'partial');
  assert.equal((await claimGuest(f.store, f.guest.token, 'account', f.now())).seconds, 0);
});
test('expired lease preserves only acknowledged evidence and cannot be promoted by a stale worker', async () => {
  const f = await fixture(); f.advance(5000); await f.life.checkpoint({ learnerTurns: 1, baseline: f.pack });
  f.advance(21000); assert.equal((await f.result()).outcome, 'interrupted');
  await assert.rejects(f.life.checkpoint({ learnerTurns: 2, baseline: f.pack, firstPracticeComplete: true }));
  await f.life.complete({ learnerTurns: 2, firstPracticeComplete: true });
  assert.equal((await f.result()).outcome, 'interrupted'); assert.equal((await f.result()).learnerTurns, 1);
});
test('provider failure cannot become a full completion or a trial debit', async () => {
  const f = await fixture(); f.advance(5000); await f.life.checkpoint({ learnerTurns: 1, baseline: f.pack, firstPracticeComplete: true });
  const result = await f.life.complete({ learnerTurns: 1, serviceFailure: 'tts_error' }); assert.equal(result.kind, 'not-charged');
  assert.equal((await f.result()).outcome, 'interrupted'); assert.equal((await claimGuest(f.store, f.guest.token, 'account', f.now())).seconds, 0);
});
test('different worker, user, room and invalid or cross-owned pack are rejected', async () => {
  const f = await fixture(); const claim = f.calls[0]!.body;
  for (const patch of [{ userId: f.room.sessionId }, { claimNonce: f.guest.id }, { roomName: 'another' }])
    await assert.rejects(guestLiveOperation(f.store, f.key, 'claim', { ...claim, ...patch }, f.now()));
  const payload = { revision: 1, seconds: 1, learnerTurns: 1, serviceFailure: null, baseline: {...f.pack, learnerId: f.room.sessionId}, firstPracticeComplete: true };
  await assert.rejects(guestLiveOperation(f.store, f.key, 'checkpoint', { ...f.identity, fence: claim.claimNonce, ...payload, digest: tutorDigest(payload) }, f.now()));
  await f.life.complete({learnerTurns:0});
});
test('lost completion response returns the same receipt and cannot alter a completed record', async () => {
  const f = await fixture(); f.advance(1000); await f.life.checkpoint({ learnerTurns: 1, baseline: f.pack, firstPracticeComplete: true });
  await f.life.complete({ learnerTurns: 1 }); const body = f.calls.find(c => c.op === 'complete')!.body;
  const first = await guestLiveOperation(f.store, f.key, 'complete', body, f.now());
  assert.deepEqual(await guestLiveOperation(f.store, f.key, 'complete', body, f.now()), first);
  await assert.rejects(guestLiveOperation(f.store, f.key, 'complete', { ...body, digest: 'tampered' }, f.now()));
});
test('an unclaimed connection retry retains its room and plan, while a claimed room cannot reopen', async () => {
  const store = new MemoryGuestStore(), now = Date.now(); const g = await createGuest(store, { installation: 'retry', eligible: true, goal: 'trip', drink: 'coffee', minutes: 5 });
  const first = await prepareGuestLive(store, guestKey(g.token), brief, now);
  const next = await prepareGuestLive(store, guestKey(g.token), brief, now + 130000); assert.equal(next.sessionId, first.sessionId);
  const revised = await prepareGuestLive(store, guestKey(g.token), {...brief, minutes: 5}, now);
  assert.notEqual(revised.sessionId, first.sessionId); assert.equal(revised.maxSeconds,360);
  const f = await fixture(); await assert.rejects(prepareGuestLive(f.store, f.key, brief)); await f.life.complete({learnerTurns:0});
});

test('closing before joining cancels outstanding grants and remains a partial session', async () => {
  const {endGuestLive} = await import('./guestLive.ts'); const now = Date.now(), store = new MemoryGuestStore();
  const g = await createGuest(store,{installation:'close',eligible:true,goal:'food',drink:'coffee',minutes:5});
  const key = guestKey(g.token), room = await prepareGuestLive(store,key,brief);
  assert.equal((await endGuestLive(store,key,now)).outcome,'partial');
  await assert.rejects(guestLiveOperation(store,key,'claim',{userId:g.id,sessionId:room.sessionId,roomName:room.roomName,mode:'convo',claimNonce:g.id},now));
});

test('a safety stop removes the acknowledged learning summary and awards neither completion nor charge', async () => {
  const f = await fixture(); f.advance(5000); await f.life.checkpoint({learnerTurns:1,baseline:f.pack,firstPracticeComplete:true});
  assert.equal((await f.life.complete({learnerTurns:1,firstPracticeStopped:true})).kind,'not-charged');
  const result = await f.result(); assert.equal(result.pack,null); assert.equal(result.outcome,'interrupted');
  assert.equal((await claimGuest(f.store,f.guest.token,'account',f.now())).seconds,0);
});
