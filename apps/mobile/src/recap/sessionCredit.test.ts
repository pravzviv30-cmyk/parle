/**
 * Turns earn credit (F904, founder decision 2026-10-28).
 *
 * A scene the learner never replied in is time set aside, not a conversation:
 * no XP, no "new phrases", no claim. `stats.turns` counts silence rescues too,
 * which is how a rescued silence used to earn "7 new phrases, +39 XP", so the
 * decision reads the agent's `learnerReplies` and falls back only when an
 * older agent did not send one.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { learnerRepliesOf, sessionCredit } from './sessionCredit.ts';
import { MADE_TIME_FOR_FRENCH, recapLine } from '../tutor/recapLine.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('turns earn credit — F904', () => {
  test('the end card awards no new phrases and no content XP when the learner never replied', () => {
    // Seven rescues, seven phrases the tutor modelled, not one learner reply.
    const stats = { turns: 7, rescues: 7, unassistedRate: 1, learnerReplies: 0 };
    const credit = sessionCredit(stats);
    assert.equal(credit.earns, false, 'a silent scene banked XP');
    assert.equal(credit.showPhrases, false, 'a silent scene still claims new phrases');
    assert.equal(credit.line, MADE_TIME_FOR_FRENCH);
    assert.equal(recapLine(stats), MADE_TIME_FOR_FRENCH, 'the recap line claims a conversation nobody held');
    assert.equal(learnerRepliesOf(stats), 0);

    // One reply is enough to earn today's credit.
    const replied = sessionCredit({ ...stats, learnerReplies: 1 });
    assert.equal(replied.earns, true);
    assert.equal(replied.showPhrases, true);

    // And the screens read it: the XP banked and the phrases tile.
    const convo = read('../ConvoScreen.tsx');
    assert.match(convo, /const xp = credit\.earns \? conversationXp\(/, 'the recap effect no longer asks whether turns earned credit');
    assert.match(convo, /const credit = sessionCredit\(stats\);/);
    assert.match(read('../RecapScreen.tsx'), /sessionCredit\(recap\.stats\)\.showPhrases/, 'the end card counts phrases without asking for a reply');
  });

  test('a recap from an older agent without a reply count keeps today\'s wording', () => {
    const stats = { turns: 6, rescues: 2, unassistedRate: 0.8 };
    assert.equal(learnerRepliesOf(stats), null);
    const credit = sessionCredit(stats);
    assert.equal(credit.earns, true);
    assert.equal(credit.showPhrases, true);
    assert.equal(credit.line, recapLine(stats));
    assert.notEqual(credit.line, MADE_TIME_FOR_FRENCH);
    // A malformed count is treated as absent, never as evidence.
    for (const learnerReplies of [-1, 0.5, Number.NaN]) assert.equal(learnerRepliesOf({ ...stats, learnerReplies }), null);
  });
});
