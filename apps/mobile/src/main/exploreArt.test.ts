/**
 * Which drawing, pastel and badge each Explore and Scene preview place takes
 * (2026-10-20 UI-008, artboards B-Explore and B-ScenePreview).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { DAILY_SCENARIOS, MISSIONS, TUTOR_VOICES, type TutorVoiceKey } from '@luvani/core';

import { EXPLORE_TOPICS } from './exploreCatalogue.ts';
import { PRACTICAL_COLLECTIONS, SKILL_COLLECTIONS } from './exploreCollections.ts';
import { FURTHER_TILES, PRACTICE_CARDS, TOPIC_TILES, furtherBadge, metaParts, sceneArt, situationTile, tileDecoration } from './exploreArt.ts';
import { collectionAccessNote, scenarioFacts, situationMeta } from './exploreView.ts';
import { scenePreview } from '../scenes/scenePreview.ts';
import type { TutorAudioPack } from '../daily/tutorAudio.ts';

const manifest = JSON.parse(readFileSync(new URL('../../assets/b-art/manifest.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const EMPTY = { audio: {} as TutorAudioPack, voice: Object.keys(TUTOR_VOICES)[0] as TutorVoiceKey };

describe('every drawing is a bundled canvas drawing', () => {
  test('topic, practice, further and situation art all name assets/b-art drawings', () => {
    const names = [
      ...Object.values(TOPIC_TILES).map(t => t!.art),
      ...Object.values(PRACTICE_CARDS).map(c => c.art),
      ...Object.values(FURTHER_TILES).map(c => c.art),
      ...EXPLORE_TOPICS.map(t => situationTile(t.key).art),
      situationTile(null).art,
    ];
    for (const name of names) assert.ok(Object.hasOwn(manifest, name), `${name} is not a bundled drawing`);
  });
});

describe('B-Explore tiles', () => {
  test('the four topic tiles take the artboard art, pastel and line', () => {
    assert.deepEqual(EXPLORE_TOPICS.slice(0, 4).map(t => [TOPIC_TILES[t.key]!.art, TOPIC_TILES[t.key]!.ground]), [
      ['cafe-table', 'peach'], ['friends-cheer', 'lavender'], ['map-route', 'sage'], ['paper-plane', 'butter'],
    ]);
    assert.equal(TOPIC_TILES.food!.line, 'Order, ask, pay');
    assert.equal(TOPIC_TILES.work!.ellipse, false, 'the paper plane flies: no floor ellipse');
    for (const key of ['food', 'friends', 'travel'] as const) assert.equal(TOPIC_TILES[key]!.ellipse, true, key);
  });

  test('the circle and ellipse are a glow in dark, not a white disc', () => {
    assert.ok(tileDecoration('dark').circle < tileDecoration('light').circle);
    assert.ok(tileDecoration('light').circle > 0 && tileDecoration('light').ellipse > 0);
  });

  test('every real practice door and every further collection has a card', () => {
    for (const c of SKILL_COLLECTIONS) assert.ok(PRACTICE_CARDS[c.id], c.id);
    assert.ok(PRACTICE_CARDS.sound);
    for (const c of PRACTICAL_COLLECTIONS) assert.ok(FURTHER_TILES[c.id], c.id);
  });
});

describe('badges and the meta accent', () => {
  test('a free sample is the pill, saying what is true; plan-only is the round lock; covered is nothing', () => {
    assert.deepEqual(furtherBadge(collectionAccessNote(['Free sample'])), { kind: 'pill', label: 'Free sample' });
    assert.deepEqual(furtherBadge(collectionAccessNote(['Free sample', 'Included with a plan'])), { kind: 'pill', label: 'Includes a free sample' });
    assert.deepEqual(furtherBadge(collectionAccessNote(['Included with a plan'])), { kind: 'lock' });
    assert.equal(furtherBadge(collectionAccessNote([null])), null);
  });

  test('only "free sample" takes the mint accent, and the words read the same', () => {
    const facts = { ...scenarioFacts(DAILY_SCENARIOS[0]!, EMPTY), minutes: 4, startingOut: false };
    const free = situationMeta(facts, 'Free sample');
    assert.deepEqual(metaParts(free), { plain: '4 min, with your tutor, ', accent: 'free sample' });
    const parts = metaParts(free);
    assert.equal(parts.plain + parts.accent, free);
    assert.deepEqual(metaParts(situationMeta(facts, 'Included with a plan')), { plain: '4 min, with your tutor, included with a plan', accent: null });
  });

  test('no live situation row is ever "free, offline" (founder, 2026-10-20)', () => {
    for (const s of DAILY_SCENARIOS) assert.doesNotMatch(situationMeta(scenarioFacts(s, EMPTY), 'Free sample'), /offline/, s.id);
  });
});

describe('B-ScenePreview band drawing', () => {
  test('a scene takes its topic drawing where the canvas has one, else the café table', () => {
    assert.equal(sceneArt('food'), 'cafe-table');
    assert.equal(sceneArt('travel'), 'map-route');
    assert.equal(sceneArt('health'), 'cafe-table');
    assert.equal(sceneArt(null), 'cafe-table');
    assert.equal(scenePreview('mission:premier-cafe', EMPTY)!.art, 'cafe-table');
    for (const m of MISSIONS) assert.ok(Object.hasOwn(manifest, scenePreview(m.id, EMPTY)!.art), m.id);
    for (const s of DAILY_SCENARIOS) assert.ok(Object.hasOwn(manifest, scenePreview(s.id, EMPTY)!.art), s.id);
  });
});
