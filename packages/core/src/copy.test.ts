import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { FRENCH_PHONEMES } from './phonemes/inventory.ts';
import { DRILLS } from './phonemes/drills.ts';
import { LESSONS } from './lessons/index.ts';
import { GOOD_FEEDBACK, missFeedback, typoFeedback } from './drill/session.ts';
import { DRILL_FIXTURES } from './drill/fixtures.ts';
import { learnerVisibleStrings } from './drill/validate.ts';
import { MISSIONS } from './missions/missions.ts';
import { DAILY_WORDS } from './daily/words.ts';
import { DAILY_SCENARIOS } from './daily/scenarios.ts';

/**
 * Copy rules for anything a learner reads.
 *
 * The user asked for plain, human writing with no em dashes. Style requests rot
 * unless something enforces them, so this test walks every learner-visible string
 * in the content files and fails the build on a violation.
 */

const EM_DASH = /—/;
const FILLER = /\b(simply|note that|great question)\b/i;

function check(kind: string, text: string | undefined): void {
  if (!text) return;
  assert.ok(!EM_DASH.test(text), `${kind} contains an em dash: "${text}"`);
  assert.ok(!FILLER.test(text), `${kind} contains filler: "${text}"`);
}

describe('learner-visible copy stays plain and human', () => {
  test('phoneme cues and tricks', () => {
    for (const p of FRENCH_PHONEMES) {
      check(`cue for /${p.ipa}/`, p.cue);
      check(`trick for /${p.ipa}/`, p.trick);
    }
  });

  test('drill titles, reasons, and glosses', () => {
    for (const d of DRILLS) {
      check(`drill ${d.id} title`, d.title);
      check(`drill ${d.id} why`, d.why);
      for (const pair of d.pairs ?? []) {
        check(`drill ${d.id} gloss`, pair.a.gloss);
        check(`drill ${d.id} gloss`, pair.b.gloss);
      }
      for (const item of d.items ?? []) check(`drill ${d.id} gloss`, item.gloss);
    }
  });

  test('mission titles, goals and win lines', () => {
    // A mission's English is the most-read copy in the product: it is on the
    // chooser card, on Home, and on the card a learner reads at the moment they
    // finish. The win line gets one extra rule of its own below.
    for (const mission of MISSIONS) {
      check(`${mission.id} titleEn`, mission.titleEn);
      check(`${mission.id} goalEn`, mission.goalEn);
      check(`${mission.id} winEn`, mission.winEn);
      check(`${mission.id} learnerRole`, mission.learnerRole);
      check(`${mission.id} tutorRole`, mission.tutorRole);
    }
  });

  test('a win describes what the learner did, and never praises them for it', () => {
    // PRODUCT.md: the ladder displays evidence, it is not a new incentive, and
    // a learner is never performed at. "Great job" is the sound of being
    // assessed by something that was not listening.
    const PRAISE = /\b(great|amazing|awesome|well done|excellent|perfect|brilliant|congratulations|nice work|good job)\b/i;

    for (const mission of MISSIONS) {
      assert.ok(
        !PRAISE.test(mission.winEn),
        `${mission.id} praises the learner instead of telling them what they did: "${mission.winEn}"`,
      );
      assert.ok(
        !/\d/.test(mission.winEn),
        `${mission.id} puts a number in front of a learner who just finished: "${mission.winEn}"`,
      );
      assert.ok(
        mission.winEn.trim().length > 0,
        `${mission.id} has nothing to say at the moment that matters most`,
      );
    }
  });

  test('the word of the day and the daily situation', () => {
    // Home opens on these two cards, which makes them the most-read authored
    // strings in the product. They are walked here as well as in
    // daily.test.ts on purpose: this file owns the shared rule, and a pool
    // that carried its own private copy check would be free to disagree with
    // the rest of core about what plain writing is.
    for (const word of DAILY_WORDS) {
      check(`${word.id} fr`, word.fr);
      check(`${word.id} en`, word.en);
      check(`${word.id} note`, word.note);
      check(`${word.id} exampleFr`, word.exampleFr);
      check(`${word.id} exampleEn`, word.exampleEn);
    }
    for (const scenario of DAILY_SCENARIOS) {
      check(`${scenario.id} titleEn`, scenario.titleEn);
      check(`${scenario.id} titleFr`, scenario.titleFr);
      check(`${scenario.id} bodyEn`, scenario.bodyEn);
      check(`${scenario.id} openingFr`, scenario.openingFr);
      check(`${scenario.id} openingEn`, scenario.openingEn);
    }
  });

  test('lesson premise, notes, hints, and cultural notes', () => {
    for (const lesson of LESSONS) {
      check(`${lesson.id} premise`, lesson.premise);
      for (const n of lesson.culturalNotes) check(`${lesson.id} cultural note`, n);
      for (const t of lesson.turns) {
        check(`${t.id} note`, t.note);
        check(`${t.id} hint`, t.hint);
        check(`${t.id} tutorEn`, t.tutorEn);
        check(`${t.id} targetEn`, t.targetEn);
        for (const o of t.options) check(`${t.id} option gloss`, o.en);
      }
    }
  });
});

/**
 * Drill feedback carries two extra rules beyond the shared ones: it must never
 * scold (no "wrong", "incorrect", "bad", "failed" anywhere a learner reads),
 * and it must never show a digit mid-session — numbers belong on the end card,
 * where they can be given context.
 */

const SCOLD = /\b(wrong|incorrect|bad|failed)\b/i;
const DIGIT = /[0-9]/;

function checkDrill(kind: string, text: string): void {
  check(kind, text);
  assert.ok(!SCOLD.test(text), `${kind} scolds: "${text}"`);
  assert.ok(!DIGIT.test(text), `${kind} shows a digit mid-session: "${text}"`);
}

describe('drill feedback is pinned, plain, and kind', () => {
  test('the three verdict lines are exactly these', () => {
    // Pinned verbatim: changing the feel of a correction is a product
    // decision, and this test is where that decision becomes deliberate.
    assert.equal(GOOD_FEEDBACK, 'Nickel.');
    assert.equal(typoFeedback('merci'), "Presque. Ça s'écrit «merci».");
    assert.equal(missFeedback('un café'), 'Pas tout à fait. On dit: «un café».');
    assert.equal(missFeedback(null), 'Pas tout à fait.');
  });

  test('the typo line always contains the exact form it is pointing at', () => {
    assert.ok(typoFeedback('bonne journée').includes('«bonne journée»'));
    assert.ok(missFeedback('bonne journée').includes('«bonne journée»'));
  });

  test('no feedback line scolds, dashes, or counts', () => {
    for (const line of [GOOD_FEEDBACK, typoFeedback('exemple'), missFeedback('exemple'), missFeedback(null)]) {
      checkDrill('drill feedback', line);
    }
  });
});

describe('drill fixtures obey the same copy rules as the rest of the app', () => {
  test('every learner-visible string in the bank, silent twins included', () => {
    const bank = DRILL_FIXTURES.flatMap((e) => (e.kind === 'repeat-this' ? [e, e.noMicTwin] : [e]));
    for (const exercise of bank) {
      for (const { label, text } of learnerVisibleStrings(exercise)) {
        checkDrill(`${exercise.id} ${label}`, text);
      }
    }
  });
});
