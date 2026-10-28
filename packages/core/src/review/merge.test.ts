import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { mergeDecks, gradesApplied, PAST_CONVERSATION_NOTE } from './merge.ts';
import { addEvidence, evidenceOf, NO_EVIDENCE, type PhraseEvidence } from './evidence.ts';
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

/** Everything the winner decides — the whole card except the one exception. */
function scheduling(card: ReviewCard): Omit<ReviewCard, 'evidence'> {
  const { evidence: _counters, ...rest } = card;
  return rest;
}

/** What one side counted for a card, all zero when that side never saw it. */
function countsFor(deck: readonly ReviewCard[], id: string): PhraseEvidence {
  const held = deck.find((c) => c.id === id);
  return held === undefined ? NO_EVIDENCE : evidenceOf(held);
}

/** The same random decks, with counters two devices could honestly disagree about. */
function withCounters(deck: readonly ReviewCard[], next: () => number): ReviewCard[] {
  return deck.map((c) =>
    addEvidence(c, {
      // Past ten on purpose: 9 and 10 are the pair where a string comparison
      // and a numeric one disagree, which is where a tiebreak that reads the
      // counters goes wrong.
      retrievals: Math.floor(next() * 12),
      convoUses: Math.floor(next() * 12),
      transfers: Math.floor(next() * 3),
    }),
  );
}

describe('merging what two devices counted', () => {
  test('two devices converge evidence counters to the larger count without touching scheduling', () => {
    const base = card('vocab:parce que');
    // The phone did the flashcards on the train. The tablet had the actual
    // conversation that evening, and used the phrase four times in it. Neither
    // device knows a thing about what the other counted.
    const phone = addEvidence(reviewed(base, ['good', 'good', 'good']), { retrievals: 3 });
    const tablet = addEvidence(reviewed(base, ['good'], NOW + 30 * DAY_MS), {
      retrievals: 1,
      convoUses: 4,
      transfers: 2,
    });
    // The phone graded more often; the tablet graded later and so is scheduled
    // further out. The exception must not become a second reason to take the
    // clock's answer for a field the winner already decided.
    assert.ok(gradesApplied(phone) > gradesApplied(tablet));
    assert.ok(tablet.due > phone.due, 'the loser must hold the later schedule or this proves nothing');

    const merged = mergeDecks([phone], [tablet])[0]!;

    // Field-wise larger: not the winner's block, and not a sum either — the
    // same retrieval counted on both devices is one retrieval.
    assert.deepEqual(evidenceOf(merged), { retrievals: 3, convoUses: 4, transfers: 2 });

    // And the scheduling is the phone's, whole. Every field the winner decides
    // is exactly the card it came from, with nothing blended and nothing
    // recomputed by the exception passing through.
    assert.deepEqual(scheduling(merged), scheduling(phone));
    assert.equal(merged.due, phone.due);
    assert.equal(merged.intervalDays, phone.intervalDays);
    assert.equal(merged.ease, phone.ease);
    assert.equal(merged.reps, phone.reps);
    assert.equal(merged.lapses, phone.lapses);

    // Both directions land on the same card...
    assert.deepEqual(mergeDecks([tablet], [phone])[0], merged);
    // ...and once each device has heard it, saying it again moves nothing.
    const settledPhone = mergeDecks([phone], [merged]);
    const settledTablet = mergeDecks([tablet], [merged]);
    assert.ok(same(settledPhone, settledTablet), 'the two devices did not converge');
    assert.ok(same(settledPhone, mergeDecks(settledPhone, settledTablet)), 'converged, then moved');
  });

  test('counters on the side that lost the card survive the side that won it', () => {
    const base = card('vocab:pain');
    // The phone graded it three times and counted nothing else. The tablet
    // graded once, and is where the learner actually said the word out loud.
    const phone = reviewed(base, ['good', 'good', 'good']);
    const tablet = addEvidence(reviewed(base, ['good']), { convoUses: 2, transfers: 1 });
    assert.equal(gradesApplied(phone) > gradesApplied(tablet), true);
    assert.equal(phone.evidence, undefined, 'a grade with no context must claim nothing');

    const merged = mergeDecks([phone], [tablet])[0]!;
    // The phone won the card outright, by the same rule as before...
    assert.deepEqual(scheduling(merged), scheduling(phone));
    // ...and the losing side's counters came with it anyway. They are the one
    // thing that cannot be re-derived from the card that won.
    assert.deepEqual(evidenceOf(merged), { retrievals: 0, convoUses: 2, transfers: 1 });
    assert.deepEqual(mergeDecks([tablet], [phone])[0], merged);

    // Two copies of one id inside a single side fold by the very same rule,
    // before the two sides ever meet. Half the exception is not the exception.
    assert.deepEqual(mergeDecks([phone, tablet], [])[0], merged);
    assert.deepEqual(mergeDecks([tablet, phone], [])[0], merged);

    // A card only one side has ever seen keeps its counters untouched.
    const alone = addEvidence(card('vocab:œuf'), { convoUses: 5 });
    assert.deepEqual(mergeDecks([alone], [])[0], alone);
    assert.deepEqual(mergeDecks([], [alone])[0], alone);
  });

  test('a deck written before the counters merges without growing a block it never earned', () => {
    const phone = reviewed(card('vocab:bonjour'), ['good', 'good']);
    const tablet = card('vocab:bonjour');
    assert.equal('evidence' in phone, false, 'the fixture already carries a block');

    // Off disk, the way a deck an older build wrote actually arrives.
    const stored: unknown = JSON.parse(JSON.stringify([phone]));
    const merged = mergeDecks(stored, [tablet]);
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0], phone, 'the merge invented a block nobody earned');
    assert.equal('evidence' in merged[0]!, false);
    assert.deepEqual(evidenceOf(merged[0]!), NO_EVIDENCE);

    // A hand-written block of zeros is the same state as no block, not a third
    // one — otherwise which device wrote first would decide the bytes.
    const zeroed = { ...phone, evidence: { retrievals: 0, convoUses: 0, transfers: 0 } };
    assert.equal('evidence' in mergeDecks([zeroed], [])[0]!, false);
    assert.ok(same(mergeDecks([zeroed], [phone]), mergeDecks([phone], [zeroed])), 'zeros and absent diverge');
  });

  test('a malformed evidence block off the wire reads as zero and never throws', () => {
    const good = reviewed(card('vocab:eau'), ['good', 'good']);
    const earned = addEvidence(reviewed(card('vocab:eau'), ['good']), { convoUses: 4 });
    // Each block with what it is worth once read honestly. Everything that is
    // not a count is worth nothing; a count that is merely untidy still counts.
    const junk: readonly (readonly [unknown, PhraseEvidence])[] = [
      [null, NO_EVIDENCE],
      [42, NO_EVIDENCE],
      ['lots', NO_EVIDENCE],
      [[], NO_EVIDENCE],
      [{}, NO_EVIDENCE],
      [{ retrievals: NaN, convoUses: -2, transfers: 'three' }, NO_EVIDENCE],
      [{ retrievals: null, convoUses: Infinity }, NO_EVIDENCE],
      [{ retrievals: 1.9, nonsense: true }, { retrievals: 1, convoUses: 0, transfers: 0 }],
    ];

    for (const [block, worth] of junk) {
      const tampered = { ...good, evidence: block } as unknown as ReviewCard;
      const label = JSON.stringify(block) ?? 'undefined';
      // Both in memory and through JSON, because the wire turns a NaN into a
      // null on the way and null is the shape that used to throw.
      for (const side of [[tampered], JSON.parse(JSON.stringify([tampered])) as unknown]) {
        const merged = mergeDecks(side, [])[0]!;
        assert.deepEqual(scheduling(merged), scheduling(good), `scheduling lost to junk: ${label}`);
        assert.deepEqual(evidenceOf(merged), worth, label);
        // The junk did not survive the merge either, so the next reader of
        // this card cannot be the one it costs.
        assert.doesNotThrow(() => evidenceOf(merged), label);
        if (merged.evidence !== undefined) {
          assert.deepEqual(Object.keys(merged.evidence), ['retrievals', 'convoUses', 'transfers'], label);
        }
      }

      // And a bad block on one side never takes the other side's counters
      // with it: the claim it costs is its own.
      const both = mergeDecks([tampered], [earned])[0]!;
      assert.equal(evidenceOf(both).convoUses, 4, `the good side lost its counters to ${label}`);
      assert.deepEqual(scheduling(both), scheduling(good), label);
    }
  });

  test('the tiebreak never reads the counters the merge itself rewrites', () => {
    // Three copies of one card with identical scheduling, differing in a field
    // the last-resort tiebreak sorts *after* the counters would, and in
    // counters that straddle the 9-to-10 boundary. Real enough: one device
    // learned the pronunciation and the other never did.
    const base = reviewed(card('vocab:œil'), ['good']);
    const quiet = addEvidence({ ...base, ipa: '' }, { retrievals: 2 });
    const middle = addEvidence({ ...base, ipa: 'œj' }, { retrievals: 2 });
    const loud = addEvidence({ ...base, ipa: 'ɶj' }, { retrievals: 10 });

    // A counter must not decide which card wins. `ɶj` sorts above `œj` sorts
    // above the empty string, and that is the whole of the decision.
    assert.equal(mergeDecks([quiet], [middle])[0]?.ipa, 'œj', 'a counter decided which card won');
    assert.equal(mergeDecks([loud], [middle])[0]?.ipa, 'ɶj');
    assert.equal(
      mergeDecks([addEvidence({ ...base, ipa: '' }, { retrievals: 99 })], [middle])[0]?.ipa,
      'œj',
      'the loudest counter took the card',
    );

    // So the merge stays associative even here, where a tiebreak that read the
    // counters would keep a different card on each side of the bracket.
    const left = mergeDecks(mergeDecks([quiet], [middle]), [loud]);
    const right = mergeDecks([quiet], mergeDecks([middle], [loud]));
    assert.ok(same(left, right), `associative: ${JSON.stringify(left)} vs ${JSON.stringify(right)}`);
    assert.equal(left[0]?.ipa, 'ɶj');
    assert.deepEqual(evidenceOf(left[0]!), { retrievals: 10, convoUses: 0, transfers: 0 });
  });

  test('the evidence exception is commutative, idempotent and associative over random decks', () => {
    const next = rng(12_260_827);
    let counted = 0;
    for (let i = 0; i < 300; i += 1) {
      const a = withCounters(randomDeck(next), next);
      const b = withCounters(randomDeck(next), next);
      const c = withCounters(randomDeck(next), next);

      const ab = mergeDecks(a, b);
      assert.ok(same(ab, mergeDecks(b, a)), `commutative, round ${i}`);
      assert.ok(same(ab, mergeDecks(ab, ab)), `idempotent, round ${i}`);
      assert.ok(same(ab, mergeDecks(ab, a)), `absorbs a, round ${i}`);
      assert.ok(same(ab, mergeDecks(ab, b)), `absorbs b, round ${i}`);
      assert.ok(same(mergeDecks(ab, c), mergeDecks(a, mergeDecks(b, c))), `associative, round ${i}`);

      // The algebra above holds just as well for a merge that throws every
      // counter away, so say what the counters actually came out as.
      for (const merged of ab) {
        const left = countsFor(a, merged.id);
        const right = countsFor(b, merged.id);
        assert.deepEqual(
          evidenceOf(merged),
          {
            retrievals: Math.max(left.retrievals, right.retrievals),
            convoUses: Math.max(left.convoUses, right.convoUses),
            transfers: Math.max(left.transfers, right.transfers),
          },
          `counters are the larger of the two, round ${i}`,
        );
        if (merged.evidence !== undefined) counted += 1;
      }
    }
    assert.ok(counted > 300, `the random decks carried counters only ${counted} times — the property proved nothing`);
  });

  test('three devices gossiping in any order converge on the counters as well as the cards', () => {
    const next = rng(9_140);
    for (let round = 0; round < 100; round += 1) {
      const devices = [
        withCounters(randomDeck(next), next),
        withCounters(randomDeck(next), next),
        withCounters(randomDeck(next), next),
      ];
      // Every counter any device ever held. Nothing below may go missing.
      const floor = new Map<string, PhraseEvidence>();
      for (const deck of devices) {
        for (const c of deck) {
          const held = floor.get(c.id) ?? NO_EVIDENCE;
          const mine = evidenceOf(c);
          floor.set(c.id, {
            retrievals: Math.max(held.retrievals, mine.retrievals),
            convoUses: Math.max(held.convoUses, mine.convoUses),
            transfers: Math.max(held.transfers, mine.transfers),
          });
        }
      }

      let server: unknown = [];
      for (let step = 0; step < 24; step += 1) {
        const i = Math.floor(next() * devices.length);
        const merged = mergeDecks(devices[i], server);
        devices[i] = merged;
        server = merged;
        if (next() < 0.4) server = mergeDecks(server, merged);
      }
      for (let i = 0; i < devices.length; i += 1) {
        devices[i] = mergeDecks(devices[i], server);
        server = devices[i];
      }
      for (let i = 0; i < devices.length; i += 1) {
        devices[i] = mergeDecks(devices[i], server);
      }

      assert.ok(same(devices[0]!, devices[1]!), `devices 0 and 1 agree, round ${round}`);
      assert.ok(same(devices[1]!, devices[2]!), `devices 1 and 2 agree, round ${round}`);
      for (const c of devices[0]!) {
        assert.deepEqual(evidenceOf(c), floor.get(c.id), `a counter went missing in the gossip, round ${round}`);
      }
    }
  });
});

/** Named and cleared provenance notes, with and without a pack id, on random decks. */
function withNotes(deck: readonly ReviewCard[], next: () => number): ReviewCard[] {
  return deck.map((c) => {
    const roll = next();
    if (roll < 0.25) return { ...c, context: PAST_CONVERSATION_NOTE };
    if (roll < 0.5) return { ...c, context: 'From your conversation: Coffee', contextPackId: next() < 0.5 ? 'pack-a' : 'pack-b' };
    if (roll < 0.7) return { ...c, context: 'From your conversation: Coffee' };
    if (roll < 0.85) return { ...c, context: 'From your conversation: Tea', contextPackId: 'pack-c' };
    return c;
  });
}

describe('merging a cleared conversation name', () => {
  test('a cleared conversation name survives a merge with a more-graded copy', () => {
    const named = card('vocab:café', { context: 'From your conversation: Coffee', contextPackId: 'pack-a' });
    const cleared: ReviewCard = { ...named, context: PAST_CONVERSATION_NOTE };
    delete cleared.contextPackId;
    const tablet = reviewed(named, ['good', 'good', 'easy']);
    for (const merged of [mergeDecks([cleared], [tablet]), mergeDecks([tablet], [cleared])]) {
      assert.equal(merged[0]?.context, PAST_CONVERSATION_NOTE);
      assert.equal('contextPackId' in merged[0]!, false);
      assert.equal(gradesApplied(merged[0]!), 3, 'the scheduling still comes from the more-graded copy');
      assert.equal(merged[0]?.due, tablet.due);
    }
  });

  test('a named copy keeps its pack id through a merge', () => {
    const named = card('vocab:thé', { context: 'From your conversation: Tea', contextPackId: 'pack-c' });
    const merged = mergeDecks([named], [card('vocab:thé', { context: 'From your conversation: Tea' })]);
    assert.equal(merged[0]?.contextPackId, 'pack-c');
    assert.equal(mergeDecks([named], [])[0]?.contextPackId, 'pack-c');
  });

  test('the cleared-note exception is commutative, idempotent and associative over random decks', () => {
    const next = rng(28_102_026);
    let cleared = 0;
    for (let i = 0; i < 400; i += 1) {
      const a = withNotes(withCounters(randomDeck(next), next), next);
      const b = withNotes(withCounters(randomDeck(next), next), next);
      const c = withNotes(randomDeck(next), next);
      const ab = mergeDecks(a, b);
      assert.ok(same(ab, mergeDecks(b, a)), `commutative, round ${i}`);
      assert.ok(same(ab, mergeDecks(ab, ab)), `idempotent, round ${i}`);
      assert.ok(same(ab, mergeDecks(ab, a)), `absorbs a, round ${i}`);
      assert.ok(same(ab, mergeDecks(ab, b)), `absorbs b, round ${i}`);
      assert.ok(same(mergeDecks(ab, c), mergeDecks(a, mergeDecks(b, c))), `associative, round ${i}`);
      for (const merged of ab) {
        const either = [...a, ...b].some((x) => x.id === merged.id && x.context === PAST_CONVERSATION_NOTE);
        assert.equal(merged.context === PAST_CONVERSATION_NOTE, either, `cleared wins exactly when a side cleared, round ${i}`);
        if (either) { cleared += 1; assert.equal('contextPackId' in merged, false); }
      }
    }
    assert.ok(cleared > 200, `only ${cleared} cleared merges, the property proved little`);
  });

  test('copies identical but for their note merge the same way in any order', () => {
    const base = card('vocab:x');
    const copies = [
      { ...base, context: 'From your conversation: Coffee', contextPackId: 'pack-a' },
      { ...base, context: 'From your conversation: Coffee', contextPackId: 'pack-b' },
      { ...base, context: 'From your conversation: Coffee' },
    ];
    const one = mergeDecks(mergeDecks([copies[0]], [copies[1]]), [copies[2]]);
    const two = mergeDecks([copies[2]], mergeDecks([copies[1]], [copies[0]]));
    assert.ok(same(one, two));
  });
});
