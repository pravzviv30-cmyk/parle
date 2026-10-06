import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_COPY } from './copy.ts';
import { streakGuiltIn } from '../copy/guilt.ts';

/** Every string the game layer can say, with the numbers filled in at their edges. */
function everyLine(): string[] {
  const c = GAME_COPY;
  const lines: string[] = [
    c.continue,
    c.seePlans,
    c.endCard.kicker,
    ...Object.values(c.endCard.line),
    c.endCard.xpLabel,
    c.endCard.timeLabel,
    ...Object.values(c.endCard.countLabel),
    c.endCard.capLine,
    c.endCard.alsoToday,
    c.goal.reached,
    c.goal.progress(0, 5),
    c.goal.progress(12, 20),
    c.quests.progress(0),
    c.quests.progress(2),
    c.quests.progress(3),
    c.quests.row('Finish a practice'),
    c.streak.label,
    c.streak.line(1),
    c.streak.line(12),
    c.streak.started,
    c.streak.dayOf(1),
    c.streak.dayOf(12),
    c.streak.restored,
    c.streak.lifetime(1),
    c.streak.lifetime(240),
    ...[7, 30, 100, 365, 730, 1095].map((n) => c.streak.milestone(n)),
    c.streak.repairForSubscribers,
    c.chest.title,
    c.chest.line(15),
    c.level.title(1),
    c.level.title(20),
    c.level.line,
    c.level.next(50, 2),
    c.badge.row('One week'),
    c.phraseSaved,
    c.intro.title,
    c.intro.body(0, 1),
    c.intro.body(12, 4),
  ];
  return lines;
}

describe('game copy — what the streak, goal, quests and badges say', () => {
  test('every streak, goal, quest and badge line states a fact and never threatens', () => {
    for (const line of everyLine()) {
      assert.equal(streakGuiltIn(line), undefined, `"${line}" says "${streakGuiltIn(line) ?? ''}", which streak copy may never say`);
      assert.doesNotMatch(line, /[—–·]/, `"${line}" carries a dash or a middot`);
      assert.doesNotMatch(line, /\bin a row\b/i, `"${line}" claims days in a row, but covered days bridge a run (F741)`);
      assert.doesNotMatch(line, /[!]/, `"${line}" shouts`);
    }
  });

  test('a level is a number and never a rank name', () => {
    assert.equal(GAME_COPY.level.title(7), 'Level 7');
    assert.equal(GAME_COPY.level.next(120, 8), '120 XP to Level 8');
  });

  test('the lifetime line matches the day count the rest of the app shows', () => {
    assert.equal(GAME_COPY.streak.lifetime(1), '1 day you have practised');
    assert.equal(GAME_COPY.streak.lifetime(3), '3 days you have practised');
  });

  test('a milestone beyond a year counts whole years', () => {
    assert.equal(GAME_COPY.streak.milestone(730), '2 years of French.');
    assert.equal(GAME_COPY.streak.milestone(365), 'A full year of French.');
  });

  test('the intro sheet names the saved practice it counted, and a learner with no run is told how one starts', () => {
    assert.match(GAME_COPY.intro.body(12, 4), /^You are on a 12-day streak and at Level 4, counted from the practice already saved on your account\.$/);
    assert.match(GAME_COPY.intro.body(0, 1), /^Your next practice starts a streak\./);
  });
});
