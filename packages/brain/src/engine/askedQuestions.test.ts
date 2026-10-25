import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_ASKED_QUESTIONS, askedQuestions, repeatsQuestion } from './askedQuestions.ts';
import type { ChatMessage } from '../llm/client.ts';

const tutor = (text: string): ChatMessage => ({ role: 'assistant', text });

describe('askedQuestions — VOICE-014', () => {
  test('reads the character\'s own questions, as said, and nothing else', () => {
    const asked = askedQuestions([
      tutor('Karim: Bonjour ! Qu\'est-ce que je vous sers ?'),
      { role: 'user', text: 'Et vous, ça va ?' },
      tutor('(coach) How would you say that?\nKarim: Très bien. Sur place ou à emporter ?\n(beat: order, done)'),
    ]);
    assert.deepEqual(asked, ['Qu\'est-ce que je vous sers ?', 'Sur place ou à emporter ?']);
  });

  test('dedupes, keeping the latest position', () => {
    const asked = askedQuestions([tutor('Léa: Tu habites où ?'), tutor('Léa: Ça va ?'), tutor('Léa: Tu habites OÙ ?')]);
    assert.deepEqual(asked, ['Ça va ?', 'Tu habites OÙ ?']);
  });

  test('keeps only the last six', () => {
    const history = Array.from({ length: 9 }, (_, i) => tutor(`Léa: Question numéro ${'abcdefghi'[i]} ?`));
    const asked = askedQuestions(history);
    assert.equal(asked.length, MAX_ASKED_QUESTIONS);
    assert.equal(asked[0], 'Question numéro d ?');
    assert.equal(asked.at(-1), 'Question numéro i ?');
  });
});

describe('repeatsQuestion — VOICE-014', () => {
  const asked = ['Qu\'est-ce que tu fais dans la vie ?', 'Tu habites où ?'];

  test('catches the same question, and the same question reworded', () => {
    assert.equal(repeatsQuestion('Ah bon. Tu habites où ?', asked), 'Tu habites où ?');
    assert.equal(repeatsQuestion('Et toi, tu fais quoi dans la vie ?', asked), 'Qu\'est-ce que tu fais dans la vie ?');
    assert.equal(repeatsQuestion('Vous habitez où ?', asked), 'Tu habites où ?');
  });

  test('lets a different question through, and a reply with no question', () => {
    assert.equal(repeatsQuestion('Tu travailles où ?', asked), null);
    assert.equal(repeatsQuestion('Tu aimes le café ?', asked), null);
    assert.equal(repeatsQuestion('Ah, Lyon, c\'est beau.', asked), null);
  });
});
