/**
 * "Got right" and the drill's clean XP count first-time answers only (F919).
 * Right after a miss is help, the same rule the practice route's `recalled`
 * already keeps (practice/completion.ts) and LEARN-003 keeps for the scheduler.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { answerCurrent, type DrillExercise, type DrillSessionState } from '@luvani/core';

import { firstTry } from './firstTry.ts';

const listen = (id: string, fr: string): DrillExercise =>
  ({ id, phraseKey: `phrase:${fr}`, kind: 'listen-type', difficulty: 'production', fr, accepted: [fr.toLowerCase()] }) as DrillExercise;

describe('right first time — F919', () => {
  test('a miss is not counted as right first time', () => {
    let s: DrillSessionState = { queue: [listen('a', 'Merci'), listen('b', 'Pardon'), listen('c', 'Ça marche')], missesById: {}, answered: [], startedAt: 0, finished: false };
    s = answerCurrent(s, 'merci').state; // a, first time
    s = answerCurrent(s, 'nope').state; // b missed, back of the queue
    s = answerCurrent(s, 'ça marchee').state; // c, a typo first time
    s = answerCurrent(s, 'pardon').state; // b, right after the miss
    assert.equal(s.finished, true);
    // A typo on the retry after a miss earns no typo XP either.
    let t: DrillSessionState = { queue: [listen('d', 'Merci')], missesById: {}, answered: [], startedAt: 0, finished: false };
    t = answerCurrent(t, 'nope').state;
    t = answerCurrent(t, 'mercii').state;
    assert.deepEqual(firstTry(t), { right: 0, clean: 0, typos: 0 }, 'a retry typo was paid as typo XP');
    assert.deepEqual(firstTry(s), { right: 2, clean: 1, typos: 1 }, 'a right answer after a miss was counted as right first time');

    // The drill's end card and its clean XP read this, not the resolved count.
    const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
    const screen = read('../DrillScreen.tsx').replace(/\s+/g, ' ');
    assert.match(screen, /<EndScene delta=\{end\.delta\} count=\{firstTry\(session\)\.right\}/, 'Got right counts a right-after-miss');
    assert.match(screen, /drillXp\(\{ clean: firstTry\(state\)\.clean, typoCorrected: firstTry\(state\)\.typos \}\)/, 'XP counts a right-after-miss');
  });
});
