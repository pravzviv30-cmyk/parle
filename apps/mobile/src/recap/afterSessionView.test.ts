// 2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and B-Recap: the end of a session's rules.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { HEAR_IT_SAID, MAX_SMALL_FIXES, afterSessionStats, smallFixes, celebrateView, recapEyebrow, streakLine, weekBars } from './afterSessionView.ts';
import type { WeekDay } from '../progress/momentum.ts';

const week = (states: WeekDay['state'][]): WeekDay[] => states.map((state, index) => ({ label: 'MTWTFSS'[index]!, state }) as WeekDay);

describe('the stat tiles', () => {
  test('draw minutes, new phrases and XP when each was measured', () => {
    assert.deepEqual(afterSessionStats({ activeSec: 7 * 60 + 20, phrases: 3, xp: 45 }).map((tile) => [tile.value, tile.label, tile.ground]), [
      ['7 min', 'spoken', 'sun'], ['3', 'new phrases', 'card'], ['+45', 'XP', 'mint'],
    ]);
  });
  test('leave a tile out rather than show a zero, and floor the minutes', () => {
    assert.deepEqual(afterSessionStats({ activeSec: null, phrases: 0, xp: null }), []);
    assert.equal(afterSessionStats({ activeSec: 30, phrases: 1, xp: null })[0]!.value, 'Under 1 min');
    assert.equal(afterSessionStats({ activeSec: 30, phrases: 1, xp: null })[1]!.label, 'new phrase');
    assert.equal(afterSessionStats({ activeSec: 119, phrases: 0, xp: 0 })[0]!.value, '1 min');
  });
});

describe('the streak row', () => {
  test('says the day and the week in words, never a best-week claim', () => {
    const days = week(['done', 'done', 'done', 'done', 'ahead', 'ahead', 'ahead']);
    assert.equal(streakLine(4, days), 'Day 4. You spoke French on four days this week.');
    assert.equal(streakLine(null, days), 'You spoke French on four days this week.');
    assert.equal(streakLine(null, null), null);
    assert.deepEqual(weekBars(days), [true, true, true, true, false, false, false]);
    assert.equal(weekBars(null), null);
  });
});

describe('the recap band and the celebration', () => {
  test('the eyebrow uses a comma, never a middot', () => {
    assert.equal(recapEyebrow('Au café du coin', 7 * 60), 'Au café du coin, 7 min');
    assert.equal(recapEyebrow('Au café du coin', null), 'Au café du coin');
    assert.doesNotMatch(recapEyebrow('A', 600), /·/);
  });
  test('the speaker is labelled as the tutor’s voice, not the learner’s recording', () => {
    assert.equal(HEAR_IT_SAID, 'Hear it said');
  });
  test('the celebration names the ability, the postcard and the next can-do', () => {
    const view = celebrateView({ mission: { title: 'Au café du coin', canDoEn: 'Order food and drink, then pay' }, independent: true, stamp: 'first', next: { canDoEn: 'Check in and ask one question' } });
    assert.deepEqual(view, {
      eyebrow: 'You can now', ability: 'Order food and drink, then pay', line: 'Earned on your own in Au café du coin.',
      postcardEyebrow: 'New postcard', next: 'Next: Check in and ask one question',
    });
    const helped = celebrateView({ mission: { title: 'X', canDoEn: 'Y' }, independent: false, stamp: null, next: null });
    assert.equal(helped.line, null);
    assert.equal(helped.postcardEyebrow, 'Your postcard');
    assert.equal(helped.next, null);
  });
});

describe('small fixes', () => {
  const fix = (quote: string, better: string, weight: 'matters-now' | 'minor' = 'minor') => ({ quote, better, weight });
  test('are plural, matters-now first, never repeated or empty, and capped', () => {
    const list = smallFixes([fix('a', 'b'), fix('c', 'd', 'matters-now'), fix('a', 'b'), fix(' ', 'x'), fix('same', 'same'), fix('e', 'f'), fix('g', 'h')]);
    assert.deepEqual(list.map((item) => item.quote), ['c', 'a', 'e']);
    assert.equal(list.length, MAX_SMALL_FIXES);
    assert.deepEqual(smallFixes([]), []);
  });
});
