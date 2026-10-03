import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libraryPlace, pageItems, rememberLibraryPlace } from './libraryPlace.ts';

test('daily collection restores query and finite page for the same account only', () => {
  const owner = 727;
  rememberLibraryPlace(owner, { filter: 'phrases', query: 'merci', limit: 24 });
  assert.deepEqual(libraryPlace(owner), { filter: 'phrases', query: 'merci', limit: 24 });
  assert.deepEqual(libraryPlace(owner + 1), { filter: 'saved', query: '', limit: 12 });
  const items = Array.from({ length: 28 }, (_, index) => index);
  assert.deepEqual(pageItems(items, 24), items.slice(12, 24));
  assert.deepEqual(pageItems(items.slice(0, 14), 24), items.slice(12, 14));
  assert.deepEqual(pageItems(items, 12), items.slice(0, 12));
});
