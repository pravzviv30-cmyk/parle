import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { CAFE_LESSON, LESSONS, getLesson } from './index.ts';
import { isAcceptable, matchAcceptable, normalise, phonemeCoverage } from './types.ts';
import { getPhoneme } from '../phonemes/inventory.ts';
import { drillsFor } from '../phonemes/drills.ts';

describe('lesson structure', () => {
  test('lesson ids are unique and resolvable', () => {
    assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
    assert.equal(getLesson('cafe-01')?.id, 'cafe-01');
    assert.equal(getLesson('nope'), undefined);
  });

  test('turn ids are unique within a lesson', () => {
    for (const lesson of LESSONS) {
      assert.equal(new Set(lesson.turns.map((t) => t.id)).size, lesson.turns.length, `${lesson.id} has duplicate turn ids`);
    }
  });

  test('every turn carries material for all four rungs at once', () => {
    for (const lesson of LESSONS) {
      for (const t of lesson.turns) {
        assert.ok(t.target.length > 0, `${t.id}: no target line (rung 1)`);
        assert.ok(t.options.length >= 2, `${t.id}: needs at least two options (rung 2)`);
        assert.ok(t.hint.length > 0, `${t.id}: no hint (rung 3)`);
        assert.ok(t.tutor.length > 0, `${t.id}: tutor says nothing`);
        assert.ok(t.reference.length > 0, `${t.id}: nothing for the assessor to score against`);
      }
    }
  });

  test('every turn offers at least one acceptable option', () => {
    for (const lesson of LESSONS) {
      for (const t of lesson.turns) {
        assert.ok(
          t.options.some((o) => o.acceptable),
          `${t.id}: every option is wrong — the learner cannot succeed at rung 2`,
        );
      }
    }
  });

  test('rung-3 hints leak no French — that is the whole contract of that rung', () => {
    const frenchTells = /[àâäéèêëîïôöùûüÿçœ]|s'il|vous|c'est|je |une |merci/i;
    for (const lesson of LESSONS) {
      for (const t of lesson.turns) {
        assert.ok(!frenchTells.test(t.hint), `${t.id}: hint gives away French — "${t.hint}"`);
      }
    }
  });

  test('every turn has an English gloss for both sides', () => {
    for (const lesson of LESSONS) {
      for (const t of lesson.turns) {
        assert.ok(t.tutorEn.length > 0, `${t.id}: tutor line has no translation`);
        assert.ok(t.targetEn.length > 0, `${t.id}: target line has no translation`);
        for (const o of t.options) assert.ok(o.en.length > 0, `${t.id}: option "${o.text}" has no meaning`);
      }
    }
  });
});

describe('phonetic design', () => {
  test('every focus phoneme is a real phoneme in the inventory', () => {
    for (const lesson of LESSONS) {
      for (const t of lesson.turns) {
        for (const p of t.focusPhonemes) {
          assert.ok(getPhoneme(p), `${t.id}: unknown phoneme /${p}/`);
        }
      }
    }
  });

  test('the café lesson exercises every sound it claims to target', () => {
    const covered = phonemeCoverage(CAFE_LESSON);
    for (const claimed of CAFE_LESSON.targetPhonemes) {
      assert.ok(covered.includes(claimed), `lesson claims /${claimed}/ but no turn exercises it`);
    }
  });

  test('the café lesson covers the hardest anglophone sounds', () => {
    const covered = phonemeCoverage(CAFE_LESSON);
    for (const critical of ['ʁ', 'ɔ̃', 'ɛ̃', 'ɑ̃', 'y', 'ʒ']) {
      assert.ok(covered.includes(critical), `a beginner French lesson that never exercises /${critical}/ is not doing its job`);
    }
  });

  test('every phoneme the lesson targets has a drill, so a bad score is always actionable', () => {
    for (const p of phonemeCoverage(CAFE_LESSON)) {
      const phoneme = getPhoneme(p)!;
      if (phoneme.difficulty >= 4) {
        assert.ok(drillsFor(p).length > 0, `/${p}/ is exercised and hard, but has no drill to repair it`);
      }
    }
  });

  test('the French R appears often enough to score reliably', () => {
    // The scorer needs 3+ samples before it will flag anything (MIN_SAMPLES_TO_FLAG).
    // A lesson that only touches /ʁ/ twice can never produce trustworthy feedback on it.
    const rTurns = CAFE_LESSON.turns.filter((t) => t.focusPhonemes.includes('ʁ'));
    assert.ok(rTurns.length >= 3, `only ${rTurns.length} turns exercise /ʁ/ — too few to score confidently`);
  });
});

describe('answer matching', () => {
  test('the exact target is accepted', () => {
    const t = CAFE_LESSON.turns[0]!;
    assert.ok(isAcceptable(t, 'Bonjour'));
  });

  test('matching ignores case, punctuation and accents from the transcriber', () => {
    const t = CAFE_LESSON.turns[1]!; // Un café, s'il vous plaît
    assert.ok(isAcceptable(t, 'un cafe sil vous plait'));
    assert.ok(isAcceptable(t, "UN CAFÉ, S'IL VOUS PLAÎT!"));
  });

  test('hyphenated forms match their spaced transcription', () => {
    const t = CAFE_LESSON.turns.find((x) => x.id === 't10-toilets')!;
    assert.ok(isAcceptable(t, 'excusez moi ou sont les toilettes'));
    assert.ok(isAcceptable(t, 'Excusez-moi, où sont les toilettes ?'));
  });

  test('listed alternatives are accepted — this is a conversation, not a quiz', () => {
    const t = CAFE_LESSON.turns.find((x) => x.id === 't3-sur-place')!;
    assert.ok(isAcceptable(t, 'à emporter'), 'taking it away is a perfectly good answer');
  });

  test('acceptable options count as correct answers', () => {
    const t = CAFE_LESSON.turns.find((x) => x.id === 't5-croissant')!;
    assert.ok(isAcceptable(t, 'Un pain au chocolat, sil vous plaît'));
  });

  test('a hesitation before the line is still the line', () => {
    const t = CAFE_LESSON.turns[1]!; // Un café, s'il vous plaît
    // What a beginner actually produces, and what Deepgram actually writes down.
    assert.ok(isAcceptable(t, 'euh un café sil vous plait'), 'a filled pause is not an error');
    assert.ok(isAcceptable(t, 'euh, un café, s’il vous plaît'), 'nor is one with punctuation around it');
    assert.ok(isAcceptable(t, 'bonjour un café sil vous plait'), 'greeting the barista first is not a mistake');
    assert.equal(matchAcceptable(t, 'euh un café sil vous plait').via, 'filler');
  });

  test('a swallowed syllable is a slip, not a different answer', () => {
    const t = CAFE_LESSON.turns[1]!;
    // One edit across the whole line — the same budget a typed drill answer gets.
    assert.ok(isAcceptable(t, 'un café sil vous plai'));
  });

  test('a small word lost in liaison does not fail the line', () => {
    const t = CAFE_LESSON.turns.find((x) => x.id === 't10-toilets')!;
    assert.ok(isAcceptable(t, 'excusez moi ou sont toilettes'), '"les" is the first thing to vanish');
  });

  test('a different French sentence is still wrong', () => {
    const t = CAFE_LESSON.turns[1]!; // Un café, s'il vous plaît
    // The whole claim of this product is that the feedback is trustworthy. A
    // matcher loose enough to call these the line would take that with it.
    assert.equal(isAcceptable(t, "un thé glacé et un croissant"), false);
    assert.equal(isAcceptable(t, 'je ne sais pas'), false);
    assert.equal(isAcceptable(t, 'où sont les toilettes'), false);
    assert.equal(isAcceptable(CAFE_LESSON.turns[0]!, 'bonsoir'), false, 'the deliberately-wrong option stays wrong');
  });

  test('a half-said line is a near miss, not an unrelated answer', () => {
    const t = CAFE_LESSON.turns[1]!;
    const match = matchAcceptable(t, 'un café');
    assert.equal(match.accepted, false, 'they did not say please, and the lesson is teaching please');
    assert.equal(match.via, 'near', 'but it is not "je voudrais un éléphant" either');
  });

  test('an unrelated answer is rejected', () => {
    assert.equal(isAcceptable(CAFE_LESSON.turns[0]!, 'Je voudrais un éléphant'), false);
  });

  test('silence is never acceptable', () => {
    assert.equal(isAcceptable(CAFE_LESSON.turns[0]!, ''), false);
    assert.equal(isAcceptable(CAFE_LESSON.turns[0]!, '   '), false);
  });

  test('normalise is stable and idempotent', () => {
    const once = normalise("Excusez-moi, où sont les toilettes ?");
    assert.equal(normalise(once), once);
    assert.equal(once, 'excusez moi ou sont les toilettes');
  });
});

describe('cultural depth', () => {
  test('the lesson carries the context a fifty-language app skips', () => {
    assert.ok(CAFE_LESSON.culturalNotes.length >= 3);
    for (const n of CAFE_LESSON.culturalNotes) assert.ok(n.length > 40, 'a cultural note should actually say something');
  });

  test('the two survival phrases are taught early, not buried', () => {
    const ids = CAFE_LESSON.turns.map((t) => t.id);
    assert.ok(ids.includes('t4-repeat'), 'asking for a repeat is the most useful beginner sentence there is');
    assert.ok(ids.includes('t10-toilets'));
    assert.ok(ids.indexOf('t4-repeat') < CAFE_LESSON.turns.length / 2, 'the repeat phrase should come early enough to be useful');
  });
});
