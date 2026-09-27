/**
 * The synced practice history, held to what it may carry and how it converges.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { phraseKeyOf } from '@luvani/core';
import { createSyncPolicy } from '../sync/policy.ts';
import { MAX_ENVELOPE_BYTES, sameData, sealEnvelope, envelopeBytes, stableStringify, utf8Bytes } from '../sync/envelope.ts';
import {
  MAX_PRACTICE_EVENTS,
  MAX_PRACTICE_HISTORY_BYTES,
  eventsForPack,
  hasCompletedSitting,
  isPracticeEvent,
  legacyMarkItems,
  mergePracticeEvents,
  mergePracticeHistory,
  mintPracticeId,
  packTargetsOf,
  readPracticeHistory,
  type PracticeEvent,
  type PracticeEventTarget,
  type SessionCompletedEvent,
  uniquePracticeEvents,
} from './history.ts';

const AT = Date.UTC(2026, 8, 23, 12);

const packTarget = (fr: string, packId = 'pack-a', outcome: 'recalled' | 'practised' | 'unresolved' = 'practised', attempts = 1): PracticeEventTarget => ({
  phraseKey: phraseKeyOf(fr),
  source: { kind: 'pack' as const, packId },
  outcome,
  attempts,
});

const reviewTarget = (fr: string): PracticeEventTarget => ({
  phraseKey: phraseKeyOf(fr),
  source: { kind: 'review' as const },
  outcome: 'practised' as const,
  attempts: 1,
});

const sitting = (id: string, at = AT, targets: PracticeEventTarget[] = [packTarget('bonjour')], packId: string | null = 'pack-a'): SessionCompletedEvent => ({
  kind: 'session-completed',
  id,
  at,
  packId,
  targets,
});

describe('practice history — what an event may hold', () => {
  test('a completed sitting, a warm-up and a revisit opening are all readable', () => {
    assert.ok(isPracticeEvent(sitting('s1')));
    assert.ok(isPracticeEvent({ kind: 'warmup-completed', id: 'w1', at: AT, packId: 'pack-a' }));
    assert.ok(isPracticeEvent({ kind: 'revisit-started', id: 'room-1', at: AT, packId: 'pack-a' }));
    assert.ok(isPracticeEvent(sitting('s2', AT, [reviewTarget('merci')], null)), 'a review-only sitting names no pack');
  });

  test('an extra field is refused, so a typed answer or a transcript can never ride along', () => {
    assert.equal(isPracticeEvent({ ...sitting('s1'), transcript: 'je voudrais un café' }), false);
    assert.equal(isPracticeEvent({ ...sitting('s1'), targets: [{ ...packTarget('bonjour'), answer: 'bonjor' }] }), false);
    assert.equal(isPracticeEvent({ kind: 'revisit-started', id: 'r1', at: AT, packId: 'pack-a', audio: 'x' }), false);
  });

  test('an event that contradicts itself is refused', () => {
    assert.equal(isPracticeEvent(sitting('s1', AT, [])), false, 'a completion with no answered work');
    const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((fr) => packTarget(fr));
    assert.equal(isPracticeEvent(sitting('s1', AT, seven)), false, 'more than six targets');
    assert.equal(isPracticeEvent(sitting('s1', AT, [packTarget('bonjour'), packTarget('bonjour')])), false, 'a phrase twice');
    assert.equal(isPracticeEvent(sitting('s1', AT, [packTarget('a', 'pack-a'), packTarget('b', 'pack-b')])), false, 'two conversations');
    assert.equal(isPracticeEvent(sitting('s1', AT, [packTarget('a', 'pack-a')], 'pack-b')), false, 'packId no target names');
    assert.equal(isPracticeEvent(sitting('s1', AT, [packTarget('a')], null)), false, 'pack target with no packId');
    assert.equal(isPracticeEvent(sitting('s1', AT, [reviewTarget('a')], 'pack-a')), false, 'packId with review only');
    assert.equal(isPracticeEvent(sitting('s1', AT, [packTarget('a', 'pack-a', 'recalled', 2)])), false, 'recall after a retry');
    assert.equal(isPracticeEvent(sitting('s1', AT, [packTarget('a', 'pack-a', 'practised', 0)])), false, 'zero attempts');
    assert.equal(isPracticeEvent({ ...sitting('s1'), at: 0 }), false, 'no time');
    assert.equal(isPracticeEvent({ ...sitting('bad id!') }), false, 'an id that is not an id');
    assert.equal(isPracticeEvent({ kind: 'mastered', id: 'x', at: AT, packId: 'pack-a' }), false, 'an unknown kind');
    assert.equal(isPracticeEvent({ kind: 'legacy-mark', id: 'x', at: AT, packId: 'pack-a', label: 'practised' }), false, 'legacy marks are never stored');
  });

  test('a saved phrase longer than a hundred characters still completes, identity untouched', () => {
    const long = 'Je voudrais réserver une table pour quatre personnes ce soir vers vingt heures, en terrasse si possible, merci beaucoup';
    assert.ok(phraseKeyOf(long).length > 100);
    const event = sitting('s1', AT, [packTarget(long)]);
    assert.ok(isPracticeEvent(event));
    assert.equal(mergePracticeEvents([event], [])[0]!.kind, 'session-completed');
    assert.equal((mergePracticeEvents([event], [])[0] as SessionCompletedEvent).targets[0]!.phraseKey, phraseKeyOf(long));
  });

  test('an old or newer schema reads as nothing rather than as a guess', () => {
    assert.equal(readPracticeHistory({ version: 2, events: [sitting('s1')] }), null);
    assert.equal(readPracticeHistory({ events: [sitting('s1')] }), null);
    assert.equal(readPracticeHistory('junk'), null);
    assert.deepEqual(readPracticeHistory({ version: 1, events: [sitting('s1'), { kind: 'bogus' }] })!.events, [sitting('s1')]);
  });
});

describe('practice history — convergence', () => {
  const gen = (seed: number): PracticeEvent[] => {
    const out: PracticeEvent[] = [];
    let s = seed;
    const next = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000);
    for (let i = 0; i < 8; i += 1) {
      const id = `s${Math.floor(next() * 6)}`;
      const at = AT + Math.floor(next() * 5) * 1000;
      const r = next();
      if (r < 0.4) out.push(sitting(id, at, [packTarget(['a', 'b', 'c'][Math.floor(next() * 3)]!, 'pack-a', next() < 0.5 ? 'practised' : 'unresolved', 1 + Math.floor(next() * 3))]));
      else if (r < 0.7) out.push({ kind: 'warmup-completed', id, at, packId: 'pack-a' });
      else out.push({ kind: 'revisit-started', id, at, packId: next() < 0.5 ? 'pack-a' : 'pack-b' });
    }
    return out;
  };

  test('merge is commutative, idempotent and associative, duplicates and reorders included', () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const a = gen(seed);
      const b = gen(seed * 7 + 3);
      const c = gen(seed * 13 + 1);
      const h = (events: PracticeEvent[]) => ({ version: 1, events });
      const ab = mergePracticeHistory(h(a), h(b));
      assert.ok(sameData(ab, mergePracticeHistory(h(b), h(a))), `seed ${seed} depends on order`);
      assert.ok(sameData(ab, mergePracticeHistory(ab, ab)), `seed ${seed} moves when merged twice`);
      assert.ok(sameData(ab, mergePracticeHistory(h([...a, ...a]), h([...b].reverse()))), `seed ${seed} counts a duplicate delivery`);
      assert.ok(
        sameData(mergePracticeHistory(mergePracticeHistory(h(a), h(b)), h(c)), mergePracticeHistory(h(a), mergePracticeHistory(h(b), h(c)))),
        `seed ${seed} depends on grouping`,
      );
    }
  });

  test('under the byte budget, the account merge is associative, differing copies and duplicates included', () => {
    // Events big enough that the byte budget, not the count, decides the cut;
    // differing copies of one id, and a floor that must travel with the blob.
    // The probe that found the non-associative suffix cut is this loop.
    const AT0 = AT;
    const ev = (id: string, at: number, size: number, tag: string) =>
      sitting(id, at, Array.from({ length: 6 }, (_, k) => ({ ...packTarget('x'), phraseKey: `phrase:${tag}${k}${'é'.repeat(size)}` })));
    const blob = (events: SessionCompletedEvent[]) => ({ version: 1, events });
    let bit = 0;
    for (let seed = 1; seed < 400; seed += 1) {
      let s = seed;
      const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
      const mk = () =>
        Array.from({ length: 1 + Math.floor(r() * 5) }, () =>
          ev(`s${Math.floor(r() * 5)}`, AT0 + Math.floor(r() * 5), r() < 0.5 ? 1900 : 10, ['x', 'y', 'z'][Math.floor(r() * 3)]!),
        );
      const filler = Array.from({ length: 30 + Math.floor(r() * 10) }, (_, i) => ev(`f${i}`, AT0 + 100 + i, 1900, 'f'));
      const a = blob([...mk(), ...filler]);
      const b = blob(mk());
      const c = blob(mk());
      const left = mergePracticeHistory(mergePracticeHistory(a, b), c);
      const right = mergePracticeHistory(a, mergePracticeHistory(b, c));
      if (left.floor > 0) bit += 1;
      assert.ok(utf8Bytes(JSON.stringify(left.events)) <= MAX_PRACTICE_HISTORY_BYTES);
      assert.ok(sameData(left, right), `seed ${seed} depends on grouping under the byte budget`);
      assert.ok(sameData(mergePracticeHistory(a, b), mergePracticeHistory(b, a)), `seed ${seed} depends on order`);
      assert.ok(sameData(left, mergePracticeHistory(left, left)), `seed ${seed} moves when merged twice`);
      assert.ok(sameData(left, mergePracticeHistory(left, a)), `seed ${seed} re-admits an aged-out event`);
      const shown = uniquePracticeEvents(left.events);
      assert.equal(new Set(shown.map((e) => `${e.kind}:${e.id}`)).size, shown.length, 'a reader saw one id twice');
    }
    assert.ok(bit > 50, 'the byte budget rarely bit, so this checks little');
  });

  test('an event that aged out is never brought back by an older device', () => {
    const many = Array.from({ length: 160 }, (_, i) => sitting(`s${i}`, AT + i));
    const phone = mergePracticeHistory({ version: 1, events: many }, null);
    assert.ok(phone.floor > 0);
    const tablet = { version: 1, events: many.slice(0, 20) };
    assert.ok(sameData(mergePracticeHistory(phone, tablet), phone), 'an old device resurrected an event the account had aged out');
    assert.ok(sameData(mergePracticeHistory(tablet, phone), phone), 'the floor only held when it was on the local side');
    // The floor alone, on either side, keeps an old event out, even when the union is small.
    const account = { version: 1, events: [sitting('new', AT + 100)], floor: AT + 50 };
    const old = { version: 1, events: [sitting('old', AT + 1)] };
    for (const merged of [mergePracticeHistory(account, old), mergePracticeHistory(old, account)]) {
      assert.deepEqual(merged.events.map((e) => e.id), ['new']);
      assert.equal(merged.floor, AT + 50);
    }
  });

  test('the same sitting delivered twice is one row, and a revisit with the same id as a sitting is its own row', () => {
    const merged = mergePracticeEvents([sitting('s1')], [sitting('s1'), { kind: 'revisit-started', id: 's1', at: AT, packId: 'pack-a' }]);
    assert.equal(merged.length, 2);
    assert.ok(hasCompletedSitting(merged, 's1'));
  });

  test('the count cap keeps the newest 150 on both devices', () => {
    const many = Array.from({ length: 200 }, (_, i) => sitting(`s${i}`, AT + i));
    const merged = mergePracticeHistory({ version: 1, events: many.slice(0, 120) }, { version: 1, events: many.slice(80) });
    assert.equal(merged.events.length, MAX_PRACTICE_EVENTS);
    assert.equal(merged.events[0]!.id, 's50');
    assert.equal(merged.floor, AT + 49);
    assert.ok(sameData(merged, mergePracticeHistory({ version: 1, events: many.slice(80) }, { version: 1, events: many.slice(0, 120) })));
  });

  test('the byte budget holds at the real worst case, measured through JSON escaping, and the envelope fits', () => {
    // Characters JSON escapes to six bytes, and astral characters at four, both measured.
    const escaped = '\u0001'.repeat(1990);
    const astral = '😀'.repeat(990);
    const worst = Array.from({ length: 200 }, (_, i) =>
      sitting(
        `s${i}`,
        AT + i,
        Array.from({ length: 6 }, (_, k) => ({ ...packTarget('x'), phraseKey: `phrase:${k}${i % 2 ? escaped : astral}` })),
      ),
    );
    for (const event of worst) assert.ok(isPracticeEvent(event));
    const merged = mergePracticeHistory({ version: 1, events: worst }, null);
    const bytes = utf8Bytes(JSON.stringify(merged.events));
    assert.ok(bytes <= MAX_PRACTICE_HISTORY_BYTES, `${bytes} bytes of events`);
    assert.ok(merged.events.length < 150, 'the byte budget, not the count, is what bit here');
    const envelope = envelopeBytes(sealEnvelope(merged, 'device-1', AT));
    assert.ok(envelope !== null && envelope <= MAX_ENVELOPE_BYTES, `the envelope is ${envelope} bytes`);
    // And the budget is convergent too.
    assert.ok(sameData(merged, mergePracticeHistory(merged, { version: 1, events: worst.slice(0, 50) })));
  });

  test('the sync policy merges practiceHistory through the same function and goes quiet on a newer schema', () => {
    const policy = createSyncPolicy({ now: () => AT });
    const local = { version: 1, events: [sitting('s1')] };
    const remote = { version: 1, events: [sitting('s2', AT + 1)] };
    const result = policy.merge({ namespace: 'practiceHistory', local, remote });
    assert.equal(result.kind, 'merged');
    assert.equal(stableStringify(result.kind === 'merged' ? result.data : null), stableStringify(mergePracticeHistory(local, remote)));
    const newer = policy.merge({ namespace: 'practiceHistory', local, remote: { version: 2, events: [] } });
    assert.equal(newer.kind, 'quiet');
    assert.equal(policy.merge({ namespace: 'practiceSession', local: {}, remote: {} }).kind, 'quiet', 'the resume record is never synced');
  });
});

describe('practice history — readers', () => {
  test('review targets in the same sitting never count as practice of the conversation', () => {
    const event = sitting('s1', AT, [packTarget('bonjour'), reviewTarget('merci')]);
    assert.deepEqual(packTargetsOf(event, 'pack-a').map((t) => t.phraseKey), [phraseKeyOf('bonjour')]);
    assert.deepEqual(packTargetsOf(event, 'pack-b'), []);
    assert.deepEqual(packTargetsOf({ kind: 'revisit-started', id: 'r', at: AT, packId: 'pack-a' }, 'pack-a'), []);
    assert.equal(eventsForPack([event, sitting('s2', AT, [reviewTarget('x')], null)], 'pack-a').length, 1);
  });

  test('old phone marks become reader-only legacy labels and never recall', () => {
    const items = legacyMarkItems([
      { packId: 'pack-a', practisedAt: AT, continuedAt: null },
      { packId: 'pack-b', practisedAt: null, continuedAt: AT + 1 },
      { packId: 'bad id', practisedAt: AT, continuedAt: null },
    ]);
    assert.deepEqual(
      items.map((i) => [i.kind, i.id, i.label]),
      [
        ['legacy-mark', 'legacy:practised:pack-a', 'practised'],
        ['legacy-mark', 'legacy:continued:pack-b', 'continued'],
      ],
    );
    for (const item of items) assert.equal(isPracticeEvent(item), false, 'a legacy mark is never a storable event');
  });

  test('a minted id is a valid event id and does not collide in a burst', () => {
    const ids = new Set(Array.from({ length: 200 }, () => mintPracticeId(AT)));
    assert.equal(ids.size, 200);
    for (const id of ids) assert.ok(isPracticeEvent(sitting(id)));
  });
});
