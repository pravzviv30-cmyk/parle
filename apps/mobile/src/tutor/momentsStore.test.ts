import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { SYNC_EXCLUSIONS } from '../sync/policy.ts';
import { USER_KEY_SUFFIXES } from '../storage/scope.ts';
import { MAX_MOMENTS, withMoment, type RealMoment } from './momentsStore.ts';

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
});
