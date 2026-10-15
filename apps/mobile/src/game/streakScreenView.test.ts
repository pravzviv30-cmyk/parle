/**
 * The Streak screen (F770), from the days it reads.
 *
 * Facts are built the way the game layer reads them and folded by
 * `gameViewFrom`, the fold the hooks serve, so the run, the week and the month
 * held here are the ones a phone would draw. Then the plan's half (D4, D19):
 * a subscriber's freezes and the repair being earned, and a free learner's
 * one calm line just after a reset, with nothing at any other time.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { guiltIn, streakGuiltIn } from '../copy/guilt.ts';
import type { ActivityEntry } from '../progress/activity.ts';
import { GAME_COPY } from './copy.ts';
import { emptyGame, type BadgeAward } from './model.ts';
import { clampMonth, monthOf, shiftMonth, streakScreenView, type StreakScreenView } from './streakScreenView.ts';
import { NO_OUTSIDE_FACTS, gameViewFrom, type BillingFacts, type GameFacts } from './view.ts';
import type { StreakCover } from '@luvani/core';

const TODAY = '2026-10-07';
const at = (month: number, day: number, hour: number): number => new Date(2026, month - 1, day, hour).getTime();
const FREE: BillingFacts = { plan: 'trial', lapsed: false, secondsRemaining: 600, canStart: true };
const PAID: BillingFacts = { plan: 'regular', lapsed: false, secondsRemaining: 6000, canStart: true };

function facts(input: {
  practiceDays: string[];
  covers?: StreakCover[];
  activity?: ActivityEntry[];
  badges?: BadgeAward[];
  billing?: BillingFacts | null;
}): GameFacts {
  return {
    activity: input.activity ?? [],
    practiceDays: input.practiceDays,
    game: { ...emptyGame(), covers: input.covers ?? [], badges: input.badges ?? [] },
    outside: { ...NO_OUTSIDE_FACTS, goalTarget: 10 },
    billing: input.billing ?? null,
  };
}

function screenOf(f: GameFacts, month = monthOf(TODAY)): StreakScreenView {
  return streakScreenView(gameViewFrom(f, TODAY), month);
}

/** Every string the screen model would say, so a word can be refused everywhere at once. */
function everything(view: StreakScreenView): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(view);
  return out;
}

const read = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ');

describe('the Streak screen — F770', () => {
  test('the streak screen shows the run, the lifetime total, the week and the month from real days, and never says missed', () => {
    // An earlier run of eight (25 September to 2 October), a day off, then a
    // run of three up to yesterday with Monday covered by a freeze.
    const earlier = ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
    const f = facts({
      practiceDays: [...earlier, '2026-10-04', '2026-10-06'],
      covers: [{ day: '2026-10-05', kind: 'freeze', at: at(10, 6, 1) }],
      badges: [{ id: 'streak-7', at: at(10, 1, 20) }],
    });
    const screen = screenOf(f);

    // The hero: practice days in the live run (the freeze bridges, adding 0),
    // the lifetime total beside it, the longest run, and today still open.
    assert.equal(screen.hero.count, 2);
    assert.equal(screen.hero.lit, false);
    assert.equal(screen.hero.words, 'day streak');
    assert.equal(screen.hero.lifetime, '10 days you have practised');
    assert.equal(screen.hero.longest, 'Longest streak: 8 days');
    assert.equal(screen.hero.today, 'Practise today to reach 3.');

    // This week, Monday first, every day said in full and nothing missed.
    assert.deepEqual(
      screen.week.map((cell) => cell.label),
      ['Monday, covered by a freeze', 'Tuesday, practised', 'Wednesday, today, not practised yet', 'Thursday, still to come', 'Friday, still to come', 'Saturday, still to come', 'Sunday, still to come'],
    );
    assert.deepEqual(screen.week.map((cell) => cell.mark), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);

    // The month: October 2026 starts on a Thursday, so three empty cells lead.
    const month = screen.month;
    assert.equal(month.title, 'October 2026');
    assert.equal(month.leading, 3);
    assert.equal(month.cells.length, 31);
    assert.equal(month.cells[0]!.label, '1 October, practised');
    assert.equal(month.cells[2]!.label, '3 October, no practice');
    assert.equal(month.cells[4]!.label, '5 October, covered by a freeze');
    assert.equal(month.cells[6]!.label, '7 October, today, not practised yet');
    assert.equal(month.cells[7]!.label, '8 October, still to come');
    // Back as far as the first practised month, never past this one.
    assert.equal(month.canGoBack, true);
    assert.equal(month.canGoForward, false);
    const september = screenOf(f, shiftMonth(monthOf(TODAY), -1)).month;
    assert.equal(september.title, 'September 2026');
    assert.equal(september.canGoBack, false);
    assert.equal(september.canGoForward, true);
    assert.equal(september.cells[24]!.label, '25 September, practised');
    assert.equal(september.cells[0]!.label, '1 September, no practice');
    assert.deepEqual(clampMonth({ year: 2027, month: 1 }, f.practiceDays, TODAY), { year: 2026, month: 10 });
    assert.deepEqual(clampMonth({ year: 2020, month: 1 }, f.practiceDays, TODAY), { year: 2026, month: 9 });

    // Milestones: seven reached on the day its badge was earned; the rest ahead.
    assert.deepEqual(
      screen.milestones.map((m) => [m.days, m.reached, m.when, m.medal]),
      [
        [7, true, 'Reached 1 October 2026', 'sun'],
        [30, false, null, 'next'],
        [100, false, null, 'next'],
        [365, false, null, 'next'],
      ],
    );
    assert.equal(screen.nextMilestone, 'Your next milestone is 7 days.');

    // Nothing anywhere says missed, and every line passes the streak copy rules.
    for (const said of everything(screen)) {
      assert.doesNotMatch(said, /\bmissed\b/i, `the screen says "${said}"`);
      assert.equal(streakGuiltIn(said), undefined, `"${said}" says "${streakGuiltIn(said) ?? ''}"`);
      assert.doesNotMatch(said, /[—–!]/, `"${said}" carries a dash or shouts`);
    }

    // A learner who practised today: lit, and today counts.
    const lit = screenOf(facts({ practiceDays: ['2026-10-06', TODAY] }));
    assert.equal(lit.hero.lit, true);
    assert.equal(lit.hero.today, 'Today counts. See you tomorrow.');
    // A learner with nothing yet: the lifetime line says how it starts.
    const fresh = screenOf(facts({ practiceDays: [] }));
    assert.equal(fresh.hero.count, 0);
    assert.equal(fresh.hero.lifetime, 'Your first day of French starts with practice.');
    assert.equal(fresh.hero.longest, null);
    // With no run going there is no nought: the words say how a streak starts,
    // to the eye and to a screen reader alike.
    assert.equal(fresh.hero.running, false);
    assert.equal(fresh.hero.words, 'Start a streak');
    assert.doesNotMatch(fresh.hero.label, /\b0\b|0-day/, 'a learner with no run is told "0 day streak"');
    assert.equal(screen.hero.running, true);
    assert.match(screen.hero.label, /^2-day streak\. 10 days you have practised\. Longest streak: 8 days\. Practise today to reach 3\.$/);
    assert.equal(fresh.month.canGoBack, false);

    // The screen: its own route with a web path, seven columns, labelled month
    // arrows at the touch floor, and every cell named in full.
    const screenFile = read('./StreakScreen.tsx');
    assert.match(screenFile, /<IconButton icon="back" label=\{GAME_COPY\.streakScreen\.previousMonth\} disabled=\{!month\.canGoBack\}/);
    assert.match(screenFile, /<IconButton icon="back" label=\{GAME_COPY\.streakScreen\.nextMonth\} disabled=\{!month\.canGoForward\}/);
    assert.equal(GAME_COPY.streakScreen.previousMonth, 'Previous month');
    assert.equal(GAME_COPY.streakScreen.nextMonth, 'Next month');
    assert.match(screenFile, /const COLUMN = `\$\{100 \/ 7\}%` as const;/, 'the calendar is not seven columns');
    assert.equal((screenFile.match(/accessible accessibilityLabel=\{cell\.label\}/g) ?? []).length, 2, 'a week or month cell is not named to a screen reader');
    assert.doesNotMatch(screenFile, /\b(?:streakFrom|weekStripFrom|monthFrom|capabilitiesFor)\(/, 'the screen works out a day itself');
    // The run is drawn where it stands on every visit (a count from nought
    // each time would claim a rise that did not happen), only while a run is
    // going, and drawn again on a new day so it never runs down.
    assert.match(screenFile, /\{hero\.running \? <CountUp key=\{view\.today\} from=\{hero\.count\} to=\{hero\.count\}/, 'the run counts up from nought on every visit');
    assert.match(screenFile, /<View style=\{\[st\.hero,[\s\S]*?accessible accessibilityLabel=\{hero\.label\}>/);
    assert.match(screenFile, /<C2Flame size=\{HERO_FLAME\} active=\{focused && hero\.lit\}/);
    assert.match(read('../nav/types.ts'), /Streak: undefined;/);
    assert.match(read('../nav/theme.ts'), /Streak: 'streak',/);
    assert.match(read('../nav/RootNavigator.tsx'), /<Stack\.Screen name="Streak" component=\{StreakScreen\} \/>/);
  });

  test('a free learner sees one calm repair line and a subscriber sees their freezes and repair', () => {
    // A run of three ended yesterday: the 6th went by with no practice.
    const broken = ['2026-10-03', '2026-10-04', '2026-10-05'];
    const todaySitting: ActivityEntry[] = [{ at: at(10, 7, 9), kind: 'drill', xp: 20, activeMs: 120_000 }];

    // A free learner, just after the reset: the one calm line and See plans.
    const free = screenOf(facts({ practiceDays: broken, billing: FREE }));
    assert.deepEqual(free.repairForSubscribers, { line: 'Subscribers can repair a streak within 2 days.', action: 'See plans' });
    assert.equal(free.freezes, null, 'a free learner is shown freezes');
    assert.equal(free.repair, null, 'a free learner is offered a repair');
    // Not after the window, not without a run that ended, not on an unknown plan.
    assert.equal(screenOf(facts({ practiceDays: ['2026-09-20', '2026-09-21'], billing: FREE })).repairForSubscribers, null, 'the line is said long after the reset');
    assert.equal(screenOf(facts({ practiceDays: ['2026-10-05', '2026-10-06'], billing: FREE })).repairForSubscribers, null, 'the line is said while the run is alive');
    assert.equal(screenOf(facts({ practiceDays: broken, billing: null })).repairForSubscribers, null, 'the line is said while the plan is unknown');
    assert.equal(screenOf(facts({ practiceDays: broken, billing: null })).freezes, null);

    // A subscriber: the freezes card, and the repair being earned (one of the
    // two practices done today), and never the free learner's line.
    const paid = screenOf(facts({ practiceDays: [...broken, TODAY], activity: todaySitting, billing: PAID }));
    assert.equal(paid.repairForSubscribers, null, 'a subscriber is sold a plan');
    assert.deepEqual(paid.freezes && [paid.freezes.title, paid.freezes.ready, paid.freezes.returns], ['Streak freezes', '2 ready', null]);
    assert.ok(paid.repair, 'a subscriber earning a repair is not shown it');
    assert.equal(paid.repair.title, 'Bring back your 3-day streak');
    assert.equal(paid.repair.progress, '1 of 2 practices done');
    assert.equal(paid.repair.line, 'Finish two practices within two days and it comes back.');

    // Both freezes in use: the day one comes back, from the real cover.
    const spent = screenOf(
      facts({
        practiceDays: ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'],
        covers: [
          { day: '2026-10-03', kind: 'freeze', at: at(10, 4, 1) },
          { day: '2026-10-04', kind: 'freeze', at: at(10, 5, 1) },
        ],
        billing: PAID,
      }),
    );
    assert.equal(spent.freezes?.ready, '0 ready');
    assert.equal(spent.freezes?.returns, 'Both freezes are in use. One comes back on Saturday 10 October.');

    // Calm: no countdown, no plea, no threat, in any line either learner reads.
    for (const view of [free, paid, spent]) {
      for (const said of everything(view)) {
        assert.equal(streakGuiltIn(said), undefined, `"${said}" says "${streakGuiltIn(said) ?? ''}"`);
        assert.equal(guiltIn(said), undefined);
        assert.doesNotMatch(said, /\b(?:hours?|minutes? left|tonight|hurry|last chance|save your)\b/i, `"${said}" counts down or pleads`);
      }
    }

    // The screen sends See plans to the plans page and schedules nothing.
    const screenFile = read('./StreakScreen.tsx');
    assert.match(screenFile, /screen\.repairForSubscribers !== null \?/);
    assert.match(screenFile, /label=\{screen\.repairForSubscribers\.action\} onPress=\{\(\) => nav\.navigate\('Wall', \{ entry: 'settings' \}\)\}/);
    assert.doesNotMatch(screenFile, /Notifications|scheduleNotification|reminders\//, 'the Streak screen schedules a notification');
    assert.match(screenFile, /\{screen\.freezes !== null \?/);
    assert.match(screenFile, /\{screen\.repair !== null \?/);
  });
});
