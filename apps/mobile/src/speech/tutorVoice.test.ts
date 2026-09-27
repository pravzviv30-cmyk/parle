/**
 * The device voice's chain of lines ends when it is stopped.
 *
 * Stage 4 re-check (2026-09-25): a browser reports a cancelled utterance as an
 * error, and `speak` hands errors to the same callback as a finished line, so
 * `speakLines` went on to the next line after `stop()`. The listening preview
 * stops its own voice when the learner leaves the chooser, and the guided
 * lesson speaks through the same chain.
 *
 * Read as source: expo-speech is a native module and does not load under the
 * node test runner (docs/TESTING.md).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const SOURCE = readFileSync(fileURLToPath(new URL('./tutorVoice.ts', import.meta.url)), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const FLAT = SOURCE.replace(/\s+/g, ' ');

test('a stopped chain of lines does not go on to the next one', () => {
  assert.match(
    FLAT,
    /export function speak\(text: string, opts\?: \{ onDone\?: \(\) => void; rate\?: number \}\): number \{/,
    'speak does not say which playback it started, so a chain cannot tell it was stopped',
  );
  assert.match(FLAT, /\}\); return generation; \}/, 'speak does not return the playback it started');
  assert.match(
    FLAT,
    /const generation = speak\(head, \{ onDone: \(\) => \{ if \(generation === playbackGeneration\) speakLines\(rest, onDone\); \}, \}\);/,
    'a line that ended because it was stopped starts the next one',
  );
  assert.doesNotMatch(FLAT, /speak\(head, \{ onDone: \(\) => speakLines\(rest, onDone\) \}\)/, 'the chain goes on unconditionally again');
  // Stopping moves the generation on, which is what the chain checks.
  assert.match(FLAT, /export function stop\(\): void \{ playbackGeneration\+\+; void Speech\.stop\(\); \}/);
});
