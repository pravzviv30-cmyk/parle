/** F943: "One line to try" shows the English under each French line. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MISSIONS } from '@luvani/core';
import { referenceLines } from './referenceLines.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('every reference phrase shows its English', () => {
  for (const mission of MISSIONS) {
    const lines = referenceLines(mission, Infinity);
    assert.equal(lines.length, mission.referencePhrases.length);
    for (const line of lines) assert.ok(line.en.trim().length > 0, `${mission.id}: "${line.fr}" has no English`);
  }
  // Both "One line to try" cards draw the pair, never the French alone.
  for (const screen of ['./MissionsScreen.tsx', '../onboarding/FirstSceneScreen.tsx']) {
    const source = read(screen);
    assert.match(source, /referenceLines\(/, `${screen} reads the French without its English`);
    assert.match(source, /\{line\.en\}/, `${screen} never draws the English`);
    assert.doesNotMatch(source, /referencePhrases\.(slice|map)/, `${screen} still draws bare reference phrases`);
  }
});
