import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { applyGrade, newCard } from '@luvani/core';
import { firstGradeAt, sittingGrade } from './gradeGuard.ts';

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

describe('sittingGrade (F1153; founder, 2026-11-24: back tomorrow, same stage)', () => {
  const NOW = Date.UTC(2026, 10, 24, 12);
  const DAY = 86_400_000;
  const seen = { ...newCard({ id: 'c', kind: 'vocab', front: 'Merci', back: 'Thanks', context: '', ipa: '' }, NOW - 10 * DAY), reps: 1, intervalDays: 1 };

  test('a card answered right after Again in the same sitting is graded assisted', () => {
    const missed = new Set(['c']);
    for (const grade of ['good', 'easy'] as const) {
      const out = sittingGrade('c', grade, { attempt: 'said' }, missed);
      assert.deepEqual(out, { grade: 'good', context: { attempt: 'said', assisted: true } }, grade);
      const after = applyGrade(seen, out.grade, NOW, out.context);
      assert.equal(after.reps, seen.reps, `${grade} after Again stepped the card up`);
      assert.equal(after.due, NOW + DAY, `${grade} after Again did not come back tomorrow`);
      assert.equal(after.evidence?.retrievals ?? 0, 0, `${grade} after Again counted a recall`);
    }
  });

  test('a card not missed this sitting, or graded Again, keeps its grade and context', () => {
    const missed = new Set(['other']);
    assert.deepEqual(sittingGrade('c', 'easy', { attempt: 'typed' }, missed), { grade: 'easy', context: { attempt: 'typed' } });
    assert.deepEqual(sittingGrade('c', 'good', {}, missed), { grade: 'good', context: {} });
    assert.deepEqual(sittingGrade('other', 'again', {}, missed), { grade: 'again', context: {} });
  });

  test('ReviewScreen grades through sittingGrade, remembers its misses, and counts no recall after one', () => {
    const src = readFileSync(fileURLToPath(new URL('../ReviewScreen.tsx', import.meta.url)), 'utf8');
    const body = src.slice(src.indexOf('const handleGrade'), src.indexOf('if (queue === null)'));
    assert.match(body, /sittingGrade\(card\.id, grade, view\.gradeContext, missed\.current\)/);
    assert.match(body, /gradeCard\(card\.id, given\.grade, given\.context\)/);
    assert.match(body, /missed\.current\.add\(card\.id\)/);
    assert.match(body, /assisted !== true/);
  });
});
