/**
 * The free tier's share of a review sitting (founder decision 2026-10-20):
 * conversation-only phrases are part of the trial, every other source stays
 * reviewable, and each writer says where its phrases came from.
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newCard, type ReviewCard, type ReviewSource } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { setActiveUser, userKey } from '../storage/scope.ts';
import { createSyncPolicy } from '../sync/policy.ts';
import { resetSyncRegistry } from '../sync/registry.ts';
import { HELD_BACK_ACTION, dealForTier, heldBackLine, offeredReview, reviewOffer } from './freeTier.ts';
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

  test('unlocked and unknown deal everything and hold nothing back', () => {
    for (const lock of ['unlocked', 'unknown'] as const) {
      const deal = dealForTier(deck, NOW, lock);
      assert.equal(deal.due.length, 5);
      assert.equal(deal.heldBack, 0);
    }
  });

  test('locked deals only free cards, keeps old untagged ones, and counts the rest', () => {
    const deal = dealForTier(deck, NOW, 'locked');
    assert.deepEqual(deal.due.map((c) => c.id).sort(), ['d', 'mix', 'old']);
    assert.equal(deal.heldBack, 2);
  });

  test('locked with no conversation-only cards due holds nothing back', () => {
    assert.equal(dealForTier([card('d', ['daily'])], NOW, 'locked').heldBack, 0);
    const later = { ...card('c', ['conversation']), due: NOW + 86_400_000 };
    assert.equal(dealForTier([later], NOW, 'locked').heldBack, 0);
  });
});

describe("Home's review offer", () => {
  const at = (c: ReviewCard, due: number): ReviewCard => ({ ...c, due });

  test('locked with only conversation-only cards due offers nothing', () => {
    const offer = reviewOffer([card('c1', ['conversation']), card('c2', ['conversation'])], NOW);
    assert.equal(offeredReview(offer, 'locked'), null);
  });

  test('locked with a mix offers the free card, not the older conversation one', () => {
    const deck = [at(card('c', ['conversation']), NOW - 5000), at(card('d', ['daily']), NOW - 1000)];
    assert.equal(offeredReview(reviewOffer(deck, NOW), 'locked')?.id, 'd');
  });

  test('an untagged card counts as free', () => {
    assert.equal(offeredReview(reviewOffer([card('old')], NOW), 'locked')?.id, 'old');
  });

  test('unlocked and unknown offer the oldest due card', () => {
    const deck = [at(card('d', ['daily']), NOW - 1000), at(card('c', ['conversation']), NOW - 5000)];
    for (const lock of ['unlocked', 'unknown'] as const) assert.equal(offeredReview(reviewOffer(deck, NOW), lock)?.id, 'c');
  });
});

describe('the held-back row copy', () => {
  test('appears only when something was held back, and reads plainly', () => {
    assert.equal(heldBackLine(0), null);
    assert.equal(heldBackLine(1), '1 phrase from your conversations is included with your trial.');
    assert.equal(heldBackLine(3), '3 phrases from your conversations are included with your trial.');
  });

  test('passes the guilt ban and the punctuation rule', () => {
    for (const line of [heldBackLine(1)!, heldBackLine(4)!, HELD_BACK_ACTION]) {
      assert.equal(guiltIn(line), undefined, line);
      assert.doesNotMatch(line, /[·—–!]/);
    }
  });

  test('ReviewScreen deals through the tier, reads the lock, and draws the row only when it has a line', () => {
    const screen = read('../ReviewScreen.tsx');
    assert.match(screen, /useFeatureLocks\(user\?\.id \?\? null\)/);
    assert.match(screen, /dealForTier\(deck, now, lockAtDeal\.current\('conversationPractice'\)\)/);
    assert.match(screen, /const heldRow = heldLine === null \? null :/);
    assert.match(screen, /locks\.open\('conversationPractice'\)/);
    assert.doesNotMatch(screen, /dueCards\(/, 'a sitting dealt around the tier');
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
    assert.equal(dealForTier(deck, NOW, 'locked').due.length, 1);
  });

  test('the sync merge unions sources on conflict', () => {
    const policy = createSyncPolicy({ now: () => NOW });
    const result = policy.merge({ namespace: 'review', local: [card('p', ['conversation'])], remote: [card('p', ['curated'])] });
    assert.equal(result.kind, 'merged');
    const merged = (result as { data: ReviewCard[] }).data;
    assert.deepEqual(merged[0]!.sources, ['conversation', 'curated']);
  });
});
