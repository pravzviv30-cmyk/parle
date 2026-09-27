import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { parsePracticeRoute, practiceRouteParams } from './practiceRoute.ts';

/** What the web address bar does to params: every value becomes a string. */
const throughAddressBar = (params: object): Record<string, string> =>
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));

describe('a practice sitting survives the address bar', () => {
  test('the route carries only flat strings, and reads back to the same sitting after a reload', () => {
    for (const route of [
      { origin: 'recommended' as const, packId: null, exposed: false },
      { origin: 'pack' as const, packId: 'sample-cafe-morning', exposed: true },
      { origin: 'recommended' as const, packId: '0c8a3f1e-2b4d-4e5f-9a1b-2c3d4e5f6a7b', exposed: false },
    ]) {
      const params = practiceRouteParams(route);
      for (const value of Object.values(params)) assert.equal(typeof value, 'string', 'an object went into the route');
      assert.ok(!Object.values(throughAddressBar(params)).some((v) => v.includes('[object')));
      assert.deepEqual(parsePracticeRoute(throughAddressBar(params)), route);
    }
  });

  test('the address the old route produced is refused, never opened as an empty sitting', () => {
    // The observed bug: /drill?practice=%5Bobject%20Object%5D.
    assert.equal(parsePracticeRoute({ practice: '[object Object]' }), 'invalid');
  });

  test('a link that cannot be read is invalid, and an ordinary drill is left alone', () => {
    assert.equal(parsePracticeRoute(undefined), null);
    assert.equal(parsePracticeRoute({}), null);
    assert.equal(parsePracticeRoute({ mix: 'true' }), null, 'an ordinary sitting was read as practice');
    assert.equal(parsePracticeRoute({ practice: 'pack' }), 'invalid', 'a pack sitting with no pack was accepted');
    assert.equal(parsePracticeRoute({ practice: 'pack', packId: '../../etc' }), 'invalid');
    assert.equal(parsePracticeRoute({ practice: 'pack', packId: 'x'.repeat(200) }), 'invalid');
    assert.equal(parsePracticeRoute({ practice: 'recommended', exposed: 'maybe' }), 'invalid');
    assert.deepEqual(parsePracticeRoute({ practice: 'pack', packId: 'p1', exposed: 'true' }), { origin: 'pack', packId: 'p1', exposed: true });
  });
});
