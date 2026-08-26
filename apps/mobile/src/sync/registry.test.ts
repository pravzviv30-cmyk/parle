/**
 * The seam between the stores and the engine, and the promise it exists to keep: a
 * change a learner made on a plane is still there, and still pushed, after the app has
 * been killed and reopened somewhere with signal.
 *
 * The stamp logic is the part worth reading twice. Everything else here is bookkeeping;
 * the stamp is what stops a write that landed during a push from being cleared by that
 * push's success, which is a silent, unreproducible, once-in-a-hundred-sessions data
 * loss of exactly the kind an offline queue exists to prevent.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { USER_KEY_SUFFIXES } from '../storage/scope.ts';
import { readEnvelope, sealEnvelope } from './envelope.ts';
import { startSync, type SyncFetch, type SyncHttpResponse, type SyncPolicy } from './engine.ts';
import {
  SYNC_STATE_SUFFIX,
  adopterFor,
  attachDirtyStore,
  clearDirty,
  dirtyNamespaces,
  dirtySettled,
  dirtyStamp,
  markDirty,
  onDirty,
  registerSyncAdopter,
  resetSyncRegistry,
} from './registry.ts';

const UID = '33333333-3333-4333-8333-333333333333';
const REVIEW_KEY = `parle.u.${UID}.review`;
const STATE_KEY = `parle.u.${UID}.${SYNC_STATE_SUFFIX}`;

/** AsyncStorage as the device sees it: it outlives the app, which is the whole point. */
function createDisk(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    map,
    getItem: (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null),
    setItem: (key: string, value: string): Promise<void> => {
      map.set(key, value);
      return Promise.resolve();
    },
  };
}

/** Union by id, so two devices' edits both survive. */
const unionPolicy: SyncPolicy = {
  namespaces: ['review'],
  merge({ local, remote }) {
    if (local === null && remote === null) return { kind: 'merged', data: null };
    const byId = new Map<string, { id: string }>();
    for (const side of [remote, local]) {
      if (!Array.isArray(side)) continue;
      for (const item of side as { id: string }[]) {
        if (item !== null && typeof item === 'object' && typeof item.id === 'string') byId.set(item.id, item);
      }
    }
    return { kind: 'merged', data: [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1)) };
  },
};

/** One row of learner_state, and a switch for whether the network exists this launch. */
function createServer() {
  const state = { online: true, payload: undefined as unknown, revision: 0, exists: false };
  const respond = (status: number, body: unknown): SyncHttpResponse => ({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  const fetchImpl: SyncFetch = (url, init) => {
    if (!state.online) return Promise.reject(new Error('network unreachable'));
    if (init.method === 'GET') {
      return Promise.resolve(
        respond(200, state.exists ? [{ payload: state.payload, revision: state.revision }] : []),
      );
    }
    if (init.method === 'POST') {
      if (state.exists) return Promise.resolve(respond(409, { message: 'duplicate key' }));
      const items = JSON.parse(init.body ?? '[]') as { payload: unknown }[];
      state.payload = items[0]?.payload;
      state.revision = 0;
      state.exists = true;
      return Promise.resolve(respond(201, [{ revision: 0 }]));
    }
    const wanted = new URLSearchParams(url.split('?')[1] ?? '').get('revision');
    if (!state.exists || wanted !== `eq.${state.revision}`) return Promise.resolve(respond(200, []));
    const body = JSON.parse(init.body ?? '{}') as { payload: unknown };
    state.payload = body.payload;
    state.revision += 1;
    return Promise.resolve(respond(200, [{ revision: state.revision }]));
  };
  return { fetch: fetchImpl, state };
}

function engineOn(disk: ReturnType<typeof createDisk>, server: ReturnType<typeof createServer>) {
  return startSync({
    uid: UID,
    deviceId: 'device-plane',
    url: 'https://project.supabase.co',
    anonKey: 'anon-publishable-key',
    getAccessToken: () => Promise.resolve('learner-jwt'),
    fetch: server.fetch,
    storage: disk,
    keyFor: (suffix: string) => `parle.u.${UID}.${suffix}`,
    policy: unionPolicy,
    now: () => 1_700_000_000_000,
    random: () => 0.5,
    schedule: () => {},
  });
}

const dataOn = (server: ReturnType<typeof createServer>): unknown => {
  const reading = readEnvelope(server.state.payload);
  return reading.ok ? reading.envelope.data : { unreadable: true };
};

beforeEach(() => {
  resetSyncRegistry();
});

describe('the sync registry — what survives being closed', () => {
  test('a change made offline is pushed after an app restart and reconnect', async () => {
    // ── Launch one, on a plane. The store writes to disk and raises its flag; the
    //    engine tries, fails, and leaves the flag up.
    const disk = createDisk();
    const server = createServer();
    server.state.online = false;

    const first = engineOn(disk, server);
    await disk.setItem(REVIEW_KEY, JSON.stringify([{ id: 'grande-vitesse' }]));
    markDirty('review');

    const grounded = await first.flushDirty();
    assert.equal(grounded.settled, false, 'an offline flush reported success');
    assert.deepEqual(
      grounded.outcomes.map((outcome) => outcome.status),
      ['offline'],
    );
    assert.equal(server.state.exists, false, 'something reached a server that was not there');
    await dirtySettled();
    assert.deepEqual(JSON.parse(disk.map.get(STATE_KEY)!) as unknown, { version: 1, dirty: ['review'] });
    first.stop();

    // ── The app is killed. Module state goes with it; AsyncStorage does not.
    resetSyncRegistry();
    assert.deepEqual(dirtyNamespaces(), [], 'the restart did not actually clear memory');

    // ── Launch two, back on the ground.
    server.state.online = true;
    const adopted: unknown[] = [];
    registerSyncAdopter('review', async (fold) => {
      const raw = disk.map.get(REVIEW_KEY);
      const next = fold(raw === undefined ? null : (JSON.parse(raw) as unknown));
      adopted.push(next);
      await disk.setItem(REVIEW_KEY, JSON.stringify(next));
      return 'adopted';
    });
    const second = engineOn(disk, server);

    const landed = await second.flushDirty();
    assert.equal(landed.settled, true);
    assert.deepEqual(
      landed.outcomes.map((outcome) => outcome.status),
      ['pushed'],
      'the namespace dirtied before the restart was not even looked at',
    );
    assert.deepEqual(dataOn(server), [{ id: 'grande-vitesse' }], "the plane's edit never reached the account");
    await dirtySettled();
    assert.deepEqual(JSON.parse(disk.map.get(STATE_KEY)!) as unknown, { version: 1, dirty: [] });
    assert.deepEqual(adopted, [], 'nothing needed adopting, so nothing should have been adopted');
    second.stop();
  });

  test('a crash between the store write and the flag costs one launch, never the change', async () => {
    // The dirty set is an optimisation. This is the proof that it is only that: the
    // flag never reached disk, and the launch-time full reconcile finds the change
    // anyway by reading every namespace.
    const disk = createDisk({ [REVIEW_KEY]: JSON.stringify([{ id: 'unflagged' }]) });
    const server = createServer();
    const engine = engineOn(disk, server);

    assert.deepEqual(dirtyNamespaces(), [], 'this test only means something with no flag set');
    const flushed = await engine.flushDirty();
    assert.deepEqual(flushed.outcomes, [], 'a dirty-only flush looked at a clean namespace');

    const launch = await engine.reconcileAll();
    assert.deepEqual(
      launch.outcomes.map((outcome) => outcome.status),
      ['pushed'],
    );
    assert.deepEqual(dataOn(server), [{ id: 'unflagged' }]);
    engine.stop();
  });

  test('a write that lands during a push keeps the flag up rather than riding on its success', () => {
    markDirty('review');
    const stamp = dirtyStamp('review')!;

    // The engine is mid-push, holding `stamp`. The learner grades another card.
    markDirty('review');
    assert.notEqual(dirtyStamp('review'), stamp, 'the second write left no trace');

    assert.equal(clearDirty('review', stamp), false, 'the push cleared a write it never carried');
    assert.deepEqual(dirtyNamespaces(), ['review']);

    // The next cycle reads the newer stamp, and that one does clear.
    assert.equal(clearDirty('review', dirtyStamp('review')!), true);
    assert.deepEqual(dirtyNamespaces(), []);
  });

  test('the flag is per namespace, and clearing one leaves the rest alone', () => {
    markDirty('review');
    markDirty('profile');
    markDirty('review');
    assert.deepEqual(dirtyNamespaces(), ['review', 'profile'], 'dirtying twice queued a namespace twice');
    clearDirty('profile', dirtyStamp('profile')!);
    assert.deepEqual(dirtyNamespaces(), ['review']);
    assert.equal(dirtyStamp('profile'), null);
  });

  test('a store hears about its own writes only through the adopter it registered', async () => {
    assert.equal(adopterFor('review'), null, 'a namespace nobody claimed has no adopter');
    const seen: unknown[] = [];
    const unregister = registerSyncAdopter('review', (fold) => {
      // What a store gets is a fold, not a finished blob, so its own current state is
      // always an input to what it writes. registry.ts says why.
      seen.push(fold([{ id: 'mine' }]));
      return Promise.resolve('adopted');
    });
    const adoption = await adopterFor('review')!((current) => [current, { id: 'a' }]);
    assert.equal(adoption, 'adopted');
    assert.deepEqual(seen, [[[{ id: 'mine' }], { id: 'a' }]], 'the store never saw its own state');

    unregister();
    assert.equal(adopterFor('review'), null, 'unregistering left the adopter behind');

    // Registering again replaces rather than stacking: a screen that remounts must not
    // end up with two adopters writing the same key twice.
    registerSyncAdopter('review', () => Promise.resolve('adopted'));
    const second = registerSyncAdopter('review', () => Promise.resolve('adopted'));
    second();
    assert.equal(adopterFor('review'), null, 'the last registration is the one that owns the namespace');
  });

  test('a listener that throws cannot stop a store from recording its write', () => {
    const heard: string[] = [];
    onDirty(() => {
      throw new Error('the engine fell over');
    });
    const stop = onDirty((namespace) => heard.push(namespace));
    markDirty('review');
    assert.deepEqual(heard, ['review'], 'one broken listener silenced the other');
    assert.deepEqual(dirtyNamespaces(), ['review'], 'the write was not recorded because a listener threw');
    stop();
    markDirty('profile');
    assert.deepEqual(heard, ['review'], 'unsubscribing did nothing');
  });

  test('a dirty set that came back wrong is an empty one, never a crash', async () => {
    for (const corrupt of ['not json at all', '[]', '{"version":2,"dirty":["review"]}', '{"dirty":"review"}', '']) {
      resetSyncRegistry();
      const disk = createDisk({ [STATE_KEY]: corrupt });
      await attachDirtyStore(disk, STATE_KEY);
      assert.deepEqual(dirtyNamespaces(), [], `"${corrupt.slice(0, 20)}" was read as a dirty set`);
    }

    // Non-string entries are dropped one by one rather than taking the file with them.
    resetSyncRegistry();
    const mixed = createDisk({ [STATE_KEY]: JSON.stringify({ version: 1, dirty: ['review', 7, null, 'topics', ''] }) });
    await attachDirtyStore(mixed, STATE_KEY);
    assert.deepEqual(dirtyNamespaces(), ['review', 'topics']);
  });

  test('writes made this launch are never dropped by what the last launch left behind', async () => {
    const disk = createDisk({ [STATE_KEY]: JSON.stringify({ version: 1, dirty: ['topics'] }) });
    markDirty('review');
    await attachDirtyStore(disk, STATE_KEY);
    assert.deepEqual(dirtyNamespaces(), ['review', 'topics'], 'the restore replaced memory instead of joining it');
    await dirtySettled();
    assert.deepEqual(JSON.parse(disk.map.get(STATE_KEY)!) as { dirty: string[] }, { version: 1, dirty: ['review', 'topics'] });
  });

  test('storage that refuses to write does not break the app, only the optimisation', async () => {
    const broken = {
      getItem: (): Promise<string | null> => Promise.reject(new Error('storage unavailable')),
      setItem: (): Promise<void> => Promise.reject(new Error('storage full')),
    };
    await attachDirtyStore(broken, STATE_KEY);
    markDirty('review');
    await dirtySettled();
    assert.deepEqual(dirtyNamespaces(), ['review'], 'a failed persist lost the in-memory flag too');
  });

  test('a reset drops the disk binding, so nothing lands under the next account', async () => {
    const disk = createDisk();
    await attachDirtyStore(disk, STATE_KEY);
    markDirty('review');
    await dirtySettled();
    assert.equal(disk.map.has(STATE_KEY), true);

    resetSyncRegistry();
    markDirty('profile');
    await dirtySettled();
    assert.deepEqual(
      JSON.parse(disk.map.get(STATE_KEY)!) as { dirty: string[] },
      { version: 1, dirty: ['review'] },
      "a write after the switch reached the previous account's key",
    );
    assert.equal(adopterFor('review'), null);
  });

  test('the dirty set has one name, and it is a per-user suffix like every other store', () => {
    assert.equal(SYNC_STATE_SUFFIX, 'syncState');
    assert.equal(
      STATE_KEY,
      `parle.u.${UID}.syncState`,
      'the sync state must be namespaced to the account, or a reset would leave it behind',
    );

    // The one cross-file promise this module cannot keep on its own. `clearActiveUserData`
    // wipes exactly the suffixes on that list, so a dirty set missing from it survives a
    // learner resetting their data and then asks the engine to push namespaces they just
    // cleared. scope.test.ts cannot catch this one: its scan reads literal `userKey('...')`
    // calls, and the engine resolves this key through an injected function instead.
    assert.equal(
      (USER_KEY_SUFFIXES as readonly string[]).includes(SYNC_STATE_SUFFIX),
      true,
      "add 'syncState' to USER_KEY_SUFFIXES in storage/scope.ts, or a data reset leaves the queue behind",
    );
    // Sanity on the envelope helper this file leans on, so a failure here is readable.
    assert.equal(readEnvelope(sealEnvelope([{ id: 'a' }], 'device-plane', 1)).ok, true);
  });
});
