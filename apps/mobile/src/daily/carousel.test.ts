import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAILY_TABS, horizontalSwipe, swipedCard, sceneForDaily } from './carousel.ts';
import { WORD_SCENES } from '../progress/wordScenes.ts';
test('daily swipe changes one card without stealing vertical scrolling or wrapping the ends', () => {
  assert.equal(horizontalSwipe(8, 0), false);
  assert.equal(horizontalSwipe(22, 50), false);
  assert.equal(swipedCard(0, -70, 5), 1);
  assert.equal(swipedCard(1, 70, 5), 0);
  assert.equal(swipedCard(0, 70, 5), 0);
  assert.equal(swipedCard(1, -70, 5), 1);
  assert.equal(swipedCard(0, -30, 2), 0);
  assert.equal(swipedCard(0, -70, 90), 0);
});
test('the two daily pills are actionable alternatives and only the selected card is mounted', () => {
  assert.deepEqual(DAILY_TABS, ['Word','Phrase']);
  const source = readFileSync(new URL('./DailyCarousel.tsx',import.meta.url),'utf8');
  assert.match(source, /accessibilityRole="tab"/);
  assert.match(source, /selected: selected === index/);
  assert.match(source, /onPress=\{\(\) => setSelected\(index\)\}/);
  assert.equal((source.match(/<DailyCard\b/g) ?? []).length, 1);
  assert.match(source, /key=\{item.id\}/);
  assert.doesNotMatch(source, /setInterval|setTimeout/);
  assert.match(source, /onStartShouldSetPanResponder: \(\) => Platform.OS === 'web'/,
    'native must wait for horizontal movement while web claims the mouse before selection starts');
  assert.match(source, /onPanResponderTerminationRequest: \(\) => true/);
  const card = readFileSync(new URL('./DailyCard.tsx', import.meta.url), 'utf8');
  for (const field of ['fr', 'en', 'note', 'exampleFr', 'exampleEn']) {
    assert.match(card, new RegExp(`<Text selectable=\\{!embedded\\}[^>]+>\\{item\\.${field}\\}</Text>`),
      `the embedded ${field} must not start native browser text dragging during a swipe`);
  }
});
test('daily illustrations use the existing scene pack and settle with reduced-motion and focus guards', () => {
  for (const id of ['word:clim','phrase:cafe:1']) { assert.equal(sceneForDaily(id),sceneForDaily(id)); assert.ok(WORD_SCENES.includes(sceneForDaily(id))); }
  const source = readFileSync(new URL('./DailyCard.tsx',import.meta.url),'utf8');
  assert.match(source, /paused=\{paused \|\| !focused \|\| settled \|\| reduced\}/);
  assert.match(source, /clearTimeout\(timer\)/);
  assert.match(source, /releaseDailyPlayback\(player\)/);
});
