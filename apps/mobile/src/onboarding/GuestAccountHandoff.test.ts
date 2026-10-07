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
import { checkStarter, starterTasks, type StarterTask } from '@luvani/core';
import { evidence } from '../../test/evidence.ts';
import { streakGuiltIn } from '../copy/guilt.ts';
import { tutorTimeLine } from './firstRun/copy.ts';
import type { GuestAttempt, GuestPractice } from './guestModel.ts';
import { keptPhrase, savedPhraseTasks } from './guestProgress.ts';
import { freshPreAccountDraft } from './preAccountDraft.ts';

/** A reply the starter check really returned. */
function attempt(task: StarterTask, reply: string, extra: Partial<GuestAttempt> = {}): GuestAttempt {
  return { taskId: task.id, reply, feedback: checkStarter(task, reply, 'typed'), at: Date.UTC(2026, 9, 5, 9), offline: true, ...extra };
}

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

  test('the hand-off and the guest home name only a phrase the practice saves', () => {
    const plan = { ...freshPreAccountDraft(), eligibilityConfirmed: true, reason: 'food' as const, drink: 'coffee' as const, minutes: 15 as const };
    const [a, b] = starterTasks('food', 'coffee', 15);
    assert.ok(a && b, 'a fifteen-minute food starter no longer has two exchanges');
    const practice = (attempts: GuestAttempt[], kept = false): Pick<GuestPractice, 'attempts' | 'kept' | 'plan'> => ({ attempts, kept, plan });
    const refused = attempt(b, 'xyz');
    assert.equal(refused.feedback.accepted, false, 'core accepts the miss this test relies on');
    // The walk that ended on a refused line saves the accepted one before it,
    // and that is the phrase both cards name, as its natural line.
    const walk = practice([attempt(a, a.model), refused]);
    assert.deepEqual(savedPhraseTasks(walk).map((t) => t.id), [a.id], 'a refused line is saved, or the accepted one is not');
    assert.equal(keptPhrase(savedPhraseTasks(walk).at(-1)!), a.model);
    // A refused line kept on purpose is saved, as its natural line.
    assert.deepEqual(savedPhraseTasks(practice([attempt(a, a.model), refused], true)).map((t) => t.id), [a.id, b.id]);
    assert.deepEqual(savedPhraseTasks(practice([attempt(a, 'xyz', { kept: true })])).map((t) => t.id), [a.id]);
    // Nothing accepted or kept is nothing saved, and nothing to name.
    assert.deepEqual(savedPhraseTasks(practice([refused])), []);
    assert.deepEqual(savedPhraseTasks(null), []);

    // The hand-off writes exactly those, and its card names the newest of
    // them, or says the practice is saved and names no phrase.
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    assert.match(handoff, /const phrases = savedPhraseTasks\(guest\)\.map\(\(task\) => \(\{ fr: keptPhrase\(task\),/, 'the hand-off saves a different list from the one its card names');
    assert.match(handoff, /const shown = savedPhraseTasks\(guest\)\.at\(-1\);/);
    assert.match(handoff, /title=\{saved \? \(shown \? 'Your phrase is saved\.' : 'Your practice is saved\.'\) : 'Keep this practice\?'\}/, 'the hand-off says a phrase is saved when none was');
    assert.match(handoff, /\{shown \? <Text style=\{type\.heading\}>\{keptPhrase\(shown\)\}<\/Text> : null\}/);
    assert.doesNotMatch(handoff, /attempts\.at\(-1\)\?\.feedback\.model/, 'the hand-off names the last line whether or not it was saved');
    // The guest home names the same phrase.
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.match(screen, /const homePhrase = page === 'home' \? \(savedPhraseTasks\(guest\)\.at\(-1\) \?\? null\) : null;/);
    const home = screen.slice(screen.indexOf("{page === 'home' && ("));
    assert.match(home, /\{homePhrase && \( <Card style=\{\{ gap: 10 \}\}> <Text \{\.\.\.frenchText\} style=\{type\.frenchLg\}> \{keptPhrase\(homePhrase\)\} <\/Text>/, 'the guest home names a line that was not saved');
    assert.doesNotMatch(home, /last\.feedback\.model/);
  });
});
