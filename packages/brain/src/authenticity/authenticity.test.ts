import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { FR_PACK } from './fr.ts';
import { renderAuthenticityPack } from './render.ts';

describe('the French pack holds its shape', () => {
  test('carries enough material to be worth caching', () => {
    assert.ok(FR_PACK.contrasts.length >= 24, `only ${FR_PACK.contrasts.length} contrasts`);
    assert.ok(FR_PACK.fillers.length >= 12, `only ${FR_PACK.fillers.length} fillers`);
    assert.ok(FR_PACK.slang.length >= 15, `only ${FR_PACK.slang.length} slang entries`);
    assert.ok(FR_PACK.principles.length >= 6);
  });

  test('defines all four registers exactly once', () => {
    const ids = FR_PACK.registers.map((r) => r.id);
    assert.deepEqual([...ids].sort(), ['argot', 'courant', 'familier', 'soutenu']);
  });

  test('no duplicate teaching entries', () => {
    const textbooks = FR_PACK.contrasts.map((c) => c.textbook);
    assert.equal(new Set(textbooks).size, textbooks.length, 'duplicate contrast');
    const slang = FR_PACK.slang.map((s) => s.fr);
    assert.equal(new Set(slang).size, slang.length, 'duplicate slang');
    const fillers = FR_PACK.fillers.map((f) => f.fr);
    assert.equal(new Set(fillers).size, fillers.length, 'duplicate filler');
  });

  test('a written form only appears when it differs from the spoken form', () => {
    for (const c of FR_PACK.contrasts) {
      if (c.spokenWritten !== null) {
        assert.notEqual(c.spokenWritten, c.spoken, `${c.spoken} repeats itself as its written form`);
      }
    }
  });

  test('the load-bearing contrasts are present', () => {
    // If someone prunes the pack, these are the entries the product cannot lose.
    const spoken = FR_PACK.contrasts.map((c) => c.spoken);
    for (const must of ["J'sais pas", 'Ça va ?', 'Tu fais quoi ?', 'On va au ciné']) {
      assert.ok(spoken.includes(must), `pack lost "${must}"`);
    }
  });
});

describe('the rendered pack is safe for the cached prefix', () => {
  test('renders byte-identically across calls', () => {
    assert.equal(renderAuthenticityPack(FR_PACK), renderAuthenticityPack(FR_PACK));
  });

  test('contains the material a tutor needs to see', () => {
    const text = renderAuthenticityPack(FR_PACK);
    assert.ok(text.includes("J'sais pas"));
    assert.ok(text.includes('du coup'));
    assert.ok(text.includes('kiffer'));
    assert.ok(text.includes('argot (street)'));
    assert.ok(text.includes('Textbook vs spoken'));
  });

  test('is comfortably past the cacheable minimum and free of volatile tokens', () => {
    const text = renderAuthenticityPack(FR_PACK);
    assert.ok(text.length > 4000, 'pack render suspiciously small');
    assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}/, 'a date crept into the cached prefix');
  });
});
