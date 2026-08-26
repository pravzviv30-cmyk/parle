import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { mergeDecks, gradesApplied } from './merge.ts';
import { applyGrade, newCard, DEFAULT_EASE, type ReviewCard, type ReviewGrade } from './scheduler.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function card(id: string, overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    ...newCard({ id, kind: 'vocab', front: id, back: `${id} = x`, context: `${id} = x`, ipa: '' }, NOW),
    ...overrides,
  };
}

/** Grade a card through a sequence, one grade per day, as a device would. */
function reviewed(start: ReviewCard, grades: readonly ReviewGrade[], from = NOW): ReviewCard {
  let c = start;
  let t = from;
  for (const g of grades) {
    t += DAY_MS;
    c = applyGrade(c, g, t);
  }
  return c;
}

/** Deterministic PRNG — a property test that cannot be replayed is a rumour. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

/** A random deck drawn from a small shared pool of ids, each with its own history. */
function randomDeck(next: () => number): ReviewCard[] {
  const out: ReviewCard[] = [];
  for (let i = 0; i < 6; i += 1) {
    if (next() < 0.35) continue;
    const grades: ReviewGrade[] = [];
    const runs = Math.floor(next() * 4);
    for (let g = 0; g < runs; g += 1) {
      grades.push((['again', 'good', 'easy'] as const)[Math.floor(next() * 3)] ?? 'good');
    }
    out.push(reviewed(card(`vocab:${i}`, { addedAt: NOW + i * 1000 }), grades, NOW + Math.floor(next() * 5) * DAY_MS));
  }
  return out;
}

const same = (a: readonly ReviewCard[], b: readonly ReviewCard[]) => JSON.stringify(a) === JSON.stringify(b);

describe('merging two copies of one deck', () => {
  test('merging two decks keeps the scheduling each card earned', () => {
    // One card, two devices. The phone reviewed it three times; the tablet
    // knows only the fresh card. Nothing is recomputed, nothing is reset.
    const fresh = card('vocab:café');
    const climbed = reviewed(fresh, ['good', 'good', 'easy']);
    // Sanity: the phone's copy really did earn a schedule worth keeping.
    assert.ok(climbed.intervalDays > 3);
    assert.equal(climbed.reps, 3);

    const merged = mergeDecks([climbed], [fresh]);
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0], climbed);

    // And the same in the other direction: the deck with the review history
    // wins the whole card, never a field-wise blend of two schedules.
    assert.deepEqual(mergeDecks([fresh], [climbed])[0], climbed);

    // A card only one side has ever seen is kept, not dropped.
    const onlyOnTablet = card('vocab:pain', { addedAt: NOW + 5 });
    const both = mergeDecks([climbed], [fresh, onlyOnTablet]);
    assert.deepEqual(
      both.map((c) => c.id),
      ['vocab:café', 'vocab:pain'],
    );
    assert.deepEqual(both[0], climbed);
    assert.deepEqual(both[1], onlyOnTablet);

    // The lapse history a card earned survives too — a card the learner missed
    // four times on one device does not come back looking easy.
    const lapsed = reviewed(card('vocab:œuf'), ['again', 'again', 'again', 'again']);
    const untouched = card('vocab:œuf');
    assert.equal(lapsed.lapses, 4);
    assert.ok(lapsed.ease < DEFAULT_EASE);
    const keptLapses = mergeDecks([untouched], [lapsed])[0];
    assert.equal(keptLapses?.lapses, 4);
    assert.equal(keptLapses?.ease, lapsed.ease);
  });

  test('the side with more grades wins the whole card, and grades are counted not clocked', () => {
    const base = card('vocab:merci');
    const twice = reviewed(base, ['good', 'again']);
    const once = reviewed(base, ['easy'], NOW + 10 * DAY_MS);
    // The tablet graded later by the wall clock, the phone graded more often.
    assert.ok(once.due > twice.due);
    assert.equal(gradesApplied(twice), 2);
    assert.equal(gradesApplied(once), 1);
    assert.deepEqual(mergeDecks([twice], [once])[0], twice);
    assert.deepEqual(mergeDecks([once], [twice])[0], twice);
  });

  test('a corrupt side contributes nothing and never takes the good deck with it', () => {
    const deck = [reviewed(card('vocab:eau'), ['good'])];
    for (const rubbish of [null, undefined, 42, 'deck', {}, [null], [{ id: '' }], [{ ...deck[0], ease: NaN }]]) {
      assert.deepEqual(mergeDecks(deck, rubbish), deck, `rubbish: ${JSON.stringify(rubbish) ?? 'undefined'}`);
      assert.deepEqual(mergeDecks(rubbish, deck), deck);
    }
    // Two corrupt sides give an empty deck rather than a throw.
    assert.deepEqual(mergeDecks('nonsense', { cards: [] }), []);
    // One bad card in an otherwise good array is dropped alone.
    const mixed = mergeDecks([...deck, { id: 'vocab:x', kind: 'vocab' }], []);
    assert.deepEqual(mixed, deck);
  });

  test('it is commutative, idempotent and associative over random decks', () => {
    const next = rng(20_260_826);
    for (let i = 0; i < 300; i += 1) {
      const a = randomDeck(next);
      const b = randomDeck(next);
      const c = randomDeck(next);

      const ab = mergeDecks(a, b);
      assert.ok(same(ab, mergeDecks(b, a)), `commutative, round ${i}`);
      assert.ok(same(ab, mergeDecks(ab, ab)), `idempotent, round ${i}`);
      // Absorption: once merged, re-merging either input changes nothing.
      assert.ok(same(ab, mergeDecks(ab, a)), `absorbs a, round ${i}`);
      assert.ok(same(ab, mergeDecks(ab, b)), `absorbs b, round ${i}`);
      assert.ok(
        same(mergeDecks(ab, c), mergeDecks(a, mergeDecks(b, c))),
        `associative, round ${i}`,
      );
    }
  });

  test('three devices gossiping in any order converge on the same deck', () => {
    const next = rng(4_821);
    for (let round = 0; round < 100; round += 1) {
      const devices = [randomDeck(next), randomDeck(next), randomDeck(next)];
      let server: unknown = [];
      // Reconnects in a random order, with duplicate pushes and replays.
      for (let step = 0; step < 24; step += 1) {
        const i = Math.floor(next() * devices.length);
        const merged = mergeDecks(devices[i], server);
        devices[i] = merged;
        server = merged;
        if (next() < 0.4) server = mergeDecks(server, merged); // a duplicate push
      }
      // One last full sweep: everyone has now seen the final server state.
      for (let i = 0; i < devices.length; i += 1) {
        devices[i] = mergeDecks(devices[i], server);
        server = devices[i];
      }
      for (let i = 0; i < devices.length; i += 1) {
        devices[i] = mergeDecks(devices[i], server);
      }
      assert.ok(same(devices[0]!, devices[1]!), `devices 0 and 1 agree, round ${round}`);
      assert.ok(same(devices[1]!, devices[2]!), `devices 1 and 2 agree, round ${round}`);
      assert.ok(same(devices[0]!, mergeDecks(server, [])), `devices agree with the server, round ${round}`);
    }
  });

  test('the merged order is a function of the cards, not of the order they arrived in', () => {
    const a = card('vocab:a', { addedAt: NOW + 30 });
    const b = card('vocab:b', { addedAt: NOW + 10 });
    const c = card('vocab:c', { addedAt: NOW + 20 });
    assert.deepEqual(
      mergeDecks([a, b, c], []).map((x) => x.id),
      ['vocab:b', 'vocab:c', 'vocab:a'],
    );
    assert.deepEqual(
      mergeDecks([c, a], [b]).map((x) => x.id),
      ['vocab:b', 'vocab:c', 'vocab:a'],
    );
  });

  test('a duplicate id inside one side folds before the two sides meet', () => {
    const fresh = card('vocab:oui');
    const climbed = reviewed(fresh, ['good', 'good']);
    assert.deepEqual(mergeDecks([fresh, climbed], [])[0], climbed);
    assert.deepEqual(mergeDecks([climbed, fresh], [])[0], climbed);
  });
});
