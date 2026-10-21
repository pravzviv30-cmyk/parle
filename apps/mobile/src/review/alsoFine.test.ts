// 2026-10-21 UI-008, artboard B-ReviewReveal: "Also fine:" comes from the drill bank's accepted French only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { DrillExercise } from '@luvani/core';
import { alsoFine } from './alsoFine.ts';

const KEY = "phrase:l'addition, s'il vous plaît.";
const tap = (accepted: string[], phraseKey = KEY): DrillExercise => ({ id: 't', kind: 'tap-translate', phraseKey, difficulty: 'recognition', en: 'The bill, please.', tokens: [], accepted } as unknown as DrillExercise);

test('the other accepted French for the same phrase, never the answer again', () => {
  const answer = "L'addition, s'il vous plaît.";
  assert.equal(alsoFine(KEY, answer, [tap(["l’addition s'il vous plaît", "On peut avoir l'addition ?"])]), "On peut avoir l'addition ?");
  assert.equal(alsoFine(KEY, answer, [tap(["L'addition, s'il vous plaît"])]), null, 'the answer with other punctuation is not another way to say it');
  assert.equal(alsoFine(KEY, answer, [tap(['Autre chose.'], 'phrase:autre')]), null, 'an exercise on another phrase was read');
  assert.equal(alsoFine(KEY, answer, []), null);
});

test('a French-to-English translation offers no French', () => {
  const fren = { id: 'x', kind: 'translate', phraseKey: KEY, difficulty: 'production', fr: 'x', en: 'x', direction: 'fr-en', accepted: ['The bill please'] } as unknown as DrillExercise;
  assert.equal(alsoFine(KEY, "L'addition, s'il vous plaît.", [fren]), null);
});

test('the review screen reads the bank for it and shows the line only after the answer', () => {
  const screen = readFileSync(new URL('../ReviewScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /loadDrillBank\(\)/);
  assert.match(screen, /alsoFine\(card\.id, view\.answer\.text, bank\)/);
  // The front face comes first in the ternary; the line lives only on the turned-over face after it.
  const face = screen.indexOf('const face = view.answer === null ? (');
  const back = screen.indexOf(') : (', face);
  assert.ok(face > 0 && back > face, 'the face moved; this test is reading the wrong thing');
  assert.ok(!screen.slice(face, back).includes('REVIEW_COPY.alsoFine'), 'the other way to say it can show before the answer');
  assert.ok(screen.indexOf('REVIEW_COPY.alsoFine', back) > back, 'the turned-over card lost its other way to say it');
});
