import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appearanceSession, serialAppearanceWrites, APPEARANCE_LOAD_ERROR, APPEARANCE_SAVE_ERROR } from './appearanceSession.ts';
import { displayPreference, mainMode, type DisplayPreference } from './appearanceModel.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function harness() {
  const reads: ReturnType<typeof deferred<unknown>>[] = [];
  const writes: { value: DisplayPreference; result: ReturnType<typeof deferred<void>> }[] = [];
  const values: DisplayPreference[] = [];
  const errors: (string | null)[] = [];
  let owned = true;
  const session = appearanceSession({
    current: () => owned,
    read: () => { const result = deferred<unknown>(); reads.push(result); return result.promise; },
    write: value => { const result = deferred<void>(); writes.push({ value, result }); return result.promise; },
    value: value => values.push(value), error: value => errors.push(value),
  });
  return { session, reads, writes, values, errors, switchAccount: () => { owned = false; } };
}

test('display parsing follows the device for missing or malformed data', () => {
  for (const raw of [null, undefined, 'system', 'unknown', {}, false]) assert.equal(displayPreference(raw), 'system');
  assert.equal(mainMode('system', 'dark'), 'dark');
  assert.equal(mainMode('system', null), 'light');
  assert.equal(mainMode('light', 'dark'), 'light');
  assert.equal(mainMode('dark', 'light'), 'dark');
});

test('a slow persisted read cannot overwrite a newer explicit choice or report its stale failure', async () => {
  for (const result of ['success', 'failure'] as const) {
    const h = harness();
    const load = h.session.load();
    const choice = h.session.choose('dark');
    h.writes[0]!.result.resolve();
    await choice;
    if (result === 'success') h.reads[0]!.resolve('light');
    else h.reads[0]!.reject(new Error('old disk read failed'));
    await load;
    assert.deepEqual(h.values, ['dark']);
    assert.deepEqual(h.errors, [null]);
  }
});

test('the latest read owns the result and a current load failure remains visible', async () => {
  const h = harness();
  const old = h.session.load();
  const latest = h.session.load();
  h.reads[1]!.resolve('dark');
  await latest;
  h.reads[0]!.resolve('light');
  await old;
  assert.deepEqual(h.values, ['dark']);
  const retry = h.session.load();
  h.reads[2]!.reject(new Error('unavailable'));
  await retry;
  assert.deepEqual(h.errors, [APPEARANCE_LOAD_ERROR]);
});

test('account changes and unmounts suppress reads, errors and further choices', async () => {
  for (const reason of ['account', 'unmount'] as const) {
    const h = harness();
    const load = h.session.load();
    if (reason === 'account') h.switchAccount(); else h.session.dispose();
    h.reads[0]!.resolve('dark');
    await load;
    await h.session.choose('light');
    assert.deepEqual(h.values, []);
    assert.deepEqual(h.errors, []);
    assert.equal(h.writes.length, 0);
  }
});

test('an older write failure cannot replace the latest choice with a false error', async () => {
  const h = harness();
  const old = h.session.choose('dark');
  const latest = h.session.choose('light');
  h.writes[1]!.result.resolve();
  await latest;
  h.writes[0]!.result.reject(new Error('older write failed'));
  await old;
  assert.deepEqual(h.values, ['dark', 'light']);
  assert.deepEqual(h.errors, [null, null]);
  const failed = h.session.choose('system');
  h.writes[2]!.result.reject(new Error('current write failed'));
  await failed;
  assert.equal(h.errors.at(-1), APPEARANCE_SAVE_ERROR);
});

test('device writes are serialized, survive a failure and leave the last choice on disk', async () => {
  const started: string[] = [];
  const first = deferred<void>();
  let disk = 'system';
  const writer = serialAppearanceWrites(async (value: string) => {
    started.push(value);
    if (value === 'dark') await first.promise;
    disk = value;
  });
  const old = writer.write('dark');
  const latest = writer.write('light');
  await Promise.resolve();
  assert.deepEqual(started, ['dark']);
  first.reject(new Error('native write rejected'));
  await assert.rejects(old);
  await latest;
  assert.deepEqual(started, ['dark', 'light']);
  assert.equal(disk, 'light');
});

test('a remounted provider waits for the previous provider’s explicit choice before loading', async () => {
  let disk = 'light';
  const bridge = deferred<void>();
  const writer = serialAppearanceWrites(async (value: DisplayPreference) => { await bridge.promise; disk = value; });
  const first = appearanceSession({ current: () => true, read: async () => disk, write: writer.write, value: () => {}, error: () => {} });
  const chosen = first.choose('dark');
  first.dispose();
  const shown: DisplayPreference[] = [];
  const remount = appearanceSession({ current: () => true,
    read: async () => { await writer.settled(); return disk; }, write: writer.write,
    value: value => shown.push(value), error: () => {} });
  const load = remount.load();
  await Promise.resolve();
  assert.deepEqual(shown, []);
  bridge.resolve();
  await Promise.all([chosen, load]);
  assert.deepEqual(shown, ['dark']);
});
