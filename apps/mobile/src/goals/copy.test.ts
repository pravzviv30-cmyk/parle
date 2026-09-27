/**
 * The goal surface's words, held to what it may and may not say (Stage 4,
 * 2026-09-25). No banned word, no em dash, no digit, no result claim.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { GOALS_ROW_LABEL } from '../myfrench/copy.ts';
import { GOAL_COPY, GOAL_LABEL, USED_OUTSIDE_SAID, rehearsedOn } from './copy.ts';

describe('the words the goal surface says — Stage 4', () => {
  test('no banned word, no dash, no digit, no claim of a result', () => {
    assert.ok(GOAL_COPY.length >= 14, 'the sweep reads almost nothing');
    for (const line of GOAL_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'), `"${line}" carries an em dash`);
      assert.doesNotMatch(line, /\d|%/, `"${line}" counts at the learner`);
      assert.doesNotMatch(line, /achiev|master|\bready\b|score|fluent|\bdone\b/i, `"${line}" claims a result the app cannot know`);
      assert.doesNotMatch(line, /!/, `"${line}" shouts`);
    }
  });

  test('the self-report is said back as the learner\'s word, not as a fact the app checked', () => {
    assert.equal(USED_OUTSIDE_SAID, 'You said you used this outside the app.');
  });

  test('the screen names the goal with the same words as the My French row that opens it', () => {
    assert.equal(GOAL_LABEL, GOALS_ROW_LABEL);
  });

  test('the only digits on the screen are a date', () => {
    const line = rehearsedOn(Date.UTC(2026, 8, 20, 12));
    assert.match(line, /^You rehearsed this on \d{1,2} [A-Z][a-z]+\.$/);
    assert.doesNotMatch(line, /\d{4}|:/, 'the date line carries a year or a time');
  });

  test('every fixed export is in the sweep', () => {
    const source = readFileSync(fileURLToPath(new URL('./copy.ts', import.meta.url)), 'utf8');
    const exported = source.match(/^export const [A-Z_]+ = '/gm) ?? [];
    const inObject = (source.match(/^export const GOAL_PRACTICE_LINE = \{[\s\S]*?\} as const;/m)?.[0].match(/: '/g) ?? []).length;
    assert.equal(GOAL_COPY.length, exported.length + inObject, 'a line was added to copy.ts and not to the sweep');
    assert.equal(new Set(GOAL_COPY).size, GOAL_COPY.length);
  });
});
