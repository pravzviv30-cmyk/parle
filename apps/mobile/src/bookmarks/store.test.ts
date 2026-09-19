/**
 * A bookmark that can be taken off the list and stay off.
 *
 * This is the whole reason the store is per item rather than a set of saved
 * ids, and the failure it prevents is invisible on one phone. A union of saved
 * ids can only ever add. So a learner who un-saves a situation on their phone
 * keeps it un-saved right up until their tablet syncs, at which point the older
 * copy folds back in, the situation reappears, and it reappears again on every
 * cycle after that.
 *
 * The counterfactual is asserted rather than described: the same two blobs are
 * folded the way a set union would fold them, and that fold is shown bringing
 * the removal back. Otherwise the test below is a restatement of the code.
 *
 * The storage double is the one storeBinding.test.ts uses.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setActiveUser } from '../storage/scope.ts';
import { createSyncPolicy } from '../sync/policy.ts';
import { sameData } from '../sync/envelope.ts';
import { adopterFor, resetSyncRegistry } from '../sync/registry.ts';
import { MAX_BOOKMARKS, loadBookmarks, setBookmark, type BookmarkItem } from './store.ts';

function installDisk(initial: Record<string, string> = {}): Map<string, string> {
  const map = new Map<string, string>(Object.entries(initial));
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
    map.set(key, value);
    return Promise.resolve();
  };
  shared.removeItem = (key: string): Promise<void> => {
    map.delete(key);
    return Promise.resolve();
  };
  return map;
}

let uids = 0;
const nextUid = (): string => `44444444-4444-4444-8444-${String(++uids).padStart(12, '0')}`;

let uid: string;

beforeEach(() => {
  installDisk();
  resetSyncRegistry();
  uid = nextUid();
  setActiveUser(uid);
});

const policy = createSyncPolicy({ now: () => Date.UTC(2026, 8, 4, 12, 0, 0) });

function merge(local: unknown, remote: unknown): unknown {
  const result = policy.merge({ namespace: 'bookmarks', local, remote });
  return result.kind === 'merged' ? result.data : `quiet:${result.reason}`;
}

const itemsOf = (blob: unknown): BookmarkItem[] => (blob as { items: BookmarkItem[] }).items;
const savedIds = (blob: unknown): string[] =>
  itemsOf(blob)
    .filter((item) => item.saved)
    .map((item) => item.scenarioId)
    .sort();

describe('bookmarks that can be un-saved', () => {
  test("a bookmark toggled off on one device stays off after the other device's copy folds in — F393", async () => {
    // ── 1. This phone saves two situations, then changes its mind about one.
    await setBookmark('scene:market', true, 1_000);
    await setBookmark('scene:taxi', true, 1_100);
    await setBookmark('scene:market', false, 2_000);

    const held = await loadBookmarks();
    assert.deepEqual(
      held.filter((item) => item.scenarioId === 'scene:market'),
      [{ scenarioId: 'scene:market', at: 2_000, saved: false }],
      'the un-save either kept two rows for one situation or left no record of the decision at all',
    );
    assert.deepEqual(
      held.filter((item) => item.saved).map((item) => item.scenarioId),
      ['scene:taxi'],
      'the situation the learner took off the list is still on it',
    );

    // ── 2. The tablet still holds the copy from before the change. Folding it in
    //     must not bring the removal back, whichever side asks.
    const tablet = {
      version: 1,
      items: [
        { scenarioId: 'scene:market', at: 1_000, saved: true },
        { scenarioId: 'scene:pharmacy', at: 1_400, saved: true },
      ],
    };
    const phone = { version: 1, items: held };

    const forward = merge(phone, tablet);
    const backward = merge(tablet, phone);
    assert.ok(sameData(forward, backward), 'the answer depends on which device asked');
    assert.deepEqual(
      savedIds(forward),
      ['scene:pharmacy', 'scene:taxi'],
      'the situation the learner un-saved came back the moment the other device folded its copy in',
    );
    assert.ok(sameData(merge(forward, tablet), forward), 'the list keeps moving after both sides agree');

    // The counterfactual, so the assertion above is a proof rather than a restatement:
    // the set of saved ids, which is the smaller shape this store deliberately is not,
    // brings the removal straight back.
    const asSetUnion = [
      ...new Set([...savedIds(phone), ...itemsOf(tablet).filter((i) => i.saved).map((i) => i.scenarioId)]),
    ].sort();
    assert.deepEqual(
      asSetUnion,
      ['scene:market', 'scene:pharmacy', 'scene:taxi'],
      'a set of saved ids no longer resurrects the removal, so this store could have been one',
    );

    // ── 3. The store takes the fold back on its own chain and lands on exactly what
    //     the fold answered. A row differing by nothing but order is re-adopted forever.
    const adopt = adopterFor('bookmarks');
    assert.ok(adopt, 'bookmarks registered no adopter, so a merge can never reach the store');
    let answered: unknown = null;
    assert.equal(
      await adopt((current) => {
        answered = merge(current, tablet);
        return answered;
      }),
      'adopted',
    );
    assert.deepEqual(
      (await loadBookmarks()).filter((item) => item.saved).map((item) => item.scenarioId).sort(),
      ['scene:pharmacy', 'scene:taxi'],
      'the adoption brought the un-saved situation back onto the learner\'s list',
    );
    assert.ok(
      sameData({ version: 2, items: await loadBookmarks() }, answered),
      'the store wrote something other than what the fold answered',
    );

    // ── 4. Capped, oldest decision first, so the list cannot grow forever.
    const many = Array.from({ length: MAX_BOOKMARKS + 10 }, (_, i) => ({
      scenarioId: `scene:${String(i).padStart(4, '0')}`,
      at: 10_000 + i,
      saved: true,
    }));
    const capped = merge({ version: 1, items: many }, null);
    assert.equal(itemsOf(capped).length, MAX_BOOKMARKS, 'the bookmark cap is not applied');
    assert.equal(
      itemsOf(capped)[itemsOf(capped).length - 1]?.scenarioId,
      many[many.length - 1]?.scenarioId,
      'the cap dropped the newest decision instead of the oldest',
    );
  });
});
