import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const card = () => readFileSync(new URL('./DailyCard.tsx', import.meta.url), 'utf8');

test('daily cards and the library contain no pictures or scene selection', () => {
  for (const name of ['DailyCard.tsx', 'DailyLibraryScreen.tsx']) {
    const source = readFileSync(new URL(name, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /WordScene|sceneForDaily|<Art\b|<Image\b/);
  }
  for (const name of ['DailyCarousel.tsx', 'carousel.ts', '../progress/WordScene.tsx', '../progress/WordOfDayCard.tsx', '../progress/wordScenes.ts']) {
    assert.equal(existsSync(new URL(name, import.meta.url)), false, `${name} is retired`);
  }
});
test('daily French retains all its text and its save and practice actions without a carousel', () => {
  const source = card();
  for (const field of ['fr', 'en', 'note', 'exampleFr', 'exampleEn']) assert.ok(source.includes(`{item.${field}}`));
  assert.match(source, /setBookmark\(item.id, !saved\)/);
  assert.match(source, /nav.navigate\('DailyPractice', \{ id: item.id \}\)/);
  assert.match(source, /releaseDailyPlayback\(player\)/);
  assert.match(source, /accessibilityLiveRegion="polite"/);
});
test('daily audio leads the French on every card and stays still', () => {
  const source = card();
  assert.doesNotMatch(source, /\bAnimated\b|Easing|setTimeout|useReduceMotion|\bpicture\b/);
  const hear = source.indexOf('<GhostButton label="Hear"');
  const french = source.indexOf('{item.fr}');
  assert.ok(hear >= 0 && french > hear);
  assert.match(source, /asset != null && <GhostButton label="Hear"/);
  assert.match(source, /!embedded && <Text[^>]*>\{audioLine\(asset != null\)\}/);
});
