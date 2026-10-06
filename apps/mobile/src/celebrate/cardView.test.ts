/**
 * What a takeover card says (F743): words from the copy contract, numbers from
 * the moment's own data, and a level that is a number and never a rank name.
 * And the purchase moment's key, which must name one purchase the same way on
 * every device.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_NAMES } from '@luvani/core';

import { streakGuiltIn } from '../copy/guilt.ts';
import { GAME_COPY } from '../game/copy.ts';
import { isSeenKey } from '../game/model.ts';
import { WALL_READY } from '../wall/wallCopy.ts';
import { celebrationKey, isRememberedInSeen, type CelebrationEvent } from './events.ts';
import { cardView, rowFor, spoken, type CardView } from './cardView.ts';
import { purchaseMoment, purchaseTransactionId } from './purchaseMoment.ts';
import { planBurst, type TakeoverCard } from './queue.ts';

const AT = 1_791_000_000_000;
const streak = (current: number, lifetimeDays: number, day = '2026-10-06'): CelebrationEvent => ({ type: 'streak-extended', key: celebrationKey.streak(day), origin: 'account', at: AT, data: { day, current, lifetimeDays } });
const milestone = (n: number): CelebrationEvent => ({ type: 'streak-milestone', key: celebrationKey.milestone(n, '2025-01-01'), origin: 'account', at: AT, data: { day: '2026-10-06', current: n, lifetimeDays: n + 20, milestone: n, runStart: '2025-01-01' } });
const chest = (xp: number): CelebrationEvent => ({ type: 'quest-chest', key: celebrationKey.chest('2026-10-06'), origin: 'account', at: AT, data: { day: '2026-10-06', xp } });
const level = (before: number, to: number): CelebrationEvent => ({ type: 'level-up', key: celebrationKey.level(to), origin: 'account', at: AT, data: { before, level: to } });
const badge = (id: string): CelebrationEvent => ({ type: 'badge-earned', key: celebrationKey.badge(id), origin: 'account', at: AT, data: { id } });

function cardOf(events: readonly CelebrationEvent[], budget = 3): TakeoverCard {
  const [first] = planBurst(events, budget);
  assert.ok(first, 'nothing to show');
  return { ...first, id: 'card-1' };
}

function everyString(view: CardView): string[] {
  return [view.title, ...(view.titleBefore === null ? [] : [view.titleBefore]), ...view.lines, ...view.rows, view.announce, ...(view.hero === null ? [] : [view.hero.unit])];
}

const views: CardView[] = [
  cardView(cardOf([streak(1, 1)])),
  cardView(cardOf([streak(12, 240)])),
  ...[7, 30, 100, 365, 730].map((n) => cardView(cardOf([milestone(n)]))),
  cardView(cardOf([chest(15)])),
  cardView(cardOf([level(1, 2)])),
  cardView(cardOf([badge('streak-7')])),
  cardView(cardOf([badge('streak-7'), badge('first-conversation'), badge('quests-2026-10')])),
  cardView(cardOf([purchaseMoment({ plan: 'starter', periodEnd: '2026-11-06T10:00:00.000Z' }, AT)!])),
  // The last card of a burst, with the rest as rows.
  cardView(cardOf([streak(4, 9), chest(15), level(5, 6), badge('goal-7'), badge('scene-own')], 1)),
];

describe('what a celebration card says — F743', () => {
  test('every line a card says states a fact and never threatens', () => {
    for (const view of views) {
      for (const line of everyString(view)) {
        assert.equal(streakGuiltIn(line), undefined, `"${line}" says "${streakGuiltIn(line) ?? ''}", which a celebration may never say`);
        assert.doesNotMatch(line, /[—–·]/, `"${line}" carries a dash or a middot`);
        assert.doesNotMatch(line, /\bin a row\b/i, `"${line}" claims days in a row, but covered days bridge a run (F741)`);
        assert.doesNotMatch(line, /!/, `"${line}" shouts`);
        for (const name of LEVEL_NAMES) assert.ok(!line.includes(name), `"${line}" names a rank, and levels are numbers`);
      }
      assert.ok(view.title.trim().length > 0, 'a card has no title to focus or announce');
      assert.ok(view.announce.startsWith(view.title.replace(/\.$/, '')), `"${view.announce}" does not lead with the card's title`);
    }
  });

  test('every number a card shows is the moment\'s own', () => {
    const run = cardView(cardOf([streak(12, 240)]));
    assert.deepEqual(run.hero, { value: 12, unit: GAME_COPY.streak.label });
    assert.deepEqual(run.lines, [GAME_COPY.streak.lifetime(240)], 'the lifetime count beside the run is not the stored one');
    assert.equal(run.announce, 'You practised today. 12 day streak');
    assert.equal(cardView(cardOf([streak(1, 1)])).title, GAME_COPY.streak.line(1));

    const week = cardView(cardOf([milestone(7)]));
    assert.equal(week.ground, 'coral');
    assert.deepEqual(week.hero, { value: 7, unit: GAME_COPY.streak.label });
    assert.equal(week.title, 'A whole week of French.');

    const box = cardView(cardOf([chest(15)]));
    assert.deepEqual(box.lines, ["+15 XP from today's chest."]);

    const medals = cardView(cardOf([badge('streak-7'), badge('first-conversation')]));
    assert.equal(medals.title, 'One week, First conversation');
    assert.deepEqual(medals.lines, ['You reached a 7-day streak.', 'You finished your first conversation.']);
    assert.equal(medals.badges.length, 2);

    const paid = cardView(cardOf([purchaseMoment({ plan: 'regular', periodEnd: '2026-11-06T10:00:00.000Z' }, AT)!]));
    assert.equal(paid.title, WALL_READY);
    assert.equal(paid.hero, null, 'a purchase card shows a number the moment does not carry');
    assert.deepEqual(paid.lines, []);
  });

  test('a level card says the number from the moment and never a rank name', () => {
    const view = cardView(cardOf([level(3, 4)]));
    assert.equal(view.title, 'Level 4');
    assert.equal(view.titleBefore, 'Level 3', 'the number does not change from the level the learner had');
    assert.deepEqual(view.lines, [GAME_COPY.level.line]);
    assert.equal(view.ground, 'blue');
    assert.equal(cardView(cardOf([level(2, 3), level(3, 5)])).titleBefore, 'Level 2', 'two levels in one sitting do not count from the first');
  });

  test('the rows under "Also today" name what did not get a card of its own', () => {
    const last = cardView(cardOf([streak(4, 9), chest(15), level(5, 6), badge('goal-7'), badge('scene-own')], 1));
    assert.equal(last.title, GAME_COPY.streak.line(4));
    assert.deepEqual(last.rows, [GAME_COPY.chest.title, 'Level 6', 'Badge: Goal met 7 times', 'Badge: On your own']);
    assert.equal(rowFor(streak(9, 20)), '9 day streak');
    assert.equal(rowFor(badge('nothing-like-this')), null);
    assert.equal(spoken(['Level 4', 'Earned from the French you produced.']), 'Level 4. Earned from the French you produced.');
    assert.equal(spoken(['You practised today.', null, '5 day streak']), 'You practised today. 5 day streak');
  });

  test('a confirmed purchase is keyed by its confirmed plan and period, so it plays once on every device', () => {
    const grant = { plan: 'regular', periodEnd: '2026-11-06T10:00:00.000Z' } as const;
    const here = purchaseMoment(grant, AT);
    const there = purchaseMoment(grant, AT + 5000);
    assert.ok(here && there);
    assert.equal(here.key, there.key, 'two devices confirming one purchase would each play it');
    assert.equal(here.key, `purchase:regular.${Date.parse(grant.periodEnd)}`);
    assert.ok(isSeenKey(here.key), 'the synced seen list would refuse the purchase key, so it would replay');
    assert.equal(isRememberedInSeen(here), true);
    assert.notEqual(purchaseMoment({ plan: 'regular', periodEnd: '2026-12-06T10:00:00.000Z' }, AT)!.key, here.key, 'a later period is a different purchase');
    assert.equal(purchaseTransactionId({ plan: 'trial', periodEnd: '2026-11-06T10:00:00.000Z' }), null, 'the free trial is never a purchase');
    assert.equal(purchaseTransactionId({ plan: 'starter', periodEnd: null }), null);
    assert.equal(purchaseTransactionId({ plan: 'starter', periodEnd: 'soon' }), null);
  });
});
