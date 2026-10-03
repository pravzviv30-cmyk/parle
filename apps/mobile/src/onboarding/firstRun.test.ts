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

  test('the captions are always there, the playing line is lit, and reduced motion lights every line', () => {
    const hear = pageSource('hear-it');
    assert.match(hear, /\{HEAR_IT_EXCHANGE\.map\(/, 'the exchange is not drawn from the model');
    assert.match(hear, /\{line\.fr\}/);
    assert.match(hear, /\{line\.en\}/);
    assert.match(SCREEN, /const dim = \(index: number\) => !reduced && lit !== null && lit !== index/, 'reduced motion does not show every line in full');
    assert.match(hear, /accessibilityLabel=\{lit !== null \? 'Stop the recording' : HEAR_AGAIN\}/, 'the explicit playback control has no matching name');
    assert.match(hear, /if \(lit !== null\) stop\(\); else playExchange\(0\)/, 'Hear and Stop do not control the exchange');
    assert.doesNotMatch(SCREEN, /AUTOPLAYS|if \(page === 'hear-it'[^\n]*playExchange/, 'the exchange starts without the learner choosing Hear');
    assert.match(SCREEN, /useLayoutEffect\(\(\) => \(\) => \{\s*onFinish.current = null;/, 'leaving can continue the audio chain');
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

  test('the selected recording gets a useful-line highlight without earning a tick or claiming an assessed attempt', () => {
    assert.equal((SCREEN.match(/<Highlight\b/g) ?? []).length, 1, 'the flow draws more than one highlighter');
    const line = pageSource('first-line');
    const said = line.indexOf("stage === 'selected'");
    const highlight = line.indexOf('<Highlight');
    assert.ok(said > 0 && highlight > said, 'the highlight appears before the learner selects the example');
    assert.match(line, /<Highlight text=\{FIRST_LINE\.reply\.fr\}/, 'the highlight is on something other than the reply');
    // The mint tick sits beside the marked line, and only once it is said.
    assert.doesNotMatch(SCREEN, /SceneMark|state="earned"/, 'a recording selection awards unearned learning evidence');
    assert.match(line, /\{HIGHLIGHT_MEANS\}/, 'the playback highlight has no scope explanation');
    // The tutor is named by a meta line on a white card, not drawn as a mark.
    assert.match(line, /<Text style=\{st\.speaker\}>\{persona\.name\}<\/Text>/, 'the tutor is not named on the first-line page');
    assert.doesNotMatch(SCREEN, /TutorMark/, 'the tutor mark is still drawn beside the lines');
    assert.match(line, /<FrenchBlock\s+french=\{FIRST_LINE\.question\.fr\}\s+english=\{FIRST_LINE\.question\.en\}\s+size="lg"/, 'the question is not the large French block');
    assert.match(line, /questionClip === undefined\s*\?\s*undefined/, 'the question offers playback with no recording behind it');
    assert.match(SCREEN, /player\.pause\(\);[\s\S]*player\.replace\(clip\)/, 'a second recording overlaps the first');
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
    assert.match(plan, /\{MINUTES_LABEL\}/, 'the flexible routine has no label');
    assert.match(plan, /ROUTINE_OPTIONS.map[\s\S]*keep\(\{ minutes: option.key \}\)/, 'a suggested routine cannot be changed and kept');
    assert.match(plan, /view.minutes === 'none'/, 'the routine has no unset state');
    assert.doesNotMatch(SCREEN, /\b(REMINDER_TIMES|requestPermissionsAsync)\b/, 'the demo introduces a permission or notification picker');
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
    // moving between the pages does not undo it. The sign-in detour does not
    // either (F637), and the refusal clears the saved draft (F639): both are
    // pinned in their own tests below.
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
    // F633, moved by F637 and F641. The refusal is seeded from state held
    // above this screen, so it holds while the learner moves between the
    // pages, across "I have an account" and back, and across a sign-in and
    // sign-out, for the rest of the launch. Saying it lasts the session
    // overclaims a minors safeguard, because a relaunch may ask again. If the
    // refusal moves to state with a different life, rewrite the words and
    // this pin together.
    assert.match(
      SCREEN,
      /const \[underAge, setUnderAge\] = useState\(refused\);/,
      'the refusal no longer comes from the flow above the screen: check what the doc says undoes it, and move this pin with it',
    );
    const doc = raw('../../../../docs/ONBOARDING.md');
    const row = doc.split('\n').find((line) => line.includes('| Save your plan (`save`) |'));
    assert.ok(row, 'docs/ONBOARDING.md has no row for the save page');
    const para = ageParagraph();
    const overclaim = /\b(for|the rest of) the session\b|until the app is closed/i;
    assert.doesNotMatch(row, overclaim, 'the save page row says the refusal lasts the session');
    assert.doesNotMatch(para, overclaim, 'the age question paragraph says the refusal lasts the session');
    assert.match(
      row,
      /Moving between the pages and leaving through "I have an account" do not undo it for the rest of the launch/,
      'the save page row no longer says what the refusal survives',
    );
    assert.match(
      para,
      /Moving back and forward between the pages does not undo it, and neither does leaving through "I have an account" and coming back: the refusal holds for the rest of the launch\./,
      'the doc no longer names what the refusal survives',
    );
    assert.match(para, /Signing in and out again does not end it; only closing the app does\./, 'the doc no longer says what does end the refusal');
    assert.doesNotMatch(para, /Signing in ends|until someone signs in/i, 'the doc says a sign-in ends the refusal, which narrows the founder\'s answer (F641)');
    // The screen's own comments make the same promise, and no bigger one.
    assert.doesNotMatch(raw('./PreAccountOnboarding.tsx'), /stays for the session|rest of the session|until the app is closed/i);
  });

  test('the onboarding doc says a relaunch after the under-13 refusal starts at the first page with nothing kept', () => {
    // F638, rewritten for F639. The words once said a relaunch reopens the
    // save page with the question asked again, which was true while a refusal
    // wrote nothing. The founder chose to clear on refusal (2026-09-30): the
    // saved draft goes, and nothing is saved again that launch, so a relaunch
    // opens the first page with no answers and no first name. The refusal
    // itself is memory only, never a marker on the device, so the words must
    // not promise it survives a relaunch either: that is the option the
    // founder did not choose.
    const reopensSave = /(?:clos|reopen|relaunch)[^.]{0,80}(?:reopens|opens on|back on|returns to) the save page/i;
    const survives =
      /refusal[^.]{0,60}(?:survives|outlasts|is remembered|is stored|is saved|stays after)[^.]{0,40}(?:clos|relaunch|reopen|restart)|(?:never|not) asked again|remembers? the refusal/i;
    for (const [name, text] of [
      ['docs/ONBOARDING.md', raw('../../../../docs/ONBOARDING.md')],
      ['PreAccountOnboarding.tsx', raw('./PreAccountOnboarding.tsx')],
    ] as const) {
      assert.doesNotMatch(prose(text), reopensSave, `${name} says a relaunch reopens the save page, but the refusal clears the draft`);
      assert.doesNotMatch(prose(text), survives, `${name} says the refusal outlasts a relaunch, but it is never written to the device`);
    }

    const para = ageParagraph();
    assert.match(
      para,
      /It also clears the saved first-run draft, including any first name typed, and nothing is saved again in that launch, so reopening the app starts at the first page with nothing kept\./,
      'the age question paragraph no longer says what a relaunch after a refusal shows',
    );
    assert.match(
      para,
      /The refusal itself lives in memory only and is never written to the device, so after a relaunch the question can be asked again, the same close-the-app escape the age gate keeps for a mis-tap\./,
      'the age question paragraph no longer says a relaunch may ask again',
    );

    // What makes it true: with no draft the screen opens on the first page
    // with an empty name, the refusal is never written to the draft, and once
    // refused nothing reaches the draft at all.
    assert.match(SCREEN, /useState<PreAccountPage>\(\(\) => initialDraft\?\.page \?\? 'hear-it'\)/, 'with no draft the screen opens somewhere other than the first page');
    assert.match(SCREEN, /const \[nameText, setNameText\] = useState\(\(\) => initialDraft\?\.firstName \?\? ''\);/, 'with no draft the name field is not empty');
    assert.doesNotMatch(SCREEN, /keep\(\{[^}]*(?:underAge|refus)/, 'the refusal is written to the draft, which the founder did not choose');
    assert.match(keepSource(), /if \(!underAge\) onDraftChange\(next\);/, 'a refused screen still writes the draft, so a relaunch would reopen mid-flow');
  });

  test('a refusal on the save page clears the saved draft, so a relaunch starts at the first page and keeps no first name', () => {
    // F639, founder 2026-09-30: clear on refusal. "Save my plan" wrote page
    // 'save' to the device, and so did any first name typed. The refusal now
    // hands off through `onRefuse`, which AuthFlow passes up to App.tsx, where
    // it runs the same discard the sign-in links use, and once refused this
    // screen writes nothing again, so moving page cannot put the draft back.
    const refuse = refuseSource();
    assert.match(refuse, /setUnderAge\(true\);/, 'the younger link no longer shows the refusal');
    assert.match(refuse, /onRefuse\?\.\(\);/, 'the refusal does not tell the flow, so the saved draft stays on the device');
    assert.doesNotMatch(refuse, /\bkeep\(|onDraftChange/, 'the refusal writes to the draft it should clear');
    assert.match(
      SCREEN,
      /<GhostButton label=\{YOUNGER\} color=\{paper\.ink\} onPress=\{refuse\} \/>/,
      'the younger link does not go through the refusal handler',
    );

    // Once refused, nothing reaches the device again this launch.
    assert.match(keepSource(), /if \(!underAge\) onDraftChange\(next\);/, 'a refused screen still saves the draft, so the next page move writes it back');
    assert.equal((SCREEN.match(/\bonDraftChange\(/g) ?? []).length, 1, 'the draft is written from somewhere other than keep');

    // The flow passes the refusal up, and App.tsx clears the draft with it.
    const flow = element(read('../auth/AuthFlow.tsx'), 'PreAccountOnboarding');
    assert.match(flow, /\bonRefuse=\{onRefuse\}/, 'AuthFlow does not pass the refusal up, so nothing clears the draft');
    const app = read('../../App.tsx');
    assert.match(element(app, 'AuthFlow'), /\bonRefuse=\{refusePreAccount\}/, 'App.tsx does not hear the refusal');
    const refuseInApp = app.slice(app.indexOf('const refusePreAccount'), app.indexOf('}, [discardPreAccountDraft]);', app.indexOf('const refusePreAccount')));
    assert.match(refuseInApp, /\bdiscardPreAccountDraft\(\);/, 'App.tsx does not clear the draft on a refusal');
    const discard = app.slice(app.indexOf('const discardPreAccountDraft'), app.indexOf('}, []);', app.indexOf('const discardPreAccountDraft')));
    assert.match(discard, /setPreAccountDraft\(null\);/, 'the discard keeps the draft in memory, so the screen could resume it');
    assert.match(discard, /void clearPreAccountDraft\(\);/, 'the discard leaves the draft on the device');

    // The clear takes the whole key, first name and page with it, and a
    // launch with no draft opens on the first page with an empty name.
    const draft = read('./preAccountDraft.ts');
    assert.match(draft, /firstName: string \| null;/, 'the first name no longer rides the draft: check what the refusal must clear');
    assert.match(draft, /export function clearPreAccountDraft\(\): Promise<void> \{\s*draftGeneration\+\+;\s*return enqueueDraft\(\(\) => AsyncStorage\.removeItem\(KEY\)\);/, 'the clear no longer removes the whole draft');
    assert.match(SCREEN, /useState<PreAccountPage>\(\(\) => initialDraft\?\.page \?\? 'hear-it'\)/, 'with no draft the screen opens somewhere other than the first page');
    assert.match(SCREEN, /const \[nameText, setNameText\] = useState\(\(\) => initialDraft\?\.firstName \?\? ''\);/, 'with no draft the name field is not empty');
  });

  test('the under-13 refusal holds across the sign-in detour for the rest of the launch', () => {
    // F637, founder 2026-09-30: firmer. The refusal lives in Gate in App.tsx,
    // which stays mounted for the whole launch (F641), and AuthFlow hands it
    // back to the screen whenever the first run is shown again. So "I have an
    // account", then SignIn's back, meets the refusal it left. It is memory
    // only: a marker on the device would be new data about a minor with a
    // retention period, which the founder did not choose.
    assert.match(SCREEN, /\brefused\?: boolean;/, 'the screen takes no refusal from the flow');
    assert.match(SCREEN, /\bonRefuse\?: \(\) => void;/, 'the screen cannot tell the flow it refused');
    assert.match(SCREEN, /\brefused = false,/, 'a screen mounted without the flow is not unrefused by default');
    assert.match(SCREEN, /const \[underAge, setUnderAge\] = useState\(refused\);/, 'the screen does not seed its refusal from the flow');
    assert.doesNotMatch(SCREEN, /setUnderAge\(false\)/, 'something on the screen undoes the refusal');
    assert.match(keepSource(), /if \(!underAge\) onDraftChange\(next\);/, 'a refused screen still writes the draft');

    const auth = read('../auth/AuthFlow.tsx');
    const app = read('../../App.tsx');
    assert.match(app, /const \[preAccountRefused, setPreAccountRefused\] = useState\(false\);/, 'nothing above the screen holds the refusal');
    assert.equal((app.match(/setPreAccountRefused\(/g) ?? []).length, 1, 'the refusal is set or cleared from more than one place');
    assert.match(app, /setPreAccountRefused\(true\);/, 'the refusal is never held');
    assert.match(element(app, 'AuthFlow'), /\brefused=\{preAccountRefused\}/, 'App.tsx does not hand the refusal to the flow');
    assert.equal((auth.match(/<PreAccountOnboarding\b/g) ?? []).length, 1, 'the first run is drawn from more than one place in the flow');
    const flow = element(auth, 'PreAccountOnboarding');
    assert.match(flow, /\brefused=\{refused\}/, 'the flow does not hand the refusal back to the screen');
    assert.match(flow, /\bonRefuse=\{onRefuse\}/, 'the flow does not pass the refusal up');
    // Sign in's back returns to the one welcome, which carries the refusal.
    assert.match(auth, /<SignInScreen onBack=\{\(\) => setScreen\('welcome'\)\}/, 'sign-in no longer returns to the first run');
    // Nothing remounts the flow while signed out.
    assert.doesNotMatch(element(app, 'AuthFlow'), /\bkey=/, 'App.tsx keys the flow, so a new key would drop the refusal');

    // Memory only, in both files, and the draft has no field for it.
    for (const [name, source] of [['AuthFlow.tsx', auth], ['PreAccountOnboarding.tsx', SCREEN]] as const) {
      assert.doesNotMatch(source, /AsyncStorage|SecureStore|localStorage|savePreAccountDraft|clearPreAccountDraft/, `${name} writes to the device itself`);
    }
    assert.doesNotMatch(read('./preAccountDraft.ts'), /refus|underAge/i, 'the draft carries the refusal to the device');
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
