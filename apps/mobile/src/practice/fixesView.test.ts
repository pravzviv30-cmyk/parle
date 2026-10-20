/**
 * Your fixes (B3, 2026-10-20, artboard B-Fixes): attempt before reveal, the
 * This conversation / All conversations aggregation, phrase status in words,
 * and the screen's own probes (no plan, no continue arc, a calm fallback).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { buildConversationPack, newCard, phraseKeyOf, type ConversationPack, type DrillExercise, type ReviewCard } from '@luvani/core';

import type { LockedFeature } from '../access/featureAccess.ts';
import { fixLabel, fixRows, fixesFor, fixesLocked, fixesPack, fixesSubtitle, inSentence, phraseRows, practiseAll } from './fixesView.ts';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

const card = (fr: string, extra: Partial<ReviewCard> = {}): ReviewCard =>
  ({ ...newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, NOW - 10 * DAY), ...extra });
const exercise = (fr: string): DrillExercise =>
  ({ id: `t:${phraseKeyOf(fr)}`, phraseKey: phraseKeyOf(fr), difficulty: 'production', kind: 'translate', fr, en: `meaning ${fr}`, direction: 'en-fr', accepted: [fr] });
const ENGLISH: Record<string, string> = { 'Je voudrais un café': 'I would like a coffee, please.', 'L’addition, s’il vous plaît': 'The bill, please.', 'C’est combien ?': 'How much is it?', 'Je suis allée': 'I went.' };
const fix = (quote: string, better: string) => ({ quote, better, betterEn: ENGLISH[better] ?? 'In English.', why: `why ${better}` });

function pack(id: string, daysAgo: number, corrections: ReturnType<typeof fix>[], lines: string[] = []): ConversationPack {
  return buildConversationPack({
    id, sessionId: id, learnerId: 'l', createdAt: new Date(NOW - daysAgo * DAY).toISOString(), state: 'ready',
    title: { fr: id, en: `Title ${id}` }, summary: 's', corrections, keyPhrases: lines.map((fr) => ({ fr, frWritten: null, en: `en ${fr}` })),
  });
}

const A = pack('a', 1, [fix('Je veux café', 'Je voudrais un café'), fix('Je veux l’addition', 'L’addition, s’il vous plaît'), fix('Combien ça', 'C’est combien ?')], ['Je voudrais un croissant', 'C’est combien ?']);
const B = pack('b', 5, [fix('Je suis allé', 'Je suis allée'), fix('Je veux café', 'Je voudrais un café')]);

describe('attempt before reveal', () => {
  test('the first untried fix is the one attempt, the rest wait, and none of them carries the answer', () => {
    const fixes = fixesFor({ pack: A, packs: [A, B], deck: [], bank: [], scope: 'this', now: NOW });
    const rows = fixRows(fixes, { active: null, typed: {} });
    assert.deepEqual(rows.map((r) => r.kind), ['attempt', 'waiting', 'waiting']);
    assert.equal(fixLabel(rows[0]!), 'Fix 1, try it first');
    for (const row of rows) {
      // What the row draws; the deck key and the drill route are not drawn.
      const { key: _key, ...drawn } = row;
      const said = JSON.stringify({ ...drawn, say: undefined });
      for (const answer of ['Je voudrais un café', 'Je veux café', 'why ']) assert.ok(!said.includes(answer), `an untried fix shows "${answer}" before a try`);
    }
    assert.equal(rows[0]!.kind === 'attempt' && rows[0]!.english, 'I would like a coffee, please.', 'the attempt does not ask from the English');
  });

  test('a fix the deck holds as tried shows what was said, a more natural way and why', () => {
    const deck = [card('L’addition, s’il vous plaît', { reps: 1 })];
    const fixes = fixesFor({ pack: A, packs: [A], deck, bank: [exercise('L’addition, s’il vous plaît')], scope: 'this', now: NOW });
    const rows = fixRows(fixes, { active: null, typed: {} });
    assert.deepEqual(rows.map((r) => r.kind), ['attempt', 'compared', 'waiting']);
    const tried = rows[1]!;
    assert.ok(tried.kind === 'compared');
    if (tried.kind !== 'compared') return;
    assert.equal(tried.said, 'You said yesterday');
    assert.equal(tried.quote, 'Je veux l’addition');
    assert.equal(tried.better, 'L’addition, s’il vous plaît');
    assert.equal(tried.why, 'why L’addition, s’il vous plaît');
    assert.equal(tried.wrote, null);
    // Saying it once more, after the comparison, carries the moment along.
    assert.deepEqual(tried.again, { screen: 'Drill', params: { node: { id: `fix:a:${phraseKeyOf('L’addition, s’il vous plaît')}`, title: 'Your fixes', phraseKeys: [phraseKeyOf('L’addition, s’il vous plaît')], moment: { quote: 'Je veux l’addition', better: 'L’addition, s’il vous plaît', why: 'why L’addition, s’il vous plaît' } } } });
  });

  test('an introduced card is not a try, and a typed attempt here reveals only that fix', () => {
    const deck = [card('Je voudrais un café', { reps: 0 })];
    const fixes = fixesFor({ pack: A, packs: [A], deck, bank: [exercise('Je voudrais un café')], scope: 'this', now: NOW });
    assert.equal(fixRows(fixes, { active: null, typed: {} })[0]!.kind, 'attempt', 'a card only introduced counts as tried');
    const key = phraseKeyOf('Je voudrais un café');
    const rows = fixRows(fixes, { active: null, typed: { [key]: 'Je voudrais café' } });
    assert.deepEqual(rows.map((r) => r.kind), ['compared', 'attempt', 'waiting']);
    assert.equal(rows[0]!.kind === 'compared' && rows[0]!.wrote, 'Je voudrais café');
  });

  test('Say it opens the drill on the better line with no moment, and only when the bank can ask for it', () => {
    const key = phraseKeyOf('Je voudrais un café');
    const without = fixRows(fixesFor({ pack: A, packs: [A], deck: [], bank: [], scope: 'this', now: NOW }), { active: null, typed: {} });
    assert.equal(without[0]!.kind === 'attempt' && without[0]!.say, null, 'Say it opens an empty sitting');
    const rows = fixRows(fixesFor({ pack: A, packs: [A], deck: [], bank: [exercise('Je voudrais un café')], scope: 'this', now: NOW }), { active: null, typed: {} });
    assert.deepEqual(rows[0]!.kind === 'attempt' && rows[0]!.say, { screen: 'Drill', params: { node: { id: `fix:a:${key}`, title: 'Your fixes', phraseKeys: [key] } } });
  });

  test('Try it moves the attempt to the chosen fix', () => {
    const fixes = fixesFor({ pack: A, packs: [A], deck: [], bank: [], scope: 'this', now: NOW });
    const rows = fixRows(fixes, { active: phraseKeyOf('C’est combien ?'), typed: {} });
    assert.deepEqual(rows.map((r) => r.kind), ['waiting', 'waiting', 'attempt']);
  });
});

describe('this conversation and all conversations', () => {
  test('All gathers every ready conversation\'s fixes, newest first, one row per better line', () => {
    const one = fixesFor({ pack: A, packs: [A, B], deck: [], bank: [], scope: 'this', now: NOW });
    const all = fixesFor({ pack: A, packs: [B, A], deck: [], bank: [], scope: 'all', now: NOW });
    assert.equal(one.length, 3);
    assert.deepEqual(all.map((f) => f.correction.better), ['Je voudrais un café', 'L’addition, s’il vous plaît', 'C’est combien ?', 'Je suis allée']);
    assert.equal(all[3]!.packId, 'b');
    assert.equal(all[3]!.day, '5 days ago');
  });

  test('Practise all fixes drills every listed fix the bank can ask for, and says free', () => {
    const fixes = fixesFor({ pack: A, packs: [A], deck: [], bank: [exercise('Je voudrais un café'), exercise('C’est combien ?')], scope: 'this', now: NOW });
    assert.deepEqual(practiseAll(fixes, 'this', 'a'), { screen: 'Drill', params: { node: { id: 'fixes:a', title: 'Your fixes', phraseKeys: [phraseKeyOf('Je voudrais un café'), phraseKeyOf('C’est combien ?')] } } });
    assert.equal(practiseAll(fixesFor({ pack: A, packs: [A], deck: [], bank: [], scope: 'all', now: NOW }), 'all', 'a'), null);
    const screen = readFileSync(fileURLToPath(new URL('./fixesView.ts', import.meta.url)), 'utf8');
    assert.match(screen, /practiseAll: 'Practise all fixes, free'/);
    assert.doesNotMatch(screen, /\d+ min/, 'the screen claims minutes nothing estimates');
  });
});

describe('the rest of the screen', () => {
  test('phrase status comes from each card, and never "Used in n conversations"', () => {
    const deck = [card('Je voudrais un croissant', { evidence: { retrievals: 0, convoUses: 2, transfers: 0 } })];
    assert.deepEqual(phraseRows(A, deck).map((r) => r.status), ['Used 2 times', 'Not practised yet']);
    assert.doesNotMatch(readFileSync(fileURLToPath(new URL('./fixesView.ts', import.meta.url)), 'utf8'), /['`]Used in/);
  });

  test('the header line names the conversation and its day; an unknown pack has none', () => {
    assert.equal(fixesSubtitle(A, NOW), 'Title a, yesterday');
    assert.equal(inSentence('12 Oct'), 'on 12 Oct');
    assert.equal(fixesPack('missing', [A]), null);
    assert.equal(fixesPack('a', [A])?.id, 'a');
  });

  test('the lock comes from the seam only, and the screen asks neither the plan nor the continue arc', () => {
    assert.equal(fixesLocked((_f: LockedFeature) => 'locked'), true);
    assert.equal(fixesLocked(), false);
    const screen = readFileSync(fileURLToPath(new URL('./FixesScreen.tsx', import.meta.url)), 'utf8');
    // 2026-10-20, lock seam wiring: the screen holds the reactive hook and hands its access to the view;
    // the badge sits under the title, above the conversation line, as B-Fixes draws it.
    for (const asked of ['capabilitiesFor(', 'useContinueArc(']) assert.ok(!screen.includes(asked), `Your fixes calls ${asked}`);
    assert.doesNotMatch(screen, /(?<!use)featureAccess\(/, 'Your fixes asks the seam itself');
    assert.match(screen, /const locked = fixesLocked\(locks\.access\);/);
    assert.match(screen, /\{locked && <LockBadge \/>\}\s*<Text[^>]*>\{fixesSubtitle\(pack, now\)\}/);
    assert.match(screen, /\{FIX_COPY\.unknownTitle\}/, 'an unknown conversation has no calm fallback');
    assert.match(screen, /<OutlineButton label=\{FIX_COPY\.back\} onPress=\{back\} \/>/, 'the fallback has no way back');
  });

  test('the Why line is drawn only when the stored reason has words', () => {
    const screen = readFileSync(fileURLToPath(new URL('./FixesScreen.tsx', import.meta.url)), 'utf8');
    assert.match(screen, /\{row\.why\.trim\(\) !== '' && <Text[^>]*>\{FIX_COPY\.why\} \{row\.why\}<\/Text>\}/, 'an empty reason still draws "Why:" over nothing');
    assert.equal((screen.match(/\{FIX_COPY\.why\}/g) ?? []).length, 1);
  });

  test('the screen draws the answer only in the compared branch, and the typed attempt is never stored', () => {
    const screen = readFileSync(fileURLToPath(new URL('./FixesScreen.tsx', import.meta.url)), 'utf8');
    const attempt = screen.slice(screen.indexOf("if (row.kind === 'attempt')"), screen.indexOf("if (row.kind === 'waiting')"));
    for (const answer of ['row.better', 'row.quote', 'row.why']) assert.ok(!attempt.includes(answer), `the attempt branch draws ${answer}`);
    assert.doesNotMatch(screen, /AsyncStorage|saveDeck|setItem|userKey\(/, 'Your fixes writes something');
    assert.match(screen, /<TabBar tabs=\{SCOPES\}/, 'the This conversation and All conversations toggle is not the shared segmented control');
  });
});
