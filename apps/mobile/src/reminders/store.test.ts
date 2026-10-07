/**
 * Where the reminder's chosen time lives, and what it costs when it goes wrong.
 *
 * The store is small enough that the interesting questions are all about the
 * edges rather than the round trip. Three of them are held here.
 *
 * **Whose reminder is it.** Two accounts share a phone, and the one thing a
 * settings key must never do is leak across them: a partner signing in and
 * finding a notification they never asked for is the worst version of this
 * feature. So the key is asserted literally, both accounts are driven through
 * the same disk, a signed-out read is asserted to be a crash rather than a
 * shared key, and a write already queued when the account changes is asserted
 * to land in the account that asked for it. A reset is run end to end rather
 * than checked against a list, because a suffix present in `USER_KEY_SUFFIXES`
 * and a key a reset actually reaches are two different claims.
 *
 * **Which way a corrupt blob falls.** Every unreadable shape resolves to *off*.
 * That asymmetry is the whole point: reading junk as on would schedule a daily
 * notification nobody asked for, over a switch that reads Off, which the
 * learner then cannot turn off from the row that claims it already is.
 *
 * **What a write is allowed to claim.** The store answers `PersistAck`, and the
 * two taps a learner makes in one beat are serialised, so the disk ends up
 * holding the tap they finished on rather than whichever `setItem` the platform
 * happened to resolve last.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyLog, type ReminderLog } from './plan.ts';
import { DEFAULT_REMINDER_TIME, reminderRow } from './reminder.ts';
import {
  clearGuestReminderLog,
  loadGuestReminderLog,
  loadHeldPlan,
  loadReminder,
  loadReminderLog,
  saveGuestReminderLog,
  saveHeldPlan,
  saveReminder,
  saveReminderLog,
} from './store.ts';
import { clearActiveUserData, setActiveUser, USER_KEY_SUFFIXES } from '../storage/scope.ts';

/**
 * One in-memory AsyncStorage, so the round trip is the real store's.
 *
 * The same double storeBinding.test.ts and ack.test.ts use: every module
 * imports the same object, so assigning the methods onto it is enough. `refuse`
 * is a phone with no room for one key, and `hold` is a platform that has not
 * finished the first write when the second is asked for.
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
    const time = (JSON.parse(value) as { reminder?: { time?: string } }).reminder?.time ?? '?';
    order.push(`start ${time}`);
    if (opts.hold) await opts.hold(call);
    if (opts.refuse?.(key)) throw new Error('QuotaExceededError');
    map.set(key, value);
    order.push(`done ${time}`);
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
const nextUid = (): string => `55555555-5555-4555-8555-${String(++uids).padStart(12, '0')}`;

/** The audio sweep a reset runs first, stubbed: this suite is about one key. */
const noAudio = (): { removed: number; failed: number } => ({ removed: 0, failed: 0 });

describe('the reminder store — whose reminder it is', () => {
  test("the reminder store keeps the chosen time under the signed-in learner's own key", async () => {
    const disk = installDisk();
    const mine = nextUid();
    const theirs = nextUid();

    setActiveUser(mine);
    assert.equal(await loadReminder(), null, 'a learner who has never opened the sheet must read as nothing chosen');

    assert.equal(await saveReminder({ enabled: true, time: 'morning' }), 'durable');
    assert.deepEqual(
      [...disk.map.keys()],
      [`luvani.u.${mine}.reminder`],
      "the chosen time landed somewhere other than this account's own key",
    );
    assert.deepEqual(await loadReminder(), { enabled: true, time: 'morning' });

    // The second account on the same phone. A reminder is a decision one person
    // made about their own lock screen; the other one must not inherit it, and
    // must not overwrite it either.
    setActiveUser(theirs);
    assert.equal(await loadReminder(), null, "a second account on this phone inherited the first one's reminder");
    assert.equal(await saveReminder({ enabled: false, time: 'night' }), 'durable');

    setActiveUser(mine);
    assert.deepEqual(
      await loadReminder(),
      { enabled: true, time: 'morning' },
      "the second account wrote over the first one's choice",
    );

    // Signed out is a crash, on purpose. An un-namespaced fallback here is one
    // account scheduling a notification on another account's behalf.
    setActiveUser(null);
    assert.throws(() => loadReminder(), /no signed-in user/, 'a signed-out read resolved to some shared key');
    assert.throws(() => saveReminder({ enabled: true, time: 'lunch' }), /no signed-in user/);

    // A queued write is refused when its account scope changes before the
    // chain drains. It cannot land in either learner's namespace.
    setActiveUser(mine);
    const inFlight = saveReminder({ enabled: true, time: 'lunch' });
    setActiveUser(theirs);
    assert.equal(await inFlight, 'failed');
    assert.deepEqual(
      await loadReminder(),
      { enabled: false, time: 'night' },
      "a queued write followed the account switch into somebody else's namespace",
    );
    setActiveUser(mine);
    assert.deepEqual(await loadReminder(), { enabled: true, time: 'morning' });

    // And a data reset reaches it. Run end to end rather than asserted against
    // the list, because a suffix in USER_KEY_SUFFIXES and a key a reset really
    // clears are two different claims. The membership is asserted too, since
    // that is the mechanism, and a missing entry should say so by name.
    assert.equal(
      (USER_KEY_SUFFIXES as readonly string[]).includes('reminder'),
      true,
      'the reminder suffix is not on the reset list, so a cleared account keeps its reminder',
    );
    await clearActiveUserData({ sweepAudio: noAudio });
    assert.equal(disk.map.has(`luvani.u.${mine}.reminder`), false, 'a data reset left the reminder key on the device');
    assert.equal(await loadReminder(), null, "a reset learner still has a reminder waiting for them");
    setActiveUser(null);
  });
});

describe('the reminder store — which way a bad blob falls', () => {
  test('strict owned reads leave a missing choice absent and refuse unknown bytes', async () => {
    const disk = installDisk();
    const uid = nextUid();
    setActiveUser(uid);
    const key = `luvani.u.${uid}.reminder`;
    assert.equal(await loadReminder({ strict: true }), null, 'a genuinely absent reminder should remain a valid no-choice state');
    disk.map.set(key, '{"version":1,"reminder":{"enabled":false,"time":"night"}}');
    assert.deepEqual(await loadReminder({ strict: true }), { enabled: false, time: 'night' });
    for (const raw of ['', '{', '{"version":2,"reminder":{"enabled":false,"time":"night"}}', '{"version":1,"reminder":{"enabled":"false","time":"night"}}']) {
      disk.map.set(key, raw);
      await assert.rejects(loadReminder({ strict: true }), `strict read accepted ${raw} as Off`);
      assert.equal(disk.map.get(key), raw, 'a failed read rewrote the learner’s choice');
    }
    (AsyncStorage as unknown as Record<string, unknown>).getItem = async () => { throw new Error('native read refused'); };
    await assert.rejects(loadReminder({ strict: true }), /native read refused/);
    setActiveUser(null);
  });

  test('an unreadable reminder reads as off, never as on', async () => {
    // Every one of these is a reminder this build cannot read. Reading any of
    // them as on would schedule a daily notification the learner never asked
    // for, under a row that says Off, which they then cannot turn off.
    const unreadable: readonly (string | null)[] = [
      null,
      '',
      'not json at all',
      '{"version":2,"reminder":{"enabled":true,"time":"morning"}}',
      '{"version":1}',
      '{"version":1,"reminder":null}',
      '{"version":1,"reminder":{"time":"morning"}}',
      '{"version":1,"reminder":{"enabled":"true","time":"morning"}}',
      '{"version":1,"reminder":{"enabled":1,"time":"morning"}}',
      '[{"version":1,"reminder":{"enabled":true,"time":"morning"}}]',
    ];

    for (const blob of unreadable) {
      const disk = installDisk();
      const uid = nextUid();
      setActiveUser(uid);
      if (blob !== null) disk.map.set(`luvani.u.${uid}.reminder`, blob);

      const stored = await loadReminder();
      assert.equal(stored, null, `this read as something rather than as nothing: ${blob}`);
      assert.equal(
        reminderRow(stored, 'granted').on,
        false,
        `an unreadable reminder drew an on switch: ${blob}`,
      );
      setActiveUser(null);
    }

    // Storage itself refusing the read is the same answer, not a crash on the
    // Profile tab.
    const uid = nextUid();
    installDisk();
    (AsyncStorage as unknown as Record<string, unknown>).getItem = (): Promise<string> =>
      Promise.reject(new Error('storage unavailable'));
    setActiveUser(uid);
    assert.equal(await loadReminder(), null, 'a storage failure took the Profile tab down with it');
    setActiveUser(null);

    // A preset this build does not know is repaired rather than discarded. The
    // learner asked to be reminded; only which hour is unreadable, and
    // reminder.ts already owns what an unknown id resolves to.
    const disk = installDisk();
    const kept = nextUid();
    setActiveUser(kept);
    disk.map.set(`luvani.u.${kept}.reminder`, '{"version":1,"reminder":{"enabled":true,"time":"teatime"}}');
    assert.deepEqual(
      await loadReminder(),
      { enabled: true, time: DEFAULT_REMINDER_TIME },
      "an unknown preset either threw the learner's own choice away or invented a time of its own",
    );

    // Off is remembered with its time, so turning it back on does not silently
    // move the reminder to a different part of the day.
    assert.equal(await saveReminder({ enabled: false, time: 'night' }), 'durable');
    assert.deepEqual(await loadReminder(), { enabled: false, time: 'night' });
    setActiveUser(null);
  });
});

describe('the reminder store — version 2 (Come alive, README Part 5.F)', () => {
  test('version 2 keeps the smart mode, the streak choice, the pause and the log, and version 1 is read with its time kept', async () => {
    const disk = installDisk();
    const uid = nextUid();
    setActiveUser(uid);
    const key = `luvani.u.${uid}.reminder`;

    // An existing learner's version 1 choice: their evening stays the evening, and the log starts empty.
    disk.map.set(key, '{"version":1,"reminder":{"enabled":true,"time":"night"}}');
    assert.deepEqual(await loadReminder({ strict: true }), { enabled: true, time: 'night' });
    assert.deepEqual(await loadReminderLog(), emptyLog());

    // The smart mode, the streak left off the lock screen, and a pause, round the disk.
    assert.equal(await saveReminder({ enabled: true, time: 'smart', mentionStreak: false, paused: true }), 'durable');
    assert.deepEqual(await loadReminder({ strict: true }), { enabled: true, time: 'smart', mentionStreak: false, paused: true });
    const written = JSON.parse(disk.map.get(key)!) as { version: number; log: unknown };
    assert.equal(written.version, 2);
    // Defaults are not written down, so a choice that never touched them reads back as it was.
    assert.equal(await saveReminder({ enabled: true, time: 'smart', mentionStreak: true, paused: false }), 'durable');
    assert.deepEqual(await loadReminder({ strict: true }), { enabled: true, time: 'smart' });

    // The log rides beside the choice: a new choice keeps it, and it is bounded to day keys.
    const log: ReminderLog = {
      ...emptyLog(),
      sent: Array.from({ length: 20 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`),
      answered: ['2026-09-20'],
      opened: ['not a day'],
      slots: [{ day: '2026-10-07', at: Date.UTC(2026, 9, 7, 18), line: 'routine-moment' }],
      last: { day: '2026-09-20', line: 'streak-habit' },
    };
    assert.equal(await saveReminderLog(log), 'durable');
    assert.equal(await saveReminder({ enabled: true, time: 'lunch' }), 'durable');
    const kept = await loadReminderLog();
    assert.equal(kept.sent.length, 14, 'the log keeps more than the last fourteen days');
    assert.equal(kept.sent[0], '2026-09-07');
    assert.deepEqual(kept.answered, ['2026-09-20']);
    assert.deepEqual(kept.opened, [], 'a log entry that is not a day was kept');
    assert.deepEqual(kept.slots, log.slots);
    assert.deepEqual(kept.last, log.last);
    assert.deepEqual(await loadReminder(), { enabled: true, time: 'lunch' });

    // A log with no choice to keep it with is not written: it would be a reminder nobody chose.
    const empty = nextUid();
    setActiveUser(empty);
    assert.equal(await saveReminderLog(log), 'failed');
    assert.equal(disk.map.has(`luvani.u.${empty}.reminder`), false);

    // A version 1 envelope cannot claim the smart mode: only version 2 can.
    setActiveUser(uid);
    disk.map.set(key, '{"version":1,"reminder":{"enabled":true,"time":"smart"}}');
    assert.deepEqual(await loadReminder({ strict: true }), { enabled: true, time: DEFAULT_REMINDER_TIME });
    setActiveUser(null);
  });

  test("a guest's log lives on the device, and goes when the guest's reminder does", async () => {
    const disk = installDisk();
    assert.deepEqual(await loadGuestReminderLog(), { paused: false, log: emptyLog() });
    assert.equal(await saveGuestReminderLog({ paused: true, log: { ...emptyLog(), sent: ['2026-10-01'] } }), 'durable');
    assert.deepEqual(await loadGuestReminderLog(), { paused: true, log: { ...emptyLog(), sent: ['2026-10-01'] } });
    assert.deepEqual([...disk.map.keys()], ['@luvani/guest-reminder/v1'], 'the guest log landed under an account or more than one key');
    await clearGuestReminderLog();
    assert.equal(disk.map.size, 0);
    disk.map.set('@luvani/guest-reminder/v1', 'not json');
    assert.deepEqual(await loadGuestReminderLog(), { paused: false, log: emptyLog() }, 'an unreadable guest log read as paused');
  });

  test('which plan the phone holds is one instant on the device, written even after a sign-out, and anything unreadable reads as none', async () => {
    const disk = installDisk();
    const planned = Date.UTC(2026, 9, 7, 9);
    // A log names its plan, and keeps the name round the disk.
    const uid = nextUid();
    setActiveUser(uid);
    assert.equal(await saveReminder({ enabled: true, time: 'evening' }), 'durable');
    const named: ReminderLog = { ...emptyLog(), slots: [{ day: '2026-10-07', at: planned + 9 * 3_600_000, line: 'routine-moment' }], plannedAt: planned };
    assert.equal(await saveReminderLog(named), 'durable');
    assert.equal((await loadReminderLog()).plannedAt, planned);
    assert.equal(await saveReminderLog({ ...named, plannedAt: -1 }), 'durable');
    assert.equal((await loadReminderLog()).plannedAt, undefined, 'a plan named by something that is not an instant was kept');

    // Nothing held yet, then a plan, then none: one device key, one number, no account in it.
    assert.equal(await loadHeldPlan(), null);
    assert.equal(await saveHeldPlan(planned), 'durable');
    assert.equal(await loadHeldPlan(), planned);
    assert.deepEqual(JSON.parse(disk.map.get('@luvani/reminder-held/v1')!), { version: 1, plan: planned });
    // A sign-out has to say the plan is gone after the account's own keys are closed.
    setActiveUser(null);
    assert.equal(await saveHeldPlan(null), 'durable', 'a sign-out could not say the plan was taken back');
    assert.equal(await loadHeldPlan(), null);
    assert.ok(![...disk.map.keys()].some((key) => key.startsWith('@luvani/') && key.includes(uid)), 'the held plan names the account');

    // Unreadable is none: it only ever stops a log counting, which never invents a pause.
    for (const raw of ['not json', '{"version":2,"plan":5}', '{"version":1,"plan":"5"}', '{"version":1,"plan":-5}']) {
      disk.map.set('@luvani/reminder-held/v1', raw);
      assert.equal(await loadHeldPlan(), null, `${raw} read as a plan the OS holds`);
    }
  });
});

describe('the reminder store — what a write is allowed to claim', () => {
  test('two taps in one beat leave the disk holding the last one, and a refused write says so', async () => {
    // The learner opens the sheet, taps lunch, changes their mind and taps
    // night. Without a chain the two setItem calls race, and the phone that
    // finishes the first one last leaves the disk holding lunch while the
    // screen shows night.
    const disk = installDisk({ hold: (call) => (call === 1 ? new Promise((r) => setTimeout(r, 10)) : Promise.resolve()) });
    const uid = nextUid();
    setActiveUser(uid);

    const first = saveReminder({ enabled: true, time: 'lunch' });
    const second = saveReminder({ enabled: true, time: 'night' });
    assert.deepEqual(await Promise.all([first, second]), ['durable', 'durable']);

    assert.deepEqual(
      disk.order,
      ['start lunch', 'done lunch', 'start night', 'done night'],
      'the two writes overlapped, so which one the disk keeps is decided by the platform',
    );
    assert.deepEqual(await loadReminder(), { enabled: true, time: 'night' }, 'the disk kept the tap the learner changed away from');
    setActiveUser(null);

    // A phone with no room says so rather than resolving as if it had landed.
    // The row on screen is unaffected; what changes is that nobody downstream
    // may believe the choice survives this launch.
    const full = nextUid();
    const refused = installDisk({ refuse: (key) => key === `luvani.u.${full}.reminder` });
    setActiveUser(full);
    assert.equal(
      await saveReminder({ enabled: true, time: 'morning' }),
      'failed',
      'a refused write answered as if it had landed, so a switch would claim a reminder nothing will send',
    );
    assert.equal(refused.map.has(`luvani.u.${full}.reminder`), false, "the test's own disk did not actually refuse the write");
    assert.equal(await loadReminder(), null, 'a refused write left something readable behind');
    setActiveUser(null);
  });
});
