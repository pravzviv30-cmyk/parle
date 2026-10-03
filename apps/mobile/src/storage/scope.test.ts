/**
 * The reset list, held against the app that writes the keys.
 *
 * `clearActiveUserData` names its suffixes by hand, and nothing has ever
 * checked that list against reality. A store that forgets to join it looks
 * completely fine — right up to the moment a learner resets their data and
 * something they thought they had cleared comes back, or a one-time flag that
 * survived the wipe silently never fires again for the rest of their life.
 *
 * So this reads both sides, the way palette.test.ts does: the list as the
 * module exports it, and every `userKey('...')` literal in the app source.
 * A new store cannot be added without this test noticing.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ATTEMPT_AUDIO_NOT_SWEPT,
  clearActiveUserData,
  onUserScopeCleanup,
  migrateLegacyStores,
  onUserScopeReset,
  RETIRED_DEVICE_KEYS,
  setActiveUser,
  USER_KEY_SUFFIXES,
  userKey,
} from './scope.ts';

/** The whole app, not just src/: App.tsx sets the scope up and could read it. */
const APP = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    // A test may name a suffix while proving something about it; only the app
    // itself decides which keys exist.
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Every `userKey('suffix')` the app actually writes, with the file it came from. */
function suffixesInSource(): { file: string; suffix: string }[] {
  const found: { file: string; suffix: string }[] = [];
  for (const file of sourceFiles(APP)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/userKey\(\s*'([^']+)'\s*\)/g)) {
      found.push({ file: file.slice(APP.length), suffix: match[1]! });
    }
  }
  return found;
}

/**
 * Give the shared AsyncStorage module an implementation for this test.
 *
 * The same double storeBinding.test.ts uses: AsyncStorage resolves under plain
 * node but has no implementation off a device, and every module imports the
 * same object, so assigning the methods onto it is enough.
 */
function installDisk(initial: Record<string, string> = {}): {
  map: Map<string, string>;
  removals: string[][];
} {
  const map = new Map<string, string>(Object.entries(initial));
  const removals: string[][] = [];
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.multiGet = (keys: string[]): Promise<[string, string | null][]> =>
    Promise.resolve(keys.map((key) => [key, map.get(key) ?? null]));
  shared.multiSet = (pairs: [string, string][]): Promise<void> => {
    for (const [key, value] of pairs) map.set(key, value);
    return Promise.resolve();
  };
  shared.multiRemove = (keys: string[]): Promise<void> => {
    removals.push([...keys]);
    for (const key of keys) map.delete(key);
    return Promise.resolve();
  };
  return { map, removals };
}

/** A uid shaped like the real thing; this suite never signs anyone in. */
const UID = '11111111-1111-4111-8111-000000000001';

describe('storage scope — what a reset actually reaches', () => {
  test('every key the app writes for a learner is one a reset clears', () => {
    const used = suffixesInSource();
    assert.ok(used.length > 0, 'the scan found no userKey calls at all, so it is checking nothing');
    const cleared = new Set<string>(USER_KEY_SUFFIXES);
    const missing = used.filter(({ suffix }) => !cleared.has(suffix));
    assert.deepEqual(
      missing,
      [],
      `these stores would survive a reset: ${missing.map((m) => `${m.suffix} (${m.file})`).join(', ')}`,
    );
  });

  test('the reset list names each key once, so the list itself is readable', () => {
    assert.equal(
      new Set(USER_KEY_SUFFIXES).size,
      USER_KEY_SUFFIXES.length,
      'a duplicated suffix is a sign the list was appended to twice for the same store',
    );
  });

  test('a key is always namespaced to the signed-in account', () => {
    // Not decoration: an un-namespaced key is one account reading another
    // learner's work on a shared phone, which is why this throws rather than
    // returning something plausible.
    // Said out loud rather than assumed: the reset suite below does sign a
    // learner in, so this asserts the signed-out state instead of inheriting it
    // from the order the file happens to run in.
    setActiveUser(null);
    assert.throws(
      () => userKey('profile'),
      /no signed-in user/,
      'a store read with nobody signed in must be loud, never a silent shared key',
    );
  });
});

/**
 * The other half of a deletion.
 *
 * Deleting the screen is the visible half; the key it wrote is still on every
 * phone that ran the old build, and a device-level key survives account reset
 * and account deletion both. `luvani.seenSplash.v1` is the first of those to be
 * retired, and it had no value to lose: it recorded that this install had seen
 * a screen that no longer exists.
 */
describe('storage scope — the keys whose reader was deleted', () => {
  test('the retired splash flag is removed by the storage sweep', async () => {
    // The device this actually happens on. It inherited its pre-auth data long
    // ago, so the legacy marker is already set — which is exactly why the sweep
    // cannot live behind that marker.
    const legacyDone = 'luvani.legacyMigrated.v1';
    const ownData = `luvani.u.${UID}.profile`;
    const first = installDisk({
      'luvani.seenSplash.v1': '1',
      [legacyDone]: '1',
      [ownData]: '{"version":4}',
    });

    await migrateLegacyStores(UID);

    assert.equal(
      first.map.get('luvani.seenSplash.v1'),
      undefined,
      'a flag whose reader was deleted must be swept, not left behind a marker that already fired',
    );
    assert.equal(
      first.map.get(ownData),
      '{"version":4}',
      "the sweep touches retired device keys only, never the account's own data",
    );
    assert.equal(first.map.get(legacyDone), '1', 'the legacy marker is left exactly as it was found');

    // Idempotent, and cheap after the launch that does the work: the second
    // run finds nothing present and writes nothing at all.
    const second = installDisk({ [legacyDone]: '1', [ownData]: '{"version":4}' });
    await migrateLegacyStores(UID);
    assert.deepEqual(second.removals, [], 'a swept device must not pay a write on every launch');
    assert.equal(second.map.get(ownData), '{"version":4}');
  });

  test('nothing in the app still reads a key the sweep deletes', () => {
    // A sweep with a live reader is worse than no sweep: the reader would see
    // its flag reset on the first launch after every sign-in.
    const readers: string[] = [];
    for (const file of sourceFiles(APP)) {
      if (file.endsWith(`${sep}storage${sep}scope.ts`)) continue;
      const source = readFileSync(file, 'utf8');
      for (const key of RETIRED_DEVICE_KEYS) {
        if (source.includes(key)) readers.push(`${key} (${file.slice(APP.length)})`);
      }
    }
    assert.deepEqual(readers, [], `these still read a retired key: ${readers.join(', ')}`);
  });
});

/**
 * The half of a reset that is not a key.
 *
 * Two screens record through expo-audio, and expo-audio writes those
 * recordings into the app's cache as files. Until F115 nothing removed them, so
 * `clearActiveUserData` emptied twelve AsyncStorage namespaces, account
 * deletion cascaded the server rows, and a learner who did both still had their
 * own voice on the phone.
 *
 * The per-attempt discard in speech/discardRecording.ts is the fix. This is the
 * backstop, and the split between what is proven here and what is not is worth
 * being plain about. The policy is real behaviour under test: that the sweep
 * runs, that it runs before the keys, that a failure is neither fatal nor
 * silent, and that both doors into a reset use the real sweep rather than a
 * double. The unlink itself is a platform call in attemptAudio.native.ts that
 * no test on this machine can run, so the last test reads it as source — narrow
 * on purpose, checking only that it still empties the two directories expo-audio
 * records into and still leaves the cache root alone.
 */
describe('storage scope — the voice a reset has to reach', () => {
  /** A cache with the two shapes that matter: our recordings, and not ours. */
  function cacheWithRecordings(): { files: Set<string>; sweep: () => { removed: number; failed: number } } {
    const files = new Set([
      // iOS: AudioUtils.createRecordingUrl.
      'file:///cache/ExpoAudio/recording-11111111.m4a',
      'file:///cache/ExpoAudio/recording-22222222.m4a',
      // Android: AudioRecorder.createRecordingFilePath.
      'file:///cache/Audio/recording-33333333.m4a',
      // progress/saveFile.native.ts writes the Anki export into the same cache
      // root. A learner who exported their deck and has not opened the share
      // sheet yet must not lose it to a sweep aimed at audio.
      'file:///cache/luvani-review-2026-08-26.csv',
    ]);
    const sweep = (): { removed: number; failed: number } => {
      let removed = 0;
      for (const uri of [...files]) {
        if (!/\/(?:ExpoAudio|Audio)\//.test(uri)) continue;
        files.delete(uri);
        removed += 1;
      }
      return { removed, failed: 0 };
    };
    return { files, sweep };
  }

  test("clearing a learner's data removes any attempt audio left on the device", async () => {
    const stored = Object.fromEntries(USER_KEY_SUFFIXES.map((s) => [`luvani.u.${UID}.${s}`, '{"version":1}']));
    const disk = installDisk(stored);
    const cache = cacheWithRecordings();

    let dropped = 0;
    onUserScopeReset(() => {
      dropped += 1;
    });

    // Audio ahead of the keys, so a storage failure cannot skip it. Read the
    // way the scoring test reads its cache: at the moment the sweep runs.
    let keysStillOnDiskWhenSweeping = false;
    const sweepAudio = (): { removed: number; failed: number } => {
      keysStillOnDiskWhenSweeping = disk.map.has(`luvani.u.${UID}.profile`);
      return cache.sweep();
    };

    setActiveUser(UID);
    dropped = 0;
    let droppedByTheReset = -1;
    try {
      await clearActiveUserData({ sweepAudio });
      // Read before the sign-out below, which fires the same hooks.
      droppedByTheReset = dropped;
    } finally {
      setActiveUser(null);
    }

    assert.deepEqual(
      [...cache.files],
      ['file:///cache/luvani-review-2026-08-26.csv'],
      "a reset either left the learner's recordings on the device or took the Anki export with them",
    );
    assert.equal(keysStillOnDiskWhenSweeping, true, 'the keys went first, so a storage failure would skip the audio');

    for (const suffix of USER_KEY_SUFFIXES) {
      assert.equal(disk.map.has(`luvani.u.${UID}.${suffix}`), false, `${suffix} survived the reset`);
    }
    assert.deepEqual(
      disk.removals,
      [USER_KEY_SUFFIXES.map((s) => `luvani.u.${UID}.${s}`)],
      'the key removal changed shape; the sweep must not have quietly replaced it',
    );
    assert.equal(
      droppedByTheReset,
      1,
      'the module caches were never dropped, so a screen can still hold what was just erased',
    );
  });

  test('a sweep that could not finish still resets the device, and does not pass in silence', async () => {
    const alarms: string[] = [];
    const alarm = (line: string): void => {
      alarms.push(line);
    };
    const disk = installDisk({ [`luvani.u.${UID}.profile`]: '{"version":1}' });

    let dropped = 0;
    onUserScopeReset(() => {
      dropped += 1;
    });

    setActiveUser(UID);
    dropped = 0;
    let droppedByTheResets = -1;
    try {
      // The platform refused outright.
      await clearActiveUserData({
        sweepAudio: () => {
          throw new Error('the volume is read only');
        },
        alarm,
      });
      // It ran, removed most of them, and could not remove one. Counted, not
      // thrown: the learner asked for their data to go and nearly all of it did.
      await clearActiveUserData({ sweepAudio: () => ({ removed: 3, failed: 1 }), alarm });
      // A clean sweep says nothing at all, or the line stops meaning anything.
      await clearActiveUserData({ sweepAudio: () => ({ removed: 2, failed: 0 }), alarm });
      // Read before the sign-out below, which fires the same hooks.
      droppedByTheResets = dropped;
    } finally {
      setActiveUser(null);
    }

    assert.deepEqual(alarms, [ATTEMPT_AUDIO_NOT_SWEPT, ATTEMPT_AUDIO_NOT_SWEPT]);
    assert.match(ATTEMPT_AUDIO_NOT_SWEPT, /^\[luvani\] [A-Z_]+$/, 'the alarm left the house shape');
    assert.doesNotMatch(ATTEMPT_AUDIO_NOT_SWEPT, /file:|\/|Caches/, 'the alarm carries a device path');
    assert.equal(disk.map.has(`luvani.u.${UID}.profile`), false, 'a failed sweep took the data reset down with it');
    assert.equal(droppedByTheResets, 3, 'a failed sweep stopped the module caches being dropped');

    // The other half of the same discipline, and the reason audio goes first.
    // A storage failure still throws — App.tsx tells the learner plainly that
    // this device could not finish erasing its local copy — but the audio is
    // already gone by then.
    installDisk({ [`luvani.u.${UID}.profile`]: '{"version":1}' });
    (AsyncStorage as unknown as Record<string, unknown>).multiRemove = (): Promise<void> =>
      Promise.reject(new Error('the disk is full'));
    let sweptAnyway = false;
    setActiveUser(UID);
    try {
      await assert.rejects(
        clearActiveUserData({
          sweepAudio: () => {
            sweptAnyway = true;
            return { removed: 1, failed: 0 };
          },
          alarm,
        }),
        /the disk is full/,
        'a local wipe that failed must still be loud; App.tsx warns the learner on that error',
      );
    } finally {
      setActiveUser(null);
    }
    assert.equal(sweptAnyway, true, 'a storage failure skipped the audio, which is the bytes nobody can check');
  });

  test('the one door into a reset uses the real sweep, not a double', () => {
    // The hooks exist so this policy can be tested without a device, which
    // means production passing one would be a silent no-op erase. It does not:
    // App.tsx calls with no arguments at the one door that survives — account
    // deletion — so deleting an account sweeps the attempt audio with the real
    // defaults, not a hooked-out double.
    const app = readFileSync(join(APP, 'App.tsx'), 'utf8');
    const calls = [...app.matchAll(/clearActiveUserData\(([^)]*)\)/g)].map((m) => m[1]!.trim());
    assert.deepEqual(calls, [''], 'App.tsx must clear with the real defaults, at its one remaining door');

    const start = app.indexOf('const deleteAccount = useCallback(');
    assert.ok(start >= 0, 'App.tsx no longer defines deleteAccount; this test is reading the wrong file');
    const end = app.indexOf('}, []);', start);
    assert.ok(end > start, 'deleteAccount no longer ends where this test expects, so the slice below proves nothing');
    assert.ok(
      app.slice(start, end).includes('clearActiveUserData()'),
      'deleteAccount does not clear this device, so a learner who deleted their account keeps their data locally',
    );
  });

  test('nothing in the app still threads a progress reset that no screen can reach', () => {
    // F349 removed the reset chain outright: a callback in App.tsx threaded a
    // prop through RootNavigator into a Tabs that never passed it on, because
    // ProfileTab dropped the prop when its dead buttons went. Either name
    // reappearing in these two files means the unreachable chain is back. The
    // needles are assembled from fragments so this file does not itself contain
    // the very literals it forbids.
    const callback = ['reset', 'Progress'].join('');
    const prop = ['onReset', 'Progress'].join('');
    for (const rel of ['App.tsx', join('src', 'nav', 'RootNavigator.tsx')]) {
      const src = readFileSync(join(APP, rel), 'utf8');
      assert.ok(!src.includes(callback), `${rel} still names ${callback}, but no screen can reach one`);
      assert.ok(!src.includes(prop), `${rel} still threads ${prop}, but ProfileTab stopped accepting it`);
    }
  });

  test('the native sweep empties the directories expo-audio records into, and never the cache root', () => {
    // Lexical, because the unlink is a platform call. It cannot see that the
    // delete works; it sees that the two directory names read off the SDK 57
    // sources are still the ones being emptied, and that the cache root — where
    // the Anki export lives — is still not.
    const here = import.meta.dirname;
    const native = readFileSync(join(here, 'attemptAudio.native.ts'), 'utf8');

    assert.ok(native.includes("'ExpoAudio'"), 'the sweep no longer names the directory iOS records into');
    assert.ok(native.includes("'Audio'"), 'the sweep no longer names the directory Android records into');
    assert.ok(native.includes('new Directory(Paths.cache,'), 'the sweep no longer resolves its directories under the cache');
    assert.doesNotMatch(
      native,
      /new Directory\(Paths\.cache\)|Paths\.cache\.delete\(/,
      'the sweep deletes the whole cache, which also holds an Anki export the learner may not have opened',
    );

    // Both halves of the platform split, or Metro resolves nothing on one of them.
    const web = readFileSync(join(here, 'attemptAudio.ts'), 'utf8');
    for (const [file, source] of [['attemptAudio.ts', web], ['attemptAudio.native.ts', native]] as const) {
      assert.ok(source.includes('export function sweepAttemptAudio('), `${file} stopped exporting sweepAttemptAudio`);
    }
  });
});
