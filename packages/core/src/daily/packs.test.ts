import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAILY_WORDS } from './words.ts';
import { DAILY_PHRASES } from './phrases.ts';
test('the offline release carries exactly 1000 unique words and 1000 unique phrases',()=>{
 for(const pack of [DAILY_WORDS,DAILY_PHRASES]) {
  assert.equal(pack.length,1000); assert.equal(new Set(pack.map(p=>p.id)).size,1000);
  assert.equal(new Set(pack.map(p=>p.fr.normalize('NFC').toLocaleLowerCase('fr'))).size,1000);
  for(const item of pack) { assert.ok(item.fr.trim()); assert.ok(item.en.trim()); assert.ok([1,2,3].includes(item.tier)); }
 }
 for(const tier of [1,2,3]) assert.ok(DAILY_PHRASES.some(p=>p.tier===tier));
});
test('supplementary word examples contain the whole word, not the start of a different word',()=>{
 for(const word of DAILY_WORDS.filter(w=>w.id.startsWith('word:pack-'))) {
  const escaped=word.fr.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  assert.match(word.exampleFr,new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,'iu'),word.id);
 }
});
