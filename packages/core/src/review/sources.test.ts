import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeDecks } from './merge.ts';
import { mergeCards, newCard, applyGrade, type ReviewCard } from './scheduler.ts';
import { conversationOnly, reviewableFree, sourcesOf, unionSources, type ReviewSource } from './sources.ts';
import * as core from '../index.ts';

const NOW = 1_700_000_000_000;

function card(id: string, sources?: readonly ReviewSource[]): ReviewCard {
  const base = newCard({ id, kind: 'vocab', front: id, back: `${id} = x`, context: '', ipa: '' }, NOW);
  return sources === undefined ? base : { ...base, sources };
}

describe('review sources (free tier, 2026-10-20)', () => {
  test('conversationOnly is true only for a tagged card whose every tag is conversation', () => {
    assert.equal(conversationOnly(card('a', ['conversation'])), true);
    assert.equal(conversationOnly(card('a', ['conversation', 'daily'])), false);
    assert.equal(conversationOnly(card('a', ['lesson'])), false);
    assert.equal(conversationOnly(card('a', [])), false);
    // An untagged card predates tagging: fail open.
    assert.equal(conversationOnly(card('a')), false);
    // Junk on disk reads as no tag, never as a lock.
    assert.equal(conversationOnly({ sources: 'conversation' as unknown as ReviewSource[] }), false);
    assert.equal(conversationOnly({ sources: ['nope', 'conversation'] as unknown as ReviewSource[] }), true);
  });

  test('reviewableFree keeps everything that is not conversation-only, old untagged cards included', () => {
    const deck = [card('old'), card('convo', ['conversation']), card('daily', ['daily']), card('sample', ['sample']), card('both', ['conversation', 'curated'])];
    assert.deepEqual(reviewableFree(deck).map((c) => c.id), ['old', 'daily', 'sample', 'both']);
  });

  test('sources read in one fixed order, deduped', () => {
    assert.deepEqual(sourcesOf(card('a', ['curated', 'daily', 'daily'])), ['daily', 'curated']);
    assert.deepEqual(unionSources(['conversation'], ['sample', 'conversation']), ['sample', 'conversation']);
  });

  test('mergeCards unions the sources of a phrase added again, and keeps its scheduling', () => {
    const graded = applyGrade(card('p', ['conversation']), 'good', NOW + 1000);
    const [merged] = mergeCards([graded], [card('p', ['daily'])]);
    assert.deepEqual(merged!.sources, ['daily', 'conversation']);
    assert.equal(merged!.reps, graded.reps);
    assert.equal(merged!.due, graded.due);
    assert.equal(conversationOnly(merged!), false);
  });

  test('an old untagged card stays untagged when a conversation adds it again', () => {
    const [merged] = mergeCards([card('p')], [card('p', ['conversation'])]);
    assert.equal(merged!.sources, undefined);
    assert.equal(reviewableFree([merged!]).length, 1);
  });

  test('a new card enters with its tag', () => {
    const deck = mergeCards([], [card('p', ['sample'])]);
    assert.deepEqual(deck[0]!.sources, ['sample']);
  });

  test('mergeDecks unions sources whichever side wins the card', () => {
    const phone = applyGrade(card('p', ['conversation']), 'good', NOW + 1000);
    const tablet = card('p', ['daily']);
    for (const merged of [mergeDecks([phone], [tablet]), mergeDecks([tablet], [phone])]) {
      assert.equal(merged.length, 1);
      assert.deepEqual(merged[0]!.sources, ['daily', 'conversation']);
      assert.equal(merged[0]!.reps, phone.reps);
    }
  });

  test('mergeDecks: an untagged copy absorbs, so legacy cards stay free', () => {
    const merged = mergeDecks([card('p')], [card('p', ['conversation'])]);
    assert.equal(merged[0]!.sources, undefined);
    assert.equal(conversationOnly(merged[0]!), false);
  });

  test('mergeDecks stays commutative, idempotent and associative with sources', () => {
    const tags: (readonly ReviewSource[] | undefined)[] = [undefined, [], ['conversation'], ['daily'], ['sample', 'conversation'], ['lesson']];
    const sides = tags.map((t, i) => [i % 2 ? applyGrade(card('p', t), 'good', NOW + i) : card('p', t), card(`q${i}`, t)]);
    const json = (x: unknown) => JSON.stringify(x);
    for (const a of sides) for (const b of sides) {
      assert.equal(json(mergeDecks(a, b)), json(mergeDecks(b, a)));
      assert.equal(json(mergeDecks(mergeDecks(a, b), b)), json(mergeDecks(a, b)));
      for (const c of sides) assert.equal(json(mergeDecks(mergeDecks(a, b), c)), json(mergeDecks(a, mergeDecks(b, c))));
    }
  });

  test('exported from core', () => {
    assert.equal(typeof core.conversationOnly, 'function');
    assert.equal(typeof core.reviewableFree, 'function');
  });
});
