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
// Rewritten 2026-09-27 (notebook Phase 3, B1): only the orb and the
// highlighter move, so the card's entrance and its settle timer are gone and
// the drawing is always still. Today asks for the card with no picture at all,
// and then the tutor's audio comes before the words.
test('daily illustrations use the existing scene pack, stand still, and leave Today with the audio first', () => {
  for (const id of ['word:clim','phrase:cafe:1']) { assert.equal(sceneForDaily(id),sceneForDaily(id)); assert.ok(WORD_SCENES.includes(sceneForDaily(id))); }
  const source = readFileSync(new URL('./DailyCard.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source, /\bAnimated\b|Easing|setTimeout|useReduceMotion/, 'the daily card still moves');
  assert.match(source, /<WordScene scene=\{sceneForDaily\(item\.id\)\} width=\{76\} paused=\{true\} \/>/, 'the drawing is not held still');
  assert.match(source, /picture = true/, 'the picture is not optional, so Today cannot leave it out');
  assert.match(source, /\{picture && <WordScene/, 'the picture is drawn whether or not the caller asked for it');
  assert.match(source, /\{!picture && asset != null && <GhostButton label="Hear"/, 'without the picture the audio does not lead');
  assert.ok(source.indexOf('{!picture && asset != null && <GhostButton label="Hear"') < source.indexOf('{item.fr}'), 'the audio comes after the words it is meant to lead');
  assert.match(source, /releaseDailyPlayback\(player\)/);
});
