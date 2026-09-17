/**
 * The Progress screen, read as source — F572.
 *
 * Four blocks moved down a level off Home and nothing was dropped on the way,
 * which is the whole claim this file holds. There is no renderer here, so the
 * screen is read as text: what it draws, what it reads, what it refuses to
 * decide for itself, and that it wears the one frame with one way back.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const SCREEN = stripComments(read('./ProgressScreen.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');
const MOMENTUM = stripComments(read('./MomentumCards.tsx'));

describe('real progress is a screen of its own, and it kept everything Home let go of — F572', () => {
  test('the progress screen keeps the momentum, the week story and the word of the day', () => {
    // The week, from the one module allowed to narrow it, and absent when the
    // week was quiet: a block that can draw empty is a quota.
    assert.match(FLAT, /import \{ hasStory, storyFrom, type WeekStory \} from '\.\/story\.ts'/, 'the screen does not read the week story');
    assert.match(
      FLAT,
      /setStory\(storyFrom\(\{ sessions: history, activity, packs, completions, now \}\)\)/,
      'the story is narrowed before story.ts sees it, which walks straight past the no-delta guarantee',
    );
    assert.match(FLAT, /story !== null && hasStory\(story\)/, 'a quiet week still draws the story block');

    // What the learner can now do: the module's rows, the place's own paper and
    // the place's own mark, and a chevron that opens the scene it came from.
    assert.match(FLAT, /<Label>\{CAN_DO_LABEL\}<\/Label>/, 'the abilities block lost its heading, or the screen typed one itself');
    assert.match(FLAT, /rows !== null && hasCanDo\(rows\)/, 'an empty abilities list still draws its heading');
    assert.match(FLAT, /setRows\(canDoRows\(stampsFrom\(progress\)\)\)/, 'the rows are not the passport’s stamps folded by progressView.ts');
    assert.match(FLAT, /<TintRow key=\{row\.missionId\} tint=\{missionTint\(row\.place\)\}/, 'an ability row does not take its place’s own tint');
    assert.match(FLAT, /glyph=\{<PlaceGlyph place=\{row\.place\}/, 'an ability row does not carry its place’s own mark');
    assert.match(FLAT, /onPress=\{\(\) => nav\.navigate\('Convo', \{ missionId: row\.missionId \}\)\}/, 'an ability row ends in a chevron that opens nothing');

    // The four momentum cards, moved here whole and drawn under the screen's
    // own heading rather than one of their own.
    assert.match(
      FLAT,
      /<Label>\{MOMENTUM_LABEL\}<\/Label> <MomentumCards momentum=\{momentum\} onReviewPhrases=\{\(\) => nav\.navigate\('Review'\)\} \/>/,
      'the momentum block is not drawn under the screen’s heading, or has lost its way to the phrase bank',
    );
    assert.match(FLAT, /momentum !== null &&/, 'the momentum block is drawn from an unanswered read, so a first morning is shown to somebody who has been talking for months');
    assert.equal((MOMENTUM.match(/<Card\b/g) ?? []).length, 4, 'the momentum block no longer draws its four cards');
    // The plain rail, without day names. Seven labels under a half-width tile
    // wrap onto two lines on a 430pt phone; the labelled rail is Profile's,
    // where the rhythm panel is full width and the week is the subject rather
    // than one tile of four.
    assert.match(MOMENTUM, /<WeekRail week=\{days\.week\} \/>/, 'the momentum tile no longer draws the shared week rail');
    assert.doesNotMatch(MOMENTUM, /labels=/, 'the half-width momentum tile labels its seven dots, which wraps the rail onto two lines');
    assert.ok(!MOMENTUM.includes('<Label>'), 'the momentum block names its own section again, so the screen and the block can head it twice');

    // The day's word at the foot, told to stop when something is pushed over
    // the top of this screen. A loop nobody is looking at is F313's own defect.
    assert.match(
      FLAT,
      /\{word !== null && scene !== null && <WordOfDayCard word=\{word\} scene=\{scene\} paused=\{!focused\} \/>\}/,
      'the word of the day is drawn without a scene, or without being told to stop',
    );
    assert.match(FLAT, /const focused = useIsFocused\(\)/, 'the screen never asks whether it is on top, so its scene loops behind whatever is');
    assert.match(FLAT, /setWord\(gentlestWord\(now\)\)/, 'a disk that will not answer takes the word with it as well as the counts');
  });

  test('the screen wears the one frame, shows one way back, and decides nothing it draws', () => {
    assert.equal((SCREEN.match(/<ScrollScreen\b/g) ?? []).length, 1, 'the screen is not built on the shared scrolling frame');
    assert.equal((SCREEN.match(/<ScreenHeader\b/g) ?? []).length, 1, 'a pushed screen shows exactly one way back');
    assert.match(FLAT, /<ScreenHeader back=\{\{ onPress: onBack \}\} \/>/, 'the header is not the shared back');
    for (const own of ['useSafeAreaInsets', '<ScrollView', '<ChevronLeft', 'accessibilityLabel="Back"']) {
      assert.ok(!SCREEN.includes(own), `the screen re-derives ${own} instead of taking it from the frame`);
    }

    // Every heading comes from the module beside this file. A string in a .tsx
    // is a string no test in this workspace can read back.
    for (const heading of ['PROGRESS_TITLE', 'CAN_DO_LABEL', 'MOMENTUM_LABEL']) {
      assert.ok(SCREEN.includes(heading), `the screen no longer reads ${heading} from progressView.ts`);
    }
    assert.ok(!SCREEN.includes("'Real progress'"), 'the screen types its own title, so nothing can read the copy back');

    for (const raw of ['fontSize', 'fontFamily', 'lineHeight']) {
      assert.ok(!SCREEN.includes(raw), `the screen writes ${raw} itself; the type scale lives in theme.ts`);
    }
    assert.doesNotMatch(SCREEN, /#[0-9A-Fa-f]{6}/, 'the screen writes a raw colour; every hex lives in palette.ts');
    for (const clip of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'adjustsFontSizeToFit']) {
      assert.ok(!SCREEN.includes(clip), `the screen uses ${clip}, so a learner who turns the text up loses words`);
    }
    // No number a learner could read is typed here. Layout takes its numbers
    // from the tokens; every figure on the page belongs to the module that
    // counted it.
    for (const quoted of SCREEN.match(/'[^']*'/g) ?? []) {
      assert.doesNotMatch(quoted, /\d/, `the screen types ${quoted}; every figure here belongs to the module that counted it`);
    }
    assert.doesNotMatch(SCREEN, /—/, 'the screen carries an em dash, which no learner-facing file may');
  });
});
