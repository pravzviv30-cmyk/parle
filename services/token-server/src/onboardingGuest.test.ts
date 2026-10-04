import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MemoryGuestStore,
  createGuest,
  guestAttempt,
  claimGuest,
  guestKey,
} from './onboardingGuest.ts';
test('guest requires eligibility, expires and never stores learner content', async () => {
  const store = new MemoryGuestStore();
  const input = {
    installation: 'device',
    eligible: true,
    goal: 'food' as const,
    drink: 'tea' as const,
    minutes: 5 as const,
  };
  await assert.rejects(createGuest(store, { ...input, eligible: false }));
  const guest = await createGuest(store, input);
  const response = await guestAttempt(store, guest.token, 'drink', 'Un thé, merci.', 'typed');
  assert.equal(response.accepted, true);
  assert.equal(JSON.stringify(await store.get(guestKey(guest.token))).includes('merci'), false);
  await assert.rejects(
    guestAttempt(store, guest.token, 'drink', 'Un thé.', 'typed', guest.expiresAt + 1),
  );
  await assert.rejects(createGuest(store, input));
});
test('parallel requests get two attempts total, claim binds one account and is retryable', async () => {
  const store = new MemoryGuestStore();
  const g = await createGuest(store, {
    installation: 'a',
    eligible: true,
    goal: 'work',
    drink: 'coffee',
    minutes: 5,
  });
  const attempts = await Promise.allSettled(
    Array.from({ length: 8 }, () => guestAttempt(store, g.token, 'colleague', 'Bonjour.', 'typed')),
  );
  assert.equal(attempts.filter((x) => x.status === 'fulfilled').length, 2);
  const row = await claimGuest(store, g.token, 'account-a');
  assert.equal(row.owner, 'account-a');
  assert.equal((await claimGuest(store, g.token, 'account-a')).id, row.id);
  await assert.rejects(claimGuest(store, g.token, 'account-b'));
  await assert.rejects(guestAttempt(store, g.token, 'colleague', 'Bonjour.', 'typed'));
});
test('unknown tasks cannot spend attempts and bounded active time excludes idle time', async () => {
  const store = new MemoryGuestStore(); const now = Date.now();
  const guest = await createGuest(store, { installation: 'clock', eligible: true, goal: 'trip', drink: 'coffee', minutes: 15 }, now);
  await assert.rejects(guestAttempt(store, guest.token, 'drink', 'Un café.', 'typed', now + 100000, 90));
  assert.deepEqual((await store.get(guestKey(guest.token)))?.attempts, {});
  const reply = 'Bonjour, où est la gare ?';
  assert.equal((await guestAttempt(store, guest.token, 'directions', reply, 'typed', now + 3600000, 17)).secondsUsed, 17);
  assert.equal((await guestAttempt(store, guest.token, 'directions', reply, 'typed', now + 3700000, 9999)).secondsUsed, 137);
  await assert.rejects(guestAttempt(store, guest.token, 'directions', reply, 'typed', now + 3701000, 120));
  assert.equal((await store.get(guestKey(guest.token)))?.seconds, 137);
});
test('expired online practice can transfer once during retention without granting new attempts', async () => {
  const store = new MemoryGuestStore(); const now = Date.now();
  const guest = await createGuest(store, { installation: 'late', eligible: true, goal: 'food', drink: 'coffee', minutes: 5 }, now);
  const late = now + 2 * 86400000;
  await assert.rejects(guestAttempt(store, guest.token, 'drink', 'Un café.', 'typed', late));
  assert.equal((await claimGuest(store, guest.token, 'owner', late)).owner, 'owner');
  await assert.rejects(claimGuest(store, guest.token, 'other', late));
  await assert.rejects(claimGuest(store, guest.token, 'owner', now + 30 * 86400000));
});
