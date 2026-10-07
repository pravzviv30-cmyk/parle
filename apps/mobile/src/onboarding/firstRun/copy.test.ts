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
    assert.match(
      screen,
      /error\.message === 'limit' \? '[^']*' : uri \? FIRST_RUN_COPY\.takeUnheard : 'The tutor can’t connect\. Your reply is still here\.'/,
      'a failed spoken take still says the reply is here',
    );
    assert.match(screen, /const actions = issueActions\(issue, page !== 'practice' \? 'start' : mode\);/, 'the row does not know whether the reply was typed');
    const from = screen.indexOf('{actions.offline && (');
    assert.ok(from > 0, 'the failure row is not drawn from the rule');
    const row = screen.slice(from, screen.indexOf("{storageNote !== '' ?", from));
    assert.match(row, /label="Practise this offline"/);
    assert.match(row, /\{actions\.retry \? \( <IconAction icon="refresh" label="Try again"/, 'Try again is drawn whatever the reply was');
    assert.equal((row.match(/label="Try again"/g) ?? []).length, 1);
    // Offline checks typed words only, so going offline from a spoken page turns to typing.
    assert.match(row, /offline: true \} : offlineContinuation\(draft, null\), \); setMode\('typed'\); setIssue\(''\);/);

    // The microphone and Type instead are the way on, and both stay on the spoken page.
    const take = evidence('apps/mobile/src/onboarding/GuestRecording.tsx');
    assert.match(take, /onPress=\{\(\) => void record\(\)\}/);
    assert.match(take, /label=\{FIRST_RUN_COPY\.typeInstead\}/);

    // A reminder set on day one leaves with the plan it was set for, at all
    // three doors the privacy document names, and the document says so.
    const doc = readFileSync(fileURLToPath(new URL('../../../../../docs/PRIVACY_AND_SAFETY.md', import.meta.url)), 'utf8');
    assert.match(doc, /reminder set on day one goes with the plan it was set for: the under-thirteen answer, "Start a new plan instead" and sign-in's "Create one" each cancel it on the phone\./);
    const younger = screen.slice(screen.indexOf('label="I am younger than that"'), screen.indexOf('<SwitchRow'));
    assert.match(younger, /if \(draftRef\.current\.reminderEnabled === true\) void cancelReminder\(\);/);
    const app = evidence('apps/mobile/App.tsx');
    assert.match(app, /const startAgain = async \(\) => \{ if \(draft\.reminderEnabled === true\) await cancelReminder\(\);/);
    assert.match(app, /<GhostButton label="Start a new plan instead" onPress=\{\(\) => void startAgain\(\)\} \/>/);
    const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx');
    const newAccount = flow.slice(flow.indexOf('const newAccount ='), flow.indexOf('const signIn ='));
    assert.match(newAccount, /if \(initialDraft\?\.reminderEnabled === true\) void cancelReminder\(\);/);
    assert.match(flow, /<SignInScreen onCreateAccount=\{newAccount\} \/>/);
    assert.match(evidence('apps/mobile/src/auth/SignInScreen.tsx'), /Create one/);
  });
});
