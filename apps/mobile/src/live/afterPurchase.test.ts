import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { afterPurchase } from './afterPurchase.ts';

test('a purchase that granted minutes returns to the conversation that was refused, and nothing else does', () => {
  for (const name of ['Convo', 'Lesson']) {
    const params = { textMode: true, missionId: 'cafe', continuationPackId: 'owned-pack', goalRef: 'opaque-goal', walkMode: false };
    const state = { index: 2, routes: [{ key: 'tabs', name: 'Tabs' }, { key: 'refused', name, params }, { key: 'wall', name: 'Wall' }] };
    const input = { granted: true, canStart: true, ownsAccount: true, resumeRouteKey: 'refused', wallKey: 'wall', state };
    const result = afterPurchase(input)!;
    assert.equal(result.index, 1);
    assert.equal(result.routes.length, 2);
    assert.deepEqual(result.routes[0], state.routes[0]);
    assert.equal(result.routes[1]!.key, undefined, 'the refused instance must unmount before a new attempt');
    assert.deepEqual(result.routes[1], { name, params });
    for (const change of [{ granted: false }, { canStart: false }, { ownsAccount: false }, { resumeRouteKey: undefined }, { resumeRouteKey: 'other' }, { wallKey: 'other' }]) {
      assert.equal(afterPurchase({ ...input, ...change }), null);
    }
    assert.equal(afterPurchase({ ...input, state: { ...state, index: 1 } }), null);
    assert.equal(afterPurchase({ ...input, state: { index: 1, routes: [{ key: 'refused', name: 'Settings' }, state.routes[2]!] } }), null);
    assert.equal(afterPurchase({ ...input, state: { index: 0, routes: [] } }), null);
    assert.equal(afterPurchase({ ...input, state: { index: 1, routes: [state.routes[1]!, { key: 'other-wall', name: 'Wall' }] } }), null);
  }
  const refused = readFileSync(new URL('./OutOfMinutesView.tsx', import.meta.url), 'utf8');
  assert.match(refused, /resumeRouteKey: route.key/);
  const wall = readFileSync(new URL('../wall/WallScreen.tsx', import.meta.url), 'utf8');
  assert.match(wall, /onStartSpeaking\(granted && confirmedGrant\?\.canStart === true\)/);
  const nav = readFileSync(new URL('../nav/RootNavigator.tsx', import.meta.url), 'utf8');
  assert.match(nav, /owner !== scopeGeneration\(\)/);
  assert.match(nav, /nav.reset\(resumed\)/);
});
