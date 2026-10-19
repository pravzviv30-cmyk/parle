import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONNECTOR_IDS, DAILY_SCENARIOS, MISSIONS, seedTopicOf } from '@luvani/core';
import { DAILY_ITEMS } from '../daily/catalogue.ts';
import { freeExploreScenarioIds } from '../purchases/exploreAccess.ts';
import { learningSuggestions } from './learningSuggestions.ts';
import { EXPLORE_TOPICS, exploreScenarios, exploreMissions, exploreTopicSeed, scenarioTopic } from './exploreCatalogue.ts';
import { collectionCount, collectionCountLine, collectionItems, EXPLORE_COLLECTIONS, exploreCollection, exploreScenario, PRACTICAL_COLLECTIONS, searchCollectionItems, searchCollections, TOPIC_COLLECTIONS } from './exploreCollections.ts';
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

test('the ten everyday destinations partition the existing scenario catalogue without duplicates or invented lessons', () => {
  assert.equal(EXPLORE_TOPICS.length, 10);
  assert.equal(new Set(EXPLORE_TOPICS.map(t => t.theme)).size, 10);
  const ids: string[] = [];
  for (const collection of TOPIC_COLLECTIONS) {
    const items = collectionItems(collection);
    assert.ok(items.length > 0, collection.id);
    assert.equal(collectionCount(collection), items.length);
    assert.equal(collectionCountLine(collection, items.length), `${items.length} conversation starters`);
    for (const item of items) {
      assert.equal(item.kind, 'scenario');
      assert.strictEqual(item.source, DAILY_SCENARIOS.find(s => s.id === item.id));
      if (item.kind === 'scenario') assert.equal(scenarioTopic(item.source).key, collection.topic);
      ids.push(item.id);
    }
  }
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(new Set(ids), new Set(DAILY_SCENARIOS.map(s => s.id)));
});

test('every practical collection reference resolves to existing content and keeps the signed seed bound', () => {
  assert.equal(new Set(EXPLORE_COLLECTIONS.map(c => c.id)).size, EXPLORE_COLLECTIONS.length);
  for (const collection of PRACTICAL_COLLECTIONS) {
    const refs = collection.refs!;
    const items = collectionItems(collection);
    assert.equal(items.length, refs.length, collection.id);
    assert.equal(new Set(refs.map(ref => ref.id)).size, refs.length);
    for (const item of items) {
      assert.equal(item.kind, 'scenario');
      const scenario = exploreScenario(item.id)!;
      assert.ok(scenario.lines.length >= 3);
      const seed = seedTopicOf(scenario);
      for (const value of Object.values(seed)) assert.ok(value.length > 0 && value.length <= 120, `${item.id}: ${value}`);
    }
  }
});

test('each stated ability orders complete topic content with its real free sample first at the relevant pitch', () => {
  const free = new Set(freeExploreScenarioIds());
  for (const level of ['zero', 'few', 'getby', 'confident'] as const) {
    const { preferredTier } = learningSuggestions({ level, confidence: null, focus: null });
    for (const collection of TOPIC_COLLECTIONS) {
      const all = collectionItems(collection);
      const ordered = collectionItems(collection, { tier: preferredTier });
      assert.deepEqual(new Set(ordered.map(x => x.id)), new Set(all.map(x => x.id)));
      const first = ordered[0]!;
      assert.equal(first.kind, 'scenario');
      if (first.kind === 'scenario') assert.equal(first.tier, preferredTier);
      assert.ok(free.has(first.id), `${level}: ${collection.id}: ${first.id}`);
    }
  }
});

test('Hear and practise contains only actual assets in the selected voice and never falls back to another tutor', () => {
  const collection = exploreCollection('hear-and-practise')!;
  const first = DAILY_ITEMS[0]!.id, second = DAILY_ITEMS[1]!.id;
  const audio = { alexandre: { [first]: 10 }, emilie: { [second]: 20 } };
  const a = collectionItems(collection, { audio, voice: 'alexandre' });
  const b = collectionItems(collection, { audio, voice: 'emilie' });
  assert.deepEqual(a.map(x => x.id), [first]);
  assert.deepEqual(b.map(x => x.id), [second]);
  assert.ok(a.every(x => x.kind === 'daily' && x.hasAudio));
  assert.equal(collectionCount(collection, { audio, voice: 'alexandre' }), 1);
  assert.deepEqual(collectionItems(collection, { audio, voice: 'marie' }), []);
  assert.deepEqual(collectionItems(collection), []);
});

test('the connector collection reuses every authored expression and remains readable when recordings are missing', () => {
  const collection = exploreCollection('connect-your-ideas')!;
  const items = collectionItems(collection, { voice: 'alexandre', audio: {} });
  assert.deepEqual(items.map(x => x.id), CONNECTOR_IDS);
  for (const item of items) {
    assert.strictEqual(item.source, DAILY_ITEMS.find(x => x.id === item.id));
    assert.ok(item.kind === 'daily' && !item.hasAudio);
  }
});

test('guided content remains the existing beginner mission inventory and is never relabelled advanced', () => {
  const collection = exploreCollection('guided-situations')!;
  const items = collectionItems(collection);
  assert.deepEqual(items.map(x => x.id), MISSIONS.map(m => m.id));
  assert.ok(items.every(item => item.kind === 'mission' && item.detail.includes('Guided beginner activity.')));
  assert.ok(items.every(item => item.kind === 'mission' && ['A0', 'A1'].includes(item.source.cefr)));
  assert.ok(exploreMissions('', 'food').some(m => m.id === 'mission:cafe'));
  assert.ok(exploreMissions('', 'shops').some(m => m.id === 'mission:marche'));
  assert.ok(exploreMissions('', 'admin').some(m => m.id === 'mission:hotel'));
});

test('scenario search spans French, English and explicit themes while retaining complete authored results', () => {
  assert.equal(exploreScenarios('', null).length, DAILY_SCENARIOS.length);
  assert.deepEqual(exploreScenarios('café', null).map(x => x.id), exploreScenarios('cafe', null).map(x => x.id));
  assert.ok(exploreScenarios('pharmacie', null).some(x => x.theme === 'health-and-pharmacy'));
  const paperwork = new Set(exploreScenarios('paperwork', null).map(x => x.id));
  assert.ok(DAILY_SCENARIOS.filter(x => x.theme === 'admin-and-paperwork').every(x => paperwork.has(x.id)), 'theme synonyms find every explicit paperwork scene alongside relevant full-text matches');
  assert.ok(exploreScenarios('paperwork', 'admin').every(x => x.theme === 'admin-and-paperwork'));
  assert.ok(exploreScenarios('disagreement', null).some(x => x.id === 'situation:friends-a-polite-disagreement'));
  assert.deepEqual(exploreScenarios('no such phrase zzzz', null), []);
  assert.ok(searchCollections('conversation').some(c => c.id === 'connect-your-ideas'));
  assert.equal(exploreCollection('missing'), undefined);
  assert.equal(exploreScenario('missing'), undefined);
  assert.equal(exploreCollection({ id: 'everyday' }), undefined);
  for (const topic of EXPLORE_TOPICS) {
    const seed = exploreTopicSeed('', topic.key)!;
    assert.ok(seed.fr.length <= 120 && seed.en.length <= 120);
  }
});

test('collection search reads French and English examples without mutating its full-list order', () => {
  const collection = exploreCollection('topic:food')!;
  const items = collectionItems(collection, { tier: 2 });
  const ids = items.map(x => x.id);
  const source = items.find(item => item.kind === 'scenario')!;
  assert.ok(source.kind === 'scenario');
  if (source.kind === 'scenario') {
    assert.ok(searchCollectionItems(items, source.source.lines[0]!.fr).some(x => x.id === source.id));
    assert.ok(searchCollectionItems(items, source.source.lines[0]!.en).some(x => x.id === source.id));
  }
  assert.deepEqual(searchCollectionItems(items, 'café'), searchCollectionItems(items, 'cafe'));
  assert.deepEqual(searchCollectionItems(items, 'no result zzzz'), []);
  assert.strictEqual(searchCollectionItems(items, ' '), items);
  assert.deepEqual(items.map(x => x.id), ids);
});

test('collection navigation preserves the parent and keeps preparation optional before the existing speaking and writing gate', () => {
  const screen = read('./ExploreCollectionScreen.tsx');
  assert.match(screen, /nav\.push\('ExploreCollection', \{ id: item.id \}\)/);
  assert.match(screen, /nav\.push\('ExploreCollection', \{ id: child.id \}\)/);
  assert.match(screen, /access\.open\(ref, \(\) => conversation\.start\(\{ seedTopic: seedTopicOf\(source\) \}, textMode\)\)/);
  assert.match(screen, /label=\{needsPlan \? 'View plans to write' : 'Write instead'\}[^\n]*openContent\(\{ kind: 'scenario', id: scenario.id \}, true\)/);
  assert.match(screen, /disabled=\{access.checking \|\| conversation.checking\}/);
  assert.match(screen, /showLines && scenario.lines.map/);
  assert.match(screen, /Collection unavailable/);
  assert.match(screen, /No recordings are available in your selected tutor/);
  assert.doesNotMatch(screen, /addPhrases|recordWarmupCompleted|recordActiveDay|completePractice|setMastered|recordRetrieval/);
});

test('scene access copy distinguishes plan access from finite tutor time and never implies an unsaved session already exists', () => {
  const screen = read('./ExploreCollectionScreen.tsx');
  assert.match(screen, /accessLabel === 'Included with a plan'/);
  assert.match(screen, /needsPlan \? 'View plans to start' : 'Start talking'/);
  assert.match(screen, /needsPlan \? 'View plans to write' : 'Write instead'/);
  assert.match(screen, /Conversations use your available tutor time\./);
  assert.match(screen, /accessLabel !== null && <MainText/);
  assert.match(screen, /access.error !== null && <View accessibilityLiveRegion="polite"><MainText>\{access.error\}<\/MainText>/);
  assert.match(screen, /title="Your saved conversations" detail="After a session, revisit its saved learning notes/);
  assert.doesNotMatch(screen, /Practise your conversation afterwards|unlimited|free tutor time|exact transcript/i);
});

test('Explore landing uses finite previews and real full-list destinations without duplicating private conversation storage', () => {
  const explore = read('../tabs/ExploreTab.tsx');
  assert.match(explore, /EXPLORE_TOPICS.slice\(0, 4\)/);
  assert.match(explore, /openCollection\('everyday'\)/);
  assert.match(explore, /scenarios.slice\(0, limit\)/);
  assert.match(explore, /phrases.slice\(0, searching \? limit : 3\)/);
  assert.match(explore, /nav.navigate\('Library', \{ view: 'practise' \}\)/);
  assert.doesNotMatch(explore, /loadConversationPacks|saveConversationPack|AsyncStorage|samplePack|previewPack/);
});
