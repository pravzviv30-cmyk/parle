/**
 * F21 — the drill bank's fold, pinned.
 *
 * `mergeExercises` in store.ts is the landing point for the `drills` protocol
 * message, called once per conversation from ConvoScreen. Its comment used to
 * claim nothing called it, which is how the rule underneath went untested for
 * as long as it did. The rule is worth a test: it is the only thing standing
 * between a regenerated exercise and a learner meeting the same phrase in the
 * same format twice in one sitting.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { DrillExercise, FillBlankExercise, TapTranslateExercise } from '@parle/core';

import { MAX_DRILL_EXERCISES, mergeExerciseBank } from './merge.ts';

const COFFEE = 'phrase:je voudrais un café';
const BILL = "phrase:l'addition, s'il vous plaît";

function fillBlank(over: Partial<FillBlankExercise> = {}): FillBlankExercise {
  return {
    id: 'gen:coffee-fill',
    phraseKey: COFFEE,
    kind: 'fill-blank',
    difficulty: 'recognition',
    sentence: 'Je voudrais ___ café.',
    options: ['un', 'une', 'le'],
    accepted: ['un'],
    en: 'I would like a coffee.',
    ...over,
  };
}

function tapTranslate(over: Partial<TapTranslateExercise> = {}): TapTranslateExercise {
  return {
    id: 'gen:coffee-tap',
    phraseKey: COFFEE,
    kind: 'tap-translate',
    difficulty: 'production',
    en: 'I would like a coffee.',
    tokens: ['Je', 'voudrais', 'un', 'café', 'thé'],
    accepted: ['Je voudrais un café'],
    ...over,
  };
}

/** What the bank holds, in order, as the drill screen would walk it. */
const idsOf = (bank: readonly DrillExercise[]): string[] => bank.map((e) => e.id);

describe('folding a generated batch into the drill bank — replace, never accumulate', () => {
  test('merging a regenerated exercise replaces its earlier take instead of duplicating it', () => {
    // The tutor authored this phrase as a fill-blank last week and has authored
    // it again this session, under a fresh id and with a better sentence. The
    // bank must hold one of them, not both: two rows here means the learner is
    // asked to fill the same blank twice in one sitting.
    const bank = [fillBlank({ id: 'gen:old', sentence: 'Je voudrais ___ café.' })];
    const fresh = fillBlank({ id: 'gen:fresh', sentence: 'Bonjour, je voudrais ___ café.' });
    const merged = mergeExerciseBank(bank, [fresh]);

    assert.equal(
      merged.length,
      1,
      'a regenerated drill for the same phrase in the same format took a second slot, so the learner meets it twice',
    );
    assert.equal(
      merged[0]?.id,
      'gen:fresh',
      'the older take survived the merge; a regeneration is meant to take over that slot',
    );
    assert.equal(
      (merged[0] as FillBlankExercise).sentence,
      'Bonjour, je voudrais ___ café.',
      'the slot kept the old sentence, so the regeneration changed nothing the learner sees',
    );
  });

  test('a phrase the learner has never drilled joins the bank without displacing anything', () => {
    const bank = [fillBlank({ id: 'gen:coffee' })];
    const merged = mergeExerciseBank(bank, [fillBlank({ id: 'gen:bill', phraseKey: BILL })]);

    assert.deepEqual(
      idsOf(merged),
      ['gen:coffee', 'gen:bill'],
      'a genuinely new exercise must append; replacing here would silently drop a phrase the learner earned',
    );
  });

  test('the same phrase asked a different way is a second drill, not a replacement', () => {
    // Recognition and production of one phrase are two rungs of the same ladder.
    // Collapsing them would strand the phrase at whichever rung arrived last.
    const bank = [fillBlank()];
    const merged = mergeExerciseBank(bank, [tapTranslate()]);

    assert.deepEqual(
      idsOf(merged),
      ['gen:coffee-fill', 'gen:coffee-tap'],
      'two formats of one phrase collapsed into one, so a rung of the ladder went missing',
    );
  });

  test('a batch that kept its id while changing phrase replaces in place', () => {
    // No (phraseKey, kind) match exists, so plain id is the only handle left.
    // Appending would leave the bank holding a stale exercise under a live id.
    const bank = [fillBlank({ id: 'gen:slot-1', phraseKey: COFFEE }), fillBlank({ id: 'gen:slot-2', phraseKey: BILL })];
    const merged = mergeExerciseBank(bank, [tapTranslate({ id: 'gen:slot-1', phraseKey: 'phrase:merci beaucoup' })]);

    assert.deepEqual(
      idsOf(merged),
      ['gen:slot-1', 'gen:slot-2'],
      'the id fallback did not fire, so one id now names two exercises in the bank',
    );
    assert.equal(
      merged[0]?.phraseKey,
      'phrase:merci beaucoup',
      'the id matched but the row was not rewritten, so the bank still drills what the batch replaced',
    );
  });

  test('one incoming exercise leaves exactly one exercise behind, even when its id drifted', () => {
    // The nastiest case: the incoming exercise matches one row by phrase and
    // format, and a different row by id. Both are the same drill wearing two
    // hats, so only one may survive.
    const bank = [
      fillBlank({ id: 'gen:by-key', phraseKey: COFFEE }),
      fillBlank({ id: 'gen:drifted', phraseKey: BILL }),
    ];
    const merged = mergeExerciseBank(bank, [fillBlank({ id: 'gen:drifted', phraseKey: COFFEE })]);

    assert.deepEqual(
      idsOf(merged),
      ['gen:drifted'],
      'the row the incoming id used to occupy stayed behind as a second copy of the same drill',
    );
    assert.equal(
      merged[0]?.phraseKey,
      COFFEE,
      'the surviving row is the phrase-and-format match, which is the identity the bank is keyed on',
    );
  });

  test('an empty batch leaves the bank exactly as the learner left it', () => {
    // A conversation can end with nothing new to drill. That must never be
    // mistaken for a reason to touch the deck.
    const bank = [fillBlank({ id: 'gen:coffee' }), fillBlank({ id: 'gen:bill', phraseKey: BILL })];
    const merged = mergeExerciseBank(bank, []);

    assert.deepEqual(idsOf(merged), ['gen:coffee', 'gen:bill'], 'a batch with nothing in it disturbed the bank');
  });

  test('the bank handed in is never edited underneath its owner', () => {
    // store.ts caches the loaded bank and hands the same array in on every
    // merge. A fold that mutated it would corrupt the cache before the disk
    // write was even decided.
    const bank: DrillExercise[] = [fillBlank({ id: 'gen:old' })];
    const before = [...bank];
    mergeExerciseBank(bank, [fillBlank({ id: 'gen:fresh' }), fillBlank({ id: 'gen:bill', phraseKey: BILL })]);

    assert.deepEqual(
      bank,
      before,
      'the merge mutated its input, so the cached bank inside the store changed behind its back',
    );
  });

  test('generated variations are capped while authored offline drills survive', () => {
    const authored = fillBlank({ id: 'fixture:coffee' });
    const generated = Array.from({ length: MAX_DRILL_EXERCISES + 20 }, (_, index) =>
      fillBlank({ id: `gen:${index}`, phraseKey: `phrase:${index}` }),
    );
    const merged = mergeExerciseBank([authored], generated);

    assert.equal(merged.length, MAX_DRILL_EXERCISES);
    assert.equal(merged[0]!.id, 'fixture:coffee');
    assert.equal(merged.at(-1)!.id, `gen:${MAX_DRILL_EXERCISES + 19}`);
  });
});
