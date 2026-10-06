/**
 * The hand-off after the first run (come alive, README Part 5.C row 11).
 *
 * "Saved to your phrasebook." is said only once the phrasebook write is
 * durable, keyed by the stored phrase and never the learner's text; the time
 * with the tutor is the server's answer, free only on the free allowance; and
 * the app is told whether the practice was kept. The words are run; the screen
 * is read as source, because there is no renderer in this suite.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../test/evidence.ts';
import { streakGuiltIn } from '../copy/guilt.ts';
import { tutorTimeLine } from './firstRun/copy.ts';

describe('the hand-off', () => {
  test('the hand-off says a phrase is saved only after the durable write, and the time the server holds', () => {
    // The time with the tutor, from the server's seconds, rounded down, and
    // never a countdown: nothing when none is held, free only on the free allowance.
    assert.equal(tutorTimeLine(0, true), null);
    assert.equal(tutorTimeLine(-5, null), null);
    assert.equal(tutorTimeLine(Number.NaN, true), null);
    assert.equal(tutorTimeLine(45, true), 'You have less than a minute with your AI tutor.');
    assert.equal(tutorTimeLine(60, true), 'You have 1 free minute with your AI tutor.');
    assert.equal(tutorTimeLine(1799, true), 'You have 29 free minutes with your AI tutor.');
    assert.equal(tutorTimeLine(10800, false), 'You have 180 minutes with your AI tutor on your plan.');
    assert.equal(tutorTimeLine(600, null), 'You have 10 minutes with your AI tutor.');
    for (const seconds of [45, 60, 1799, 10800]) {
      for (const free of [true, false, null]) {
        const line = tutorTimeLine(seconds, free)!;
        assert.equal(streakGuiltIn(line), undefined, `"${line}" counts down or nags`);
        assert.doesNotMatch(line, /seconds|left|[—–·!]/, `"${line}" ticks, counts down or shouts`);
      }
    }

    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    // The toast: after the durable phrasebook write, and before nothing else that could fail it.
    const durable = handoff.indexOf("if ((await addPhrases(phrases)) !== 'durable')");
    const toast = handoff.indexOf('publishCelebrations(');
    assert.ok(durable > 0 && toast > durable, 'the phrase is said saved before the phrasebook write is durable');
    assert.equal((handoff.match(/publishCelebrations\(/g) ?? []).length, 1);
    assert.match(
      handoff,
      /publishCelebrations\(\[\{ type: 'phrase-saved', key: celebrationKey\.saved\(phraseKey\), origin: 'account', at: Date\.now\(\), data: \{ phraseKey \} \}\]\)/,
    );
    assert.match(handoff, /const phraseKey = phraseKeyOf\(newest\.fr\);/, 'the toast is keyed by something other than the stored phrase');
    assert.match(handoff, /fr: keptPhrase\(task\),/, 'the stored phrase is not the natural line');
    // The settle still follows the saved practice, and the screen turns to saved after it (game/sites.test.ts).
    assert.ok(handoff.indexOf("userKey('onboarding-practice')") < handoff.indexOf('settleGuestHandoff(guest)'));
    assert.ok(handoff.indexOf('settleGuestHandoff(guest)') < handoff.indexOf('setSaved(true);'));
    // The time: the server's status once saved, read in the background, for this account only.
    assert.match(handoff, /setSaved\(true\); void fetchBillingStatus\(uid\)\.then\(\(answer\) => \{ if \(owner === scopeGeneration\(\) && activeUserId\(\) === uid\) setStatus\(answer\); \}\);/);
    assert.match(handoff, /tutorTimeLine\(status\.secondsRemaining, status\.plan === 'trial' \|\| status\.lapsed\)/, 'a paid plan is called free, or the free allowance is not');
    assert.match(handoff, /tutorTimeLine\(remaining, null\)/);
    assert.doesNotMatch(handoff, /seconds remaining/, 'the hand-off still counts seconds');
  });
});
