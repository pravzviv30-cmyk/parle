import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAFE_LESSON, directiveFor, type Rung } from '@luvani/core';
import { sayable, scriptedSpeech, scriptedSpeechParts } from './scriptedSpeech.ts';
import { AUTHORED_SPEECH_LINES } from './authoredSpeech.ts';
import { tokenize } from '@livekit/agents';

const turn = CAFE_LESSON.turns[1]!;

test('every part is closed with terminal punctuation, so cache keys stay stable', () => {
  assert.equal(sayable('Bonjour'), 'Bonjour.');
  assert.equal(sayable(' Bonjour ! '), 'Bonjour !');
  assert.equal(sayable('   '), '');
});

test('the ladder decides how much is said, as it decides what is shown', () => {
  assert.deepEqual(scriptedSpeechParts(turn, directiveFor(1)), [sayable(turn.tutor), sayable(turn.target)]);
  assert.deepEqual(scriptedSpeechParts(turn, directiveFor(2)), [sayable(turn.tutor), ...turn.options.slice(0, 3).map(o => sayable(o.text))]);
  assert.deepEqual(scriptedSpeechParts(turn, directiveFor(3)), [sayable(turn.tutor), sayable(turn.hint)]);
  assert.deepEqual(scriptedSpeechParts(turn, directiveFor(4)), [sayable(turn.tutor)]);
  for (const rung of [1, 2, 3, 4] as Rung[]) {
    assert.deepEqual(scriptedSpeechParts(turn, directiveFor(rung, true)), [sayable(turn.target)], 'a rescue hands over the line itself');
    assert.deepEqual(scriptedSpeechParts(turn, directiveFor(rung, true), { newTurn: true }), [sayable(turn.tutor), sayable(turn.target)], 'after the question, when the rescue moved the lesson on');
  }
});

test('every sentence the script can say is already in the warm cache list', () => {
  const warmed = new Set(AUTHORED_SPEECH_LINES);
  const splitter = new tokenize.basic.SentenceTokenizer();
  for (const lessonTurn of CAFE_LESSON.turns) for (const rung of [1, 2, 3, 4] as Rung[]) for (const rescued of [false, true]) for (const newTurn of [false, true]) {
    for (const sentence of splitter.tokenize(scriptedSpeech(lessonTurn, directiveFor(rung, rescued), { newTurn }))) {
      assert.ok(warmed.has(sentence.replace(/\s+/g, ' ').trim()), `not warmed: ${sentence}`);
    }
  }
});
