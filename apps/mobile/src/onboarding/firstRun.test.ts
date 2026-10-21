import { evidence } from '../../test/evidence.ts';
/**
 * The six pages before an account: hear it, first line, start level, reason,
 * plan, save. The recorded exchange is data here, so the order, the voices and
 * the captions can be asserted as values; the rest is a read of the screen, in
 * the `answers.test.ts` idiom, because apps/mobile has no renderer.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DAILY_PHRASES } from '@luvani/core';
import { guiltIn } from '../copy/guilt.ts';
import { DEMO_REPLY_ID, TUTOR_LINES, TUTOR_LINES_VOICE } from './tutorLines.ts';
import { PRE_ACCOUNT_PAGES } from './preAccountDraft.ts';
import {
  CREATE_ACCOUNT_AGE,
  FIRST_LINE,
  FIRST_RUN_PAGE_COPY,
  HEAR_IT_EXCHANGE,
  STUCK_HINT,
  UNDER_AGE,
  UNDER_AGE_BODY,
  UNDER_AGE_TITLE,
} from './firstRun.ts';

const strip = (source: string) => {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
};
const read = (relative: string) => strip(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));
const SCREEN = read('./PreAccountOnboarding.tsx');
const AUDIO = read('./exchangeAudio.ts');

/** A file as written, comments and all, for the tests that read words rather than code. */
const raw = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
/** Comment lines joined into prose, so a sentence split across `//` lines still reads whole. */
const prose = (text: string) => text.replace(/\n\s*(?:\/\/|\*)[ \t]?/g, ' ').replace(/\s+/g, ' ');
/** The onboarding doc's paragraph on the age question, as one line of prose. */
function ageParagraph(): string {
  const doc = raw('../../../../docs/ONBOARDING.md');
  const at = doc.indexOf('**The age question sits on the save page.**');
  assert.ok(at > 0, 'docs/ONBOARDING.md no longer explains the age question on the save page');
  return prose(doc.slice(at, doc.indexOf('\n\n', at)));
}
/** One JSX element's source, from its opening tag to the `/>` that closes it. */
function element(source: string, tag: string): string {
  const at = source.search(new RegExp(`<${tag}(?=\\s|>)`));
  assert.ok(at >= 0, `<${tag}> is not rendered`);
  return source.slice(at, source.indexOf('/>', at) + 2);
}
/** The screen's one door to the draft. */
const keepSource = () => SCREEN.slice(SCREEN.indexOf('const keep ='), SCREEN.indexOf('const setConsent'));
/** The younger link's handler. */
const refuseSource = () => {
  const at = SCREEN.indexOf('const refuse = ');
  assert.ok(at > 0, 'the younger link has no handler of its own');
  return SCREEN.slice(at, SCREEN.indexOf('};', at) + 2);
};

/** The source of one page: from its `page === '<name>' &&` block to the next page's. */
function pageSource(name: string): string {
  const at = SCREEN.indexOf(`page === '${name}' && (`);
  assert.ok(at > 0, `the ${name} page has no body`);
  const next = PRE_ACCOUNT_PAGES.slice(PRE_ACCOUNT_PAGES.indexOf(name as never) + 1)
    .map((p) => SCREEN.indexOf(`page === '${p}' && (`, at + 1))
    .filter((i) => i > 0);
  return SCREEN.slice(at, next.length > 0 ? Math.min(...next) : SCREEN.length);
}

const reply = DAILY_PHRASES.find((phrase) => phrase.id === DEMO_REPLY_ID);

describe('screen one plays a real recorded exchange', () => {
  test('the recorded tutor asks, a second recorded voice replies, the tutor follows up, each captioned in French and English', () => {
    assert.deepEqual(
      HEAR_IT_EXCHANGE.map((line) => [line.id, line.voice, line.speaker]),
      [
        [TUTOR_LINES.question.id, TUTOR_LINES_VOICE, 'tutor'],
        [DEMO_REPLY_ID, 'emilie', 'learner'],
        [TUTOR_LINES.followUp.id, TUTOR_LINES_VOICE, 'tutor'],
      ],
    );
    assert.ok(reply);
    assert.equal(HEAR_IT_EXCHANGE[1]!.fr, reply.fr);
    assert.equal(HEAR_IT_EXCHANGE[1]!.en, reply.en);
    for (const line of HEAR_IT_EXCHANGE) assert.ok(line.fr.length > 0 && line.en.length > 0, `${line.id} has no caption`);
    // Every clip is a bundled recording: the onboarding map or the daily manifest.
    assert.match(AUDIO, /import \{ TUTOR_LINE_AUDIO \} from '\.\/tutorLineAudio\.ts'/);
    assert.match(AUDIO, /import \{ TUTOR_DAILY_AUDIO \} from '\.\.\/daily\/tutorAudioManifest\.ts'/);
    assert.doesNotMatch(AUDIO, /Speech|speak\(|tts/i, 'a line is synthesised on the device instead of played from a recording');
  });

  // 2026-10-21 UI-008, artboard B-OB-Welcome: the welcome's line names the tutor, and the page is the brand ground with the canvas friends drawing.
  test("welcome values are visible and optional tutor samples never start on arrival", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /'hear-it': 'Welcome to Luvani'/); assert.match(screen, /Real conversations with your own tutor, from your very first try\./); assert.match(screen, /Start your personal plan/); assert.match(screen, /Audio could not play/); assert.doesNotMatch(screen, /Coffee or tea|Bonjour, je vais prendre un|Hello, I will have a|autoplay|playExchange\(0\)/i); assert.match(screen, /player\.pause\(\)/); });

  test("welcome and recap share cream progress chrome with a readable bottom action", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /const blue = page === 'hear-it'/); assert.match(screen, /<FirstSessionCelebration/); assert.match(screen, /refused \? c\.paper : blue \? t\.brand : c\.paper/); assert.match(screen, /<OnboardingLayout/); assert.doesNotMatch(screen, /icon="back"/); assert.match(screen, /type\.display/); assert.match(screen, /label="Start your personal plan"/); assert.match(screen, /footer=\{footer\}/); assert.match(screen, /<BWelcomeArt \/>/); });
});

describe('screen two: the learner’s first line, then the first highlight', () => {
  test('the recorded tutor asks, the tapped reply plays in the same recorded voice, and the tutor closes', () => {
    assert.equal(FIRST_LINE.question.id, TUTOR_LINES.question.id);
    assert.equal(FIRST_LINE.close.id, TUTOR_LINES.close.id);
    assert.equal(FIRST_LINE.reply.id, DEMO_REPLY_ID);
    assert.equal(FIRST_LINE.reply.voice, TUTOR_LINES_VOICE, 'the tapped reply plays in a voice other than the recorded tutor’s');
    assert.ok(reply && reply.fr.startsWith(STUCK_HINT.replace('…', '')), '"I\'m stuck" hands back words the reply does not start with');
    assert.equal(STUCK_HINT, 'Bonjour, je vais…');
  });

  test("playback selects a model but only a real submitted reply can receive success feedback", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.doesNotMatch(screen, /sendGuestAttempt|<GuestRecording/); assert.match(screen, /next\.live\?\.outcome === 'completed' \? 'recap' : 'keep'/); const live = evidence('apps/mobile/src/onboarding/FirstLivePractice.tsx'); assert.match(live, /await readGuestLiveResult/); assert.ok(live.indexOf('await saveGuestPractice(next)') < live.indexOf('onFinished(next)')); assert.doesNotMatch(screen, /SceneMark|state="earned"|awardXp|pronunciationScore/); });
});

describe('the rest of the flow', () => {
  test("personal questions use explicit named Next actions and only real answers enable them", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const order = evidence('apps/mobile/src/onboarding/flow.ts'); assert.match(order, /'reason', 'interests', 'start-level', 'confidence', 'focus', 'time', 'plan'/); assert.doesNotMatch(order, /'frequency'/); assert.match(screen, /<NextButton bold disabled=\{answer == null\} label=\{nextSetupLabel\(page, five\)\}/); for (const label of ['Continue', 'See your plan']) assert.ok(order.includes(label)); assert.match(screen, /BOLD_GOALS\.map\(/); assert.doesNotMatch(screen, /v\.key !== 'because'/, 'Just exploring must remain a real purpose answer'); assert.match(screen, /FIRST_RUN_COPY\.chooseEachTime/); assert.doesNotMatch(screen, /No schedule|I’m not sure/); });

  test("the personal plan leads with the authored first practice then a dedicated deliberate tutor choice", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const plan = evidence('apps/mobile/src/onboarding/PersonalPlan.tsx'); const tutors = evidence('apps/mobile/src/onboarding/TutorSelection.tsx'); assert.match(screen, /refused \? c\.paper : blue \? t\.brand : c\.paper/); assert.match(screen, /<PersonalPlan draft=\{draft\}/); assert.match(plan, /planFor\(draft\)/); assert.match(plan, /firstPracticeScenario\(briefFromDraft\(draft\)\)/); assert.match(screen, /accessibilityLabel="Adjust my plan"[^>]*onPress=\{\(\) => open\('plan'\)/); assert.match(screen, /label="Choose your tutor" onPress=\{\(\) => go\('choose-tutor'\)\}/); assert.match(screen, /label=\{draft\.tutorChosen \? `Continue with \$\{tutorName\}` : 'Choose a tutor'\} disabled=\{draft\.tutorChosen !== true \|\| busy\}/); assert.match(tutors, /TUTOR_VOICE_OPTIONS\.map/); assert.match(tutors, /accessibilityRole="radio"/); assert.doesNotMatch(plan, /Choose tutor|tutorName|HeroNumber|ROUTINE_NOTE/); /* 2026-10-21 UI-008, artboard B-OB-Plan draws How it works, so the plan shows METHOD_STEPS under METHOD_LABEL. */ assert.match(plan, /<BHowItWorks title=\{METHOD_LABEL\} steps=\{METHOD_STEPS\} \/>/); });

  test("illustrated full-width choices carry radio state and never advance on selection", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(evidence('apps/mobile/src/onboarding/ChoiceCard.tsx'), /export \{ Choice \} from '\.\.\/components\.tsx';/); const components = evidence('apps/mobile/src/components.tsx'); const choice = components.slice(components.indexOf('export function Choice('), components.indexOf('const ic = StyleSheet.create(')); assert.match(choice, /role = 'radio'/); assert.match(choice, /accessibilityRole=\{role\}/); assert.match(choice, /accessibilityState=\{navigation \? undefined : radio \? \{ checked: selected \} : \{ selected \}\}/); assert.match(screen, /onPress=\{\(\) => choose\(\{ reason: v\.key \}\)/); const choose = screen.slice(screen.indexOf('const choose ='), screen.indexOf('const open =')); assert.doesNotMatch(choose, /go\(|setPage/); assert.match(screen, /<BoldChoice/); const bold = evidence('apps/mobile/src/onboarding/BoldChoice.tsx'); assert.match(bold, /accessibilityState=\{\{ checked: selected \}\}/); assert.match(bold, /haptic="selection" depth="raised"/); });

  test("the deliberate Start tap declares eligibility after Terms and refusal removes all processing actions", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.doesNotMatch(screen, /title="I am 13 or older"|label="I am younger than that"/); assert.match(screen, /TermsAcceptance context="practice"/); assert.match(screen, /patch\(\{ eligibilityConfirmed: true \}\)/); assert.match(screen, /const footer = refused \?/); assert.match(screen, /state-postcard-frame/); assert.doesNotMatch(screen, /CREATE_ACCOUNT_AGE/); });

  test("the age boundary is documented before processing and lasts the launch only", () => { const doc = evidence('docs/ONBOARDING.md'); assert.match(doc, /linked declaration precedes first processing/); assert.match(doc, /known underage\/refusal state still blocks continuation/); assert.match(doc, /no typed answers or refusal marker/); assert.match(doc, /sign-in, sign-out and account switching cannot bypass that launch's refusal/); });

  test("relaunch does not restore a refusal marker or retained child draft", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(app, /setPreAccountRefused\(true\)/); assert.match(app, /discardPreAccountDraft\(\)/); assert.match(screen, /clearGuestPractice\(\)/); assert.match(screen, /generation\.current\+\+/); assert.match(flow, /refused=\{refused\}/); assert.doesNotMatch(flow, /setRefused|refusal.*setItem|refusal.*fetch/i); const draft = evidence('apps/mobile/src/onboarding/preAccountDraft.ts'); assert.match(draft, /draftGeneration\+\+/); assert.doesNotMatch(draft, /refusedAt|underAgeAt|refusalKey/); });

  test("refusal invalidates pending service work and queued guest writes", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(app, /setPreAccountRefused\(true\)/); assert.match(app, /discardPreAccountDraft\(\)/); assert.match(screen, /clearGuestPractice\(\)/); assert.match(screen, /generation\.current\+\+/); assert.match(flow, /refused=\{refused\}/); assert.doesNotMatch(flow, /setRefused|refusal.*setItem|refusal.*fetch/i); const service = evidence('apps/mobile/src/onboarding/guestPractice.ts'); assert.match(service, /writeGeneration\+\+/); assert.match(service, /owner === writeGeneration/); assert.match(screen, /ticket !== generation\.current/); });

  test("authentication cannot undo a refusal or silently make its draft eligible", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(flow, /initialDraft=\{refused \? refusalPage/); assert.match(flow, /if \(refused\) return/); assert.match(app, /refused=\{preAccountRefused\}/); assert.match(screen, /operation\.current \|\| refused/); });

  test("each saved page and answer updates the draft and Back retains scroll position", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /const persisted = \{ \.\.\.next, page \}/); assert.match(screen, /onDraftChange\(persisted\)/); assert.match(screen, /onboardingCompletedSteps: completedSteps/); assert.match(screen, /offsets\.current\[page\]/); assert.match(screen, /scroll\.current\?\.scrollTo/); assert.match(screen, /go\(questionOrder\[index - 1\]!?, true\)/); });

  test("account creation follows useful practice and opens a full-page form with the same provider doors", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const signup = evidence('apps/mobile/src/auth/SignUpScreen.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.doesNotMatch(flow, /<Sheet/); assert.match(flow, /<SignUpScreen/); assert.match(flow, /if \(refused\) return;[\s\S]*onCreateAccount\(accountDraft\);[\s\S]*switchScreen\('signup'\)/); assert.match(flow, /planDraft=\{refused \? null : signupDraft\}/); assert.match(app, /onCreateAccount=\{keepPreAccountDraft\}/); assert.match(signup, /adapter\.signUpWithPassword\(/); assert.match(signup, /signInWithApple/); assert.match(signup, /signInWithGoogle/); });

  test('page copy is warm, plain and free of em dashes', () => {
    for (const line of FIRST_RUN_PAGE_COPY) {
      assert.equal(guiltIn(line), undefined, `guilt in "${line}"`);
      assert.doesNotMatch(line, /[—–]/, `em dash in "${line}"`);
    }
  });
});
