/**
 * The review sitting (REV-003, 2026-11-18: conversation phrases are reviewed
 * free on every plan), and each writer says where its phrases came from.
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newCard, type ReviewCard, type ReviewSource } from '@luvani/core';

import { setActiveUser, userKey } from '../storage/scope.ts';
import { createSyncPolicy } from '../sync/policy.ts';
import { resetSyncRegistry } from '../sync/registry.ts';
import { featureLockState, lockedRouteFeature } from '../purchases/featureLocks.ts';
import { dealForTier, reviewOffer } from './freeTier.ts';
import { addPhrases, loadDeck } from './store.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const NOW = 1_700_000_000_000;

function card(id: string, sources?: readonly ReviewSource[]): ReviewCard {
  const base = newCard({ id, kind: 'vocab', front: id, back: 'x', context: '', ipa: '' }, NOW - 1000);
  return sources === undefined ? base : { ...base, sources };
}
const phrase = (fr: string) => ({ fr, en: 'x', frWritten: null, enLiteral: null, register: 'courant' as const, note: null });

describe('dealForTier', () => {
  const deck = [card('old'), card('c1', ['conversation']), card('c2', ['conversation']), card('d', ['daily']), card('mix', ['conversation', 'sample'])];

  // REV-003 (2026-11-18, founder): spaced review of conversation phrases is free on every plan.
  test('every plan is dealt conversation-only cards, with nothing held back', () => {
    const deal = dealForTier(deck, NOW);
    assert.deepEqual(deal.due.map((c) => c.id).sort(), ['c1', 'c2', 'd', 'mix', 'old']);
    assert.equal((deal as { heldBack?: number }).heldBack ?? 0, 0);
  });
});

describe("Home's review offer", () => {
  const at = (c: ReviewCard, due: number): ReviewCard => ({ ...c, due });

  test('only conversation-only cards due still offers the oldest', () => {
    const deck = [at(card('d', ['daily']), NOW - 1000), at(card('c', ['conversation']), NOW - 5000)];
    assert.equal(reviewOffer(deck, NOW)?.id, 'c');
    assert.equal(reviewOffer([card('c1', ['conversation'])], NOW)?.id, 'c1');
    assert.equal(reviewOffer([], NOW), null);
  });
});

describe('Review reads no lock, pack drills stay locked', () => {
  test('ReviewScreen deals the whole deck and draws no held-back row', () => {
    const screen = read('../ReviewScreen.tsx');
    assert.match(screen, /dealForTier\(deck, now\)/);
    assert.doesNotMatch(screen, /conversationPractice|heldRow|HELD_BACK_ACTION/);
    assert.doesNotMatch(screen, /dueCards\(/, 'a sitting dealt around the tier');
  });

  test('a drill of a whole conversation pack stays locked for the free plan', () => {
    assert.equal(lockedRouteFeature('Review'), null);
    assert.equal(lockedRouteFeature('Drill', { practice: 'pack', packId: 'p1' }), 'conversationPractice');
    assert.equal(lockedRouteFeature('ConversationPractice', { packId: 'p1' }), 'conversationPractice');
    const free = { plan: 'trial', secondsRemaining: 300, periodEnd: null, lapsed: false, canStart: true, reason: null } as const;
    assert.equal(featureLockState('conversationPractice', free), 'locked');
  });
});

describe('every writer tags its phrases', () => {
  const writers: [string, RegExp][] = [
    ['../daily/DailyPracticeScreen.tsx', /addPhrases\([^;]*\{ source: 'daily' \}\)/],
    ['../live/journal.ts', /addPhrases\(batch\.phrases, \{ source: 'conversation',/],
    ['../conversationPacks/store.ts', /\{source:'conversation',stagger:true\}/],
    ['../conversationPacks/sampleFixture.ts', /addPhrases\(reviewPhrasesFor\(sample\), \{ source: 'sample',/],
    ['../live/recapKeepsake.ts', /\{ source: 'conversation' \}/],
    ['../onboarding/StarterContinuation.tsx', /\{ source: 'curated' \}/],
    ['../onboarding/GuestAccountHandoff.tsx', /addPhrases\(phrases, \{ source: 'curated' \}\)/],
    ['../DrillScreen.tsx', /note: null \}, 'conversation'\)/],
    ['./store.ts', /const sources: readonly ReviewSource\[\] = \['lesson'\];/],
  ];
  for (const [file, pattern] of writers) test(file, () => assert.match(read(file), pattern));
});

describe('the deck keeps sources on disk and through sync', () => {
  let n = 0;
  const disk = new Map<string, string>();
  beforeEach(() => {
    disk.clear();
    const shared = AsyncStorage as unknown as Record<string, unknown>;
    shared.getItem = async (key: string) => disk.get(key) ?? null;
    shared.setItem = async (key: string, value: string) => { disk.set(key, value); };
    resetSyncRegistry();
    setActiveUser(`free-tier-deck-${++n}`);
  });
  afterEach(() => resetSyncRegistry());

  test('a phrase added from two writers is one card with both sources, saved', async () => {
    assert.equal(await addPhrases([phrase('Un café')], { source: 'conversation' }), 'durable');
    assert.equal(await addPhrases([phrase('Un café')], { source: 'daily' }), 'durable');
    const deck = await loadDeck();
    assert.equal(deck.length, 1);
    assert.deepEqual(deck[0]!.sources, ['daily', 'conversation']);
    const stored = JSON.parse(disk.get(userKey('review'))!) as ReviewCard[];
    assert.deepEqual(stored[0]!.sources, ['daily', 'conversation']);
  });

  test('an old stored deck without sources still loads and stays reviewable', async () => {
    disk.set(userKey('review'), JSON.stringify([card('vocab:café')]));
    const deck = await loadDeck();
    assert.equal(deck.length, 1);
    assert.equal(deck[0]!.sources, undefined);
    assert.equal(dealForTier(deck, NOW).due.length, 1);
  });

  test('the sync merge unions sources on conflict', () => {
    const policy = createSyncPolicy({ now: () => NOW });
    const result = policy.merge({ namespace: 'review', local: [card('p', ['conversation'])], remote: [card('p', ['curated'])] });
    assert.equal(result.kind, 'merged');
    const merged = (result as { data: ReviewCard[] }).data;
    assert.deepEqual(merged[0]!.sources, ['conversation', 'curated']);
  });
});
