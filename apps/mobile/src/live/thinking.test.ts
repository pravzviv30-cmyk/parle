import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { ServerMessage } from '@luvani/core';
import { STILL_THINKING, STILL_THINKING_AFTER_MS, thinkingAfter, thinkingLine } from './thinking.ts';
import { streakGuiltIn } from '../copy/guilt.ts';

/** The learner has said something and is waiting on the tutor. */
const WAITING = true;

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; the source checks below read code. */
function strip(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

describe('is the tutor still deciding', () => {
  test('a trouble notice stops the tutor looking like it is still thinking', () => {
    // The bug: the tutor says "I cannot answer that one" and the orb beside the
    // message went on insisting it was thinking — and the notice cleared itself
    // after eight seconds while the orb never did.
    const notice: ServerMessage = { t: 'error', message: 'Say that once more for me.' };
    assert.equal(thinkingAfter(WAITING, notice), false);
  });

  test('a final transcript starts the wait', () => {
    assert.equal(thinkingAfter(false, { t: 'transcript', text: 'Bonjour', final: true }), true);
  });

  test('a partial transcript changes nothing — they are still talking', () => {
    assert.equal(thinkingAfter(false, { t: 'transcript', text: 'Bon', final: false }), false);
    assert.equal(thinkingAfter(WAITING, { t: 'transcript', text: 'Bon', final: false }), true);
  });

  test('every shape of answer ends the wait', () => {
    const answers: ServerMessage[] = [
      { t: 'prompt', prompt: {} as never },
      { t: 'convo', view: {} as never },
      { t: 'opening', prompt: { fr: 'x', en: 'x' } },
      { t: 'recap', recap: {} as never, profile: {} },
      { t: 'summary', summary: {} as never },
    ];
    for (const answer of answers) {
      assert.equal(thinkingAfter(WAITING, answer), false, `${answer.t} is an answer and must stop the orb`);
    }
  });

  test('taking the floor ends the wait; giving it up does not start one', () => {
    assert.equal(thinkingAfter(WAITING, { t: 'speaking', speaking: true }), false);
    assert.equal(thinkingAfter(false, { t: 'speaking', speaking: false }), false, 'the learner has the floor, nobody is deciding');
  });

  test('messages that ride alongside an answer leave the wait alone', () => {
    // Feedback arrives with a prompt and drills arrive after a recap; both would
    // already have cleared it, and neither is an answer on its own.
    assert.equal(thinkingAfter(WAITING, { t: 'feedback', feedback: {} as never }), true);
    assert.equal(thinkingAfter(WAITING, { t: 'drills', exercises: [] }), true);
  });
});

describe('a long wait is said honestly', () => {
  test('after six seconds of real thinking the room says it is still thinking, and never before', () => {
    assert.equal(thinkingLine(0), null);
    assert.equal(thinkingLine(STILL_THINKING_AFTER_MS - 1), null, 'a normal wait is narrated');
    assert.equal(STILL_THINKING_AFTER_MS, 6000);
    assert.equal(thinkingLine(STILL_THINKING_AFTER_MS), 'Still thinking. This can take a few seconds.');
    assert.equal(thinkingLine(60_000), STILL_THINKING, 'a long wait goes quiet again, or counts');
    assert.equal(thinkingLine(Number.NaN), null);
    // Warm, plain and true: no dash, no number, no blame, no pretend progress.
    assert.doesNotMatch(STILL_THINKING, /[\u2014\u2013\u00b7\d%]|analys|almost|nearly/i);
    assert.equal(streakGuiltIn(STILL_THINKING), undefined, "the line carries a word the copy rules ban");
  });

  test('the long-wait line is timed from real thinking and sits in the scene header under the connection line', () => {
    // The clock: one timer per wait, armed only while the tutor is really
    // thinking, and the words are thinkingLine's.
    const hook = strip(read('./useThinkingLine.ts'));
    assert.match(hook, /if \(!thinking\) return undefined;/, 'the line is timed while nothing is being thought about');
    assert.match(hook, /setTimeout\(\(\) => setWaited\(Date\.now\(\) - from\), STILL_THINKING_AFTER_MS\)/, 'the wait is not measured from when thinking began');
    assert.match(hook, /return \(\) => clearTimeout\(timer\);/, 'an answered wait leaves its timer running');
    assert.match(hook, /return thinking \? thinkingLine\(waited\) : null;/, 'the line outlives the answer, or is written outside thinkingLine');
    assert.doesNotMatch(hook, /setInterval/, 'the long-wait line ticks');

    // The slot: the scene header, and only when the connection line is empty.
    const screen = strip(read('../ConvoScreen.tsx'));
    assert.match(screen, /const stillThinking = useThinkingLine\(live\.thinking\);/, 'the line is not timed from the session\'s own thinking flag');
    assert.match(screen, /const headerLine = line\.text \?\? stillThinking;/, 'the long-wait line can cover a dropped connection or a notice');
    assert.match(screen, /caption=\{headerLine \?\?/, 'the scene caption does not show the long-wait line');
    assert.match(strip(read('./C2LiveRoom.tsx')), /accessibilityLiveRegion="polite"[\s\S]{0,100}\{caption\}/, 'the shared caption is not announced');
  });
});
