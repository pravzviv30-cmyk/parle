import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { evidence } from '../../test/evidence.ts';
import { FULL_SETUP, FIVE_SETUP } from './flow.ts';

const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
const layout = evidence('apps/mobile/src/onboarding/OnboardingLayout.tsx');

/** Exercise the real local Back callback; no second navigation policy in tests. */
function localBack(page: string, questionOrder: readonly string[], busy = false) {
  const raw = readFileSync(new URL('./PreAccountOnboarding.tsx', import.meta.url), 'utf8');
  const source = raw.slice(raw.indexOf('const back = () => {') + 'const back = () => {'.length,
    raw.indexOf('\n  };', raw.indexOf('const back = () => {')));
  const visits: [string, boolean][] = [];
  const callback = stripTypeScriptTypes(`(function(page, questionOrder, busy, GUEST_PAGES, surface, setSurface, stopSound, go) {${source}})`);
  Function(`return ${callback}`)()(
    page, questionOrder, busy, ['practice', 'recap', 'keep'], null, () => {}, () => {},
    (destination: string, backward: boolean) => visits.push([destination, backward]),
  );
  return visits;
}

test('native onboarding exposes draft-aware Back on reversible setup pages and retains the correct full or short order', () => {
  assert.match(screen, /onBack=\{!refused && \(question \|\| page === 'plan' \|\| page === 'choose-tutor'\) \? back : undefined\}/);
  assert.match(layout, /onBack &&[\s\S]*accessibilityLabel="Back"[\s\S]*minHeight: 44/);
  for (const order of [FULL_SETUP, FIVE_SETUP]) {
    for (let index = 1; index < order.length; index++) {
      assert.deepEqual(localBack(order[index]!, order), [[order[index - 1], true]]);
    }
    assert.deepEqual(localBack('choose-tutor', order), [['plan', true]]);
    assert.deepEqual(localBack('hear-it', order), []);
    assert.deepEqual(localBack('confidence', order, true), []);
    assert.deepEqual(localBack('practice', order), []);
  }
  // The existing backward transition preserves all answers and saved offsets.
  assert.match(screen, /const persisted = \{ \.\.\.draftRef\.current, page: next/);
  assert.match(screen, /offsets\.current\[page\]/);
});

test('native onboarding measures its real screen origin for keyboard avoidance beneath the shared progress header', () => {
  assert.match(layout, /ref=\{frame\} onLayout=/);
  assert.match(layout, /frame\.current\?\.measureInWindow\(\(_x, y\) =>/);
  assert.match(layout, /Number\.isFinite\(y\)/);
  assert.match(layout, /setKeyboardOffset\(Math\.max\(0, y\)\)/);
  assert.match(layout, /<KeyboardAvoidingView[^>]*keyboardVerticalOffset=\{keyboardOffset\}/);
  const name = evidence('apps/mobile/src/onboarding/AccountName.tsx');
  assert.match(name, /ground=\{C2\.reflection\} avoidKeyboard\s+footer=/);
  assert.doesNotMatch(name, /actionInScroll/);
});

test('authored onboarding illustration edges are allowed beyond their nominal export frame instead of cropped', () => {
  const art = JSON.parse(readFileSync(new URL('../../assets/onboarding-art/scenes.json', import.meta.url), 'utf8'));
  assert.ok(art.welcome.layers.some((layer: { x: number }) => layer.x < 0), 'the reference must retain the original cloud geometry');
  assert.ok(art.welcome.layers.some((layer: { x: number; assetWidth: number }) => layer.x + layer.assetWidth > art.welcome.width), 'the original orange character reaches beyond the nominal frame');
  const scene = evidence('apps/mobile/src/onboarding/motion/C2Scene.tsx');
  assert.doesNotMatch(scene, /overflow: 'hidden'/);
  assert.match(scene, /width: renderedWidth, height: scene\.height \* scale, alignSelf: 'center', overflow: 'visible'/);
});
