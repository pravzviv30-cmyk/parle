import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAFE_LESSON, lessonKeyterms, type Lesson } from '../index.ts';

test('café keyterms keep the three question targets, without the question mark', () => {
  const keyterms = lessonKeyterms(CAFE_LESSON);
  for (const id of ['t4-repeat', 't7-how-much', 't10-toilets']) {
    const target = CAFE_LESSON.turns.find(turn => turn.id === id)!.target;
    assert.ok(target.endsWith('?'), `${id} is still a question in the lesson`);
    assert.ok(keyterms.includes(target.replace(/\s*\?$/, '')), `${id} reaches recognition`);
  }
  assert.ok(keyterms.every(term => !term.includes('?')));
});

test('café keyterms leave out the lowercase unaccented accepts and stay within the caps', () => {
  const keyterms = lessonKeyterms(CAFE_LESSON);
  const shown = new Set(CAFE_LESSON.turns.flatMap(turn => [turn.target, ...turn.options.map(option => option.text)]).map(line => line.replace(/\s*\?$/, '')));
  for (const accept of CAFE_LESSON.turns.flatMap(turn => turn.accepts)) {
    if (!shown.has(accept)) assert.ok(!keyterms.includes(accept), `accepts string "${accept}" leaked`);
  }
  assert.ok(!keyterms.includes('un cafe sil vous plait'));
  assert.ok(keyterms.length >= 1 && keyterms.length <= 16);
  assert.ok(Buffer.byteLength(keyterms.join('')) <= 400);
  assert.ok(keyterms.every(term => term.length >= 1 && term.length <= 100 && !/[\x00-\x1f\x7f]/.test(term)));
  assert.equal(new Set(keyterms).size, keyterms.length);
});

test('targets come before options, so a long lesson keeps its targets', () => {
  const turn = CAFE_LESSON.turns[0]!;
  const lesson: Lesson = { ...CAFE_LESSON, turns: Array.from({ length: 14 }, (_, n) => ({
    ...turn, id: `t${n}`, target: `Cible numéro ${n} ?`, accepts: [`cible ${n}`],
    options: [{ text: `Option numéro ${n}`, en: '', acceptable: true }, { text: `Faux ${n}`, en: '', acceptable: false }],
  })) };
  const keyterms = lessonKeyterms(lesson);
  assert.equal(keyterms[0], 'Cible numéro 0');
  assert.deepEqual(keyterms.slice(0, 14), lesson.turns.map((_, n) => `Cible numéro ${n}`), 'every target before any option');
  assert.ok(keyterms.length <= 16 && !keyterms.some(term => term.startsWith('Faux')));
  const optionsOnly: Lesson = { ...lesson, turns: lesson.turns.slice(0, 2) };
  assert.deepEqual(lessonKeyterms(optionsOnly), ['Cible numéro 0', 'Cible numéro 1', 'Option numéro 0', 'Option numéro 1']);
});

test('every café target survives the caps before any short form or option', () => {
  const keyterms = lessonKeyterms(CAFE_LESSON);
  assert.equal(CAFE_LESSON.turns.length, 12);
  assert.deepEqual(keyterms.slice(0, 12), CAFE_LESSON.turns.map(turn => turn.target.replace(/\s*\?$/, '')));
  assert.ok(keyterms.includes('Au revoir, madame'));
});
