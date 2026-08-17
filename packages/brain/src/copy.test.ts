import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECOVERY_LINE,
  RESCUE_LINE,
  coachFallbackLine,
  copyViolations,
  sanitizeLearnerText,
} from './copy.ts';
import { FR_PACK } from './authenticity/fr.ts';
import { renderAuthenticityPack } from './authenticity/render.ts';
import { CAFE_FRAME, APERO_FRAME } from './fixtures.ts';
import type { CoachKind } from './contract/types.ts';

/**
 * The same idea as core's copy.test.ts, extended to the brain's world: the
 * learner-visible strings here are partly hand-authored (pack, fixtures, fixed
 * lines) and partly model-generated at runtime. This file pins the authored
 * side and the sanitizer that guards the generated side.
 */

describe('sanitizeLearnerText', () => {
  test('replaces em and en dashes with commas', () => {
    assert.equal(sanitizeLearnerText('Not quite — try again'), 'Not quite, try again');
    assert.equal(sanitizeLearnerText('spoken – written'), 'spoken, written');
  });

  test('settles whitespace', () => {
    assert.equal(sanitizeLearnerText('  two   words \n here '), 'two words here');
  });
});

describe('copyViolations', () => {
  test('flags each rule by name', () => {
    assert.deepEqual(copyViolations('a — b'), ['em-dash']);
    assert.deepEqual(copyViolations('Simply do it'), ['filler']);
    assert.deepEqual(copyViolations('That was wrong'), ['scold']);
    assert.deepEqual(copyViolations('You got 80 percent'), ['score']);
    assert.deepEqual(copyViolations('All good here'), []);
  });

  test('digits inside quoted speech are conversation, not a score', () => {
    assert.deepEqual(copyViolations('Say "Ça fait 2 euros" back to him'), []);
    assert.deepEqual(copyViolations('Ça fait 2 euros'), ['score']);
  });

  test('allowDigits lets scene dialogue carry prices but never score words', () => {
    assert.deepEqual(copyViolations('Ça fait 3 euros 50', { allowDigits: true }), []);
    assert.deepEqual(copyViolations('I rated it 9', { allowDigits: true }), ['score']);
  });
});

describe('fixed lines and fallbacks stay clean', () => {
  test('the rescue and recovery lines pass every rule', () => {
    assert.deepEqual(copyViolations(RESCUE_LINE), []);
    assert.deepEqual(copyViolations(RECOVERY_LINE), []);
  });

  test('every coach fallback template passes and carries the better form', () => {
    const kinds: CoachKind[] = ['blocking-error', 'grammar-slip', 'textbook-phrasing', 'register-mismatch', 'anglicism'];
    for (const kind of kinds) {
      const line = coachFallbackLine(kind, "j'sais pas");
      assert.deepEqual(copyViolations(line), [], `${kind} fallback breaks a copy rule: "${line}"`);
      assert.ok(line.includes("j'sais pas"), `${kind} fallback lost the better form`);
    }
  });

  test('a textbook-phrasing fallback never opens with "Not quite" — the learner was not wrong', () => {
    assert.doesNotMatch(coachFallbackLine('textbook-phrasing', 'ça va'), /^not quite/i);
  });
});

describe('hand-authored content passes the copy rules', () => {
  function check(kind: string, text: string): void {
    const broken = copyViolations(text, { allowDigits: true });
    assert.deepEqual(broken, [], `${kind} breaks ${broken.join(', ')}: "${text}"`);
  }

  test('every string in the French pack', () => {
    for (const p of FR_PACK.principles) check('principle', p);
    for (const r of FR_PACK.registers) check(`register ${r.id}`, `${r.label} ${r.whenToUse}`);
    for (const c of FR_PACK.contrasts) check(`contrast ${c.textbook}`, `${c.en} ${c.why}`);
    for (const f of FR_PACK.fillers) check(`filler ${f.fr}`, `${f.en} ${f.useWhen}`);
    for (const s of FR_PACK.slang) {
      check(`slang ${s.fr}`, [s.en, s.enLiteral ?? '', s.caution ?? ''].join(' '));
    }
  });

  test('the rendered pack as a whole', () => {
    check('rendered pack', renderAuthenticityPack(FR_PACK));
  });

  test('every learner-visible string in the scenario fixtures', () => {
    for (const frame of [CAFE_FRAME, APERO_FRAME]) {
      check(`${frame.titleEn} setting`, frame.setting);
      check(`${frame.titleEn} guidance`, frame.registerGuidance);
      for (const note of frame.cultureNotes) check(`${frame.titleEn} culture note`, note);
      for (const b of frame.beats) check(`${frame.titleEn} beat`, b.goalEn);
      for (const g of frame.goalPhrases) check(`${frame.titleEn} goal phrase`, g.en);
      check(`${frame.titleEn} opening`, frame.openingLine.en);
      check(`${frame.titleEn} hint`, frame.openingSupport.hintEn);
      for (const o of frame.openingSupport.options) check(`${frame.titleEn} option`, o.en);
    }
  });
});
