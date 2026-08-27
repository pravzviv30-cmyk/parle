import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  addEvidence,
  evidenceOf,
  evidenceStateOf,
  isDue,
  isMastered,
  isSettled,
  presentationOf,
  raiseEvidenceTo,
  EVIDENCE_STATES,
  MASTERY_USES,
  NO_EVIDENCE,
  SETTLED_DAYS,
  SETTLED_REPS,
  type PhraseEvidence,
} from './evidence.ts';
import { applyGrade, newCard, type ReviewCard, type ReviewCardKind } from './scheduler.ts';
import { mergeDecks } from './merge.ts';
import { buildPath } from '../path/path.ts';

const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The two phrases the authored path's rescue node drills. */
const ASK_AGAIN = 'phrase:pardon, vous pouvez répéter ?';
const TOILETS = 'phrase:où sont les toilettes ?';

function card(id: string, overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    ...newCard({ id, kind: 'vocab', front: id, back: id, context: '', ipa: '' }, NOW),
    ...overrides,
  };
}

/** The rescue node's state, projected from whatever deck is handed in. */
function rescueNodeState(deck: readonly ReviewCard[], now: number): string {
  const node = buildPath(deck, [], [], { lessonDone: false }, now)
    .flatMap((unit) => unit.nodes)
    .find((n) => n.id === 'cafe:rescue');
  assert.ok(node, 'the authored path lost the node this test projects from');
  return node.state;
}

describe('the phrase evidence record', () => {
  test('one phrase has one evidence record behind brain phrasebook path and scheduler', () => {
    // One card, and every verdict below is read off it. Before this there were
    // four answers to "does the learner know this phrase" living in four files.
    let mine = card(ASK_AGAIN);
    let sibling = card(TOILETS);

    // The scheduler writes the record. It is the same object it reschedules,
    // not a parallel one.
    mine = applyGrade(mine, 'good', NOW, { attempt: 'said' });
    assert.equal(evidenceOf(mine).retrievals, 1);
    assert.equal(evidenceStateOf(mine, NOW), 'recalled');

    // The path projects the same card. One phrase still due keeps the node
    // asking; both earned and neither due closes it.
    assert.equal(rescueNodeState([mine, sibling], NOW), 'needs-review');
    sibling = applyGrade(sibling, 'good', NOW, { attempt: 'typed' });
    assert.equal(rescueNodeState([mine, sibling], NOW), 'complete');
    assert.equal(rescueNodeState([mine, sibling], NOW + 2 * DAY_MS), 'needs-review');

    // The phrasebook shelf is the same card's reps and interval, on exactly
    // the rule it used before the thresholds moved into core. Any drift here
    // silently re-shelves a learner's own phrases.
    const shelfBefore = (c: ReviewCard, now: number): string =>
      c.due <= now ? 'coming-back' : c.reps >= 2 && c.intervalDays >= 7 ? 'steady' : 'new';
    for (const reps of [0, 1, 2, 5]) {
      for (const intervalDays of [0, 3, 7, 20]) {
        for (const due of [NOW - DAY_MS, NOW, NOW + DAY_MS]) {
          const c = { ...mine, reps, intervalDays, due };
          const shelfNow = isDue(c, NOW) ? 'coming-back' : isSettled(c, NOW) ? 'steady' : 'new';
          assert.equal(shelfNow, shelfBefore(c, NOW), `the shelf moved for reps ${reps}, interval ${intervalDays}`);
        }
      }
    }
    assert.equal(SETTLED_REPS, 2);
    assert.equal(SETTLED_DAYS, 7);

    // The brain's mastery is a projection of the same record's conversation
    // count, not a flag beside it.
    const used = raiseEvidenceTo(mine, { convoUses: MASTERY_USES });
    assert.equal(evidenceStateOf(used, NOW), 'used');
    assert.ok(isMastered(evidenceOf(used).convoUses));
    assert.ok(!isMastered(MASTERY_USES - 1));

    // And the brain reads the threshold from here rather than keeping its own.
    // A second copy of this number is a second opinion about what a learner
    // knows, which is the whole thing this record exists to end.
    const brain = readFileSync(new URL('../../../brain/src/profile/profile.ts', import.meta.url), 'utf8');
    assert.ok(
      !/^\s*export const MASTERY_USES\b/m.test(brain),
      'brain declares its own mastery threshold again',
    );
    assert.match(brain, /export \{ MASTERY_USES \} from '@parle\/core'/);
  });

  test('a card with no evidence block reads as all zero, and an old deck still parses', () => {
    const old = card('vocab:bonjour');
    assert.equal('evidence' in old, false, 'a new card must not write a block it has not earned');
    assert.deepEqual(evidenceOf(old), NO_EVIDENCE);
    assert.equal(evidenceStateOf(old, NOW), 'introduced');

    // A deck written before any of this, off disk and through the merge that
    // reads it. Nothing is dropped and nothing is invented.
    const stored: unknown = JSON.parse(
      JSON.stringify([old, { ...card('vocab:merci'), reps: 2, intervalDays: 3, due: NOW + DAY_MS }]),
    );
    const deck = mergeDecks(stored, []);
    assert.equal(deck.length, 2, 'a card without the block was refused by the merge');
    assert.deepEqual(deck.map(evidenceOf), [NO_EVIDENCE, NO_EVIDENCE]);
    assert.equal(
      evidenceStateOf(deck[1]!, NOW),
      'recalled',
      'reps grandfather recall, or every upgrading learner opens an empty phrasebook',
    );

    // Grading without context leaves the card exactly as it found it.
    assert.equal(applyGrade(old, 'good', NOW).evidence, undefined);
    assert.equal(applyGrade(old, 'easy', NOW, {}).evidence, undefined);
    assert.equal(applyGrade(old, 'good', NOW, { transfer: false }).evidence, undefined);
  });

  test('a phrase sits at the highest rung it has evidence for', () => {
    assert.deepEqual([...EVIDENCE_STATES], ['introduced', 'recalled', 'used', 'transferred']);

    const fresh = card('vocab:alors');
    assert.equal(evidenceStateOf(fresh, NOW), 'introduced');
    assert.equal(evidenceStateOf(addEvidence(fresh, { retrievals: 1 }), NOW), 'recalled');

    // Conversation outranks the flashcard, and transfer outranks both, whatever
    // else is on the record.
    const used = addEvidence(addEvidence(fresh, { retrievals: 4 }), { convoUses: 1 });
    assert.equal(evidenceStateOf(used, NOW), 'used');
    assert.equal(evidenceStateOf(addEvidence(used, { transfers: 1 }), NOW), 'transferred');
    assert.equal(evidenceStateOf(addEvidence(fresh, { transfers: 1 }), NOW), 'transferred');

    // Time passing is not forgetting. A card years overdue still shows what it
    // showed; what expires is the schedule.
    assert.equal(evidenceStateOf(used, NOW + 400 * DAY_MS), 'used');
  });

  test('evidence only ever climbs', () => {
    const one = addEvidence(card('vocab:oui'), { retrievals: 1 });

    // Nothing takes a count down: a negative, a fraction and a nonsense delta
    // all read as no change, and no-change returns the very same card so a
    // deck that earned nothing this sitting is byte-identical on disk.
    assert.equal(addEvidence(one, { retrievals: -5 }), one);
    assert.equal(addEvidence(one, { convoUses: Number.NaN }), one);
    assert.equal(addEvidence(one, {}), one);
    assert.equal(raiseEvidenceTo(one, { retrievals: 0 }), one);
    assert.equal(evidenceOf(raiseEvidenceTo(one, { retrievals: 1 })).retrievals, 1);

    // Raising to a floor is what a replayed conversation batch does, so twice
    // must equal once.
    const banked = raiseEvidenceTo(one, { convoUses: 2 });
    assert.deepEqual(evidenceOf(raiseEvidenceTo(banked, { convoUses: 2 })), evidenceOf(banked));
    assert.equal(evidenceOf(addEvidence(banked, { convoUses: 2 })).convoUses, 4, 'adding is not folding');

    // A corrupt counter costs one claim, never the screen that read it.
    const corrupt = { ...one, evidence: { retrievals: -3, convoUses: 'lots', transfers: undefined } } as unknown as ReviewCard;
    assert.deepEqual(evidenceOf(corrupt), NO_EVIDENCE);
    assert.equal(evidenceStateOf(corrupt, NOW), 'introduced');
  });

  test('a null evidence block reads as zero rather than throwing', () => {
    // The shape this exists for: a counter that ever went non-finite comes back
    // off the wire as null, because that is what JSON.stringify does with NaN
    // and Infinity. Not an exotic corruption, a routine arrival.
    const wire: unknown = JSON.parse(
      JSON.stringify({ ...card('vocab:ça'), evidence: { retrievals: Number.NaN, convoUses: Infinity, transfers: 2 } }),
    );
    const arrived = wire as ReviewCard;
    assert.equal((arrived.evidence as unknown as Record<string, unknown>).retrievals, null, 'the wire stopped producing nulls');
    assert.deepEqual(evidenceOf(arrived), { retrievals: 0, convoUses: 0, transfers: 2 });
    assert.equal(evidenceStateOf(arrived, NOW), 'transferred', 'one unreadable counter cost the other two their claim');

    // Every shape a block can arrive as, through every reader that takes a
    // card. A screen in stage four reads these; a throw there is a blank
    // phrasebook, not a missing number.
    const shapes: [string, unknown][] = [
      ['undefined', undefined],
      ['null', null],
      ['a string', 'junk'],
      ['a number', 7],
      ['an array', []],
      ['an empty object', {}],
      ['null counters', { retrievals: null, convoUses: null, transfers: null }],
      ['nonsense counters', { retrievals: Number.NaN, convoUses: -4, transfers: '3' }],
    ];
    for (const [name, evidence] of shapes) {
      const c = { ...card('vocab:ça'), evidence } as unknown as ReviewCard;
      assert.deepEqual(evidenceOf(c), NO_EVIDENCE, `evidenceOf read counts out of ${name}`);
      assert.equal(evidenceStateOf(c, NOW), 'introduced', `evidenceStateOf claimed a rung from ${name}`);
      assert.equal(presentationOf(c, NOW), 'introduction', `presentationOf stumbled on ${name}`);
      assert.equal(evidenceOf(addEvidence(c, { retrievals: 1 })).retrievals, 1, `addEvidence stumbled on ${name}`);
      assert.equal(evidenceOf(raiseEvidenceTo(c, { convoUses: 2 })).convoUses, 2, `raiseEvidenceTo stumbled on ${name}`);
      assert.equal(isMastered(evidenceOf(c).convoUses), false, `isMastered claimed mastery from ${name}`);
    }

    // A fraction floors rather than rounding up, so 1.7 transfers is one.
    assert.equal(evidenceOf({ evidence: { retrievals: 1.7 } as PhraseEvidence }).retrievals, 1);

    // Writing to a junk block heals it; writing nothing leaves the card alone,
    // junk and all, because no-change must stay the identity it promises.
    const nulled = { ...card('vocab:ça'), evidence: null } as unknown as ReviewCard;
    assert.deepEqual(addEvidence(nulled, { retrievals: 1 }).evidence, { retrievals: 1, convoUses: 0, transfers: 0 });
    assert.equal(addEvidence(nulled, {}), nulled);
  });

  test('a new card and a phoneme card are introduced, and a due recalled card is asked first', () => {
    const kinds: ReviewCardKind[] = ['vocab', 'turn'];

    // Never recalled means genuinely new: asking someone to produce a phrase
    // they have never once recalled is a test with no teaching in it.
    for (const kind of kinds) {
      assert.equal(presentationOf(card('x', { kind, reps: 0 }), NOW), 'introduction');
      assert.equal(presentationOf(card('x', { kind, reps: 1, due: NOW }), NOW), 'retrieval');
      assert.equal(presentationOf(card('x', { kind, reps: 3, due: NOW - DAY_MS }), NOW), 'retrieval');
      // Opened ahead of its due date, a card is a look rather than a test.
      assert.equal(presentationOf(card('x', { kind, reps: 3, due: NOW + DAY_MS }), NOW), 'introduction');
    }

    // A sound is listened to and copied, never produced from an English
    // prompt. A listening exercise stays a listening exercise at every age of
    // the card.
    for (const reps of [0, 1, 9]) {
      assert.equal(
        presentationOf(card('phoneme:ʁ', { kind: 'phoneme', reps, due: NOW - DAY_MS }), NOW),
        'introduction',
      );
    }
  });
});
