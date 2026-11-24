import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SYNC_EXCLUSIONS } from '../sync/policy.ts';
import { USER_KEY_SUFFIXES, setActiveUser } from '../storage/scope.ts';
import { MAX_MOMENTS, loadMoments, saveMoment, withMoment, type RealMoment } from './momentsStore.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('the moments a learner brought, kept on this phone (F549)', () => {
  test('moments are kept on this device, capped, and excluded from sync for a written reason', () => {
    // Newest first, the same moment once, and the cap drops the least recent.
    let moments: RealMoment[] = [];
    for (let i = 0; i < MAX_MOMENTS + 5; i += 1) {
      moments = withMoment(moments, 'interview', `line ${i}`, 1_000 + i);
    }
    assert.equal(moments.length, MAX_MOMENTS, 'the list grows past its cap');
    assert.equal(moments[0]!.detail, `line ${MAX_MOMENTS + 4}`, 'the newest moment is not first');
    assert.ok(!moments.some((moment) => moment.detail === 'line 0'), 'the least recently rehearsed survived the cap');

    const twice = withMoment(withMoment([], 'date', 'with Sam', 10), 'date', 'with Sam', 20);
    assert.equal(twice.length, 1, 'the same moment typed twice is two rows');
    assert.equal(twice[0]!.lastUsedAt, 20, 'rehearsing a moment again does not move it to the front');
    assert.equal(twice[0]!.at, 10, 'rehearsing again forgets when it was first brought');

    // On this device: a per-user key the reset clears and the export carries,
    // and a sync exclusion with the reason written down.
    assert.ok((USER_KEY_SUFFIXES as readonly string[]).includes('moments'), 'the moments key is not in the suffix list, so a reset would leave it behind');
    assert.match(read('./momentsStore.ts'), /userKey\('moments'\)/, 'the store keys itself to something other than the account');
    const exclusion = SYNC_EXCLUSIONS.find((entry) => entry.namespace === 'moments');
    assert.ok(exclusion, 'moments is not excluded from sync, so a line about somebody\'s job hunt would ride the account envelope');
    assert.ok(exclusion!.reason.length > 40, 'the exclusion states no real reason');
    assert.match(exclusion!.reason, /phone/, 'the reason does not say the text stays on the phone');
  });

  describe('the store itself (F1148)', () => {
    const disk = new Map<string, string>();
    beforeEach(() => {
      disk.clear();
      const shared = AsyncStorage as unknown as Record<string, unknown>;
      shared.getItem = async (name: string): Promise<string | null> => disk.get(name) ?? null;
      shared.setItem = async (name: string, value: string): Promise<void> => { disk.set(name, value); };
      setActiveUser('11111111-1111-4111-8111-000000001148');
    });

    test('saveMoment keeps 20, newest first, and a repeat moves up rather than duplicating', async () => {
      for (let i = 0; i < MAX_MOMENTS + 5; i += 1) {
        await saveMoment('interview', `line ${i}`, 1_000 + i);
      }
      let moments = await loadMoments();
      assert.equal(moments.length, MAX_MOMENTS, 'the stored list grows past its cap');
      assert.equal(moments[0]!.detail, `line ${MAX_MOMENTS + 4}`, 'the newest stored moment is not first');
      assert.ok(!moments.some((moment) => moment.detail === 'line 0'), 'the least recently rehearsed survived the cap on disk');
      assert.match(moments[0]!.id, /^m[0-9a-z]+\.[0-9a-z]+$/, 'a stored id lost its random suffix');

      const first = await saveMoment('interview', 'line 10', 5_000);
      moments = await loadMoments();
      assert.equal(moments.length, MAX_MOMENTS, 'a repeat added a second row');
      assert.equal(moments.filter((moment) => moment.detail === 'line 10').length, 1, 'the same moment is stored twice');
      assert.equal(moments[0]!.detail, 'line 10', 'a repeat did not move to the front');
      assert.equal(moments[0]!.at, 1_010, 'a repeat forgot when it was first brought');
      assert.equal(first.id, moments[0]!.id, 'a repeat was given a new id');

      // One home for the rule: the shipped path is the tested helper.
      assert.match(read('./momentsStore.ts'), /saveMoment[\s\S]*withMoment\(current,/, 'saveMoment keeps its own copy of the cap rule');
    });
  });
});
