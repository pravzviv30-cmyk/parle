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

import { banksPracticeFor, learnerRepliesOf, recapUse, sessionCredit } from './sessionCredit.ts';
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
    assert.match(convo, /const credit = sessionCredit\(stats, carriedRepliesRef\.current\);/);
    assert.match(read('../RecapScreen.tsx'), /credit\.showPhrases \? recap\.phrases\.length/, 'the end card counts phrases without asking for a reply');
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

  test('a scene with no learner reply settles nothing: no active day, no streak, no minutes, no XP', () => {
    const silent = sessionCredit({ turns: 5, rescues: 5, unassistedRate: 1, learnerReplies: 0 });
    assert.equal(silent.settles, false, 'a silent scene still records a day');
    assert.equal(silent.line, MADE_TIME_FOR_FRENCH, 'the end card stops saying it made time');
    assert.equal(sessionCredit({ turns: 5, rescues: 1, unassistedRate: 1, learnerReplies: 2 }).settles, true);
    assert.equal(sessionCredit({ turns: 5, rescues: 1, unassistedRate: 1 }).settles, true, 'an older agent lost its settle');
    // Replies carried from the typed part of a switched scene count (F903).
    assert.equal(sessionCredit({ turns: 3, rescues: 3, unassistedRate: 1, learnerReplies: 0 }, 2).settles, true);
    // The screen skips the settle for it, and the end card still draws.
    const convo = read('../ConvoScreen.tsx');
    assert.match(convo, /if \(use\.settle\) \{/, 'the recap effect settles without asking');
  });

  test('a scene with no learner reply banks no practice by any path', () => {
    const silent = { turns: 5, rescues: 5, unassistedRate: 1, learnerReplies: 0 };
    assert.equal(banksPracticeFor(silent, 0), false);
    assert.equal(banksPracticeFor({ ...silent, learnerReplies: 1 }, 0), true);
    assert.equal(banksPracticeFor({ turns: 1, rescues: 0, unassistedRate: 1 }, 0), true, 'an older agent lost its practice');
    assert.equal(banksPracticeFor(null, 0), true, 'practice with no recap yet is today\'s path');
    assert.equal(banksPracticeFor(silent, 1), true);
    // Every app path that banks asks: the practice message, the recovered recap phrases (Leave and the switch).
    const convo = read('../ConvoScreen.tsx');
    assert.match(convo, /if \(!live\.practice \|\| practiceBankedRef\.current \|\| stopped\) return;\s*if \(!banksPracticeFor\(live\.recap\?\.recap\.stats \?\? null, carriedRepliesRef\.current\)\) return;/);
    assert.match(convo, /if \(!stopped && !practiceBankedRef\.current && live\.recap && banksPracticeFor\(live\.recap\.recap\.stats, carriedRepliesRef\.current\)\) \{/);
  });

  test('a scene with no learner reply offers no saved conversation text', () => {
    assert.equal(sessionCredit({ turns: 2, rescues: 2, unassistedRate: 1, learnerReplies: 0 }).savesText, false);
    assert.equal(sessionCredit({ turns: 2, rescues: 0, unassistedRate: 1, learnerReplies: 1 }).savesText, true);
    assert.equal(sessionCredit({ turns: 2, rescues: 0, unassistedRate: 1 }).savesText, true);
    assert.match(read('../ConvoScreen.tsx'), /conversationText=\{credit\.savesText \? \{ ownerId: userId,/);
  });

  test('the typed part of a switched scene banks its lines but is not a finished sitting', () => {
    const credit = sessionCredit({ turns: 4, rescues: 0, unassistedRate: 1, learnerReplies: 2 });
    assert.deepEqual(recapUse(credit, 'switch'), { settle: false, track: false });
    assert.deepEqual(recapUse(credit, 'end'), { settle: true, track: true });
    const silent = sessionCredit({ turns: 4, rescues: 4, unassistedRate: 1, learnerReplies: 0 });
    assert.deepEqual(recapUse(silent, 'end'), { settle: false, track: true });
    assert.deepEqual(recapUse(silent, 'switch'), { settle: false, track: false });
    const convo = read('../ConvoScreen.tsx');
    assert.match(convo, /const use = recapUse\(credit, switchingRef\.current \? 'switch' : 'end'\);/);
    assert.match(convo, /if \(use\.track\) void trackProductEvent\(sessionFinishedEvent\(/);
  });

  test('replies carried from a typed start still earn the scene its credit after switching to voice', () => {
    // Two replies typed, a switch, then silence in the voice room: the voice agent counts 0.
    const voice = { turns: 3, rescues: 3, unassistedRate: 1, learnerReplies: 0 };
    const credit = sessionCredit(voice, 2);
    assert.equal(credit.showPhrases, true, 'the end card hid the phrases of a learner who replied');
    assert.equal(credit.settles, true);
    assert.notEqual(credit.line, MADE_TIME_FOR_FRENCH, 'the end card says no conversation was held');
    assert.equal(sessionCredit(voice, 0).line, MADE_TIME_FOR_FRENCH);
    // An older agent with no count keeps today's fallback, whatever was carried.
    assert.equal(sessionCredit({ turns: 6, rescues: 2, unassistedRate: 0.8 }, 2).line, recapLine({ turns: 6, rescues: 2, unassistedRate: 0.8 }));
    // The end card and the settle read the same rule with the same carried count.
    const card = read('../RecapScreen.tsx');
    assert.match(card, /const credit = sessionCredit\(recap\.stats, carriedReplies\);/, 'the end card decides credit without the typed replies');
    assert.match(card, /phrases: credit\.showPhrases \? recap\.phrases\.length : 0/);
    assert.match(card, /\{credit\.line\}/, 'the end card works its line out apart from the credit');
    assert.match(read('../ConvoScreen.tsx'), /carriedReplies=\{carriedRepliesRef\.current\}/, 'the screen does not hand the end card the typed replies');
  });
});
