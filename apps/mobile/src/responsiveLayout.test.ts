import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { navigationWidth, screenInsets } from './responsiveLayout.ts';

test('phone content respects left and right safe areas', () => {
  assert.deepEqual(screenInsets(390, 0, 0), { paddingLeft: 20, paddingRight: 20 });
  assert.deepEqual(screenInsets(700, 44, 12), { paddingLeft: 64, paddingRight: 32 });
  assert.deepEqual(screenInsets(390, 0, 0, false), { paddingLeft: 0, paddingRight: 0 });
});

test('iPad reading width is bounded and split view returns to phone geometry', () => {
  for (const width of [834, 1024, 1194, 1366]) {
    const inset = screenInsets(width, 0, 0);
    assert.equal(width - inset.paddingLeft - inset.paddingRight, 760);
  }
  assert.deepEqual(screenInsets(375, 0, 0), { paddingLeft: 20, paddingRight: 20 });
});

test('navigation stays compact on iPad and fits narrow phones', () => {
  assert.equal(navigationWidth(320, 0, 0), 304);
  assert.equal(navigationWidth(390, 0, 0), 374);
  assert.equal(navigationWidth(600, 44, 12), 528);
  assert.equal(navigationWidth(834, 0, 0), 640);
  assert.equal(navigationWidth(1366, 0, 0), 640);
});

test('app tab headers do not render the retired website masthead', () => {
  const layout = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(layout, /Le français, pour la vie\./);
  assert.doesNotMatch(layout, /Luvani · Your French journal/);
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /maxWidth: 460/, 'iPad must not be constrained by the retired phone-only shell');
});
