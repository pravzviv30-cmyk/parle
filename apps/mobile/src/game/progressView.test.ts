/**
 * Progress and Profile, from their own records (F769).
 *
 * The cards' models are folded from facts built the way the game layer reads
 * them, through `gameViewFrom`, so every number held here is one a phone would
 * draw from those records. The tabs are then held to drawing the cards in the
 * order README Part 5.F gives, each fed from its own read, and to working out
 * no level or XP of their own.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAILY_GOAL_TIERS, LEVEL_NAMES } from '@luvani/core';

import type { ActivityEntry } from '../progress/activity.ts';
import { emptyGame, type BadgeAward } from './model.ts';
import { GOAL_CHOICES, goalChoiceOf, profileStatsView } from './profileStatsView.ts';
import {
  NEXT_BADGES,
  badgeShelfView,
  countTiles,
  levelXpCardView,
  progressShowsGame,
  streakSummaryView,
} from './progressView.ts';
import { todayHeroView } from './todayHeroView.ts';
import { NO_OUTSIDE_FACTS, gameViewFrom, measuredMinutes, type BillingFacts, type GameFacts } from './view.ts';

const TODAY = '2026-10-07';
const at = (day: number, hour: number): number => new Date(2026, 9, day, hour).getTime();
const MIN = 60_000;

const read = (relative: string): string =>
  readFileSync(new URL(relative, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ');

const ACTIVITY: ActivityEntry[] = [
  { at: at(5, 9), kind: 'drill', xp: 40, activeMs: 4.5 * MIN },
  { at: at(6, 9), kind: 'review', xp: 30, activeMs: 3 * MIN },
  // Untimed: adds nothing to the minutes.
  { at: at(7, 9), kind: 'convo', xp: 60 },
];

function facts(badges: BadgeAward[] = [], billing: BillingFacts | null = null): GameFacts {
  return {
    activity: ACTIVITY,
    practiceDays: ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07'],
    game: { ...emptyGame(), badges },
    outside: { ...NO_OUTSIDE_FACTS, goalTarget: 10 },
    billing,
  };
}

const NEVER_SAID = /\b(?:locked|remaining|collect all|collect|missed|mastered|percent)\b/i;

describe('Progress from its own records — F769', () => {
  test('Progress leads with the level, the streak and real counts, each from its own record', () => {
    const view = gameViewFrom(facts([{ id: 'streak-7', at: at(3, 20) }, { id: 'first-conversation', at: null }]), TODAY);

    // The level: a number from the displayed XP (130: Level 3), never a rank.
    const level = levelXpCardView(view.level, view.xp)!;
    assert.equal(level.title, 'Level 3');
    assert.equal(level.total, 130);
    assert.equal(level.totalWords, '130 XP');
    assert.equal(level.next, `${view.level.toNext} XP to Level 4`);
    assert.equal(level.fraction, view.level.intoLevel / view.level.levelSpan);
    assert.equal(level.capped, null, 'a day under the cap is said to be capped');
    for (const name of LEVEL_NAMES) assert.ok(!level.label.includes(name), `the level card names the rank "${name}"`);
    assert.equal(levelXpCardView(null, view.xp), null, 'an unread level draws a card');
    assert.equal(levelXpCardView(view.level, null), null, 'unread XP draws a card');

    // The streak: the live run (three days up to today), the longest run and
    // this week from the same practice days. Never "missed".
    const run = streakSummaryView(view)!;
    assert.equal(run.count, 3);
    assert.equal(run.words, '3-day streak');
    assert.equal(run.longest, 'Longest streak: 3 days');
    assert.equal(run.week.length, 7);
    assert.deepEqual(
      run.week.map((cell) => cell.label),
      ['Monday, practised', 'Tuesday, practised', 'Wednesday, practised', 'Thursday, still to come', 'Friday, still to come', 'Saturday, still to come', 'Sunday, still to come'],
    );
    for (const cell of run.week) assert.doesNotMatch(cell.label, NEVER_SAID);
    assert.equal(streakSummaryView(null), null);

    // The counts: phrases and conversations from the tab's own reads, minutes
    // measured and floored over every finished sitting by the game view (the
    // untimed sitting adds nothing), practice days from the streak's lifetime
    // total.
    // 2026-10-07 (Phase 4 review): the minutes moved from the tab's own sum
    // of the activity log to the game view, so a zero-XP sitting the game
    // store keeps (a daily phrase) counts here as it does on Home's ring.
    assert.equal(view.minutesPractised, 7);
    assert.equal(measuredMinutes([{ activeMs: Number.NaN }, { activeMs: -5 * MIN }, {}]), 0, 'an unmeasured sitting counted as minutes');
    const tiles = countTiles({ phrases: 12, conversations: 2, minutes: view.minutesPractised, days: view.streak.lifetimeDays });
    assert.deepEqual(
      tiles.map((tile) => [tile.words, tile.value, tile.opens]),
      [
        ['Phrases kept', 12, 'Phrasebook'],
        ['Conversations', 2, 'Conversations'],
        ['Minutes practised', 7, 'Streak'],
        ['Practice days', 5, 'Streak'],
      ],
    );
    assert.equal(countTiles({ phrases: 1, conversations: 0, minutes: 0, days: null }).length, 3, 'unread practice days are drawn as a count');
    assert.deepEqual(
      countTiles({ phrases: 1, conversations: 0, minutes: null, days: 4 }).map((tile) => tile.id),
      ['phrases', 'conversations', 'days'],
      'unread minutes are drawn as a count',
    );

    // One daily phrase, a zero-XP sitting the game store keeps with its
    // measured time: Home's ring and Progress's minutes say the same.
    const phraseOnly = gameViewFrom(
      { ...facts(), activity: [], game: { ...emptyGame(), sittings: [{ at: at(7, 8), source: 'phrase', activeMs: 3 * MIN + 20_000 }] } },
      TODAY,
    );
    const ring = todayHeroView({ streak: phraseOnly.streak, goal: phraseOnly.goal, level: phraseOnly.level, xp: phraseOnly.xp })!;
    assert.equal(ring.goal.minutes, 3);
    assert.equal(ring.goal.words, '3 of 10 min today');
    const phraseTile = countTiles({ phrases: 0, conversations: 0, minutes: phraseOnly.minutesPractised, days: null }).find((tile) => tile.id === 'minutes');
    assert.equal(phraseTile?.value, 3, "Progress's minutes leave out the daily phrase that Home's ring counts");

    // The badges: earned newest first, with the date or the honest "counted
    // from saved practice"; at most three ahead, each with how it is earned.
    const shelf = badgeShelfView(view.badges)!;
    assert.deepEqual(shelf.earned.map((badge) => [badge.title, badge.when]), [
      ['One week', 'Earned 3 October 2026'],
      ['First conversation', 'Counted from practice already saved'],
    ]);
    assert.equal(shelf.next.length, NEXT_BADGES);
    assert.ok(shelf.next.every((badge) => badge.medal === 'next' && badge.when === null));
    assert.equal(shelf.next[0]!.line, 'Reach a 30-day streak');
    for (const badge of [...shelf.earned, ...shelf.next]) {
      for (const said of [badge.title, badge.line, badge.label, badge.when ?? '']) assert.doesNotMatch(said, NEVER_SAID, `the shelf says "${said}"`);
    }
    assert.equal(shelf.empty, null);
    assert.equal(badgeShelfView([])!.empty, 'Badges you earn show here.');
    assert.equal(badgeShelfView(null), null);

    // The cards are drawn once there is practice to show, never empty on a
    // first visit, and never hidden from a learner who has practised.
    assert.equal(progressShowsGame(true, 0), false);
    assert.equal(progressShowsGame(true, null), false);
    assert.equal(progressShowsGame(true, 2), true);
    assert.equal(progressShowsGame(false, null), true);

    // The tab: the cards in order, each from its own read, the CEFR card the
    // one pill after them, the postcard shelf, then the tiled rows.
    const tab = read('../tabs/MyFrenchTab.tsx');
    const order = ['<TabHeader', '<LevelXpCard />', '<StreakSummaryCard><DayCount weekly /></StreakSummaryCard>', '<CountsGrid', '<BadgeShelf />', '<LevelCard', '<PostcardShelf', 'rows.map('];
    for (let i = 1; i < order.length; i += 1) {
      const before = tab.indexOf(order[i - 1]!);
      const after = tab.indexOf(order[i]!);
      assert.ok(before !== -1 && after !== -1 && before < after, `${order[i - 1]} is not drawn before ${order[i]}`);
    }
    assert.match(tab, /const gameCards = renderStatus === 'ready' && showsGame;/, 'the game cards are drawn before the tab has read, or on an empty first visit');
    assert.match(tab, /\{gameCards && \(/);
    assert.match(tab, /const showsGame = progressShowsGame\(firstVisit, run === null \? null : run\.lifetimeDays\);/);
    // The weekly day line reads its own record, so it is drawn on its own
    // whenever the game cards are not (loading, a failed read, a first visit).
    assert.match(tab, /\{!gameCards && <DayCount weekly \/>\}/, 'the weekly day line hides whenever the game cards do');
    assert.equal((tab.match(/<DayCount weekly \/>/g) ?? []).length, 2);
    // The minutes are the game view's, the ring's own fold, not a sum the tab makes.
    assert.match(tab, /<CountsGrid phrases=\{kept\.phrases\} conversations=\{kept\.conversations\} \/>/);
    assert.doesNotMatch(tab, /minutesPractised|activeMs/, 'the tab sums the minutes itself');
    assert.match(read('./CountsGrid.tsx'), /const minutes = useMinutesPractised\(\);/, 'the minutes tile does not read the game view');
    assert.match(tab, /<PostcardShelf postcards=\{postcards\} onOpen=\{\(\) => nav\.navigate\('Postcards'\)\} \/>/);
    assert.doesNotMatch(tab, /<LedgerRow[^>]*title="Place postcards"/, 'the postcards are still a ledger row beside the shelf');
    assert.match(tab, /glyph=\{<IconTile ground="skeleton" name=\{rowTile\(row\.kind\)\} size=\{ROW_TILE\} \/>\}/, 'the rows are not led by their tiles');
    assert.doesNotMatch(tab, /\b(?:levelFor|xpLevelFor|totalXp|displayXp)\(/, 'the tab works out a level or an XP total itself');
    // The level card reads the hooks, and only the hooks.
    const card = read('./LevelXpCard.tsx');
    assert.match(card, /levelXpCardView\(useLevel\(\), useXp\(\)\)/);
    assert.doesNotMatch(card, /\b(?:levelFor|xpLevelFor|totalXp|displayXp)\(/);
    // A screen reader hears the card's head as one element, and that element
    // is the header: a role on a Text inside an accessible View is never heard.
    assert.match(card, /<View style=\{st\.head\} accessible accessibilityRole="header" accessibilityLabel=\{card\.label\}>/, "the level card's header is not heard as a header");
    assert.equal((card.match(/accessibilityRole="header"/g) ?? []).length, 1, 'a header role sits inside the accessible head, where it is never heard');
  });

  test('Profile shows the run and the level as two tiles, a subscriber\'s freezes, and the goal as five choices', () => {
    const free = gameViewFrom(facts(), TODAY);
    const stats = profileStatsView({ streak: free.streak, level: free.level, freezes: free.freezes, protection: free.protection })!;
    assert.deepEqual(stats.tiles.map((tile) => [tile.id, tile.value, tile.opens]), [['streak', '3', 'Streak'], ['level', '3', 'MyFrench']]);
    assert.equal(stats.freezes, null, 'an unknown plan is shown freezes');
    const paid = gameViewFrom(facts([], { plan: 'regular', lapsed: false, secondsRemaining: 600, canStart: true }), TODAY);
    const subscriber = profileStatsView({ streak: paid.streak, level: paid.level, freezes: paid.freezes, protection: paid.protection })!;
    assert.equal(subscriber.freezes?.ready, '2 ready');
    const trial = gameViewFrom(facts([], { plan: 'trial', lapsed: false, secondsRemaining: 600, canStart: true }), TODAY);
    assert.equal(profileStatsView({ streak: trial.streak, level: trial.level, freezes: trial.freezes, protection: trial.protection })!.freezes, null, 'a free learner is shown freezes');
    assert.equal(profileStatsView({ streak: null, level: null, freezes: null, protection: null }), null);

    // No goal, then core's four tiers, gentlest first, sizes in words.
    assert.deepEqual(GOAL_CHOICES.map((choice) => choice.title), ['No goal', 'Casual', 'Regular', 'Serious', 'Intense']);
    assert.deepEqual(GOAL_CHOICES.map((choice) => choice.minutes), [null, ...DAILY_GOAL_TIERS.map((tier) => tier.minutes)]);
    for (const choice of GOAL_CHOICES) {
      assert.doesNotMatch(`${choice.title} ${choice.detail}`, /\d/, `"${choice.detail}" counts at somebody in a settings choice`);
      assert.equal(goalChoiceOf(choice.minutes), choice.key);
    }
    assert.equal(goalChoiceOf(7), 'none');

    // P2 (2026-10-19): Profile says the level and the practice days on its
    // Progress row, and the goal's five choices are on Learning preferences.
    const tab = read('../tabs/ProfileTab.tsx');
    assert.match(tab, /level: level\?\.level \?\? null/, 'the Progress row does not read the level from the game view');
    assert.match(tab, /label=\{PROGRESS_ROW\}/, 'Profile has no Progress row');
    const prefs = read('../settings/LearningPreferencesScreen.tsx');
    assert.match(prefs, /GOAL_CHOICES\.map\(\(choice\) => \(\s*<Choice/, 'the goal is not drawn as the five choices');
    assert.match(prefs, /selected=\{goalChoiceOf\(dailyGoalOf\(profile\)\) === choice\.key\}/);
    assert.match(prefs, /onPress=\{\(\) => update\(withDailyGoal\(profile, choice\.minutes\)\)\}/);
    assert.doesNotMatch(prefs, /Days a week|reminderDays|daysAWeek/, 'the days-a-week question is back');
    assert.doesNotMatch(tab, /Days a week|reminderDays|daysAWeek/, 'the days-a-week question is back');
    const tiles = read('./ProfileStats.tsx');
    assert.match(tiles, /profileStatsView\(\{ streak: run, level: useLevel\(\)/);
    assert.doesNotMatch(tiles, /\b(?:levelFor|xpLevelFor|totalXp|displayXp|capabilitiesFor)\(/);
  });
});
