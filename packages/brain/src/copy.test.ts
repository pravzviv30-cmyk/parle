import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENGLISH_HAND_BACK_VARIANTS,
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
    const kinds: CoachKind[] = [
      'blocking-error',
      'english-to-french',
      'grammar-slip',
      'textbook-phrasing',
      'register-mismatch',
      'anglicism',
    ];
    for (const kind of kinds) {
      const line = coachFallbackLine(kind, "j'sais pas");
      assert.deepEqual(copyViolations(line), [], `${kind} fallback breaks a copy rule: "${line}"`);
      assert.ok(line.includes("j'sais pas"), `${kind} fallback lost the better form`);
    }
  });

  test('a textbook-phrasing fallback never opens with "Not quite" — the learner was not wrong', () => {
    assert.doesNotMatch(coachFallbackLine('textbook-phrasing', 'ça va'), /^not quite/i);
  });

  test('an English attempt gets a direct French recast without being scolded', () => {
    const line = coachFallbackLine('english-to-french', 'je voudrais parler du devoir');
    assert.ok(line.includes('"je voudrais parler du devoir"'));
    assert.doesNotMatch(line, /^not quite/i);
    assert.deepEqual(copyViolations(line), []);
  });

  test('the English hand-back is warm, varied, and passes the copy rules', () => {
    // G8. The founder's complaint was that asking "how would I say this?" got
    // bare French back. The model writes this line itself on the good path;
    // this is the floor under it, so the warmth is guaranteed rather than
    // hoped for. Variation is keyed on the turn so a session never repeats one.
    const seen = new Set<string>();
    for (let variant = 0; variant < ENGLISH_HAND_BACK_VARIANTS; variant += 1) {
      const line = coachFallbackLine('english-to-french', 'un café, s’il vous plaît', { name: 'Sam', variant });
      assert.deepEqual(copyViolations(line), [], `variant ${variant} breaks a copy rule: "${line}"`);
      assert.ok(line.includes('"un café, s’il vous plaît"'), `variant ${variant} lost the French`);
      assert.ok(!seen.has(line), `variant ${variant} repeats an earlier hand-back: "${line}"`);
      seen.add(line);
    }
    assert.equal(seen.size, ENGLISH_HAND_BACK_VARIANTS);
  });

  test('the hand-back uses the name sometimes, never every line', () => {
    const lines = Array.from({ length: ENGLISH_HAND_BACK_VARIANTS }, (_, variant) =>
      coachFallbackLine('english-to-french', 'je sais pas', { name: 'Sam', variant }),
    );
    const named = lines.filter((l) => l.includes('Sam'));
    assert.ok(named.length > 0, 'the name never appears, so the founder’s ask is unmet');
    assert.ok(named.length < lines.length, 'the name appears every time, which is what reads as a bot');
  });

  test('a learner with no name gets the same warmth, unnamed', () => {
    for (let variant = 0; variant < ENGLISH_HAND_BACK_VARIANTS; variant += 1) {
      const line = coachFallbackLine('english-to-french', 'je sais pas', { name: null, variant });
      assert.deepEqual(copyViolations(line), [], `variant ${variant} breaks a copy rule unnamed: "${line}"`);
      assert.doesNotMatch(line, /\s,|,\s*\./, `variant ${variant} left a comma where the name was: "${line}"`);
    }
  });

  test('the hand-back never reassures, because reassurance implies failure', () => {
    // The persona already bans "don't worry" and "take your time" for exactly
    // this reason: telling a learner not to worry tells them there was
    // something to worry about. Acknowledgement instead of reassurance.
    for (let variant = 0; variant < ENGLISH_HAND_BACK_VARIANTS; variant += 1) {
      const line = coachFallbackLine('english-to-french', 'je sais pas', { name: 'Sam', variant });
      assert.doesNotMatch(line, /don'?t worry|no worries|take your time|it'?s (ok|fine|alright)/i, line);
    }
  });

  test('an out-of-range variant still returns a clean line', () => {
    const line = coachFallbackLine('english-to-french', 'je sais pas', { name: 'Sam', variant: 99 });
    assert.deepEqual(copyViolations(line), []);
    assert.ok(line.includes('"je sais pas"'));
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
