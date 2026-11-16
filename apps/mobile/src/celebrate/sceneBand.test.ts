// UI-020 (docs/changes/recap.md, Q1 and Q2): EndScene's band and tile row are
// shared with the recap. The band draws Cloud three ways; the drill end keeps
// the face-only Cloud, and only the resting Cloud blinks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./EndScene.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ');
const fn = (name: string): string => {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `no ${name}`);
  const next = src.indexOf(' function ', start + 10);
  return src.slice(start, next < 0 ? undefined : next);
};

test('the band and the tile row are exported', () => {
  assert.match(src, /export function SceneBand\(/);
  assert.match(src, /export function SceneTiles\(/);
  assert.match(src, /export type SceneCloud = 'face' \| 'posed' \| 'resting';/);
});

test('the band draws the face, posed cheer and resting modes', () => {
  const band = fn('SceneBand');
  assert.match(band, /<Cloud expression=\{mood\} size=\{CLOUD\} outline \/>/, 'face mode changed');
  // The white body keeps its edge on the light lavender, as the face-only Cloud does.
  assert.match(band, /<Cloud pose="cheer" ink=\{t\.text\} size=\{POSED\} outline \/>/, 'posed cheer missing, or without its outline');
  assert.match(band, /<Blink active lids=\{<CloudLids size=\{CLOUD\} \/>\}> <Cloud expression="idle" size=\{CLOUD\} outline \/> <\/Blink>/, 'resting blink missing');
  assert.equal((band.match(/<Blink\b/g) ?? []).length, 1, 'only the resting Cloud blinks');
  // The mode conditions, not only the elements.
  assert.match(band, /cloud === 'posed' \? \( <View[^>]*> <Cloud pose="cheer"/, 'the posed branch is not picked by the posed mode');
  assert.match(band, /cloud === 'resting' \? \( <Blink /, 'the blink is not picked by the resting mode');
  assert.match(band, /<ToastMascot expression=\{mood\} size=\{TOAST\} \/>/);
  assert.match(band, /postcard/);
});

test('the drill end passes the face mode, with no pose and no tick change', () => {
  const body = fn('Body');
  assert.match(body, /<SceneBand mood=\{celebrated \? 'cheer' : 'idle'\} cloud="face" confetti=\{band\} \/>/);
  assert.doesNotMatch(body, /pose=/);
  assert.match(body, /tick: tile\.id === 'xp' && first \? 'both' : 'none'/);
});

test('the posed box is worked out from the two viewBoxes, not typed in', () => {
  assert.match(src, /const POSED = Math\.round\(\(CLOUD \* CLOUD_POSES\.cheer\.viewBox\.width\) \/ CLOUD_VIEWBOX\.width\);/);
  assert.doesNotMatch(src, /304\) \/ 256/);
});
