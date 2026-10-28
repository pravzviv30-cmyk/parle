import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JudgeMemo, judgeMemoFromEnv, normaliseAttempt } from './judgeMemo.ts';

const req = (attempt: string) => ({ kind: 'judge' as const, system: 's', request: attempt, signal: new AbortController().signal });

test('a memo key ignores the abort signal and separates users, endpoints and requests', () => {
  const memo = new JudgeMemo({ model: () => 'm' });
  memo.set('u1', 'own-words', req('a'), { ok: 1 });
  assert.deepEqual(memo.get('u1', 'own-words', req('a')), { ok: 1 });
  assert.equal(memo.get('u2', 'own-words', req('a')), undefined);
  assert.equal(memo.get('u1', 'fix-line', req('a')), undefined);
  assert.equal(memo.get('u1', 'own-words', req('A')), undefined);
});

test('a changed judge model invalidates the entry', () => {
  let model = 'm1';
  const memo = new JudgeMemo({ model: () => model });
  memo.set('u', 'own-words', req('a'), 1);
  model = 'm2';
  assert.equal(memo.get('u', 'own-words', req('a')), undefined);
});

test('entries expire after the TTL', () => {
  let now = 0;
  const memo = new JudgeMemo({ model: () => 'm', now: () => now, ttlMs: 1000 });
  memo.set('u', 'own-words', req('a'), 1);
  now = 999; assert.equal(memo.get('u', 'own-words', req('a')), 1);
  now = 1000; assert.equal(memo.get('u', 'own-words', req('a')), undefined);
  assert.equal(memo.size, 0);
});

test('the global cap evicts the least recently used entry', () => {
  const memo = new JudgeMemo({ model: () => 'm', maxEntries: 2, maxPerUser: 10 });
  memo.set('a', 'own-words', req('1'), 1);
  memo.set('b', 'own-words', req('2'), 2);
  memo.get('a', 'own-words', req('1'));
  memo.set('c', 'own-words', req('3'), 3);
  assert.equal(memo.get('b', 'own-words', req('2')), undefined);
  assert.equal(memo.get('a', 'own-words', req('1')), 1);
  assert.equal(memo.get('c', 'own-words', req('3')), 3);
});

test('the per-user cap evicts only that user\'s oldest entry', () => {
  const memo = new JudgeMemo({ model: () => 'm', maxEntries: 100, maxPerUser: 2 });
  memo.set('other', 'own-words', req('x'), 0);
  memo.set('u', 'own-words', req('1'), 1);
  memo.set('u', 'own-words', req('2'), 2);
  memo.set('u', 'own-words', req('3'), 3);
  assert.equal(memo.get('u', 'own-words', req('1')), undefined);
  assert.equal(memo.get('u', 'own-words', req('3')), 3);
  assert.equal(memo.get('other', 'own-words', req('x')), 0);
});

test('forgetUser removes every entry of that user and no one else\'s', () => {
  const memo = new JudgeMemo({ model: () => 'm' });
  memo.set('u', 'own-words', req('1'), 1);
  memo.set('u', 'fix-line', req('2'), 2);
  memo.set('v', 'own-words', req('1'), 3);
  memo.forgetUser('u');
  assert.equal(memo.get('u', 'own-words', req('1')), undefined);
  assert.equal(memo.get('u', 'fix-line', req('2')), undefined);
  assert.equal(memo.get('v', 'own-words', req('1')), 3);
  assert.equal(memo.size, 1);
});

test('normaliseAttempt is NFC, trimmed and collapses whitespace, keeping case, accents and punctuation', () => {
  assert.equal(normaliseAttempt('  Un  café,\n\tMerci ! '), 'Un café, Merci !');
});

test('the memo is off unless LUVANI_JUDGE_MEMO is 1', () => {
  assert.equal(judgeMemoFromEnv({}), null);
  assert.equal(judgeMemoFromEnv({ LUVANI_JUDGE_MEMO: '0' }), null);
  assert.equal(judgeMemoFromEnv({ LUVANI_JUDGE_MEMO: 'true' }), null);
  assert.ok(judgeMemoFromEnv({ LUVANI_JUDGE_MEMO: '1' }) instanceof JudgeMemo);
});
