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

test('a view never changes the French of a line already shown, and fills in its English', () => {
  // F988: the tutor-line shows the French as it is spoken; the view after it
  // brings the English and the written form, and the French stays as heard.
  let turns = pushTurn([], { who: 'tutor', fr: 'Et avec ceci ?', frWritten: null, en: null }, 'tutor:c1');
  turns = pushTurn(turns, { who: 'learner', fr: 'Un croissant.', frWritten: null, en: null }, 'u1');
  turns = pushTurn(turns, { who: 'tutor', fr: 'Et avec ceci, monsieur ?', frWritten: 'Et avec ceci, Monsieur ?', en: 'Anything else?' }, 'tutor:c1');
  assert.equal(turns.length, 2);
  assert.deepEqual(turns[0], { id: 'tutor:c1', who: 'tutor', fr: 'Et avec ceci ?', frWritten: 'Et avec ceci, Monsieur ?', en: 'Anything else?' });
  // Filled once: a later copy changes nothing, and an unchanged list is the same list.
  const again = pushTurn(turns, { who: 'tutor', fr: 'Autre', frWritten: 'Autre', en: 'Other' }, 'tutor:c1');
  assert.equal(again, turns);
  // An empty English from a view is not English.
  const blank = pushTurn([], { who: 'tutor', fr: 'Oui.', frWritten: null, en: null }, 'tutor:c2');
  assert.equal(pushTurn(blank, { who: 'tutor', fr: 'Oui.', frWritten: null, en: '' }, 'tutor:c2'), blank);
});
