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
import { FIRST_LINE, FIRST_RUN_PAGE_COPY, HEAR_IT_EXCHANGE, STUCK_HINT } from './firstRun.ts';

const strip = (source: string) => {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
};
const read = (relative: string) => strip(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));
const SCREEN = read('./PreAccountOnboarding.tsx');
const AUDIO = read('./exchangeAudio.ts');

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

  test('the captions are always there, the playing line is lit, and reduced motion lights every line', () => {
    const hear = pageSource('hear-it');
    assert.match(hear, /\{HEAR_IT_EXCHANGE\.map\(/, 'the exchange is not drawn from the model');
    assert.match(hear, /\{line\.fr\}/);
    assert.match(hear, /\{line\.en\}/);
    assert.match(SCREEN, /const dim = \(index: number\) => !reduced && lit !== null && lit !== index/, 'reduced motion does not show every line in full');
    assert.match(hear, /label=\{HEAR_AGAIN\}/, 'there is no quiet way to hear it again');
    assert.match(SCREEN, /if \(page === 'hear-it' && allowed\) playExchange\(0\)/, 'the exchange does not try to play on arrival');
    assert.match(SCREEN, /const AUTOPLAYS = Platform\.OS !== 'web'/, 'a browser is asked to autoplay before the page is touched');
    assert.match(hear, /WELCOME_SUBLINE\(persona\)/, 'the AI disclosure left the first screen');
  });

  test('one ink button, and the account link is quiet', () => {
    assert.match(SCREEN, /page === 'hear-it' && \(\s*<>\s*<PillButton label=\{TRY_A_LINE\}/, 'Try a line is not the first screen’s one pill');
    assert.match(SCREEN, /<GhostButton label=\{HAVE_ACCOUNT\}/, 'I have an account is not a quiet link');
  });
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

  test('the first chartreuse is the Highlight under the tapped reply, and nothing earlier is lit', () => {
    assert.equal((SCREEN.match(/<Highlight\b/g) ?? []).length, 1, 'the flow draws more than one highlighter');
    const line = pageSource('first-line');
    const said = line.indexOf("stage === 'said'");
    const highlight = line.indexOf('<Highlight');
    assert.ok(said > 0 && highlight > said, 'the highlight is drawn before the reply has been said');
    assert.match(line, /<Highlight text=\{FIRST_LINE\.reply\.fr\}/, 'the highlight is on something other than the reply');
    assert.match(line, /<TutorMark \/>/, 'the tutor has no mark on the first-line page');
    assert.match(line, /label=\{STUCK\}/, 'there is no way to say you are stuck');
    const before = SCREEN.slice(0, SCREEN.indexOf("page === 'first-line' && ("));
    assert.doesNotMatch(before, /accent\.feature|\bhighlight\b|<Highlight/, 'chartreuse appears before the first line');
    assert.doesNotMatch(SCREEN, /accent\.feature/, 'the flow paints the deprecated chartreuse alias');
  });
});

describe('the rest of the flow', () => {
  test('six pages, answers one tap each, and the old welcome is gone', () => {
    assert.deepEqual([...PRE_ACCOUNT_PAGES], ['hear-it', 'first-line', 'start-level', 'reason', 'plan', 'save']);
    assert.equal((SCREEN.match(/accessibilityRole="header"/g) ?? []).length, PRE_ACCOUNT_PAGES.length, 'a page has no heading, or one has two');
    assert.match(pageSource('start-level'), /onPress=\{\(\) => answerLevel\(option\.key\)\}/);
    assert.match(pageSource('reason'), /onPress=\{\(\) => answerReason\(option\.key\)\}/);
    assert.match(SCREEN, /label=\{REASON_SKIP\}/, 'the reason cannot be skipped');
    for (const gone of ['SpeakBubbles', 'SCREEN_ART', 'Life happens', 'Find your voice in French', 'Bonjour, new possibilities', 'TintPanel', 'Animated.']) {
      assert.ok(!SCREEN.includes(gone), `the old welcome still carries ${gone}`);
    }
  });

  test('the plan draws only the places in the plan, with the voice choice inside it', () => {
    const plan = pageSource('plan');
    assert.match(plan, /\{planPlaces\(view\)\.map\(\(place\) => \(\s*<Art key=\{place\} name=\{HERO_ART\[place\]\}/, 'the plan draws a picture that is not a place in the plan');
    assert.equal((SCREEN.match(/<Art\b/g) ?? []).length, 1, 'a picture appears outside the plan');
    assert.match(plan, /<TutorCard\b/, 'the voice choice did not move into the plan');
    assert.match(plan, /\{NO_STREAKS\}/);
    assert.match(plan, /\{view\.reminder\.note\}/, 'the reminder is not labelled as not on yet');
  });

  test('every answer and the page go through the draft, so a return resumes where it left', () => {
    assert.match(SCREEN, /useState<PreAccountPage>\(\(\) => initialDraft\?\.page \?\? 'hear-it'\)/, 'a returning learner starts again from the first page');
    const keep = SCREEN.slice(SCREEN.indexOf('const keep ='), SCREEN.indexOf('const keep =') + 300);
    assert.match(keep, /onDraftChange\(next\)/, 'answers are held in memory only');
    assert.match(SCREEN, /keep\(\{ page: to \}\)/, 'moving page is not written to the draft');
  });

  test('sign-up frames the saved plan, and its account doors are the same three calls', () => {
    const signUp = read('../auth/SignUpScreen.tsx');
    assert.match(signUp, /<Text accessibilityRole="header"[^>]*>One last step<\/Text>/, 'sign-up does not pick up where the plan left off');
    assert.match(signUp, /An account keeps your plan, your lines and what your tutor remembers\./);
    for (const call of ['adapter.signUpWithPassword(email.trim(), password)', 'adapter.signInWithGoogle()', 'adapter.signInWithApple()']) {
      assert.equal(signUp.split(call).length - 1, 1, `sign-up no longer makes exactly one ${call}`);
    }
  });

  test('page copy is warm, plain and free of em dashes', () => {
    for (const line of FIRST_RUN_PAGE_COPY) {
      assert.equal(guiltIn(line), undefined, `guilt in "${line}"`);
      assert.doesNotMatch(line, /[—–]/, `em dash in "${line}"`);
    }
  });
});
