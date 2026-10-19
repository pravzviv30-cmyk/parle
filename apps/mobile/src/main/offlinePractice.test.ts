import { test } from 'node:test';
import assert from 'node:assert/strict';
import { offlinePractice } from './offlinePractice.ts';
const items = [
  {id:'first',fr:'Bonjour.',en:'Hello.',label:'Phrase',note:'',tier:1 as const},
  {id:'richer',fr:'À vrai dire…',en:'To tell the truth…',label:'Phrase',note:'',tier:3 as const},
  {id:'missing',fr:'Pourquoi pas ?',en:'Why not?',label:'Phrase',note:'',tier:2 as const},
];
test('offline sound practice prefers the selected pitch and exactly the selected tutor', () => {
  const audio = { emilie: {first:1,richer:2}, marie: {first:3} };
  assert.equal(offlinePractice(items,audio,'emilie',3)?.id,'richer');
  assert.equal(offlinePractice(items,audio,'emilie',1)?.id,'first');
  assert.equal(offlinePractice(items,audio,'marie',3)?.id,'first');
  assert.equal(offlinePractice(items,audio,'emilie',2)?.id,'first');
  assert.equal(offlinePractice(items,{},'emilie',3),null);
});
