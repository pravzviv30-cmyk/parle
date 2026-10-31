import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { litLetters } from './litLetters.ts';

const shown = (attempt: string, expected: string): string | null => {
  const r = litLetters(attempt, expected);
  if (r === null) return null;
  let out = '';
  let at = 0;
  for (const [s, e] of r.lit) {
    out += `${r.text.slice(at, s)}[${r.text.slice(s, e)}]`;
    at = e;
  }
  return out + r.text.slice(at);
};

describe('litLetters: the letter the learner missed lights up in the field', () => {
  test('a missing letter is lit in the right spelling', () => {
    assert.equal(shown('voudrai', 'voudrais'), 'voudrai[s]');
    assert.equal(shown('adition', 'addition'), 'a[d]dition');
  });
  test('a wrong letter is lit where the right one goes', () => {
    assert.equal(shown('voudrait', 'voudrais'), 'voudrai[s]');
  });
  test('an accent counts as a letter', () => {
    assert.equal(shown('cafe', 'café'), 'caf[é]');
    assert.equal(shown('tres bien', 'très bien'), 'tr[è]s bien');
  });
  test('only an extra letter: the attempt is shown with it lit', () => {
    // Either doubled s is the extra one; the alignment lights the first.
    assert.equal(shown('voudraiss', 'voudrais'), 'voudrai[s]s');
    assert.equal(shown('mercii', 'merci'), 'merc[i]i');
  });
  test('two slips light two runs, adjacent slips one run', () => {
    assert.equal(shown('combein', 'combien'), 'comb[ie]n');
  });
  test('case and outer spaces are not slips', () => {
    assert.equal(litLetters('Voudrais', 'voudrais'), null);
    assert.equal(shown('  voudrai ', 'voudrais'), 'voudrai[s]');
  });
  test('anything bigger than a small typo lights nothing', () => {
    assert.equal(litLetters('bonjour', 'merci'), null);
    assert.equal(litLetters('abc', 'xyz'), null);
    assert.equal(litLetters('je vais', 'je voudrais'), null);
    assert.equal(litLetters('ca', 'ça va'), null);
    assert.equal(litLetters('', 'oui'), null);
    assert.equal(litLetters('voudrais', 'voudrais'), null);
  });

  test('a letter whose lowercase is longer never shifts the lit spans', () => {
    const lit = litLetters('İstanbu', 'İstanbul');
    assert.ok(lit !== null);
    assert.equal(lit.text, 'İstanbul');
    assert.deepEqual(lit.lit, [[7, 8]]);
  });
});
