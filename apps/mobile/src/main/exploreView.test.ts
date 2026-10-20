/**
 * Explore's decisions, held where they are made (B1, 2026-10-20, B-Explore).
 *
 * The four filters are derived from data that already ships: the authored
 * tier, `home/estimate.ts` minutes, the free-sample list and the bundled
 * recordings. Nothing here is stored, and no row claims a fact it lacks.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { DAILY_SCENARIOS, MISSIONS, TUTOR_VOICES, type TutorVoiceKey } from '@luvani/core';

import { freeExploreScenarioIds, isFreeExploreContent } from '../purchases/exploreAccess.ts';
import { recordingIdFor } from '../missions/preview.ts';
import { estimateMinutes, missionMinutes } from '../home/estimate.ts';
import type { TutorAudioPack } from '../daily/tutorAudio.ts';
import {
  EXPLORE_FILTERS,
  SHORT_MINUTES,
  collectionAccessNote,
  matchesFilters,
  missionFacts,
  phraseMatches,
  realMomentParams,
  scenarioFacts,
  sectionShown,
  seedRowTitle,
  situationMeta,
  situationRoute,
  situationsFor,
  toggleFilter,
  type ExploreFilter,
} from './exploreView.ts';

const VOICE = Object.keys(TUTOR_VOICES)[0] as TutorVoiceKey;
const EMPTY = { audio: {} as TutorAudioPack, voice: VOICE };
const set = (...f: ExploreFilter[]) => new Set<ExploreFilter>(f);
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

const FREE = DAILY_SCENARIOS.find((s) => freeExploreScenarioIds().includes(s.id))!;
const PAID = DAILY_SCENARIOS.find((s) => !isFreeExploreContent({ kind: 'scenario', id: s.id }))!;
const recorded = (ids: readonly string[]): TutorAudioPack => ({ [VOICE]: Object.fromEntries(ids.map((id, i) => [id, 100 + i])) });

describe('the four filters are derived, never stored', () => {
  test('the chips are the artboard four, in its order', () => {
    assert.deepEqual(EXPLORE_FILTERS.map((f) => f.label), ['Starting out', 'Under 5 min', 'Free, offline', 'With your tutor']);
  });

  test('Starting out is tier 1 for a scene and A0 for a guided mission', () => {
    for (const s of DAILY_SCENARIOS) assert.equal(scenarioFacts(s, EMPTY).startingOut, s.tier === 1, s.id);
    for (const m of MISSIONS) assert.equal(missionFacts(m).startingOut, m.cefr === 'A0', m.id);
  });

  test('Under 5 min reads the estimate, strictly under five', () => {
    for (const s of DAILY_SCENARIOS) assert.equal(scenarioFacts(s, EMPTY).minutes, estimateMinutes({ kind: 'scenario', lines: s.lines.length }));
    for (const m of MISSIONS) assert.equal(missionFacts(m).minutes, missionMinutes(m));
    const base = { startingOut: true, offline: true, tutor: true as const };
    assert.equal(matchesFilters({ ...base, minutes: SHORT_MINUTES - 1 }, set('short')), true);
    assert.equal(matchesFilters({ ...base, minutes: SHORT_MINUTES }, set('short')), false);
  });

  test('no situation row is ever Free, offline: it leads to a live conversation that uses speaking time', () => {
    // B1 learning-science review (2026-10-20): even a recorded free sample.
    assert.equal(scenarioFacts(FREE, { audio: recorded([recordingIdFor(FREE)]), voice: VOICE }).offline, false);
    for (const m of MISSIONS) assert.equal(missionFacts(m).offline, false, m.id);
    const everything = { audio: recorded(DAILY_SCENARIOS.map(recordingIdFor)), voice: VOICE };
    assert.deepEqual(situationsFor(DAILY_SCENARIOS, MISSIONS, set('offline'), everything, Infinity), []);
    assert.equal(sectionShown('situations', set('offline')), false, 'the section hides rather than stand empty');
  });

  test('Free, offline keeps word and phrase rows with a free, bundled recording', () => {
    assert.equal(phraseMatches({ startingOut: false, offline: true }, set('offline')), true);
    assert.equal(sectionShown('words', set('offline')), true);
  });

  test('With your tutor keeps every situation, and every chosen filter must hold', () => {
    const all = situationsFor(DAILY_SCENARIOS, MISSIONS, set('tutor'), EMPTY, Infinity);
    assert.equal(all.length, DAILY_SCENARIOS.length + MISSIONS.length);
    const both = situationsFor(DAILY_SCENARIOS, MISSIONS, set('starting', 'short'), EMPTY, Infinity);
    assert.ok(both.length > 0);
    for (const f of both) assert.ok(f.startingOut && f.minutes < SHORT_MINUTES, f.id);
    assert.deepEqual(situationsFor(DAILY_SCENARIOS, MISSIONS, set(), EMPTY, 3).length, 3, 'the landing shows three');
  });

  test('a toggle returns a new set and turns the filter back off', () => {
    const none = set();
    const on = toggleFilter(none, 'short');
    assert.equal(none.size, 0);
    assert.deepEqual([...on], ['short']);
    assert.equal(toggleFilter(on, 'short').size, 0);
  });

  test('a section stands only under filters it truly meets', () => {
    assert.equal(sectionShown('topics', set()), true);
    assert.equal(sectionShown('topics', set('tutor')), false);
    assert.equal(sectionShown('prepare', set('tutor')), true);
    assert.equal(sectionShown('further', set('short')), false);
    assert.equal(sectionShown('words', set('starting', 'offline')), true);
    assert.equal(sectionShown('words', set('tutor')), false, 'words and phrases are not a tutor conversation');
    assert.equal(phraseMatches({ startingOut: true, offline: false }, set('offline')), false);
    assert.equal(phraseMatches({ startingOut: true, offline: true }, set('starting', 'offline')), true);
  });
});

describe('situation rows', () => {
  test('a scene row practises the French, with the English in brackets', () => {
    const s = DAILY_SCENARIOS[0]!;
    assert.equal(scenarioFacts(s, EMPTY).practise, `Practise saying “${s.openingFr}” (${s.openingEn})`);
  });

  test('every subtitle is led by "Practise"', () => {
    for (const f of situationsFor(DAILY_SCENARIOS, MISSIONS, set(), EMPTY, Infinity)) assert.match(f.practise, /^Practise /, f.id);
  });

  test('the meta line says only what is true, in commas', () => {
    const facts = { ...scenarioFacts(PAID, EMPTY), minutes: 4, startingOut: true };
    assert.equal(situationMeta(facts, 'Included with a plan'), '4 min, with your tutor, starting out, included with a plan');
    assert.equal(situationMeta({ ...facts, startingOut: false }, null), '4 min, with your tutor');
    assert.equal(situationMeta(facts, 'Free sample'), '4 min, with your tutor, starting out, free sample');
    assert.doesNotMatch(situationMeta(scenarioFacts(FREE, EMPTY), 'Free sample'), /offline/);
  });

  test('every row opens the scene preview with its own id', () => {
    for (const f of situationsFor(DAILY_SCENARIOS, MISSIONS, set(), EMPTY, Infinity)) {
      assert.deepEqual(situationRoute(f), { screen: 'ScenePreview', params: { missionId: f.id } });
    }
  });

  test('a practical collection is never called free when only one sample in it is', () => {
    assert.equal(collectionAccessNote(['Free sample', 'Included with a plan']), 'Includes a free sample');
    assert.equal(collectionAccessNote(['Included with a plan', null]), 'Included with a plan');
    assert.equal(collectionAccessNote([null, null]), null);
  });
});

describe('search and prefill', () => {
  test('a search with no match offers the tutor by name', () => {
    assert.equal(seedRowTitle(true, true), 'Talk about this with your tutor');
    assert.equal(seedRowTitle(true, false), 'Talk about this topic');
    assert.equal(seedRowTitle(false, true), 'Talk about your own topic');
  });

  test('the real-moment prefill carries the trimmed words, or nothing', () => {
    assert.deepEqual(realMomentParams('  Dinner in Lyon '), { detail: 'Dinner in Lyon' });
    assert.deepEqual(realMomentParams('   '), {});
  });
});

describe('the tab wires those decisions and nothing else (source probes)', () => {
  const explore = read('../tabs/ExploreTab.tsx');

  test('situation rows navigate to ScenePreview through situationRoute', () => {
    assert.match(explore, /const target = situationRoute\(facts\);/);
    assert.match(explore, /onPress=\{\(\) => nav\.navigate\(target\.screen, target\.params\)\}/);
  });

  test('Prepare for something real goes to RealMoment with the prefill, and locks only through the seam', () => {
    assert.match(explore, /nav\.navigate\('RealMoment', realMomentParams\(real\)\)/);
    assert.match(explore, /featureAccess\('realMoment'\) === 'locked' && <LockBadge \/>/);
    assert.match(explore, /featureAccess\('conversationPractice'\) === 'locked' \? <LockBadge form="round" \/>/);
    assert.equal((explore.match(/<LockBadge\b/g) ?? []).length, 2, 'a lock badge drawn outside the seam');
  });

  test('the no-match row is the seed row, still started through useConversationStart', () => {
    assert.match(explore, /title=\{seedRowTitle\(topicSeed !== null, nothingFound\)\}/);
    assert.match(explore, /topicSeed \? conversation\.start\(\{ seedTopic: topicSeed \}\) : nav\.navigate\('Tutor'\)/);
    assert.match(explore, /const conversation = useConversationStart\(\);/);
  });

  test('next-conversation ideas say "picked for you", because interests are not stored', () => {
    assert.match(explore, /picked for you/);
    assert.doesNotMatch(explore, /your interests/);
  });

  test('the filters are the shared Chip, and words carry a hear control', () => {
    assert.match(explore, /<Chip key=\{f\.key\} variant="filter"/);
    assert.match(explore, /<IconAction layout="inline" icon="speaker" label="Hear"/);
    assert.match(explore, /<LedgerRow lang="fr" title=\{item\.fr\}/);
  });
});
