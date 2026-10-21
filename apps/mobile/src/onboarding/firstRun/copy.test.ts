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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { evidence } from '../../../test/evidence.ts';
import { FIRST_RUN_COPY, FIRST_RUN_LINES, SLOW_CHECK_MS, TAKE_CAP_SECONDS, exchangeLabel, issueActions, takeLength } from './copy.ts';
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
    assert.equal(START_LEVELS.length, 4, 'the requested four self-reported starting points are incomplete');
    assert.match(START_LEVELS[0]!.title, /Brand new/);
    assert.ok(START_LEVELS.every(level => level.title.length > 0 && level.gloss.length > 0), 'a level choice lacks its readable label');

    // Honest waits: the slow line comes after a real wait, the take is counted against its real cap.
    assert.equal(SLOW_CHECK_MS, 4000);
    assert.equal(TAKE_CAP_SECONDS, 20);
    assert.equal(takeLength(8.7), '8 of 20 seconds');
    assert.equal(takeLength(-3), '0 of 20 seconds');
    assert.equal(takeLength(45), '20 of 20 seconds');
  });
});

describe('a spoken take the tutor did not hear — F776', () => {
  test('a failed spoken take offers to record again or type, never a Try again that does nothing', () => {
    // The line: the take is gone, so it says what the page offers instead.
    const unheard = FIRST_RUN_COPY.takeUnheard;
    assert.equal(unheard, 'The tutor could not hear that take. You can record it again or type it.');
    assert.equal(streakGuiltIn(unheard), undefined);
    assert.doesNotMatch(unheard, /[—–·]|still here/, 'a spoken failure claims a reply is still on the page');

    // The row: Practise this offline after every failure that can go offline,
    // Try again only where pressing it sends something.
    const failures = [
      unheard,
      'The tutor can’t connect. Your reply is still here.',
      'The tutor can’t connect.',
      'Your guest practice has expired. Your phrase is still here. You can practise this offline.',
      'This starter has used its two attempts. You can practise this offline or finish.',
    ];
    for (const issue of failures) {
      assert.deepEqual(issueActions(issue, 'spoken'), { offline: true, retry: false }, `a spoken page offers a Try again that sends nothing after "${issue}"`);
      assert.deepEqual(issueActions(issue, 'typed'), { offline: true, retry: true }, `a typed reply cannot be sent again after "${issue}"`);
      assert.deepEqual(issueActions(issue, 'start'), { offline: true, retry: true }, `the start cannot be tried again after "${issue}"`);
    }
    for (const calm of [FIRST_RUN_COPY.speechPaused, 'You can type the same reply.', FIRST_RUN_COPY.reminderSet, '']) {
      for (const again of ['spoken', 'typed', 'start'] as const) {
        assert.deepEqual(issueActions(calm, again), { offline: false, retry: false }, `"${calm}" grew a failure row`);
      }
    }

    // The screen: a spoken take that fails (expired and limit aside) says the
    // line above, and the row's Try again is drawn only on the rule's yes.
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.doesNotMatch(screen, /sendGuestAttempt|const submit =|<GuestRecording/);
    assert.doesNotMatch(screen, /label="Practise this offline"|offlineContinuation\(/);
    const live = evidence('apps/mobile/src/onboarding/FirstLivePractice.tsx');
    assert.match(live, /Try connecting again/);
    assert.match(live, /onModeChange=\{next => void changeInput\(next\)\}/);
    const room = evidence('apps/mobile/src/live/C2LiveRoom.tsx');
    // 2026-10-21 UI-008, artboard B-Live: the mode switch is the Type (or Speak) side control.
    assert.match(room, /accessibilityLabel="Type instead"/);
    assert.match(room, /onModeChange\(true\)/, 'the compact typing control must reach the existing room recovery');
    assert.match(live, /await live\.pauseMic\(\)/);

    assert.match(live, /await live\.openMic\(\)/);
    assert.match(live, /await live\.sendSay\(text\)/);

    // A reminder set on day one leaves with the plan it was set for, at all
    // three doors the privacy document names, and the document says so.
    const doc = readFileSync(fileURLToPath(new URL('../../../../../docs/PRIVACY_AND_SAFETY.md', import.meta.url)), 'utf8');
    assert.match(doc, /A daily reminder remains attached to its plan: known refusal,\s*“Start a new plan instead” and sign-in's “Create an account” retain the existing\s*device cancellation\./);
    assert.doesNotMatch(screen, /label="I am younger than that"/);
    const refusal = screen.slice(screen.indexOf('if (!refused) return;'), screen.indexOf('const showPage ='));
    assert.match(refusal, /if \(draftRef\.current\.reminderEnabled === true\) void cancelReminder\(\);/, 'a server safety refusal still clears the reminder belonging to the old plan');
    const app = evidence('apps/mobile/App.tsx');
    const startAgain = app.slice(app.indexOf('const startAgain ='), app.indexOf('return <OnboardingLayout', app.indexOf('const startAgain =')));
    assert.match(startAgain, /draft\.reminderEnabled === true && \(await cancelReminder\(\)\) === 'failed'/);
    assert.ok(startAgain.indexOf('await cancelReminder()') < startAgain.indexOf('onConsumed();'), 'the reviewed plan must remain while its reminder is pending');
    assert.match(startAgain, /setBootstrapError\('Your reminder could not be cancelled/);
    assert.match(app, /<IconAction layout="inline" icon="edit" label="Start a new plan instead" busy=\{restartBusy\} disabled=\{restartBusy\} onPress=\{\(\) => void startAgain\(\)\} \/>/);
    const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx');
    const newAccount = flow.slice(flow.indexOf('const newAccount ='), flow.indexOf('const signIn ='));
    assert.match(newAccount, /initialDraft\?\.reminderEnabled === true && \(await cancelReminder\(\)\) === 'failed'/);
    assert.ok(newAccount.indexOf('await clearGuestPractice()') < newAccount.indexOf('await cancelReminder()'));
    assert.ok(newAccount.indexOf('await cancelReminder()') < newAccount.indexOf('onDiscardDraft();'), 'the old plan must survive both pending cleanup owners');
    assert.match(newAccount, /catch \{ if \(mounted\.current\) setRestartError\(true\); \}/);
    assert.match(flow, /<SignInScreen onCreateAccount=\{newAccount\} \/>/);
    assert.match(evidence('apps/mobile/src/auth/SignInScreen.tsx'), /Create an account/);
  });
});
