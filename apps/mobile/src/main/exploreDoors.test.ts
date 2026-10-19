import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

test('Explore advertises real conversation ideas instead of opening an unrelated collection', () => {
  const home = read('../tabs/HomeTab.tsx');
  const explore = read('../tabs/ExploreTab.tsx');
  assert.doesNotMatch(home + explore, /Explore the collection/,
    'a named collection must not resolve to a generic friends keyword filter');
  assert.match(home, /label: 'Browse Explore', onPress: \(\) => nav\.navigate\('Explore'\)/);
  assert.match(explore, /suggestions\.ideas\.map\(idea =>/);
  assert.match(explore, /conversation\.start\(\{ seedTopic: \{ fr: idea\.fr, en: idea\.en \} \}\)/,
    'the named conversation idea must carry its own topic to the tutor');
});

test('Explore gives the native Press frame its topic grid width and lets large text stack', () => {
  const explore = read('../tabs/ExploreTab.tsx');
  const start = explore.indexOf('EXPLORE_TOPICS.slice(0, 4).map(t =>');
  const topics = explore.slice(start, explore.indexOf('})}</View>', start));
  assert.match(topics, /frame=\{\[s\.topicFrame, single && s\.topicFrameSingle\]\}/,
    'Press owns parent layout through frame; inner surface width leaves native cards in a half-width column');
  assert.doesNotMatch(topics, /style=\{\[[\s\S]*?flexBasis/,
    'the animated surface cannot size the tile in its parent grid');
  assert.match(explore, /const single = width < 350 \|\| fontScale >= 1\.5/);
  assert.match(explore, /topicFrame: \{ flexBasis: '47%', flexGrow: 1, minWidth: 0 \}/);
  assert.match(explore, /topicFrameSingle: \{ width: '100%', flexBasis: 'auto', flexGrow: 0 \}/,
    'a column needs full width and content height, rather than a percentage height basis');
});
