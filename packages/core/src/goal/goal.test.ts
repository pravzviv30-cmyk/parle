import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DAILY_GOAL_TIERS, goalProgressFrom, goalTierFor, isDailyGoalMinutes } from './goal.ts';

process.env.TZ = 'Europe/Paris';

const at = (day: string, hourUtc = 10) => Date.parse(`${day}T${`${hourUtc}`.padStart(2, '0')}:00:00Z`);

describe('the daily goal', () => {
  test('the four tiers are Casual, Regular, Serious and Intense at 5, 10, 15 and 20 minutes', () => {
    assert.deepEqual(
      DAILY_GOAL_TIERS.map((t) => [t.id, t.minutes, t.label]),
      [
        ['casual', 5, 'Casual'],
        ['regular', 10, 'Regular'],
        ['serious', 15, 'Serious'],
        ['intense', 20, 'Intense'],
      ],
    );
    assert.equal(goalTierFor(20)?.id, 'intense');
    assert.equal(goalTierFor(null), null);
    assert.equal(goalTierFor(7), null);
    assert.ok(isDailyGoalMinutes(15) && !isDailyGoalMinutes(12) && !isDailyGoalMinutes('10'));
    for (const tier of DAILY_GOAL_TIERS) {
      assert.ok(!/[—–·]/.test(`${tier.label} ${tier.line}`), `${tier.id} uses a dash or a middot`);
    }
  });

  test("today's goal minutes count only measured active time", () => {
    const today = '2026-10-05';
    const progress = goalProgressFrom({
      today,
      target: 10,
      sittings: [
        { at: at(today, 8), activeMs: 270_000 }, // 4 min 30 s
        { at: at(today, 9), activeMs: 329_000 }, // 5 min 29 s, so 9 min 59 s in all
        { at: at(today, 11) }, // measured nothing
        // Wall-clock length is not practice time, whatever the record carries beside it.
        { at: at(today, 12), durationMs: 1_800_000 } as { at: number },
        { at: at('2026-10-04', 12), activeMs: 1_200_000 }, // yesterday
      ],
    });
    assert.equal(progress.activeMs, 599_000);
    assert.equal(progress.minutes, 9, 'minutes are floored: 9 min 59 s is 9, never 10');
    assert.equal(progress.met, false, 'a goal is met by time spent, never by rounding');
    assert.equal(progress.untimed, true, 'an unmeasured sitting is named, not read as nought');

    // Only untimed sittings: no minutes counted, and the day says why.
    const unmeasured = goalProgressFrom({ today, target: 5, sittings: [{ at: at(today) }] });
    assert.deepEqual(unmeasured, { activeMs: 0, minutes: 0, target: 5, met: false, untimed: true });

    // Nothing at all is simply nothing, and not untimed.
    const empty = goalProgressFrom({ today, target: 5, sittings: [] });
    assert.equal(empty.untimed, false);
  });

  test('a goal is met only when one is set, and at exactly its minutes', () => {
    const today = '2026-10-05';
    const tenMinutes = [{ at: at(today), activeMs: 600_000 }];
    assert.equal(goalProgressFrom({ today, target: 10, sittings: tenMinutes }).met, true);
    assert.equal(goalProgressFrom({ today, target: 15, sittings: tenMinutes }).met, false);
    const none = goalProgressFrom({ today, target: null, sittings: tenMinutes });
    assert.equal(none.met, false);
    assert.equal(none.minutes, 10);
    assert.equal(none.target, null);
  });

  test('today is the local date, so a late sitting counts for the day it finished', () => {
    // 22:30 UTC on the 4th is 00:30 on the 5th in Paris.
    const late = Date.UTC(2026, 9, 4, 22, 30);
    const progress = goalProgressFrom({ today: '2026-10-05', target: 5, sittings: [{ at: late, activeMs: 300_000 }] });
    assert.equal(progress.minutes, 5);
    assert.equal(progress.met, true);
    // A garbled measurement is unmeasured, never negative.
    const garbled = goalProgressFrom({ today: '2026-10-05', target: 5, sittings: [{ at: late, activeMs: Number.NaN }, { at: late, activeMs: -60_000 }] });
    assert.equal(garbled.activeMs, 0);
    assert.equal(garbled.untimed, true);
  });
});
