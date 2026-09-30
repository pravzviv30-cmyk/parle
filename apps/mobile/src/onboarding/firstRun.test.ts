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
    assert.match(hear, /<Press\b[^>]*?accessibilityLabel=\{HEAR_AGAIN\}/, 'there is no quiet way to hear it again');
    assert.match(hear, /<Text style=\{st\.againLabel\}>\{HEAR_AGAIN\}<\/Text>/, 'the way to hear it again does not say so');
    assert.match(SCREEN, /if \(page === 'hear-it' && allowed\) playExchange\(0\)/, 'the exchange does not try to play on arrival');
    assert.match(SCREEN, /const AUTOPLAYS = Platform\.OS !== 'web'/, 'a browser is asked to autoplay before the page is touched');
    assert.match(hear, /WELCOME_SUBLINE\(persona\)/, 'the AI disclosure left the first screen');
  });

  test('the first two pages are blue: story segments, a display headline, the exchange in white and ink, and a round next', () => {
    // The page's ground comes from one map, and so do the segments' colours,
    // so the dots can never be drawn for a ground the page is not on.
    assert.match(SCREEN, /ground=\{GROUND\[page\]\}/, 'the pages are not drawn on their own grounds');
    assert.match(SCREEN, /'hear-it': colour\.blue,\s*'first-line': colour\.blue,/, 'hear it and the first line are not blue pages');
    assert.match(SCREEN, /'hear-it': 'blue',\s*'first-line': 'blue',/, 'the story segments are not drawn for the blue ground');
    assert.match(
      SCREEN,
      /<ProgressDots total=\{PRE_ACCOUNT_PAGES\.length\} index=\{index\} ground=\{SEGMENTS\[page\]\} \/>/,
      'the pages are not counted in story segments',
    );
    // The segments sit above the round back, and the header prints no title.
    assert.match(SCREEN, /<ScreenHeader title=\{false\} divider=\{false\} back=/, 'the header prints the app name over the segments');

    // A display headline in white, on the two blue pages and nowhere else.
    assert.match(SCREEN, /display: \{ \.\.\.type\.display, color: textOn\.blue \}/, 'the blue headline is not the display size in white');
    assert.equal((SCREEN.match(/type\.display/g) ?? []).length, 1, 'the display size is spread somewhere other than the blue headline');
    for (const name of ['hear-it', 'first-line']) {
      assert.match(pageSource(name), /<Text accessibilityRole="header" style=\{st\.display\}>/, `the ${name} headline is not the display line`);
    }
    for (const name of ['start-level', 'reason', 'plan', 'save']) {
      assert.doesNotMatch(pageSource(name), /st\.display\b/, `the ${name} page borrows the blue headline`);
    }

    // The exchange: the tutor in white, the learner in ink, and no hairlines.
    const bubble = (name: string) => SCREEN.slice(SCREEN.indexOf(`  ${name}: {`), SCREEN.indexOf('},', SCREEN.indexOf(`  ${name}: {`)));
    assert.match(bubble('tutorBubble'), /backgroundColor: paper\.card/, 'the tutor does not speak in a white bubble');
    assert.match(bubble('learnerBubble'), /backgroundColor: paper\.ink/, 'the learner does not speak in an ink bubble');
    assert.match(bubble('learnerBubble'), /alignSelf: 'flex-end'/, 'the learner line is not on the right');
    for (const name of ['bubble', 'tutorBubble', 'learnerBubble']) {
      assert.doesNotMatch(bubble(name), /borderWidth|borderColor/, `the ${name} still draws a hairline`);
    }
    assert.match(pageSource('hear-it'), /style=\{learner \? st\.frenchOnInk : st\.french\}|style=\{\[learner \? st\.frenchOnInk : st\.french/, 'the learner line is not white on ink');

    // One way on, the round next on sun, and the account link is quiet and white.
    assert.match(
      SCREEN,
      /page === 'hear-it' && \(\s*<View style=\{st\.footRow\}>\s*<RoundButton kind="next" tone="sun" label=\{TRY_A_LINE\}/,
      'Try a line is not the first screen’s round next',
    );
    assert.match(SCREEN, /<GhostButton label=\{HAVE_ACCOUNT\} color=\{paper\.onInk\}/, 'I have an account is not a quiet white link');
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

  test('the first chartreuse is the Highlight on the tapped reply, beside a mint tick, and nothing earlier is lit', () => {
    assert.equal((SCREEN.match(/<Highlight\b/g) ?? []).length, 1, 'the flow draws more than one highlighter');
    const line = pageSource('first-line');
    const said = line.indexOf("stage === 'said'");
    const highlight = line.indexOf('<Highlight');
    assert.ok(said > 0 && highlight > said, 'the highlight is drawn before the reply has been said');
    assert.match(line, /<Highlight text=\{FIRST_LINE\.reply\.fr\}/, 'the highlight is on something other than the reply');
    // The mint tick sits beside the marked line, and only once it is said.
    const tick = line.indexOf('<SceneMark state="earned" />');
    assert.ok(tick > highlight, 'the marked reply has no mint tick beside it');
    assert.equal((SCREEN.match(/<SceneMark\b/g) ?? []).length, 1, 'a tick appears somewhere other than the marked reply');
    // The tutor is named by a meta line on a white card, not drawn as a mark.
    assert.match(line, /<Text style=\{st\.speaker\}>\{persona\.name\}<\/Text>/, 'the tutor is not named on the first-line page');
    assert.doesNotMatch(SCREEN, /TutorMark/, 'the tutor mark is still drawn beside the lines');
    assert.match(line, /<FrenchBlock\s+french=\{FIRST_LINE\.question\.fr\}\s+english=\{FIRST_LINE\.question\.en\}\s+size="lg"/, 'the question is not the large French block');
    assert.match(line, /questionClip === undefined \|\| stage === 'saying'\s*\?\s*undefined/, 'the question offers a disc with no recording behind it, or one that cuts across the reply');
    assert.match(SCREEN, /const questionClip = clipFor\(FIRST_LINE\.question\)/, 'the question plays something other than its bundled recording');
    assert.doesNotMatch(line, /<Pressable\b/, 'the reply is not pressed through the one spring');
    assert.match(line, /<Press\s+haptic="light"\s+accessibilityRole="button"\s+accessibilityLabel=\{`Reply: /, 'the reply is not the white card the learner presses');
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

  test('the plan is the sun page: the hero minutes, the first three scenes in French, the tutor, how it works, and no picture', () => {
    const plan = pageSource('plan');
    assert.match(SCREEN, /plan: colour\.sun,/, 'the plan is not the sun page');
    assert.match(SCREEN, /plan: 'sun',/, 'the story segments are not drawn for the sun ground');
    assert.match(plan, /<Text accessibilityRole="header" style=\{st\.planTitle\}>\{PLAN_TITLE\}<\/Text>/, 'the plan has no title in its body');
    assert.match(plan, /<HeroNumber value=\{String\(view\.minutes\)\} unit=\{MINUTES_UNIT\} ground="sun" \/>/, 'the minutes are not the hero number');
    assert.match(plan, /\{NO_STREAKS\}/);
    assert.match(plan, /\{reminderLine\(view\.reminder\.clock\)\}/, 'the reminder is not said to be off');

    // The scenes lead in French, with the English beside and the can-do under.
    const titleFr = plan.indexOf('{scene.titleFr}');
    assert.ok(titleFr > 0 && plan.indexOf('{scene.titleEn}') > titleFr && plan.indexOf('{scene.canDoEn}') > titleFr, 'the scenes do not lead in French');
    assert.match(plan, /<Text \{\.\.\.frenchText\} style=\{st\.french\}>\{scene\.titleFr\}<\/Text>/, 'the French title is not marked as French');
    assert.match(plan, /<TutorCard\b/, 'the voice choice did not move into the plan');
    assert.match(plan, /\{METHOD_LABEL\}[\s\S]*?\{at \+ 1\}[\s\S]*?\{step\}/, 'how it works is not three numbered steps');

    // It shows the plan rather than configuring it: no pickers, no picture.
    assert.doesNotMatch(plan, /<TabBar\b/, 'the plan still asks for the minutes or the reminder');
    assert.doesNotMatch(SCREEN, /\b(MINUTES_LABEL|REMINDER_LABEL|GOALS|REMINDER_TIMES)\b/, 'the plan still reads the pickers it dropped');
    assert.doesNotMatch(SCREEN, /sceneIllustration|<Art\b/, 'the plan still draws a place');
    assert.doesNotMatch(plan, /<Illustration\b/, 'the plan draws a picture the board does not');
    // The save page's refusal is the one picture this flow draws.
    assert.equal((SCREEN.match(/<Illustration\b/g) ?? []).length, 1, 'a picture appears somewhere other than the under-13 page');

    // One way on: the round next in ink, and the trial beside it.
    assert.match(SCREEN, /<RoundButton kind="next" tone="ink" label=\{SAVE_PLAN\}/, 'Save my plan is not the round next on sun');
    assert.match(SCREEN, /<Text style=\{st\.trialOnSun\}>\{TRIAL_LINE\}<\/Text>/, 'the trial is not said beside the next');
  });

  test('the one-tap answers are option rows that carry their choice as state, never ledger rows with a Chosen word', () => {
    for (const [name, list, chosen, answer] of [
      ['start-level', 'START_LEVELS', 'level === option\\.key', 'answerLevel\\(option\\.key\\)'],
      ['reason', 'REASONS', 'draft\\.reason === option\\.key', 'answerReason\\(option\\.key\\)'],
    ] as const) {
      const body = pageSource(name);
      assert.match(body, new RegExp(`\\{${list}\\.map\\(\\(option\\) => \\(\\s*<OptionRow\\b`), `the ${name} answers are not option rows`);
      assert.match(body, new RegExp(`selected=\\{${chosen}\\}`), `the ${name} choice is not carried as state`);
      assert.match(body, new RegExp(`onPress=\\{\\(\\) => ${answer}\\}`), `a ${name} answer is not one tap`);
      assert.match(body, /<Text accessibilityRole="header" style=\{st\.title\}>/, `the ${name} title is not a working title`);
    }
    // The resumed voice choice is carried the same way.
    assert.match(pageSource('plan'), /\{TUTOR_VOICE_OPTIONS\.map\(\(option\) => \(\s*<OptionRow\b[\s\S]*?selected=\{selected === option\.value\}/, 'the voice list is not option rows');
    for (const gone of ['<Ledger', 'LedgerRow', 'CHOSEN', 'st.chosen']) {
      assert.ok(!SCREEN.includes(gone), `the answers still carry ${gone}`);
    }
  });

  test('the save page asks with one ink pill and no middot, and the refusal is its own calm page with the frame drawing', () => {
    assert.equal(CREATE_ACCOUNT_AGE, 'I am 13 or older, create account');
    assert.doesNotMatch(CREATE_ACCOUNT_AGE, /[·—–]/, 'the pill carries a middot or a dash');
    assert.doesNotMatch(SCREEN, /·/, 'a middot is still on the first run');
    const save = SCREEN.slice(SCREEN.indexOf("{page === 'save' && !underAge && ("));
    assert.match(save, /^\{page === 'save' && !underAge && \(\s*<>\s*<PillButton label=\{CREATE_ACCOUNT_AGE\} onPress=\{\(\) => onCreateAccount\(draft\)\} \/>/, 'the save page is not asked with its one ink pill');
    assert.match(save, /<GhostButton label=\{YOUNGER\}[\s\S]*?<GhostButton label=\{ALREADY_HAVE_ACCOUNT\}/, 'the younger link is not first under the pill');

    // The trust card: one mark to a row, and the row's own sentence.
    const page = pageSource('save');
    const marks = ['<InfoGlyph size={20} color={paper.ink} />', '<MicGlyph size={20} color={paper.ink} />', '<LockGlyph size={20} color={paper.ink} />'];
    const at = marks.map((mark) => page.indexOf(mark));
    assert.ok(at.every((i, n) => i > 0 && (n === 0 || i > at[n - 1]!)), 'the trust rows do not each carry their one mark, AI first');
    for (const title of ['Speak when you choose', 'Raw audio stays out of your learning history']) {
      assert.ok(!page.includes(title), `the trust card still carries the bold title "${title}"`);
    }

    // Under thirteen: the frame drawing, a title and one line, no footer, and
    // moving between the pages does not undo it. It lives in this screen's
    // state only, so leaving through "I have an account" starts the first run
    // fresh, and closing the app reopens the save page with the question asked
    // again (F638).
    assert.equal(UNDER_AGE, `${UNDER_AGE_TITLE} ${UNDER_AGE_BODY}`, 'the refusal no longer reads as it always has');
    assert.equal(UNDER_AGE_TITLE, 'Luvani is for learners thirteen and up.');
    assert.match(page, /\{underAge && <Illustration name="state-postcard-frame" fit="small" \/>\}/, 'the refusal has no frame drawing');
    assert.match(page, /\{underAge \? UNDER_AGE_TITLE : SAVE_TITLE\}/, 'the refusal has no title of its own');
    assert.match(page, /<Text style=\{st\.refusalBody\}>\{UNDER_AGE_BODY\}<\/Text>/, 'the refusal says nothing under its title');
    assert.match(SCREEN, /const refusedHere = page === 'save' && underAge;/);
    assert.match(SCREEN, /footer=\{\s*refusedHere \? undefined : \(/, 'the refusal page still draws a footer');
    assert.match(SCREEN, /\{!refusedHere && <ProgressDots\b/, 'the refusal page still counts steps toward an account it will not make');
    const go = SCREEN.slice(SCREEN.indexOf('const go = '), SCREEN.indexOf('const sayReply'));
    assert.doesNotMatch(go, /setUnderAge\(false\)/, 'moving page undoes the refusal, so the way through is one tap from a refused child');
    assert.equal((SCREEN.match(/setUnderAge\(/g) ?? []).length, 1, 'the refusal is set or cleared from more than one place');
  });

  test('the onboarding doc says what undoes the under-13 refusal, and promises no more than the screen holds', () => {
    // F633. The refusal is this screen's own state, so it holds while the
    // learner moves between the pages and no longer: "I have an account"
    // leaves the screen, and SignIn's back mounts a fresh one with no refusal.
    // Closing the app is not a fresh start: the saved draft reopens the save
    // page with the question asked again (F638, pinned in the next test).
    // Saying it lasts the session overclaims a minors safeguard. If the
    // refusal moves to state that outlives the screen (F637), rewrite the
    // words and this pin together.
    assert.match(
      SCREEN,
      /const \[underAge, setUnderAge\] = useState\(false\);/,
      'the refusal no longer lives in this screen alone: check what the doc says undoes it, and move this pin with it',
    );
    const raw = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
    const doc = raw('../../../../docs/ONBOARDING.md');
    const row = doc.split('\n').find((line) => line.includes('| Save your plan (`save`) |'));
    assert.ok(row, 'docs/ONBOARDING.md has no row for the save page');
    const paraAt = doc.indexOf('**The age question sits on the save page.**');
    assert.ok(paraAt > 0, 'docs/ONBOARDING.md no longer explains the age question on the save page');
    const para = doc.slice(paraAt, doc.indexOf('\n\n', paraAt)).replace(/\s+/g, ' ');
    const overclaim = /\b(for|the rest of) the session\b|until the app is closed/i;
    assert.doesNotMatch(row, overclaim, 'the save page row says the refusal lasts the session');
    assert.doesNotMatch(para, overclaim, 'the age question paragraph says the refusal lasts the session');
    assert.match(row, /moving between the pages does not undo/, 'the save page row no longer says what the refusal survives');
    assert.match(
      para,
      /Moving back and forward between the pages does not undo it\. Leaving through "I have an account" starts the first run fresh, and closing the app reopens the save page with the question asked again, the same close-the-app escape the age gate keeps for a mis-tap\./,
      'the doc no longer names what starts the first run fresh after a refusal, and what a relaunch shows',
    );
    // The screen's own comments make the same promise, and no bigger one.
    assert.doesNotMatch(raw('./PreAccountOnboarding.tsx'), /stays for the session|rest of the session|until the app is closed/i);
  });

  test('the onboarding doc says a relaunch after the under-13 refusal reopens the save page with the question asked again', () => {
    // F638. "Save my plan" writes page 'save' to the draft, App.tsx saves every
    // draft to the device, and "I am younger than that" writes nothing. So a
    // relaunch opens on the save page with the refusal gone and the pill live.
    // That is the age gate's close-the-app escape for a mis-tap, and the words
    // must not promise a fresh start. If a refusal ever clears the draft (F639),
    // the pins below fail: rewrite the doc, the comment and this test together.
    const raw = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
    // Comment lines joined into prose, so a sentence split across `//` lines still reads whole.
    const prose = (text: string) => text.replace(/\n\s*(?:\/\/|\*)[ \t]?/g, ' ').replace(/\s+/g, ' ');
    const closingStartsFresh =
      /closing the app[^.]{0,80}starts the first run fresh|starts the first run fresh,? (?:when|if|after|once|on) [^.]{0,30}(?:clos|relaunch|quit)/i;
    for (const [name, text] of [
      ['docs/ONBOARDING.md', raw('../../../../docs/ONBOARDING.md')],
      ['PreAccountOnboarding.tsx', raw('./PreAccountOnboarding.tsx')],
    ] as const) {
      assert.doesNotMatch(prose(text), closingStartsFresh, `${name} says closing the app starts the first run fresh, but a relaunch reopens the save page`);
    }

    const doc = raw('../../../../docs/ONBOARDING.md');
    const paraAt = doc.indexOf('**The age question sits on the save page.**');
    assert.ok(paraAt > 0, 'docs/ONBOARDING.md no longer explains the age question on the save page');
    const para = prose(doc.slice(paraAt, doc.indexOf('\n\n', paraAt)));
    assert.match(para, /closing the app reopens the save page/, 'the age question paragraph no longer says what a relaunch after a refusal shows');

    // What makes it true: moving page is written to the draft, the refusal is
    // not, and the screen opens on the draft's page with no refusal.
    const go = SCREEN.slice(SCREEN.indexOf('const go = '), SCREEN.indexOf('const sayReply'));
    assert.match(go, /keep\(\{ page: to \}\)/, 'moving page is no longer written to the draft, so a relaunch may not reopen the save page');
    assert.match(
      SCREEN,
      /<GhostButton label=\{YOUNGER\} color=\{paper\.ink\} onPress=\{\(\) => setUnderAge\(true\)\} \/>/,
      'the younger link now does more than set the refusal: check whether it writes or clears the draft, and move the doc with it',
    );
    assert.doesNotMatch(SCREEN, /keep\(\{[^}]*underAge/, 'the refusal is written to the draft, so a relaunch no longer asks again');
    assert.match(SCREEN, /useState<PreAccountPage>\(\(\) => initialDraft\?\.page \?\? 'hear-it'\)/, 'the screen no longer opens on the saved page');
    assert.match(SCREEN, /const \[underAge, setUnderAge\] = useState\(false\);/, 'the screen no longer opens with the question unanswered');
  });

  test('every answer and the page go through the draft, so a return resumes where it left', () => {
    assert.match(SCREEN, /useState<PreAccountPage>\(\(\) => initialDraft\?\.page \?\? 'hear-it'\)/, 'a returning learner starts again from the first page');
    const keep = SCREEN.slice(SCREEN.indexOf('const keep ='), SCREEN.indexOf('const keep =') + 300);
    assert.match(keep, /onDraftChange\(next\)/, 'answers are held in memory only');
    assert.match(SCREEN, /keep\(\{ page: to \}\)/, 'moving page is not written to the draft');
  });

  test('sign-up frames the saved plan, and its account doors are the same three calls', () => {
    const signUp = read('../auth/SignUpScreen.tsx');
    assert.match(signUp, /<Text accessibilityRole="header"[^>]*>Create your account<\/Text>/, 'sign-up does not pick up where the plan left off');
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
