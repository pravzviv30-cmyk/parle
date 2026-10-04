import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStarter, starterTasks } from '@luvani/core';
import { continuingTask, repairGuestPractice, type GuestPractice } from './guestModel.ts';
import { freshPreAccountDraft } from './preAccountDraft.ts';
const fixture = (): GuestPractice => ({ version: 2, token: null, id: null, expiresAt: 0, secondsUsed: 0, attempts: [], kept: false, completed: false, plan: { ...freshPreAccountDraft(), eligibilityConfirmed: true, reason: 'trip', minutes: 15 } });
test('corrupt disk cannot invent eligibility, tokens, usage, task evidence or a saved acknowledgement', () => {
  const guest = fixture(); assert.deepEqual(repairGuestPractice(guest), { ...guest, offline: false, speechAvailable: false });
  for (const change of [{ version: 1 }, { token: 'token' }, { secondsUsed: NaN }, { secondsUsed: 361 }, { plan: { ...guest.plan, eligibilityConfirmed: 'true' } }, { attempts: [{ taskId: 'foreign-task' }] }]) assert.equal(repairGuestPractice({ ...guest, ...change }), null);
  assert.equal(repairGuestPractice({ ...guest, kept: 'yes' })?.kept, false);
});
test('continuation stays on an unaccepted reply and retries the exact task after acceptance', () => {
  const guest = fixture(); const first = starterTasks('trip', 'coffee', 15)[0]!;
  assert.equal(continuingTask(guest).id, first.id);
  guest.attempts.push({ taskId: first.id, reply: 'xyz', feedback: checkStarter(first, 'xyz', 'typed'), at: 1, offline: true });
  assert.equal(continuingTask(guest).id, first.id);
  guest.attempts[0] = { ...guest.attempts[0]!, reply: first.model, feedback: checkStarter(first, first.model, 'typed') };
  assert.equal(continuingTask(guest).id, starterTasks('trip', 'coffee', 15)[1]!.id);
  assert.equal(continuingTask(guest, true).id, first.id);
});
test('changing a goal for offline practice preserves guest capability and usage for later reconciliation', async () => {
  const { offlineContinuation } = await import('./guestModel.ts');
  const prior = { ...fixture(), token: 'a'.repeat(43), id: '00000000-0000-4000-8000-000000000000', expiresAt: 9000, secondsUsed: 17 };
  const next = offlineContinuation({ ...prior.plan, reason: 'work' }, prior);
  assert.equal(next.token, prior.token); assert.equal(next.id, prior.id); assert.equal(next.secondsUsed, 17); assert.equal(next.plan.reason, 'work'); assert.equal(next.offline, true); assert.deepEqual(next.attempts, []); assert.ok(repairGuestPractice(next));
});

test('stored speech availability defaults off and accepts only a service boolean', () => {
  for (const value of [undefined, null, 'true', 1]) assert.equal(repairGuestPractice({ ...fixture(), speechAvailable: value })?.speechAvailable, false);
  assert.equal(repairGuestPractice({ ...fixture(), speechAvailable: true })?.speechAvailable, true);
});
