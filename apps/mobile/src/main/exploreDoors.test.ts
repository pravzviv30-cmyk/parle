import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

test('Explore is a tab and advertises real conversation ideas instead of opening an unrelated collection', () => {
  const home = read('../tabs/HomeTab.tsx');
  const explore = read('../tabs/ExploreTab.tsx');
  const navigator = read('../nav/RootNavigator.tsx');
  // 2026-10-20 UI-008: the words moved from the bar into nav/tabBarModel.ts.
  const bar = read('../nav/tabBarModel.ts');
  assert.doesNotMatch(home + explore, /Explore the collection/,
    'a named collection must not resolve to a generic friends keyword filter');
  assert.match(navigator, /<Tab\.Screen name="Home" component=\{HomeTab\} \/>\s*<Tab\.Screen name="Explore" component=\{ExploreTab\} \/>/,
    'Explore is the second tab, straight after Today');
  assert.match(navigator, /<Stack\.Screen name="ExploreCollection" component=\{ExploreCollectionScreen\} \/>/);
  assert.match(bar, /Explore: 'Explore'/, 'the Explore tab has no word under its glyph');
  assert.match(explore, /suggestions\.ideas\.map\(idea =>/);
  assert.match(explore, /conversation\.start\(\{ seedTopic: \{ fr: idea\.fr, en: idea\.en \} \}\)/,
    'the named conversation idea must carry its own topic to the tutor');
});

test('Explore gives the native Press frame its topic grid width and lets large text stack', () => {
  // 2026-10-20, B1, B-Explore: the tiles are ColourCards now, drawn by one
  // `tile` helper for the topics and the practice doors. The outer frame View
  // still owns the grid width, never the pressable card inside it.
  const explore = read('../tabs/ExploreTab.tsx');
  const start = explore.indexOf('const tile = (');
  assert.notEqual(start, -1, 'Explore no longer draws its tiles through one helper');
  const tile = explore.slice(start, explore.indexOf('</ColourCard>', start));
  assert.match(tile, /<View key=\{key\} style=\{\[st\.topicFrame, single && st\.topicFrameSingle\]\}>/,
    'the frame owns parent layout; inner surface width leaves native cards in a half-width column');
  assert.match(tile, /<ColourCard ground=\{ground\} lift onPress=\{go\}/);
  assert.doesNotMatch(explore, /tile: \{[^}]*flexBasis/, 'the pressable surface cannot size the tile in its parent grid');
  assert.match(explore, /EXPLORE_TOPICS\.slice\(0, 4\)\.map\(t => \{[\s\S]*?return tile\(/, 'the topic grid stopped using the framed tile');
  assert.match(explore, /const single = width < 350 \|\| fontScale >= 1\.5/);
  assert.match(explore, /topicFrame: \{ flexBasis: '47%', flexGrow: 1, minWidth: 0 \}/);
  assert.match(explore, /topicFrameSingle: \{ width: '100%', flexBasis: 'auto', flexGrow: 0 \}/,
    'a column needs full width and content height, rather than a percentage height basis');
});
