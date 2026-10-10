import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pushTurn } from './turns.ts';
test('a replayed tutor turn id cannot duplicate narration and speech after a learner reply', () => {
  let turns = pushTurn([], {who:'narration',fr:'At the restaurant',frWritten:null,en:null}, 'narration:c1');
  turns = pushTurn(turns, {who:'tutor',fr:'Pour combien ?',frWritten:null,en:null}, 'tutor:c1');
  turns = pushTurn(turns, {who:'learner',fr:'Deux.',frWritten:null,en:null}, 'u1');
  turns = pushTurn(turns, {who:'narration',fr:'At the restaurant',frWritten:null,en:null}, 'narration:c1');
  turns = pushTurn(turns, {who:'tutor',fr:'Pour combien ?',frWritten:null,en:null}, 'tutor:c1');
  assert.equal(turns.length, 3); assert.equal(turns[2]!.who, 'learner');
});
