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
  assert.match(explore, /conversation\.start\(\{ seedTopic: seedOf\(idea\) \}\)/,
    'the named conversation idea must carry its own topic to the tutor');
});

test('Explore gives the native Press frame its topic grid width and lets large text stack', () => {
  // 2026-10-20 UI-008, artboard B-Explore: the tiles are the B part
  // TopicTileCard (explore/ExploreParts.tsx), each inside a frame View that
  // owns the grid width, never the pressable card inside it. Replaces the
  // ColourCard `tile` helper probe.
  const explore = read('../tabs/ExploreTab.tsx');
  assert.match(explore, /<View key=\{tile\.key\} style=\{\[st\.topicFrame, single && st\.topicFrameSingle\]\}>\s*<TopicTileCard tile=\{tile\.tile\} title=\{tile\.title\} onPress=\{tile\.go\} \/>/,
    'the frame owns parent layout; inner surface width leaves native cards in a half-width column');
  assert.match(explore, /EXPLORE_TOPICS\.slice\(0, 4\)\.map\(t => \{/, 'the topic grid stopped drawing the first four topics');
  assert.match(explore, /const single = width < 350 \|\| fontScale >= 1\.5/);
  assert.match(explore, /topicFrame: \{ flexBasis: '47%', flexGrow: 1, minWidth: 0 \}/);
  assert.match(explore, /topicFrameSingle: \{ width: '100%', flexBasis: 'auto', flexGrow: 0 \}/,
    'a column needs full width and content height, rather than a percentage height basis');
  const parts = read('../explore/ExploreParts.tsx');
  assert.match(parts, /frame=\{s\.fill\} style=\{\[s\.topic,/, 'the tile card fills its frame rather than sizing itself');
  assert.match(parts, /topic: \{ flex: 1, borderRadius: 26, overflow: 'hidden', \.\.\.liftStyle \}/, 'the tile lost its radius 26 or its lift');
});
