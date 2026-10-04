import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPhrases, needsPhraseSearch } from './search.ts';
import type { Phrasebook } from './phrasebook.ts';
const book: Phrasebook = { groups: [], count: 0, topics: 0, saved: [{ id: 'coffee', front: 'Un café, s’il vous plaît.', back: 'A coffee, please.' }, { id: 'water', front: 'De l’eau.', back: 'Water.' }] };
test('phrase retrieval matches French accents and English without changing saved learning evidence', () => {
  assert.equal(searchPhrases(book, 'cafe').saved[0]?.id, 'coffee');
  assert.equal(searchPhrases(book, 'coffee please').saved[0]?.id, 'coffee');
  assert.equal(searchPhrases(book, 'water').saved[0]?.id, 'water');
  assert.equal(searchPhrases(book, "l'eau").saved[0]?.id, 'water');
  assert.deepEqual(searchPhrases(book, 'unknown').saved, []);
  assert.equal(searchPhrases(book, '').count, 0); assert.equal(book.saved.length, 2);
  assert.equal(searchPhrases(book, '   '), book);
});
test('a small phrasebook stays simple while a growing collection gets search', () => {
  assert.equal(needsPhraseSearch(book), false);
  assert.equal(needsPhraseSearch({ ...book, saved: Array(12).fill(book.saved[0]) }), true);
});
