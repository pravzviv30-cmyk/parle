/**
 * Where the analytics answer lives, and which way it falls when it goes wrong.
 *
 * The store is one boolean, so the interesting questions are all about the
 * edges rather than the round trip. Three of them are held here.
 *
 * **Whose answer is it.** Two accounts share a phone, and the one thing a
 * consent must never do is leak across them: one person agreeing to be measured
 * on another person's behalf is the worst version of this feature. So the key is
 * asserted literally, both accounts are driven through the same disk, a
 * signed-out read is asserted to be a crash rather than a shared key, and a
 * write already queued when the account changes is asserted to land in the
 * account that asked for it. A reset is run end to end rather than checked
 * against a list, because a suffix present in `USER_KEY_SUFFIXES` and a key a
 * reset actually reaches are two different claims — and for this key the reset
 * is the erasure a learner asked for.
 *
 * **Which way a corrupt blob falls.** Every unreadable shape resolves to *no
 * record at all*. That asymmetry is the whole point: reading junk as agreement
 * would send events for someone who never said yes, which is the exact failure
 * the consent exists to prevent. `null` is deliberately not `{ allowed: false }`
 * either, because "never asked" and "asked and declined" are different facts and
 * the screen that draws the switch has to be able to tell them apart.
 *
 * **What a write is allowed to claim.** The store answers `PersistAck`, and two
 * taps made in one beat are serialised, so the disk ends up holding the tap the
 * learner finished on rather than whichever `setItem` the platform happened to
 * resolve last.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadConsent, saveConsent } from './consentStore.ts';
import { clearActiveUserData, setActiveUser, USER_KEY_SUFFIXES } from '../storage/scope.ts';

/**
 * One in-memory AsyncStorage, so the round trip is the real store's.
 *
 * The same double reminders/store.test.ts uses: every module imports the same
 * object, so assigning the methods onto it is enough. `refuse` is a phone with
 * no room for one key, and `hold` is a platform that has not finished the first
 * write when the second is asked for.
 */
function installDisk(opts: { refuse?: (key: string) => boolean; hold?: (call: number) => Promise<void> } = {}): {
  map: Map<string, string>;
  order: string[];
} {
  const map = new Map<string, string>();
  const order: string[] = [];
  let calls = 0;
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = async (key: string, value: string): Promise<void> => {
    const call = ++calls;
    const allowed = String((JSON.parse(value) as { consent?: { allowed?: boolean } }).consent?.allowed ?? '?');
    order.push(`start ${allowed}`);
    if (opts.hold) await opts.hold(call);
    if (opts.refuse?.(key)) throw new Error('QuotaExceededError');
    map.set(key, value);
    order.push(`done ${allowed}`);
  };
  shared.removeItem = (key: string): Promise<void> => {
    map.delete(key);
    return Promise.resolve();
  };
  shared.multiRemove = (keys: string[]): Promise<void> => {
    for (const key of keys) map.delete(key);
    return Promise.resolve();
  };
  return { map, order };
}

let uids = 0;
const nextUid = (): string => `44444444-4444-4444-8444-${String(++uids).padStart(12, '0')}`;

/** The audio sweep a reset runs first, stubbed: this suite is about one key. */
const noAudio = (): { removed: number; failed: number } => ({ removed: 0, failed: 0 });

describe('the analytics consent store — whose answer it is', () => {
  test("the consent store keeps the answer under the signed-in learner's own key", async () => {
    const disk = installDisk();
    const mine = nextUid();
    const theirs = nextUid();

    setActiveUser(mine);
    assert.equal(await loadConsent(), null, 'a learner nobody has asked yet must read as no record, not as an answer');

    assert.equal(await saveConsent({ allowed: true }), 'durable');
    assert.deepEqual(
      [...disk.map.keys()],
      [`luvani.u.${mine}.analytics`],
      "the answer landed somewhere other than this account's own key",
    );
    assert.deepEqual(await loadConsent(), { allowed: true }, 'a saved consent did not read back');

    // The second account on the same phone. A consent is a permission one
    // person gave about their own data; the other one must not inherit it, and
    // must not overwrite it either.
    setActiveUser(theirs);
    assert.equal(await loadConsent(), null, "a second account on this phone inherited the first one's consent");
    assert.equal(await saveConsent({ allowed: false }), 'durable');
    assert.deepEqual(await loadConsent(), { allowed: false }, 'a declined consent is a stored answer, not an absence');

    setActiveUser(mine);
    assert.deepEqual(
      await loadConsent(),
      { allowed: true },
      "the second account wrote over the first one's answer",
    );

    // Signed out is a crash, on purpose. An un-namespaced fallback here is one
    // account agreeing to be measured on another account's behalf.
    setActiveUser(null);
    assert.throws(() => loadConsent(), /no signed-in user/, 'a signed-out read resolved to some shared key');
    assert.throws(() => saveConsent({ allowed: true }), /no signed-in user/);

    // A write already queued when the account changes belongs to the account
    // that asked for it. The chain defers the write by a microtask, so the
    // switch below really does land in the middle of it.
    setActiveUser(mine);
    const inFlight = saveConsent({ allowed: false });
    setActiveUser(theirs);
    assert.equal(await inFlight, 'durable');
    assert.deepEqual(
      await loadConsent(),
      { allowed: false },
      "a queued write followed the account switch into somebody else's namespace",
    );
    setActiveUser(mine);
    assert.deepEqual(await loadConsent(), { allowed: false }, 'the queued write did not land in the account that asked');

    // And a data reset reaches it. Run end to end rather than asserted against
    // the list, because a suffix in USER_KEY_SUFFIXES and a key a reset really
    // clears are two different claims. The membership is asserted too, since
    // that is the mechanism, and a missing entry should say so by name.
    assert.equal(
      (USER_KEY_SUFFIXES as readonly string[]).includes('analytics'),
      true,
      'the analytics suffix is not on the reset list, so a deleted account keeps its consent and the export omits it',
    );
    await clearActiveUserData({ sweepAudio: noAudio });
    assert.equal(disk.map.has(`luvani.u.${mine}.analytics`), false, 'a data reset left the consent key on the device');
    assert.equal(await loadConsent(), null, 'a reset learner still has an answer on file they did not give again');
    setActiveUser(null);
  });
});

describe('the analytics consent store — which way a bad blob falls', () => {
  test('nothing readable under the consent key is no record at all, never a yes', async () => {
    // Every one of these is an answer this build cannot read. Reading any of
    // them as agreement would send events for a learner who never said yes.
    const unreadable: readonly (string | null)[] = [
      null,
      '',
      'not json at all',
      '{"version":2,"consent":{"allowed":true}}',
      '{"version":0,"consent":{"allowed":true}}',
      '{"consent":{"allowed":true}}',
      '{"version":1}',
      '{"version":1,"consent":null}',
      '{"version":1,"consent":{}}',
      '{"version":1,"consent":{"allowed":"true"}}',
      '{"version":1,"consent":{"allowed":1}}',
      '[{"version":1,"consent":{"allowed":true}}]',
    ];

    for (const blob of unreadable) {
      const disk = installDisk();
      const uid = nextUid();
      setActiveUser(uid);
      if (blob !== null) disk.map.set(`luvani.u.${uid}.analytics`, blob);

      assert.equal(await loadConsent(), null, `this read as an answer rather than as nothing: ${blob}`);
      setActiveUser(null);
    }

    // Storage itself refusing the read is the same answer, not a crash on the
    // screen that draws the switch.
    const uid = nextUid();
    installDisk();
    (AsyncStorage as unknown as Record<string, unknown>).getItem = (): Promise<string> =>
      Promise.reject(new Error('storage unavailable'));
    setActiveUser(uid);
    assert.equal(await loadConsent(), null, 'a storage failure took the caller down with it');
    setActiveUser(null);

    // And a real `false` is kept as a real `false`. Withdrawal is an answer the
    // learner gave, not an empty slot: clearing the key instead would make a
    // withdrawal indistinguishable from never having been asked, and the first
    // run would ask again as if nothing had been said.
    const declined = nextUid();
    const disk = installDisk();
    setActiveUser(declined);
    assert.equal(await saveConsent({ allowed: false }), 'durable');
    assert.deepEqual(await loadConsent(), { allowed: false });
    assert.equal(
      disk.map.has(`luvani.u.${declined}.analytics`),
      true,
      'saying no cleared the key, so a withdrawal reads as a learner nobody has asked',
    );
    setActiveUser(null);
  });
});

describe('the analytics consent store — what a write is allowed to claim', () => {
  test('two consent taps in one beat leave the disk holding the last one, and a refused write says so', async () => {
    // The learner turns the switch on, thinks again and turns it off. Without a
    // chain the two setItem calls race, and the phone that finishes the first
    // one last leaves the disk holding yes while the screen shows off.
    const disk = installDisk({ hold: (call) => (call === 1 ? new Promise((r) => setTimeout(r, 10)) : Promise.resolve()) });
    const uid = nextUid();
    setActiveUser(uid);

    const first = saveConsent({ allowed: true });
    const second = saveConsent({ allowed: false });
    assert.deepEqual(await Promise.all([first, second]), ['durable', 'durable']);

    assert.deepEqual(
      disk.order,
      ['start true', 'done true', 'start false', 'done false'],
      'the two writes overlapped, so which one the disk keeps is decided by the platform',
    );
    assert.deepEqual(
      await loadConsent(),
      { allowed: false },
      'the disk kept the tap the learner changed away from, so a withdrawal was lost to a race',
    );
    setActiveUser(null);

    // A phone with no room says so rather than resolving as if it had landed.
    // Nobody downstream may believe the answer survives this launch.
    const full = nextUid();
    const refused = installDisk({ refuse: (key) => key === `luvani.u.${full}.analytics` });
    setActiveUser(full);
    assert.equal(
      await saveConsent({ allowed: true }),
      'failed',
      'a refused write answered as if it had landed, so a switch would claim an answer the disk does not hold',
    );
    assert.equal(refused.map.has(`luvani.u.${full}.analytics`), false, "the test's own disk did not actually refuse the write");
    assert.equal(await loadConsent(), null, 'a refused write left something readable behind');
    setActiveUser(null);
  });
});
