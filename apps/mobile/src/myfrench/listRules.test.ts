import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
test('a row inside the white list draws no rule of its own, so the list\'s hairline is the only one between rows', () => {
  for (const path of ['./PhraseBank.tsx', '../wall/WallYoursPage.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /<Ledger/);
    const row = source.slice(source.indexOf('  row: {'), source.indexOf('},', source.indexOf('  row: {')) + 2);
    assert.doesNotMatch(row, /border(?:Top|Bottom)Width/);
    assert.doesNotMatch(source, /style=\{[^}]*st\.(?:ruled|divided)/);
  }
});
