/**
 * The first run's new words (come alive, README Part 5.C rows 1 to 8) held to
 * the house rules: warm plain English, no em dash, en dash or middot, nothing
 * a streak could nag with, and no French praise in the interface (founder
 * decision D14). The French a learner practises is not interface copy and is
 * not in these lists.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { streakGuiltIn } from '../../copy/guilt.ts';
import { REASONS, START_LEVELS } from '../plan.ts';
import { FIRST_RUN_COPY, FIRST_RUN_LINES, SLOW_CHECK_MS, TAKE_CAP_SECONDS, exchangeLabel, takeLength } from './copy.ts';
import { NEXT_LABEL, NEXT_OFF_HINT } from './nextFace.ts';
import { GOAL_TIERS, planToken, tierLabel, tierLine } from './planModel.ts';
import { freshPreAccountDraft } from '../preAccountDraft.ts';

/** Praise a French interface would reach for. The tutor may say these in French; the app does not (D14). */
const FRENCH_PRAISE = /\b(bravo|bien jou[ée]|parfait|super|g[ée]nial|tr[èe]s bien|formidable|magnifique|chapeau|f[ée]licitations|excellent)\b/i;

function lines(): string[] {
  const draft = freshPreAccountDraft();
  const tokens = [
    ...(['coffee', 'tea'] as const).map((drink) => planToken({ ...draft, drink }, 'drink')),
    ...REASONS.map((r) => planToken({ ...draft, reason: r.key }, 'reason')),
    ...START_LEVELS.map((l) => planToken({ ...draft, startLevel: l.key }, 'level')),
    ...([5, 10, 15, 20, 'none'] as const).map((minutes) => planToken({ ...draft, minutes }, 'goal')),
  ].map((token) => token?.label ?? '');
  return [
    ...FIRST_RUN_LINES,
    NEXT_LABEL,
    NEXT_OFF_HINT,
    ...REASONS.map((r) => r.title),
    ...START_LEVELS.flatMap((l) => [l.title, l.gloss]).filter((line) => line !== ''),
    ...GOAL_TIERS.flatMap((tier) => [tier.title, tierLine(tier.minutes), tierLabel(tier, true)]),
    ...tokens,
    exchangeLabel(0, 3),
  ];
}

describe('the first run speaks plainly', () => {
  test("the first run's new lines are warm plain English with no dash, no middot and no French praise", () => {
    const all = lines();
    assert.ok(all.length > 40, 'the copy list is missing most of the first run');
    for (const line of all) {
      assert.ok(line.trim().length > 0, 'an empty line is in the copy list');
      assert.equal(streakGuiltIn(line), undefined, `"${line}" nags or scolds (${streakGuiltIn(line)})`);
      assert.doesNotMatch(line, /[—–·]/, `"${line}" has a dash or a middot`);
      assert.doesNotMatch(line, FRENCH_PRAISE, `"${line}" praises in French`);
      assert.doesNotMatch(line, /!/, `"${line}" shouts`);
    }
    // The words the brief and the founder chose, exactly.
    assert.equal(FIRST_RUN_COPY.goalWhy, 'Last question. You can change it any time.');
    assert.equal(FIRST_RUN_COPY.streakLine, 'Any finished practice counts for your streak, even offline.');
    assert.equal(FIRST_RUN_COPY.stillChecking, 'Still checking. A slow connection can take a few seconds.');
    assert.equal(FIRST_RUN_COPY.exactlyNatural, 'Exactly the natural way.');
    assert.equal(FIRST_RUN_COPY.chooseEachTime, 'Choose each time');
    assert.deepEqual(GOAL_TIERS.map((t) => t.title), ['Casual', 'Regular', 'Serious', 'Intense']);
    assert.ok(REASONS.some((r) => r.key === 'because' && r.title === 'Just exploring'), 'Just exploring is not the sixth answer');
    assert.equal(START_LEVELS.length, 3, 'the level question gained or lost an answer');
    assert.match(START_LEVELS[0]!.gloss, /^Also right if you are not sure/);
    assert.ok(!all.some((line) => /not sure/i.test(line) && line !== START_LEVELS[0]!.gloss), 'an "I am not sure" answer came back');

    // Honest waits: the slow line comes after a real wait, the take is counted against its real cap.
    assert.equal(SLOW_CHECK_MS, 4000);
    assert.equal(TAKE_CAP_SECONDS, 20);
    assert.equal(takeLength(8.7), '8 of 20 seconds');
    assert.equal(takeLength(-3), '0 of 20 seconds');
    assert.equal(takeLength(45), '20 of 20 seconds');
  });
});
