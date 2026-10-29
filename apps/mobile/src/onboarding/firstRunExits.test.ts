/**
 * Stream C, batch 1 (F915, F926): ways back and out of the first run, the
 * preselected tutor, and the welcome that shows once.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';
import { DEFAULT_TUTOR_VOICE, tutorVoice } from '@luvani/core';
import { FIVE_SETUP, FULL_SETUP, previousStep } from './flow.ts';
import { freshPreAccountDraft, repaired } from './preAccountDraft.ts';
import { shouldStartFirstPractice } from './firstPracticeEntry.ts';
import { pressBack, recordStep, stepOf, type StepHistory } from './stepHistory.ts';
import { tutorStep } from './tutorStep.ts';
import { LOOK_AROUND } from './micPrimer.ts';

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

function fakeHistory() {
  const entries: unknown[] = [null];
  let index = 0;
  const pops: (() => void)[] = [];
  const history: StepHistory = {
    get state() { return entries[index]; },
    pushState(data) { entries.splice(index + 1); entries.push(data); index += 1; },
    back() { if (index === 0) { left = true; return; } index -= 1; pops.forEach((fn) => fn()); },
  };
  let left = false;
  return { history, onPop: (fn: () => void) => pops.push(fn), get left() { return left; }, get length() { return entries.length; } };
}

test('every onboarding step after the first offers back', () => {
  for (const order of [FULL_SETUP, FIVE_SETUP]) {
    assert.equal(previousStep(order[0]!, order), null, 'the first step has nothing behind it');
    for (let i = 1; i < order.length; i++) assert.equal(previousStep(order[i]!, order), order[i - 1]);
    assert.equal(previousStep('choose-tutor', order), 'plan');
  }
  // The bands draw the chevron in the slot the artboard kept for it.
  const parts = read('./BOnboardingParts.tsx');
  assert.equal((parts.match(/onBack \? <RoundButton kind="back" accessibilityLabel="Back" onPress=\{onBack\} \/> : <View style=\{s\.backSpace\} \/>/g) ?? []).length, 2);
  // Every question, the plan, the tutor and the consent screen hand it over.
  const screen = read('./PreAccountOnboarding.tsx');
  assert.match(screen, /<BQuestionBand page=\{page as C2QuestionPage\} step=\{questionStep\} total=\{questionPages\.length\} onBack=\{backPress\} \/>/);
  assert.equal((screen.match(/<BBand tone="(sun|brand)"[^>]*onBack=\{backPress\}/g) ?? []).length, 3, 'plan, tutor and consent bands');
  assert.match(screen, /const back = \(\) => \{[\s\S]*const previous = previousStep\(page, questionOrder\);/);

  // Web: browser Back steps back inside onboarding; on the first step it leaves.
  const h = fakeHistory();
  let page = 'hear-it';
  const back = () => { page = previousStep(page as never, FULL_SETUP) ?? page; recordStep(h.history, page, page === FULL_SETUP[0]); };
  h.onPop(back);
  recordStep(h.history, page, true);
  assert.equal(h.length, 1, 'the first step pushes nothing');
  for (const next of ['reason', 'interests']) { page = next; recordStep(h.history, page, false); recordStep(h.history, page, false); }
  assert.equal(h.length, 3, 'one entry per step, never a duplicate');
  pressBack(h.history, page, back);
  assert.equal(page, 'reason');
  assert.equal(stepOf(h.history.state), 'reason');
  h.history.back();
  assert.equal(page, 'hear-it');
  assert.equal(h.left, false);
  h.history.back();
  assert.equal(h.left, true, 'browser Back on the first step leaves normally');
  // A resumed step that never pushed steps back directly.
  let direct = 0;
  pressBack(fakeHistory().history, 'time', () => { direct++; });
  pressBack(null, 'time', () => { direct++; });
  assert.equal(direct, 2);
});

test('the first scene and the consent screen offer a way home without starting a session', async () => {
  const screen = read('./PreAccountOnboarding.tsx');
  const start = screen.indexOf('  const homeFirst = async');
  const body = stripTypeScriptTypes(screen.slice(start, screen.indexOf('\n  };\n', start) + 5));
  const run = (signedIn: boolean) => {
    const calls: { account?: unknown; continued?: unknown[]; started: number } = { started: 0 };
    const fn = new Function('operation', 'pageMotion', 'refused', 'previewOnly', 'busy', 'signedIn', 'continueWithAccount', 'onCreateAccount', 'draftRef', 'stopSound', 'start', 'startGuestPractice',
      `${body}; return homeFirst;`)({ current: false }, { locked: { current: false } }, false, false, false, signedIn,
      async (...args: unknown[]) => { calls.continued = args; }, (d: unknown) => { calls.account = d; },
      { current: { ...freshPreAccountDraft(), tutorChosen: true, page: 'choose-tutor' } }, () => {}, () => { calls.started++; }, () => { calls.started++; });
    return { go: fn as () => Promise<void>, calls };
  };
  const guest = run(false);
  await guest.go();
  assert.equal(guest.calls.started, 0, 'no session is started');
  const handed = guest.calls.account as ReturnType<typeof freshPreAccountDraft>;
  assert.equal(handed.page, 'plan');
  // AuthFlow keeps the page as accountReturnPage; sign-up records the Terms.
  const afterSignUp = { ...handed, page: 'account' as const, accountReturnPage: handed.page!, eligibilityConfirmed: true };
  assert.equal(shouldStartFirstPractice(afterSignUp, null), false, 'the account lands on Home, not the first scene');
  const member = run(true);
  await member.go();
  assert.equal(member.calls.started, 0);
  assert.equal((member.calls.continued as unknown[])[1], 'plan');
  assert.equal(shouldStartFirstPractice({ ...freshPreAccountDraft(), eligibilityConfirmed: true, page: 'plan', accountReturnPage: 'hear-it' }, null), false);
  // The consent screen offers both, beside Start, with its Terms notice intact.
  assert.match(screen, /<TermsAcceptance context="practice"/);
  assert.match(screen, /\{!needsAccount && \(!signedIn \|\| draft\.eligibilityConfirmed\) && <Press accessibilityLabel=\{signedIn \? LOOK_AROUND : 'Create an account first'\} disabled=\{busy \|\| previewOnly\} onPress=\{\(\) => void homeFirst\(\)\} style=\{\{ minHeight: 44/);
  // The signed-in first scene: "Look around first", secondary, back to Home.
  assert.equal(LOOK_AROUND, 'Look around first');
  const first = read('./FirstSceneScreen.tsx');
  assert.match(first, /<Press accessibilityLabel=\{LOOK_AROUND\} onPress=\{leave\} style=\{st\.lookAround\}>/);
  assert.match(first, /lookAround: \{ minHeight: 44/);
  assert.match(first, /const leave = \(\) => \{[\s\S]*back\.current\(\);/);
});

test('a recommended tutor is preselected', () => {
  const fresh = freshPreAccountDraft();
  const step = tutorStep(fresh);
  assert.equal(step.chosen, DEFAULT_TUTOR_VOICE);
  assert.equal(step.label, `Continue with ${tutorVoice(DEFAULT_TUTOR_VOICE).persona.name}`);
  // A draft from an older build that stored false is preselected the same way.
  const migrated = repaired({ ...fresh, tutorVoice: 'emilie', tutorChosen: false });
  assert.equal(tutorStep(migrated).chosen, 'emilie');
  const screen = read('./PreAccountOnboarding.tsx');
  assert.match(screen, /chosen=\{tutorStep\(draft\)\.chosen\}/);
  assert.match(screen, /const tutorName = tutorVoice\(draft\.tutorVoice\)\.persona\.name;/);
  assert.match(screen, /<BoldButton label=\{`Continue with \$\{tutorName\}`\} disabled=\{busy\} onPress=\{\(\) => \{ patch\(\{ tutorChosen: true \}\); open\('start'\); \}\} \/>/);
});

function arrivalStore() {
  const disk = new Map<string, string>();
  const src = ts.transpileModule(read('./arrival.ts').replace(/^import .*;\n/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText.replace(/\bexport /g, '');
  const names = { AsyncStorage: { getItem: async (k: string) => disk.get(k) ?? null }, scopeGeneration: () => 1, userKey: (k: string) => `1:${k}`,
    setItemInUserScope: async (_g: number, k: string, v: string) => { disk.set(k, v); } };
  return new Function(...Object.keys(names), `${src}; return { loadArrival, welcomePending, markWelcomeSeen };`)(...Object.values(names)) as {
    loadArrival: () => Promise<{ welcomeSeen: boolean } | null>; welcomePending: (g: boolean, a: unknown, n: boolean) => boolean; markWelcomeSeen: () => Promise<void> };
}

test('the welcome after sign-up shows once and never on a reload', async () => {
  const a = arrivalStore();
  assert.equal(a.welcomePending(false, await a.loadArrival(), true), true, 'a new account sees it');
  await a.markWelcomeSeen(); // drawn; Continue never tapped
  for (const newlyCreated of [true, false]) assert.equal(a.welcomePending(false, await a.loadArrival(), newlyCreated), false, 'a reload never shows it again');
  const handoff = read('./GuestAccountHandoff.tsx');
  assert.match(handoff, /if \(welcomePending\(value !== null, arrival, newlyCreated\)\) setWelcoming\(true\);/);
  assert.match(handoff, /useEffect\(\(\) => \{ if \(!welcoming\) return; void markWelcomeSeen\(\)\.catch\(\(\) => undefined\); \}, \[welcoming\]\);/);
  // On a reload with the receipt written, the hand-off still finishes.
  assert.match(handoff, /if \(value === null && newlyCreated && arrival\?\.welcomeSeen\) onWelcomeDone\?\.\(\);/);
});
