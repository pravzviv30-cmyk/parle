import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildReport, buildTrends, type StoredSession } from './history.ts';
import { buildEntries, toCsv, toAnkiTsv } from './export.ts';
import { CAFE_LESSON } from '../lessons/cafe.ts';
import type { SessionSummary } from '../session/session.ts';

/** A minimal stored session with one phoneme stat and some words. */
function session(endedAt: number, rScore: number, words: string[], longest = 2.5): StoredSession {
  const summary: SessionSummary = {
    lessonId: 'cafe-01',
    durationSec: 300,
    pronunciation: {
      stats: [{ ipa: 'ʁ', meanScore: rScore, sampleCount: 4, worstWord: 'bonjour', worstScore: rScore - 5 }],
      focus: null,
      overall: rScore,
      wins: [],
    },
    unassistedRate: 0.4,
    wordsProduced: words,
    longestTurnSec: longest,
    speakingShare: 0.3,
    turnsCompleted: 12,
    rescues: 1,
    utterancesScored: 10,
    struggledTurnIds: [],
    nextStartRung: 1,
  };
  return { endedAt, summary };
}

describe('trends', () => {
  test('an improving sound shows a positive delta from early to recent', () => {
    const sessions = [session(1, 40, ['bonjour']), session(2, 50, ['bonjour']), session(3, 65, ['bonjour'])];
    const trend = buildTrends(sessions).find((t) => t.ipa === 'ʁ');
    assert.ok(trend);
    assert.equal(trend.earlyScore, 40);
    assert.equal(trend.recentScore, 65);
    assert.equal(trend.delta, 25);
  });

  test('one session is never enough to claim a trend', () => {
    assert.deepEqual(buildTrends([session(1, 40, [])]), []);
  });

  test('sessions are compared oldest to newest regardless of input order', () => {
    const report = buildReport([session(3, 70, []), session(1, 40, []), session(2, 55, [])]);
    const trend = report.trends.find((t) => t.ipa === 'ʁ');
    assert.ok(trend && trend.delta > 0, 'shuffled input must not fake a decline');
  });
});

describe('the report', () => {
  test('words accumulate across sessions without duplicates', () => {
    const report = buildReport([session(1, 50, ['bonjour', 'merci']), session(2, 55, ['merci', 'café'])]);
    assert.deepEqual(report.wordsKnown, ['bonjour', 'café', 'merci']);
  });

  test('at most three headlines, and an improved hard sound leads', () => {
    const report = buildReport([session(1, 40, ['bonjour'], 2), session(2, 52, ['merci'], 3.5), session(3, 66, ['café'], 4.1)]);
    assert.ok(report.headlines.length <= 3);
    assert.match(report.headlines[0]!, /\/ʁ\/ went from 40 to 66/);
    assert.match(report.headlines[1]!, /3 French words/);
  });

  test('no headline claims improvement that did not happen', () => {
    const report = buildReport([session(1, 60, ['bonjour']), session(2, 58, ['bonjour'])]);
    assert.ok(!report.headlines.some((h) => h.includes('paid off')), 'a flat sound must not be celebrated');
  });

  test('an empty history produces an empty report, not a crash', () => {
    const report = buildReport([]);
    assert.equal(report.sessionCount, 0);
    assert.deepEqual(report.headlines, []);
  });

  test('headlines contain no em dashes, matching the copy rules', () => {
    const report = buildReport([session(1, 40, ['bonjour']), session(2, 60, ['merci'], 4)]);
    for (const h of report.headlines) assert.ok(!h.includes('—'), h);
  });
});

describe('export', () => {
  const words = ['bonjour', 'café', "s'il"];

  test('entries carry the phrase each word was learned in', () => {
    const entries = buildEntries(words, [CAFE_LESSON]);
    assert.equal(entries.length, 3);
    const bonjour = entries.find((e) => e.word === 'bonjour');
    assert.ok(bonjour && bonjour.gloss.includes('='), 'the card back pairs the French phrase with its meaning');
  });

  test('IPA only appears when it belongs to that exact word', () => {
    const entries = buildEntries(['bonjour', 'merci', 'sont'], [CAFE_LESSON]);
    const bonjour = entries.find((e) => e.word === 'bonjour')!;
    const merci = entries.find((e) => e.word === 'merci')!;
    const sont = entries.find((e) => e.word === 'sont')!;
    assert.equal(bonjour.ipa, 'bɔ̃ʒuʁ', 'known from the drill bank');
    assert.equal(merci.ipa, 'mɛʁsi');
    // "sont" only ever appears inside a multi-word line, so no per-word IPA exists.
    // The old code would have pinned it a random syllable from that line's IPA.
    assert.equal(sont.ipa, '', 'a word with no per-word transcription exports without one, never with a wrong one');
  });

  test('a word without a gloss still exports rather than being dropped', () => {
    const entries = buildEntries(['zut'], [CAFE_LESSON]);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.gloss, '');
  });

  test('CSV starts with a BOM and quotes fields containing commas', () => {
    const csv = toCsv([{ word: 'oui', gloss: 'yes, indeed', ipa: 'wi' }]);
    assert.ok(csv.startsWith('﻿'), 'Excel needs the BOM to read accents');
    assert.ok(csv.includes('"yes, indeed"'));
  });

  test('Anki format is front-tab-back, one note per line', () => {
    const tsv = toAnkiTsv([
      { word: 'bonjour', gloss: 'hello', ipa: 'bɔ̃.ʒuʁ' },
      { word: 'zut', gloss: 'darn', ipa: '' },
    ]);
    const lines = tsv.trimEnd().split('\n');
    assert.equal(lines[0], 'bonjour\thello /bɔ̃.ʒuʁ/');
    assert.equal(lines[1], 'zut\tdarn');
  });

  test('accents survive the round trip', () => {
    const csv = toCsv(buildEntries(['café', 'plaît'], [CAFE_LESSON]));
    assert.ok(csv.includes('café'));
    assert.ok(csv.includes('plaît'));
  });
});
