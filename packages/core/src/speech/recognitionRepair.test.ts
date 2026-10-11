import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recognitionPhrases, repairRecognizedFrench } from './recognitionRepair.ts';

test('near-sound beginner French uses only the current turn vocabulary', () => {
  for (const heard of ['Suplesse.', 'Souplesse.', 'Surplus,']) {
    assert.deepEqual(repairRecognizedFrench(heard, ['Sur place.', 'À emporter.']), { text: 'Sur place.', interpreted: true });
    assert.deepEqual(repairRecognizedFrench(heard, ['Un thé.', 'Un café.']), { text: heard, interpreted: false });
  }
  assert.deepEqual(repairRecognizedFrench('mercy beaucoup', ['Merci beaucoup.']), { text: 'Merci beaucoup.', interpreted: true });
});
test('recognition repair preserves negation, quantities, unrelated speech and ambiguity', () => {
  for (const heard of ['pas sur place', 'deux cafés', '2 cafés', 'I am having it here', 'Je veux partir', 'oui', '']) {
    assert.deepEqual(repairRecognizedFrench(heard, ['Sur place.', 'Un café.']), { text: heard, interpreted: false });
  }
  assert.equal(repairRecognizedFrench('paris', ['Paris.', 'Pari.']).interpreted, false);
  assert.equal(repairRecognizedFrench('sur plase', ['Sur place.', 'Sur glace.']).interpreted, false);
});
test('recognition repair never appends unspoken courtesy and bounds context', () => {
  assert.deepEqual(repairRecognizedFrench('Souplesse', ['Oui, sur place, merci.']), { text: 'sur place', interpreted: true });
  assert.equal(recognitionPhrases(['What do you want?', 'x'.repeat(101)]).length, 0);
  assert.equal(repairRecognizedFrench('x'.repeat(101), ['Sur place.']).interpreted, false);
  assert.ok(new TextEncoder().encode(recognitionPhrases(Array.from({ length: 12 }, (_, i) => `Phrase ${i} ${'é'.repeat(60)}`)).join('')).length <= 400);
});

test('near-sound repair cannot change teen quantities, regional numbers or elided negation', () => {
  for (const [heard, candidate] of [
    ['treize cafés', 'seize cafés'], ['trente cafés', 'treize cafés'],
    ['septante cafés', 'soixante cafés'], ['n’en veux', 'en veux'],
    ['ni cafés', 'de cafés'], ['no cafés', 'de cafés'],
  ]) assert.deepEqual(repairRecognizedFrench(heard!, [candidate!]), { text: heard, interpreted: false });
});

test('a nearby valid word is not evidence to replace the learners meaning', () => {
  for (const [heard, candidate] of [
    ['Je veux partir', 'Je veux parler'], ['Un café', 'Un cake'],
    ['un train', 'un pain'], ['sur glace', 'sur place'],
    ['Il est malade', 'Il est salade'],
  ]) assert.deepEqual(repairRecognizedFrench(heard!, [candidate!]), { text: heard, interpreted: false });
});
