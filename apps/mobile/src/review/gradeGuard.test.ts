import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { firstGradeAt } from './gradeGuard.ts';

describe('firstGradeAt', () => {
  test('the first grade on a card goes through', () => {
    assert.equal(firstGradeAt(null, 0), true);
    assert.equal(firstGradeAt(0, 1), true);
  });
  test('a second tap on the same card is ignored', () => {
    assert.equal(firstGradeAt(3, 3), false);
  });
  test('ReviewScreen guards handleGrade on the card position', () => {
    const src = readFileSync(fileURLToPath(new URL('../ReviewScreen.tsx', import.meta.url)), 'utf8');
    const body = src.slice(src.indexOf('const handleGrade'), src.indexOf('if (queue === null)'));
    assert.match(body, /if \(!firstGradeAt\(gradedAt\.current, index\)\) return;\s*gradedAt\.current = index;/);
    assert.ok(body.indexOf('firstGradeAt') < body.indexOf('gradeCard('));
    assert.match(body, /\[card, view, clock, index\]/);
  });
});
