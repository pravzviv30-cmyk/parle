import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const screen = readFileSync(new URL('./FirstSceneScreen.tsx', import.meta.url), 'utf8');

test('the first scene puts one example before its action and makes the rest optional', () => {
  assert.match(screen, /mission\.referencePhrases\.slice\(0, 3\)/);
  assert.match(screen, /lines\.slice\(0, 1\)\.map/);
  assert.match(screen, /showMore && lines\.slice\(1\)\.map/);
  assert.match(screen, /More examples/);
  assert.match(screen, /mission\.titleEn/);
});

test('the microphone asks on Start and live minute use is visible beside both actions', () => {
  assert.match(screen, /const permission = await AudioModule\.requestRecordingPermissionsAsync\(\)/);
  assert.match(screen, /onPress=\{\(\) => act\(view\.primary\.act\)\}/);
  assert.match(screen, /Live speaking and typing use live minutes/);
  assert.match(screen, /view\.secondary !== null/);
});
