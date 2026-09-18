/**
 * The four momentum cards and the day's word, one level down — F436, F438,
 * F391, F572.
 *
 * These rules were written for Home and they are not about Home. They are about
 * a block of counts that must never become a score, a week rail that must never
 * become a streak, and a word of the day that must never animate behind a
 * screen nobody is looking at. Revamp A moved all of it onto the Progress
 * screen, so the assertions moved with it, under the titles the ledger already
 * names: a title is what `npm run gate` looks for, so a rule that moves house
 * keeps its name and the tick stays honest.
 *
 * F436 is F398 amended rather than replaced. F398 held the momentum block to
 * "absent until there is something true to say"; on 2026-09-05 the founder
 * overturned that and the four cards ship from the learner's first day, worded
 * as a start. What did not move is the reason F398 existed: the block still
 * writes none of its own words, still says nothing at zero that names a target,
 * still scores nobody, and still keeps the violet off every bar and mark.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads source.
 * The ceiling is honest: it proves the block is wired to the module that owns
 * every number on it, never that a card was drawn on a phone.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** One line, so a regex about an expression reads code and not the wrapping. */
const flat = (body: string): string => body.replace(/\s+/g, ' ');

const MOMENTUM = stripComments(read('./MomentumCards.tsx'));
const SCREEN = stripComments(read('./ProgressScreen.tsx'));
const WORD_CARD = stripComments(read('./WordOfDayCard.tsx'));
/** The shared components, where the week rail and its marks live (F561). */
const COMPONENTS = stripComments(read('../components.tsx'));

function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

/** One style rule from the sheet at the foot of a file. */
function style(body: string, name: string): string {
  return between(body, `${name}: {`, '}', `${name} is a style this file defines`);
}

describe('the momentum block and the day\'s word, one level down — F436, F438, F391', () => {
  test('progress draws four momentum cards, keeps the target gentle and uses the accent once — F436', () => {
    // Four cards, always, from the learner's first day (founder, 2026-09-05).
    // The gate on the screen is about the storage read, not about having
    // anything to say: `momentum` is null only until the deck and the log
    // answer, and dropping it would show a returning learner the four start
    // lines for a frame before their own numbers arrived.
    assert.equal((MOMENTUM.match(/<Card\b/g) ?? []).length, 4, 'the momentum block no longer draws the four cards the design doc names');
    assert.match(
      flat(SCREEN),
      /\{momentum !== null && \( <View style=\{st\.block\}> <Label>\{MOMENTUM_LABEL\}<\/Label> <MomentumCards momentum=\{momentum\} onReviewPhrases=\{\(\) => nav\.navigate\('Review'\)\} \/> <\/View> \)\}/,
      'the momentum block is drawn with nothing holding it back, or with no way to the phrase bank',
    );
    assert.match(flat(SCREEN), /momentumFrom\(\{ activity, deck, profile, now \}\)/, 'the four counts are not folded by the one module that owns them');
    assert.ok(!MOMENTUM.includes('hasMomentum'), 'the block holds itself back again; the four cards are there from day one');
    assert.ok(!MOMENTUM.includes('return null'), 'the block draws nothing at all in some branch; the founder overturned that on 2026-09-05');
    for (const part of ['days', 'retained', 'mastery', 'goal']) {
      assert.ok(!MOMENTUM.includes(`${part} !== null &&`), `the ${part} card is held behind a gate of its own; all four are always drawn`);
    }

    // The refusal moved down a level rather than going. Every numeral is drawn
    // only where the field beside it is non-null, so a count is never a nought
    // and the module's start line stands in its place.
    const gates = [
      'days.count', 'retained.count', 'retained.weekLine', 'retained.moreLine', 'retained.foot',
      'retained.link', 'mastery.percentLabel', 'mastery.line', 'goal.amount',
    ];
    for (const gate of gates) {
      assert.ok(MOMENTUM.includes(`${gate} !== null &&`), `${gate} is drawn without being checked, so a nought or an empty line can reach the card`);
    }

    // Not one of the words is written here. `momentum.ts` decides every label,
    // every line and every start line, and a tile that spelled its own could
    // say "Days active" over a number counting something else.
    const fields = [
      'days.label', 'days.count', 'days.words',
      'retained.label', 'retained.sub', 'retained.count', 'retained.words',
      'retained.weekLine', 'retained.moreLine', 'retained.foot',
      'mastery.label', 'mastery.percentLabel', 'mastery.words', 'mastery.line',
      'goal.title', 'goal.amount', 'goal.note',
    ];
    for (const field of fields) {
      assert.ok(MOMENTUM.includes(`{${field}}`), `the block does not draw ${field}, so something else is saying it`);
    }
    assert.ok(MOMENTUM.includes('retained.chips.map('), "the hero draws none of the learner's own lines");
    assert.ok(MOMENTUM.includes('label={retained.link}'), 'the way to the phrase bank spells its own word');
    // Multiword, because the fields are named `retained`, `mastery` and `words`
    // now and a one-word ban would trip on an identifier rather than on copy.
    // This is a substring sweep: no style name in the file may contain one.
    for (const spelled of [
      'Days active', 'Retained phrases', 'Speaking time today', 'this week', "today's target",
      'spoken naturally', 'Active vocabulary', 'Review phrase bank', 'land here', 'Takes shape',
      'Settling in', 'of reviews',
    ]) {
      assert.ok(!MOMENTUM.includes(spelled), `the block spells "${spelled}" itself; that word is momentum.ts's`);
    }

    // And it works nothing out either. Every number arrived decided; a second
    // opinion about one is how two halves of a card come to disagree.
    for (const worked of ['Math.', 'toFixed', '.length']) {
      assert.ok(!MOMENTUM.includes(worked), `the block computes with ${worked}; momentum.ts owns every number on it`);
    }

    // The optional target is words, not a quota-shaped visual. The card may
    // report measured minutes and an optional remainder, but it has no meter,
    // percentage label or data field from which either could be rebuilt.
    const goalCard = between(
      flat(MOMENTUM),
      '<Card style={st.goal}>',
      '</Card>',
      'the speaking-time card is still one card',
    );
    for (const quota of ['goal.percent', 'goal.percentLabel', 'accessibilityRole="progressbar"', 'st.track', 'st.fill']) {
      assert.ok(!goalCard.includes(quota), `the optional target still renders ${quota}`);
    }
    for (const quotaStyle of ['track:', 'fill:', 'goalPercent:']) {
      assert.ok(!MOMENTUM.includes(quotaStyle), `the retired target meter left ${quotaStyle} behind`);
    }
    // The one mark that is not green, and the founder chose it (F577): the week
    // rail's filled day is the identity violet, because a calendar record is a
    // diary of days already spent rather than a state being reported.
    assert.match(style(COMPONENTS, 'markDone'), /backgroundColor: accent\.primary/, 'a day that happened is not the filled violet mark the founder chose for the calendar');
    // The shared rail, and the plain one: the labelled variant is Profile's,
    // where the rhythm panel is full width. Seven day names under a half-width
    // tile wrap onto a second line at 430pt and worse below it.
    assert.match(flat(MOMENTUM), /<WeekRail week=\{days\.week\} \/>/, 'the days card no longer draws the shared week rail');
    assert.ok(!MOMENTUM.includes('labels='), 'the half-width tile names its seven days, which wraps the rail onto two lines');
    assert.match(style(MOMENTUM, 'gain'), /color: signal\.good/, "the week's gain is not set in green");
    assert.ok(!MOMENTUM.includes('signal.live'), "the tutor's red reached a block about the learner");
    assert.ok(!MOMENTUM.includes('rungColor'), 'a rung colour reached the signal set, so a state could read as a rung');

    // The violet appears once in this file, on the badge beside the recall
    // figure, where it labels a card and reports nothing. It is not a fill or
    // a mark here, so it is not in the stylesheet at all: identity is
    // the colour of the thing you press, never the colour of a state. The one
    // other violet on the block is the rail's filled day, and that one lives in
    // `components.tsx` where the founder's calendar exception is written down.
    assert.equal(
      (MOMENTUM.match(/accent\./g) ?? []).length,
      1,
      'the accent is used more than once in the momentum block; the violet labels one glyph and nothing else',
    );
    assert.match(flat(MOMENTUM), /<BadgeGlyph color=\{accent\.primary\} \/>/, 'the one violet is somewhere other than the badge on the recall tile');
    assert.ok(
      !MOMENTUM.slice(MOMENTUM.indexOf('StyleSheet.create')).includes('accent.'),
      'the accent reached the momentum stylesheet; violet is identity, not a fill or a mark',
    );

    // A day that has not happened is not a state worth signalling, so it takes
    // no colour that means anything: no accent, no signal, no rung. TodayRow's
    // rule, kept, and now stated as the rule rather than as "no fill at all".
    //
    // It does carry a fill, and it has to. A hairline ring alone is invisible on
    // Profile's lilac rhythm panel, where the ring and the tint are within a
    // hair of each other, so seven waiting days simply were not there. The fill
    // is `paper.card`, which is the paper a card is made of rather than a
    // colour with a meaning, so the dot reads as an empty slot on a tint and on
    // white alike. That is the mockup's outline dot.
    const waiting = style(COMPONENTS, 'markWaiting');
    assert.match(waiting, /backgroundColor: paper\.card/, 'the waiting dot has no paper under it, so it disappears on a tint');
    assert.match(waiting, /borderColor: paper\.line/, 'the waiting mark is not the hairline');
    for (const meaning of ['accent.', 'signal.', 'rungColor']) {
      assert.ok(!waiting.includes(meaning), `a day that has not happened is filled with ${meaning}, which reports an absence back to the learner`);
    }

    // Screen readers get the same measured amount and gentle sentence as
    // everyone else; there is no hidden progressbar announcing a percentage.
    assert.match(goalCard, /\{goal\.amount !== null && <Text style=\{st\.goalAmount\}>\{goal\.amount\}<\/Text>\}/, 'the truthful measured amount is no longer drawn');
    assert.match(goalCard, /<Text style=\{st\.goalNote\}>\{goal\.note\}<\/Text>/, 'the gentle status sentence is no longer drawn');

    // No score anywhere, and the list is unchanged. The figure on the recall
    // tile is a share of the deck's own reviews, not a mark out of ten, and
    // this is what catches it drifting into being one.
    for (const scored of ['score', 'Score', 'accuracy', 'correct']) {
      assert.ok(!MOMENTUM.includes(scored), `the block says ${scored}; nothing here scores a learner`);
    }
    // The one primary pill on a screen belongs to the screen, not to a block
    // that reports counts.
    assert.ok(!MOMENTUM.includes('<PillButton'), 'the momentum block grew a primary pill; a block of counts asks for nothing');

    // The two tiles sit side by side and both can shrink. Without `minWidth: 0`
    // a long word inside one pushes the other off the screen at large text.
    assert.match(style(MOMENTUM, 'tiles'), /flexDirection: 'row'/, 'the momentum tiles are not side by side');
    const tile = style(MOMENTUM, 'tile');
    assert.match(tile, /flex: 1/, 'a tile does not take its share of the row');
    assert.match(tile, /minWidth: 0/, 'a tile cannot shrink, so its neighbour goes off the screen at large text');
  });

  test('home wires the phrase bank link to the review deck and keeps the next step outside every momentum gate — F438', () => {
    // The block's link is the quiet one, and it opens the door Practice's own
    // control opens. Two surfaces sending a learner to two different decks
    // would be two answers to one question.
    assert.match(flat(MOMENTUM), /<GhostButton label=\{retained\.link\} onPress=\{onReviewPhrases\} \/>/, 'the phrase bank link is not the quiet control reading its word from the module');
    assert.match(flat(SCREEN), /onReviewPhrases=\{\(\) => nav\.navigate\('Review'\)\}/, 'the phrase bank link does not open the review deck');
    const practice = stripComments(read('../tabs/PracticeTab.tsx'));
    assert.match(practice, /nav\.navigate\('Review'\)/, 'Practice no longer opens the review deck, so the two surfaces have drifted apart');

    // The next step is not part of the block and never was. It is the hero on
    // Home, drawn for a learner with nothing behind them, and a gate around it
    // would be a blank page on a first run. The counts are a level down now, so
    // the hero cannot be inside one of their gates by construction, and this is
    // what stops a count following it back up.
    const home = stripComments(read('../tabs/HomeTab.tsx'));
    assert.match(home, /\{hero !== null && <MissionHero hero=\{hero\} \/>\}/, 'the hero is drawn behind some other condition than having a situation to offer');
    for (const count of ['momentum', 'Momentum', 'percent', 'Recall']) {
      assert.ok(!home.includes(count), `Home reaches for ${count} again; the counts live on the Progress screen now`);
    }
    // And the way from one to the other is a row on Home that opens this
    // screen, so nothing was hidden by being moved.
    assert.match(home, /nav\.navigate\('Progress'\)/, 'nothing on Home opens the screen the counts moved to');
  });

  test("home draws the word of the day from the learner's tier under a paused, decorative daily scene — F391", () => {
    // The pool and the pick are core's. The screen reads them with the one
    // `now` it takes per focus and stores nothing, so the same day gives the
    // same word on a fresh install and on a two-year-old one.
    assert.match(flat(SCREEN), /import \{[\s\S]*?\bDAILY_WORDS\b[\s\S]*?\} from '@luvani\/core'/, "the screen never imports core's word pool");
    assert.match(flat(SCREEN), /import \{[\s\S]*?\bdailyPick\b[\s\S]*?\} from '@luvani\/core'/, 'the screen never imports the daily pick');
    assert.match(flat(SCREEN), /import \{[\s\S]*?\bwordsForLevel\b[\s\S]*?\} from '@luvani\/core'/, 'the screen never imports the tier rule, so every learner meets the same pool');
    assert.ok(!SCREEN.includes('Math.random'), 'the word is picked at random, so it would change under the learner mid-day');

    // The word is pitched, so it waits on storage: the tier comes from the
    // level standing and the level standing is XP that has to be read. Picked
    // before the read it would be a tier one word replaced a moment later,
    // which is the app appearing to change its mind about a learner.
    const awaited = between(
      flat(SCREEN),
      'void Promise.all(',
      'return () => {',
      'the screen no longer folds its storage reads together, so this walk reads the wrong half of the effect',
    );
    assert.match(
      awaited,
      /const standing = levelFor\(totalXp\(activity\)\);/,
      "the tier is not read from the app's one level standing, so the screen has grown a second opinion about how far a learner has come",
    );
    assert.match(
      awaited,
      /setWord\(dailyPick\(wordsForLevel\(DAILY_WORDS, standing\.index\), now\)\)/,
      "the word of the day is not today's word from the learner's tier, on the screen's one clock reading",
    );
    assert.ok(
      flat(SCREEN).indexOf('setWord(') > flat(SCREEN).indexOf('void Promise.all('),
      'the word is picked before the XP is read, so a learner would watch it change tier a moment after it appeared',
    );

    // The drawing does not wait. It is a pure function of the day and a pool.
    assert.match(flat(SCREEN), /import \{ WORD_SCENES, type WordSceneKey \} from '\.\/wordScenes\.ts'/, 'the screen never imports the scene pool');
    assert.match(flat(SCREEN), /setScene\(dailyPick\(WORD_SCENES, now\)\)/, "the day's drawing is not picked by the day, from the screen's one clock reading");
    assert.ok(
      flat(SCREEN).indexOf('setScene(') < flat(SCREEN).indexOf('void Promise.all('),
      'the drawing waits on storage; it is a function of the day alone and belongs on screen before the bridge answers',
    );
    assert.match(
      flat(SCREEN),
      /\{word !== null && scene !== null && <WordOfDayCard word=\{word\} scene=\{scene\} paused=\{!focused\} \/>\}/,
      'the word card is drawn without a word, without the day it is being drawn for, or without being told when the screen is off top',
    );

    // Nothing loops behind a screen nobody is looking at. The scene cannot ask
    // for itself, so the screen passes the answer down and the card passes it
    // on to whichever of the twenty today is.
    assert.match(WORD_CARD, /import \{ WordScene \} from '\.\/WordScene\.tsx'/, 'the card does not reach the day through the chooser');
    assert.ok(!WORD_CARD.includes('WordSprout'), 'the card still names one fixed drawing, so nineteen days of the rotation never reach it');
    assert.match(WORD_CARD, /<WordScene scene=\{scene\} width=\{\d+\} paused=\{paused\} \/>/, 'the scene is drawn without a day, or without being told to stop');
    assert.match(SCREEN, /useIsFocused/, 'the screen passes paused without knowing whether it is focused');

    // Every field of the entry, and not one word of it spelled here. The card
    // is handed the day's word and sets it.
    for (const field of ['word.fr', 'word.en', 'word.note', 'word.exampleFr', 'word.exampleEn']) {
      assert.ok(WORD_CARD.includes(`{${field}}`), `the card does not draw ${field}`);
    }
    assert.match(WORD_CARD, /<Label>Word of the day<\/Label>/, 'the card lost the one label that names what it is');

    // No caption line, and no caption ink. Every word on this card is a word
    // the learner reads, and words clear 4.5; inkFaint measures under even the
    // mark floor on a card, which is how the least legible text in the app
    // happened once already.
    assert.ok(!WORD_CARD.includes('inkFaint'), 'the word card sets learner-facing text in the faint ink');
  });
});
