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

// Fix-verifier round 2: Missions' "More examples" used the default limit of
// three and lost the fourth line of mission:marche. It shows them all again.
test('More examples shows every reference phrase after the first', () => {
  const source = read('./MissionsScreen.tsx');
  const more = source.match(/showExamples && referenceLines\(first\.mission(?:, ([^)]+))?\)\.slice\(1\)/);
  assert.ok(more, 'the More examples list no longer reads referenceLines');
  assert.equal(more![1], 'Infinity', 'More examples is capped below the mission\'s own list');
  const marche = MISSIONS.find((m) => m.id === 'mission:marche')!;
  const shown = referenceLines(marche, Infinity).slice(1).map((l) => l.fr);
  assert.deepEqual(shown, marche.referencePhrases.slice(1));
  assert.ok(shown.includes('Merci, bon week-end !'));
});
