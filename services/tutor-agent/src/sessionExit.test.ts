import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exitForPipeline, exitForStop, SessionExit } from './sessionExit.ts';

test('session exit: the first class wins and the line is logged exactly once', () => {
  const lines: string[] = [];
  const exit = new SessionExit((line) => lines.push(line));
  exit.mark('brain-turn');
  exit.mark('done');
  exit.log();
  exit.log();
  exit.mark('cap');
  exit.log();
  assert.deepEqual(lines, ['[luvani:session-exit] class=brain-turn']);
});

test('session exit: nothing marked reads as the learner leaving', () => {
  const lines: string[] = [];
  const exit = new SessionExit((line) => lines.push(line));
  exit.log();
  assert.deepEqual(lines, ['[luvani:session-exit] class=learner-left']);
});

test('session exit: an unrecoverable pipeline error names its half', () => {
  assert.equal(exitForPipeline('stt_error'), 'stt');
  assert.equal(exitForPipeline('tts_error'), 'tts');
  assert.equal(exitForPipeline('llm_error'), 'brain-turn');
  assert.equal(exitForPipeline('interruption_detection_error'), undefined);
});

test('session exit: a lifecycle stop at the hard deadline is the cap, any other stop is the lease', () => {
  assert.equal(exitForStop({ stoppedAtDeadline: true }), 'cap');
  assert.equal(exitForStop({ stoppedAtDeadline: false }), 'lease');
});
