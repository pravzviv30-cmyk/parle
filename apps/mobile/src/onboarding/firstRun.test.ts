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

  test("opening text stays visible and optional playback never starts on arrival", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /Bonjour, je vais prendre un/); assert.match(screen, /Hello, I will have a/); assert.match(screen, /This phrase has no recording yet/); assert.match(screen, /Audio could not play/); assert.doesNotMatch(screen, /autoplay|playExchange\(0\)/i); assert.match(screen, /player\.pause\(\)/); });

  test("opening and recap keep vibrant brand grounds with a readable sticky action", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /const blue = page === 'hear-it'/); assert.match(screen, /colour\.blue/); assert.match(screen, /colour\.coral/); assert.match(screen, /type\.display/); assert.match(screen, /label="Make my plan"/); assert.match(screen, /footer=\{footer\}/); assert.doesNotMatch(screen, /label="Sign in".*Make my plan/); });
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

  test("playback selects a model but only a real submitted reply can receive success feedback", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /sendGuestAttempt\(guest, task, reply\.trim\(\)/); assert.match(screen, /result\.feedback\.accepted/); assert.match(screen, /result\.feedback\.evidence !== 'model'/); assert.doesNotMatch(screen, /SceneMark|state="earned"|awardXp|pronunciationScore/); });
});

describe('the rest of the flow', () => {
  test("six runtime setup surfaces use explicit Next and include duration and frequency", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const order = evidence('apps/mobile/src/onboarding/flow.ts'); assert.match(order, /'reason', 'start-level', 'time', 'plan'/); assert.doesNotMatch(order, /'frequency'/); assert.match(screen, /<NextButton disabled=\{answer == null\}/); assert.match(screen, /goals\.map\(/); assert.doesNotMatch(screen, /v\.key !== 'because'/, 'Just exploring is a skip link again instead of a sixth answer'); assert.match(screen, /FIRST_RUN_COPY\.chooseEachTime/); assert.doesNotMatch(screen, /No schedule|I’m not sure/); assert.doesNotMatch(screen, /Find your voice in French|Bonjour, new possibilities|<ProgressDots/); });

  test("the personalised result leads with one task and contextual edits instead of a syllabus", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /storyGround\(page, coral\)/); assert.match(screen, /task\.translation/); assert.match(screen, /firstTask\.prompt/); assert.match(screen, /label="Change plan"/); assert.match(screen, /label="Choose tutor"/); assert.doesNotMatch(screen, /scene\.canDoEn|METHOD_STEPS|HeroNumber|ROUTINE_NOTE/); });

  test("illustrated full-width choices carry radio state and never advance on selection", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(evidence('apps/mobile/src/onboarding/ChoiceCard.tsx'), /export \{ Choice \} from '\.\.\/components\.tsx';/); const components = evidence('apps/mobile/src/components.tsx'); const choice = components.slice(components.indexOf('export function Choice('), components.indexOf('const ic = StyleSheet.create(')); assert.match(choice, /role = 'radio'/); assert.match(choice, /accessibilityRole=\{role\}/); assert.match(choice, /accessibilityState=\{navigation \? undefined : radio \? \{ checked: selected \} : \{ selected \}\}/); assert.match(screen, /onPress=\{\(\) => choose\(\{ reason: v\.key \}\)/); const choose = screen.slice(screen.indexOf('const choose ='), screen.indexOf('const open =')); assert.doesNotMatch(choose, /go\(|setPage/); assert.match(screen, /<ChoiceArt/); });

  test("eligibility is a separate start-sheet choice and refusal removes service and account actions", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /title="I am 13 or older"/); assert.match(screen, /label="I am younger than that"/); assert.match(screen, /const footer = refused \?/); assert.match(screen, /state-postcard-frame/); assert.doesNotMatch(screen, /CREATE_ACCOUNT_AGE/); });

  test("the age boundary is documented before processing and lasts the launch only", () => { const doc = evidence('docs/ONBOARDING.md'); assert.match(doc, /age question sits before first processing/); assert.match(doc, /rest of the launch/); assert.match(doc, /no refusal marker/); assert.match(doc, /relaunching starts at the first page with nothing kept/); });

  test("relaunch does not restore a refusal marker or retained child draft", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(app, /setPreAccountRefused\(true\)/); assert.match(app, /discardPreAccountDraft\(\)/); assert.match(screen, /clearGuestPractice\(\)/); assert.match(screen, /generation\.current\+\+/); assert.match(flow, /refused=\{refused\}/); assert.doesNotMatch(flow, /setRefused|refusal.*setItem|refusal.*fetch/i); const draft = evidence('apps/mobile/src/onboarding/preAccountDraft.ts'); assert.match(draft, /draftGeneration\+\+/); assert.doesNotMatch(draft, /refusedAt|underAgeAt|refusalKey/); });

  test("refusal invalidates pending service work and queued guest writes", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); assert.match(app, /setPreAccountRefused\(true\)/); assert.match(app, /discardPreAccountDraft\(\)/); assert.match(screen, /clearGuestPractice\(\)/); assert.match(screen, /generation\.current\+\+/); assert.match(flow, /refused=\{refused\}/); assert.doesNotMatch(flow, /setRefused|refusal.*setItem|refusal.*fetch/i); const service = evidence('apps/mobile/src/onboarding/guestPractice.ts'); assert.match(service, /writeGeneration\+\+/); assert.match(service, /owner === writeGeneration/); assert.match(screen, /ticket !== generation\.current/); });

  test("authentication cannot undo a refusal or silently make its draft eligible", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(flow, /initialDraft=\{refused \? refusalPage/); assert.match(flow, /if \(refused\) return/); assert.match(app, /refused=\{preAccountRefused\}/); assert.match(screen, /!draft\.eligibilityConfirmed \|\| refused/); });

  test("each saved page and answer updates the draft and Back retains scroll position", () => { const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'); assert.match(screen, /onDraftChange\(\{ \.\.\.next, page \}\)/); assert.match(screen, /onDraftChange\(\{ \.\.\.draftRef\.current, page: next \}\)/); assert.match(screen, /offsets\.current\[page\]/); assert.match(screen, /scroll\.current\?\.scrollTo/); assert.match(screen, /go\(questionOrder\[index - 1\]!?, true\)/); });

  test("account creation follows useful practice and offers the same email, Apple and Google doors", () => { const flow = evidence('apps/mobile/src/auth/AuthFlow.tsx'); const app = evidence('apps/mobile/App.tsx'); const signup = evidence('apps/mobile/src/auth/SignUpScreen.tsx'); assert.match(flow, /<Sheet/); assert.match(flow, /planDraft=\{refused \? null : signupDraft\}/); assert.match(signup, /adapter\.signUpWithPassword\(/); assert.match(signup, /signInWithApple/); assert.match(signup, /signInWithGoogle/); assert.match(signup, /plan\.starter\.title/); });

  test('page copy is warm, plain and free of em dashes', () => {
    for (const line of FIRST_RUN_PAGE_COPY) {
      assert.equal(guiltIn(line), undefined, `guilt in "${line}"`);
      assert.doesNotMatch(line, /[—–]/, `em dash in "${line}"`);
    }
  });
});
