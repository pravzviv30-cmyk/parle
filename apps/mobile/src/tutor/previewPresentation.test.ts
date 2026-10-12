import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createMediaProgressUpdates } from '../motion/mediaProgress.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

// Do not import React Native or the animation engine in the Node test runtime.
// Runtime controller tests exercise the subscriptions; this checks their UI seam.
test('media progress subscribes at the leaf and interpolates observed time with a native transform', () => {
  const hook = read('./useTutorPreview.ts');
  const leaf = read('../motion/MediaProgress.tsx');
  const chooser = read('../onboarding/TutorSelection.tsx');
  assert.match(hook, /useSyncExternalStore\(controller\.subscribeControls, controller\.getControlSnapshot/);
  assert.match(hook, /progressSource: controller/);
  assert.match(chooser, /<MediaProgress[\s\S]*source=\{preview\?\.progressSource\}/);
  assert.doesNotMatch(chooser, /react-native-reanimated/);
  assert.match(leaf, /source\?\.subscribe\(update\)/);
  assert.match(leaf, /state\.voice === voice \? state\.progress : 0/);
  assert.match(leaf, /reduced === false && state\?\.voice === voice && state\.phase === 'playing'/);
  assert.match(leaf, /const action = nextUpdate\(target, moving\);\s*if \(action === 'none'\) return/);
  assert.match(leaf, /if \(action === 'snap'\)/);
  assert.match(leaf, /cancel\(progress\);\s*progress\.value = target/);
  assert.match(leaf, /timing\(target, 100, EASE\.linear, false\)/);
  assert.match(leaf, /transform: \[\{ scaleX: progress\.value \}\]/);
  assert.match(leaf, /width: '100%', transformOrigin: 'left center'/);
  assert.match(leaf, /unsubscribe\?\.\(\); cancel\(progress\)/);
  assert.doesNotMatch(leaf, /useState|setInterval|setTimeout|Date\.now|requestAnimationFrame/,
    'the bar must neither rerender per tick nor invent elapsed audio time');
});

test('ten playing ticks animate only the active tutor row and never restart an unchanged target', () => {
  const rows = Array.from({ length: 6 }, createMediaProgressUpdates);
  for (const update of rows) assert.equal(update(0, false), 'snap', 'each new subscription synchronizes its initial position');
  const animations = [0, 0, 0, 0, 0, 0];
  for (let tick = 1; tick <= 10; tick++) {
    for (const [index, update] of rows.entries()) {
      const target = index === 0 ? tick / 100 : 0;
      const moving = index === 0;
      if (update(target, moving) === 'animate') animations[index]!++;
      assert.equal(update(target, moving), 'none', 'a repeated media position must not restart animation');
    }
  }
  assert.deepEqual(animations, [10, 0, 0, 0, 0, 0]);
});

test('pause, buffering, completion and reduced motion land at unchanged media time before suppressing later duplicates', () => {
  for (const reason of ['pause', 'buffering', 'completion', 'reduced motion']) {
    const update = createMediaProgressUpdates();
    assert.equal(update(0.4, true), 'animate');
    assert.equal(update(0.4, false), 'snap', reason);
    assert.equal(update(0.4, false), 'none');
    assert.equal(update(0.4, true), 'none', 'resuming before time advances does not animate the same value');
    assert.equal(update(0.5, true), 'animate');
    assert.equal(update(0, false), 'snap', 'a voice switch resets the formerly active row');
  }
});

test('native bundled samples download before preloading and all warm cache leases have exit cleanup', () => {
  const hook = read('./useTutorPreview.ts');
  assert.match(hook, /await Asset\.fromModule\(voiceSample\(voice\)\)\.downloadAsync\(\);\s*await preload\(voiceSample\(voice\)\)/);
  assert.match(hook, /clear: voice => clearPreloadedSource\(voiceSample\(voice\)\)/);
  assert.match(hook, /if \(next !== 'active'\) \{ controller\.stop\(\); releaseSamples\(\); \}/);
  assert.match(hook, /document\.visibilityState !== 'visible'\) \{ controller\.stop\(\); releaseSamples\(\); \}/);
  assert.match(hook, /controller\.stop\(\);\s*releaseSamples\(\);\s*\};/);
});
