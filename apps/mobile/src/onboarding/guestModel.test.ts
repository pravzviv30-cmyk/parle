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

test('a guest streak day counts only a practice saved as finished', async () => {
  const { MAX_GUEST_FINISHES, finishGuestPractice, guestPracticeDays, offlineContinuation } = await import('./guestModel.ts');
  const utcDay = (at: number): string => new Date(at).toISOString().slice(0, 10);
  const days = (value: unknown): string[] => guestPracticeDays(repairGuestPractice(JSON.parse(JSON.stringify(value))), utcDay);
  const first = starterTasks('trip', 'coffee', 15)[0]!;
  const at = Date.UTC(2026, 9, 5, 9);

  // Replies on a practice that was never finished are not a day.
  const open = { ...fixture(), attempts: [{ taskId: first.id, reply: first.model, feedback: checkStarter(first, first.model, 'typed'), at, offline: true }] };
  assert.deepEqual(days(open), [], 'an unfinished practice counted as a streak day');
  // Nor is a record written before finishes were kept, even one marked completed:
  // the day it finished was never written down, so it is not one this phone can vouch for.
  assert.deepEqual(days({ ...open, completed: true }), []);
  assert.equal(repairGuestPractice({ ...open, completed: true })?.finishedAt, undefined);

  // Saved as finished, it is one day, and it survives the disk.
  const finished = finishGuestPractice(open, at, utcDay);
  assert.equal(finished.completed, true);
  assert.deepEqual(days(finished), ['2026-10-05']);
  // Finishing again that day is still one day, and keeps one instant; the next day is a second.
  const twice = finishGuestPractice(finishGuestPractice(finished, at + 3_600_000, utcDay), at + 86_400_000, utcDay);
  assert.deepEqual(days(twice), ['2026-10-05', '2026-10-06']);
  assert.deepEqual(repairGuestPractice(twice)?.finishedAt, [at, at + 86_400_000]);
  // A replayed finish instant is one instant.
  assert.equal(finishGuestPractice(finished, at, utcDay).finishedAt?.length, 1);
  // Many finishes in one day never push an earlier day out of the bound.
  let busy = twice;
  for (let n = 1; n <= 40; n += 1) busy = finishGuestPractice(busy, at + 86_400_000 + n * 60_000, utcDay);
  assert.deepEqual(days(busy), ['2026-10-05', '2026-10-06'], 'a busy day pushed an earlier finished day out');

  // Bounded: the newest 31 finishes, oldest first.
  let many = finished;
  for (let n = 1; n <= 40; n += 1) many = finishGuestPractice(many, at + n * 86_400_000, utcDay);
  assert.equal(many.finishedAt?.length, MAX_GUEST_FINISHES);
  assert.equal(many.finishedAt?.at(-1), at + 40 * 86_400_000, 'the bound dropped the newest finish');

  // Junk on the disk is not a finish.
  const junk = repairGuestPractice({ ...open, finishedAt: ['yesterday', Number.NaN, -1, 1.5, 9e15, null, at] });
  assert.deepEqual(junk?.finishedAt, [at]);
  assert.deepEqual(repairGuestPractice({ ...open, finishedAt: 'lots' })?.finishedAt, undefined);

  // A new plan keeps the days already finished; it does not restart them.
  const replanned = offlineContinuation({ ...finished.plan, reason: 'work' }, finished);
  assert.deepEqual(guestPracticeDays(replanned, utcDay), ['2026-10-05']);
  assert.deepEqual(guestPracticeDays(null), []);
});

test('stored speech availability defaults off and accepts only a service boolean', () => {
  for (const value of [undefined, null, 'true', 1]) assert.equal(repairGuestPractice({ ...fixture(), speechAvailable: value })?.speechAvailable, false);
  assert.equal(repairGuestPractice({ ...fixture(), speechAvailable: true })?.speechAvailable, true);
});
