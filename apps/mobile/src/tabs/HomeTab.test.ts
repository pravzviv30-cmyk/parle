/**
 * What Home is allowed to decide, draw and leave out — F420, F391, F392, F398,
 * F399, F400 and F409.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen, the way `PracticeTab.test.ts` and `MyFrenchTab.test.ts` do, and with
 * the same machinery. That is a blunt tool and its ceiling is honest: it proves
 * the greeting is wired to the hook rather than to a timer of its own, never
 * that a word slid up a slot on a phone. `docs/DEVICE_VERIFICATION.md`'s Pass 5
 * owns the half a source walk cannot see.
 *
 * The class of bug it is pointed at is the one a renderer would not catch
 * either: a screen quietly growing a second opinion about a rule that already
 * has a module. So the positive halves here are small — an import, a call, a
 * gate — and every assertion with weight in it is about what Home must NOT
 * have: a hand-split name, a spelled label, an invented colour, a count outside
 * its module's gate, or one of the things the founder took off this page.
 *
 * Home is read together with the four cards it draws, because a pill moved into
 * a card is still a pill on the screen and a label spelled in a card is still a
 * label the module was supposed to own.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { NEXT_STEP } from '../progress/portfolio.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** One line, so a regex about an expression reads code and not the wrapping. */
const flat = (body: string): string => body.replace(/\s+/g, ' ');

const SCREEN = stripComments(read('./HomeTab.tsx'));
const FLAT = flat(SCREEN);
/** The render only, so the ordering checks read JSX and not the state hooks. */
const RENDER = SCREEN.slice(SCREEN.indexOf('<ScrollScreen'));

/** The four cards Home draws, each read once. */
const WORD_CARD = stripComments(read('../home/WordOfDayCard.tsx'));
const SITUATION = stripComments(read('../home/SituationCard.tsx'));
const MOMENTUM = stripComments(read('../home/MomentumCards.tsx'));
const NEXT_ROW = stripComments(read('../home/NextStepRow.tsx'));

/**
 * Home's own file, every card it draws, and the two files behind the word
 * card's drawing, which together are the surface.
 *
 * The chooser and its pool are on this list for the reason the cards are: a
 * pill moved off a card into a file the card imports is still a pill on the
 * screen, and a word spelled one directory further away is still a word the
 * learner reads. `wordScenes.test.ts` owns what those two say about the
 * rotation; this file owns what they are allowed to put on the page.
 */
const HOME_SURFACE = [
  ['HomeTab.tsx', SCREEN],
  ['WordOfDayCard.tsx', WORD_CARD],
  ['WordScene.tsx', stripComments(read('../home/WordScene.tsx'))],
  ['wordScenes.ts', stripComments(read('../home/wordScenes.ts'))],
  ['SituationCard.tsx', SITUATION],
  ['MomentumCards.tsx', MOMENTUM],
  ['NextStepRow.tsx', NEXT_ROW],
] as const;

/**
 * The text between two markers, with both proven present.
 *
 * `PracticeTab.test.ts`'s `between`, for its reason: `indexOf` answers -1 for
 * something that is not there, and a slice taken from -1 is a slice of the
 * wrong part of the file, so every assertion after it would be asked of text
 * nobody wrote.
 */
function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

/** Where a marker sits on the screen, proven present so ordering is real. */
function at(marker: string): number {
  const i = RENDER.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the screen at all`);
  return i;
}

/** One style rule from the sheet at the foot of a file. */
function style(body: string, name: string): string {
  return between(body, `${name}: {`, '}', `${name} is a style this file defines`);
}

/**
 * Every `<Tag ...>` in a body, whole, counting braces.
 *
 * `MyFrenchTab.test.ts`'s walk, and it is needed for the same reason: an
 * `onPress` arrow carries a `>` of its own, so a lazy regex stops inside the
 * tag and reports the wrong text as the element.
 */
function tags(body: string, tag: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(new RegExp(`<${tag}\\b`, 'g'))) {
    let depth = 0;
    for (let i = match.index; i < body.length; i += 1) {
      const char = body[i]!;
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) {
        found.push(body.slice(match.index, i + 1));
        break;
      }
    }
  }
  return found;
}

/** Every quoted string in a body, minus the module paths nobody reads. */
function literals(body: string): string[] {
  return (body.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? []).filter((line) => !line.includes('/') && !line.includes('${'));
}

/**
 * The words in a body: quoted strings and JSX text.
 *
 * `literals` alone is not enough. A label written as JSX text carries no
 * quotes, so a sweep built only on quoted strings would read the accessibility
 * roles and miss the lines a learner actually reads.
 */
function spoken(body: string): string[] {
  const text = [...body.matchAll(/>\s*([A-Za-z][^<{}]*?)\s*</g)].map((m) => m[1]!);
  return [...literals(body), ...text];
}

describe('Home opens on the day rather than on a summary — F420, F391, F392', () => {
  test('home opens on the swiping greeting alone, held still for reduce motion and read once by a screen reader — F420', () => {
    // The rotation is the hook's, whole. Home holds no timer, no interval and
    // no Animated value of its own: `useGreetingRotation` owns the two timers,
    // the native-driver swipe, the commit frame, the reduce-motion branch and
    // the teardown, and a second copy of any of that here is a second answer to
    // a settled question.
    assert.match(
      FLAT,
      /import \{ useGreetingRotation \} from '\.\.\/home\/useGreetingRotation\.ts'/,
      'Home never imports the greeting rotation, so it has no greeting to draw',
    );
    assert.match(
      FLAT,
      /useGreetingRotation\(\{ firstName, focused \}\)/,
      'the rotation is not fed the name and the focus flag, so it cannot stop when the tab is not on top',
    );
    for (const forbidden of ['setInterval', 'setTimeout', 'Animated.timing', 'Animated.loop', 'requestAnimationFrame']) {
      assert.ok(!SCREEN.includes(forbidden), `Home drives the greeting itself with ${forbidden}; that chain lives in the hook`);
    }

    // Exactly one header, and the movement crosses into it as one value the
    // frame interpolates rather than as a display line escaping layout.tsx
    // into this stylesheet.
    assert.equal((SCREEN.match(/<TabHeader\b/g) ?? []).length, 1, 'Home draws more than one tab header');
    const header = tags(RENDER, 'TabHeader')[0];
    assert.ok(header, 'Home does not open on a tab header');
    assert.match(header, /titleSwap=\{greeting\.swap\}/, 'the header is handed no swap, so the greeting never moves');
    assert.ok(!SCREEN.includes('...type.display'), 'Home spreads the display line into its own stylesheet; that line lives in layout.tsx');

    // One fixed announcement, and it is the still line. A header renaming
    // itself every few seconds and announcing each new name is the most hostile
    // thing this app could do to somebody listening to it, so `title` is the
    // whole greeting at rest, which is also what a learner who asked for less
    // movement reads, and there is no live region anywhere near this row.
    assert.match(header, /title=\{greeting\.rest\}/, 'the header draws the moving word as its title instead of the still line');
    assert.ok(!header.includes('titleOpacity'), 'the header is still handed the fade the swipe replaced');
    assert.ok(
      !SCREEN.includes('titleAccessibilityLabel'),
      'Home still names the header separately; the still line is the title now, so a second label would be a second greeting',
    );
    assert.ok(!SCREEN.includes('greetingRest'), 'Home assembles the resting greeting itself; the hook returns it');
    assert.ok(!SCREEN.includes('accessibilityLiveRegion'), 'Home carries a live region, so the greeting would be announced again and again');

    // The greeting alone. The founder took all three of these off the header.
    assert.ok(!header.includes('purpose='), 'Home grew a purpose line back under the greeting');
    assert.ok(!header.includes('trailing='), 'Home grew a control back beside the greeting');
    assert.ok(!SCREEN.includes('<Monogram'), 'the profile initial is back on Home beside the greeting');

    // One name rule for the app. `firstNameOf` splits it, here and on the tutor
    // dashboard, and a learner who skipped the question is never called "you".
    assert.match(FLAT, /import \{ firstNameOf \} from '\.\.\/tutor\/dashboard\.ts'/, 'Home splits the name somewhere other than the one place that splits names');
    assert.match(FLAT, /firstNameOf\(profile\.name\)/, 'Home does not read the learner name through firstNameOf');
    assert.ok(!SCREEN.includes(".split(' ')"), 'Home hand-splits profile.name again');
    assert.ok(!SCREEN.includes("'you'"), 'Home falls back to calling the learner "you"');
  });

  test("home draws the word of the day from the learner's tier under a paused, decorative daily scene — F391", () => {
    // The pool and the pick are core's. Home reads them with the one `now` it
    // takes per focus and stores nothing, so the same day gives the same word
    // on a fresh install and on a two-year-old one.
    assert.match(FLAT, /import \{[^}]*\bDAILY_WORDS\b[^}]*\} from '@luvani\/core'/, "Home never imports core's word pool");
    assert.match(FLAT, /import \{[^}]*\bdailyPick\b[^}]*\} from '@luvani\/core'/, 'Home never imports the daily pick');
    assert.match(FLAT, /import \{[^}]*\bwordsForLevel\b[^}]*\} from '@luvani\/core'/, "Home never imports the tier rule, so every learner meets the same pool");
    assert.ok(!SCREEN.includes('Math.random'), 'Home picks the word at random, so it would change under the learner mid-day');

    // The word is pitched, so it waits on storage: the tier comes from the
    // level standing and the level standing is XP that has to be read. Picked
    // before the read it would be a tier one word replaced a moment later,
    // which is the app appearing to change its mind about a learner.
    const awaited = between(
      FLAT,
      'void Promise.all(',
      'return () => {',
      'Home no longer folds its storage reads together, so this walk reads the wrong half of the effect',
    );
    assert.match(
      awaited,
      /const standing = levelFor\(totalXp\(activity\)\);/,
      "the tier is not read from the app's one level standing, so Home has grown a second opinion about how far a learner has come",
    );
    assert.match(
      awaited,
      /setWord\(dailyPick\(wordsForLevel\(DAILY_WORDS, standing\.index\), now\)\)/,
      "the word of the day is not today's word from the learner's tier, on the screen's one clock reading",
    );
    assert.ok(
      FLAT.indexOf('setWord(') > FLAT.indexOf('void Promise.all('),
      'the word is picked before the XP is read, so a learner would watch it change tier a moment after it appeared',
    );

    // The drawing does not wait. It is a pure function of the day and a pool,
    // taken from the same `now` as the situation beside it.
    assert.match(FLAT, /import \{ WORD_SCENES, type WordSceneKey \} from '\.\.\/home\/wordScenes\.ts'/, 'Home never imports the scene pool');
    assert.match(FLAT, /setScene\(dailyPick\(WORD_SCENES, now\)\)/, "the day's drawing is not picked by the day, from the screen's one clock reading");
    assert.ok(
      FLAT.indexOf('setScene(') < FLAT.indexOf('void Promise.all('),
      'the drawing waits on storage; it is a function of the day alone and belongs on screen before the bridge answers',
    );
    assert.match(
      FLAT,
      /\{word !== null && scene !== null && \( <WordOfDayCard word=\{word\} scene=\{scene\} paused=\{!focused\} \/> \)\}/,
      'the word card is drawn without a word, without the day it is being drawn for, or without being told when the tab is off top',
    );

    // Nothing loops behind a tab nobody is looking at. The scene cannot ask for
    // itself, so the tab passes the answer down and the card passes it on to
    // whichever of the twenty today is.
    assert.match(WORD_CARD, /import \{ WordScene \} from '\.\/WordScene\.tsx'/, 'the card does not reach the day through the chooser');
    assert.ok(!WORD_CARD.includes('WordSprout'), 'the card still names one fixed drawing, so nineteen days of the rotation never reach it');
    assert.match(WORD_CARD, /<WordScene scene=\{scene\} width=\{\d+\} paused=\{paused\} \/>/, 'the scene is drawn without a day, or without being told to stop');
    assert.match(SCREEN, /useIsFocused/, 'Home passes paused without knowing whether it is focused');

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

  test("home's situation card carries the tab's one pill, opens the conversation through tutorGate with the daily seed topic, and drops the accent and level chrome — F392", () => {
    // One primary action on the page, and it is the spoken one. Counted across
    // Home and every card Home draws, because a pill moved into a card is still
    // a pill on the screen.
    const pills = HOME_SURFACE.flatMap(([path, body]) => (body.match(/<PillButton\b/g) ?? []).map(() => path));
    assert.deepEqual(pills, ['SituationCard.tsx'], `Home draws ${pills.length} primary pills; the surface carries exactly one, in the situation card`);
    assert.match(SITUATION, /label="Start oral session"/, "the tab's one pill is not the spoken session");
    assert.match(SITUATION, /icon=\{<MicGlyph/, 'the pill lost the microphone that says what it opens');

    // The same gate the Tutor tab runs, in the same order, with the same words
    // on the way back. Two surfaces disagreeing about one dead server is how a
    // learner stops believing either of them.
    assert.match(flat(SITUATION), /import \{ TUTOR_OFFLINE, tutorGate \} from '\.\.\/tutor\/gate\.ts'/, 'the card decides for itself whether a start starts anything');
    assert.match(flat(SITUATION), /recheck\(\)\.then\(\(answered\) => \{/, 'the card never re-probes the connection before opening a room');
    assert.match(flat(SITUATION), /tutorGate\(answered, false\)/, 'the card does not ask the gate, or asks it in text mode');
    assert.match(
      flat(SITUATION),
      /nav\.navigate\(decision\.screen, \{ \.\.\.decision\.params, seedTopic: seedTopicOf\(scenario\) \}\)/,
      "the conversation does not open on today's scene through the seed topic pipe",
    );
    assert.match(flat(SITUATION), /if \(checking\) return;/, 'a second tap while the probe is in flight can open a second room');

    // Held back is answered, not swallowed: the module's line and the module's
    // retry, and the retry is the same start rather than a smaller one.
    const heldBack = between(SITUATION, 'heldBack !== null &&', '</View>', 'the card answers a start it could not honour');
    assert.match(heldBack, /\{TUTOR_OFFLINE\.body\}/, 'a held-back start says nothing about why');
    assert.match(heldBack, /label=\{checking \? TUTOR_OFFLINE\.checking : TUTOR_OFFLINE\.retry\}/, 'there is no way to check again');
    assert.match(heldBack, /<OutlineButton/, 'the way to check again is drawn as a second primary');

    // Bookmark is the quiet control and its word is the module's. Home writes
    // the decision and reads the store back rather than assuming it took.
    assert.match(
      SITUATION,
      /import \{ bookmarkAccessibilityLabel, bookmarkLabel \} from '\.\.\/bookmarks\/view\.ts'/,
      'the card spells the bookmark word itself',
    );
    assert.match(
      flat(SITUATION),
      /<OutlineButton label=\{bookmarkLabel\(saved\)\}/,
      'the bookmark is not the quiet outline reading its word from the module',
    );
    // "Bookmark" and "Saved" name nothing on their own: a blind learner reaches
    // this button several lines below the title it belongs to, so the sentence
    // carries the situation with it, the way startLabel does for the pill.
    assert.match(
      flat(SITUATION),
      /accessibilityLabel=\{bookmarkAccessibilityLabel\(saved, scenario\.titleEn\)\}/,
      'the bookmark button reads as a bare word to a screen reader, naming no situation',
    );
    assert.match(FLAT, /setBookmark\(id, !saved\)/, 'Home never writes the bookmark decision');
    assert.match(FLAT, /\.then\(\(\) => loadBookmarks\(\)\)/, 'Home assumes the write took instead of reading the store back');
    assert.match(FLAT, /isBookmarked\(bookmarks, scenario\.id\)/, 'Home decides for itself whether a scene is saved');

    // The situation is the day's, and the title on it is English.
    assert.match(FLAT, /setScenario\(dailyPick\(DAILY_SCENARIOS, now\)\)/, "today's situation is not picked by the day");
    assert.ok(SITUATION.includes('{scenario.titleEn}'), 'the card does not title the scene in English');
    assert.ok(SITUATION.includes('{scenario.bodyEn}'), 'the card does not say what the learner is doing there');
    assert.ok(SITUATION.includes('{scenario.openingFr}'), 'the card does not offer the first line to say');
    assert.match(SITUATION, /<Label>Starting line<\/Label>/, 'the starting line is not named');

    // And the removals, each named so putting one back fails rather than drifts.
    for (const [path, body] of HOME_SURFACE) {
      for (const gone of ['Listen to accent', 'Immersive', 'B1', '<NextSituationCard', 'SpeakBubbles', '<Monogram', 'purpose=']) {
        assert.ok(!body.includes(gone), `${path} still carries "${gone}", which the founder took off this page`);
      }
    }
    // The level chrome went with them: the ladder is My French's to draw.
    //
    // `levelFor` and `totalXp` came back in F423 and are deliberately not on
    // this list any more. Home reads the standing to pitch one word and draws
    // none of it: no name, no rung, no rail, no number. What the founder took
    // off this page was the level being *shown*, and the four names below are
    // the ways it would be.
    for (const gone of ['StationLine', '<Stat', 'buildProgressReport', 'standing.name']) {
      assert.ok(!SCREEN.includes(gone), `Home still reaches for ${gone}; the level and the evidence are My French's to draw`);
    }
  });
});

describe('Home draws momentum and the next step, or neither — F398, F399', () => {
  test('home draws momentum only inside its gates, in tokens, with green for ground covered and never the accent on a bar — F398', () => {
    // The block is absent until there is something true to say, and each of its
    // three parts is absent on its own. A rail of empty marks is a quota, and a
    // quota you have not met is guilt wearing a different hat.
    assert.match(FLAT, /\{momentum !== null && <MomentumCards momentum=\{momentum\} \/>\}/, 'Home draws the momentum block with nothing holding it back');
    assert.match(FLAT, /momentumFrom\(\{ activity, deck, profile, now \}\)/, 'the three counts are not folded by the one module that owns them');
    assert.match(flat(MOMENTUM), /if \(!hasMomentum\(momentum\)\) return null;/, 'the block draws itself with no momentum at all');
    for (const part of ['days', 'retained', 'goal']) {
      assert.ok(MOMENTUM.includes(`${part} !== null &&`), `the ${part} tile is drawn outside its own null gate`);
    }

    // Not one of the words is written here. `momentum.ts` decides every label,
    // every unit and every line, and a tile that spelled its own could say
    // "Days active" over a number counting something else.
    const fields = [
      'days.label', 'days.unit', 'days.count',
      'retained.label', 'retained.unit', 'retained.count', 'retained.weekLine',
      'goal.title', 'goal.amount', 'goal.note', 'goal.percentLabel',
    ];
    for (const field of fields) {
      assert.ok(MOMENTUM.includes(`{${field}}`), `the block does not draw ${field}, so something else is saying it`);
    }
    for (const spelled of ['Days active', 'Retained', "Today's speaking goal", 'this week', 'daily cadence', 'phrases']) {
      assert.ok(!MOMENTUM.includes(spelled), `the block spells "${spelled}" itself; that word is momentum.ts's`);
    }

    // Green means ground already covered, here as everywhere. The accent is
    // identity and never reports a state, so it is not in this file at all.
    assert.match(style(MOMENTUM, 'fill'), /backgroundColor: signal\.good/, 'the goal bar is not filled in the green that means the learner produced French');
    assert.match(style(MOMENTUM, 'markDone'), /backgroundColor: signal\.good/, 'a day that happened is not a filled green mark');
    assert.match(style(MOMENTUM, 'gain'), /color: signal\.good/, "the week's gain is not set in green");
    assert.ok(!MOMENTUM.includes('accent.'), 'the accent reached the momentum block; violet is identity, not a state');
    assert.ok(!MOMENTUM.includes('signal.live'), "the tutor's red reached a block about the learner");
    assert.ok(!MOMENTUM.includes('rungColor'), 'a rung colour reached the signal set, so a state could read as a rung');

    // A day that has not happened is not a state worth signalling, so it is a
    // hairline and not a colour. TodayRow's rule, kept.
    const waiting = style(MOMENTUM, 'markWaiting');
    assert.ok(!waiting.includes('backgroundColor'), 'a day that has not happened is filled in, which reports an absence back to the learner');
    assert.match(waiting, /borderColor: paper\.line/, 'the waiting mark is not the hairline');

    // The bar says its value out loud, because a bar is a picture and a picture
    // is not readable by everyone.
    assert.match(flat(MOMENTUM), /accessibilityRole="progressbar"/, 'the goal bar reaches a screen reader as an unnamed view');
    assert.match(
      flat(MOMENTUM),
      /accessibilityValue=\{\{ min: 0, max: 100, now: goal\.percent, text: goal\.percentLabel \}\}/,
      'the bar announces no value',
    );

    // No score anywhere. A share of a goal the learner set for today is not a
    // mark out of ten, and nothing here turns it into one.
    for (const scored of ['score', 'Score', 'accuracy', 'correct']) {
      assert.ok(!MOMENTUM.includes(scored), `the block says ${scored}; nothing on Home scores a learner`);
    }
  });

  test("home draws the next step as a row from portfolio's words and leaves the next-situation card to my french — F399", () => {
    // Two words, said once, in the module that already says the other card's.
    assert.equal(NEXT_STEP.label, 'Next step');
    assert.equal(NEXT_STEP.link, 'View learning path');
    assert.match(NEXT_ROW, /import \{ NEXT_STEP \} from '\.\.\/progress\/portfolio\.ts'/, 'the row does not read its words from portfolio.ts');
    assert.match(NEXT_ROW, /<Label>\{NEXT_STEP\.label\}<\/Label>/, 'the row spells its own heading');
    assert.match(NEXT_ROW, /label=\{NEXT_STEP\.link\}/, 'the link spells its own word');
    for (const [path, body] of HOME_SURFACE) {
      assert.ok(!body.includes(`'${NEXT_STEP.label}'`), `${path} spells "${NEXT_STEP.label}" itself`);
      assert.ok(!body.includes(`'${NEXT_STEP.link}'`), `${path} spells "${NEXT_STEP.link}" itself`);
    }

    // Core picks the situation. Home draws the row and re-derives nothing.
    assert.match(FLAT, /suggestedMission\(missionStates\(missionCompletionsFrom\(completions\), deck, now\)\)/, 'the next step is not the situation core suggests');
    assert.match(FLAT, /\{nextMission !== null && \(/, 'the next-step row is drawn with no situation behind it');
    assert.match(FLAT, /onViewPath=\{\(\) => nav\.navigate\('Practice'\)\}/, 'the learning-path link does not open the Practice tab');
    assert.match(FLAT, /nav\.navigate\('Missions', \{ focus: nextMission\.mission\.id \}\)/, 'the row does not open the chooser on the situation it names');
    assert.match(NEXT_ROW, /<MissionDisc place=\{next\.mission\.place\}/, 'the row lost the place it happens in');
    assert.match(NEXT_ROW, /\{next\.mission\.titleEn\}/, 'the row does not name the situation');
    assert.match(NEXT_ROW, /\{next\.mission\.goalEn\}/, 'the row does not say what the learner will be able to do');

    // What left Home. The card, the outline to the tutor and the empty-state
    // scene all went, and My French still draws the card with its own pill.
    for (const gone of ['<NextSituationCard', 'NEXT_SITUATION', 'Talk to ', 'SpeakBubbles', 'Nothing here yet']) {
      assert.ok(!SCREEN.includes(gone), `Home still draws ${gone}, which belongs to My French now`);
    }
    const myFrench = stripComments(read('./MyFrenchTab.tsx'));
    assert.ok(myFrench.includes('<NextSituationCard'), 'the next-situation card left the app instead of leaving Home');
  });
});

describe('Home closes on a kind line and carries nothing else — F400', () => {
  test('home closes on the sprout note and imports nothing it does not draw — F400', () => {
    // Last on the page, under everything the learner could act on.
    assert.ok(at('<SproutGlyph') > at('<NextStepRow'), 'the closing note sits above the next step instead of under it');
    const note = 'No pressure of perfection. Speak at your own pace.';
    assert.ok(SCREEN.includes(`<Text style={st.note}>${note}</Text>`), 'Home lost its closing line');

    // The line is copy, and copy on this page is held to the whole bar: no word
    // that scolds, no em dash, no digit.
    assert.equal(guiltIn(note), undefined, `the closing line carries a banned word: ${guiltIn(note)}`);
    assert.doesNotMatch(note, /—/, 'the closing line carries an em dash');
    assert.doesNotMatch(note, /\d/, 'the closing line carries a digit');

    // Every word a learner could read on this surface, swept the same way.
    for (const [path, body] of HOME_SURFACE) {
      const said = spoken(body);
      assert.ok(said.length > 3, `only ${said.length} strings found in ${path}, so this sweep proves little`);
      for (const line of said) {
        const banned = guiltIn(line);
        assert.equal(banned, undefined, `${path} says ${line}, which carries the banned word "${banned}"`);
        assert.doesNotMatch(line, /—/, `${path} says ${line}, which carries an em dash`);
      }
    }

    // The two cards nothing draws any more are gone rather than orphaned.
    for (const retired of ['../home/TodayRow.tsx', '../home/PhrasebookCard.tsx']) {
      assert.ok(!existsSync(fileURLToPath(new URL(retired, import.meta.url))), `${retired} still ships and nothing renders it`);
    }
    // `progress/today.ts` stays. Its suite is the standing defence against a
    // streak, and momentum deliberately did not touch it.
    assert.ok(
      existsSync(fileURLToPath(new URL('../progress/today.ts', import.meta.url))),
      'today.ts went with the row that drew it, and its suite is the defence against a streak',
    );
    for (const gone of ['todayFrom', 'buildPhrasebook', 'loadHistory', 'PhrasebookScreen', 'loadTopics']) {
      assert.ok(!SCREEN.includes(gone), `Home still reads ${gone}, and nothing on the page draws it`);
    }

    // And nothing else is carried either. Every name Home imports is a name
    // Home uses, which is J14's rule applied to one file.
    const body = SCREEN.slice(SCREEN.indexOf('export function HomeTab'));
    const imported = [...SCREEN.matchAll(/import \{([\s\S]*?)\} from/g)]
      .flatMap((m) => m[1]!.split(','))
      .map((name) => name.trim().replace(/^type\s+/, ''))
      .filter(Boolean);
    assert.ok(imported.length > 10, 'the import walk found almost nothing, so it is checking nothing');
    for (const name of imported) {
      assert.ok(new RegExp(`\\b${name}\\b`).test(body), `Home imports ${name} and never uses it`);
    }
  });
});

/* ===========================================================================
 * F409 — the two tabs fit a phone at every reading size.
 *
 * A source walk cannot measure a line box, so this is deliberately a list of
 * the ways a layout is made unable to adapt: a line capped at two, a reading
 * size capped by a multiplier, a text container pinned to a number of points, a
 * tile that cannot shrink beside its neighbour, a row under the touch floor.
 * Each of those is a thing somebody types, so each can be refused here, and the
 * measurement itself belongs to `docs/DEVICE_VERIFICATION.md`'s Pass 5.
 * =========================================================================== */

/** Every file under `home/`, plus the two tabs this pass rebuilt. */
function surfaceFiles(): { path: string; body: string }[] {
  const homeDir = fileURLToPath(new URL('../home', import.meta.url));
  const cards = readdirSync(homeDir)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => ({ path: join('home', name), body: stripComments(readFileSync(join(homeDir, name), 'utf8')) }));
  return [
    { path: 'tabs/HomeTab.tsx', body: SCREEN },
    { path: 'tabs/TutorTab.tsx', body: stripComments(read('./TutorTab.tsx')) },
    ...cards,
  ];
}

describe('the two tabs fit a phone at every reading size — F409', () => {
  test('home and tutor wrap every line, cap no reading size, and keep every row at the touch floor — F409', () => {
    const files = surfaceFiles();
    assert.ok(files.length >= 6, `the walk found ${files.length} files, so it is checking almost nothing`);

    for (const { path, body } of files) {
      // Nothing truncates and nothing caps the reading size. A learner at the
      // largest text setting reads the same words as everybody else.
      for (const capped of ['numberOfLines', 'maxFontSizeMultiplier', 'ellipsizeMode', 'allowFontScaling']) {
        assert.ok(!body.includes(capped), `${path} carries ${capped}, which clips a line rather than letting it wrap`);
      }
      // Every size is a token, so the whole page grows together.
      assert.doesNotMatch(body, /fontSize:/, `${path} names a raw font size instead of a type token`);
      // No container of words is pinned to a number of points. The day marks
      // are a mark rather than a text box, and are sized by a named constant.
      assert.doesNotMatch(body, /\bwidth:\s*\d/, `${path} pins a container to a fixed width, which cannot wrap at large text`);
      // The frame owns the air above the tab bar, once.
      assert.ok(!body.includes('paddingBottom'), `${path} pads its own scroll over the frame's inset`);
    }

    // Both tabs sit on the frame, and neither reads the safe area nor opens a
    // scroll view of its own.
    for (const path of ['tabs/HomeTab.tsx', 'tabs/TutorTab.tsx']) {
      const body = files.find((file) => file.path === path)!.body;
      assert.match(body, /<ScrollScreen bottom="tab">/, `${path} is not built on the shared frame`);
      assert.ok(!body.includes('useSafeAreaInsets'), `${path} re-grows its own safe-area maths`);
      assert.ok(!body.includes('<ScrollView'), `${path} opens a scroll view of its own inside the frame's`);
    }
    assert.equal(style(SCREEN, 'scroll').trim(), 'scroll: { flexGrow: 1', "Home's scroll body carries something other than flexGrow");

    // The two tiles sit side by side and both can shrink. Without `minWidth: 0`
    // a long word inside one pushes the other off the screen at large text.
    assert.match(style(MOMENTUM, 'tiles'), /flexDirection: 'row'/, 'the momentum tiles are not side by side');
    const tile = style(MOMENTUM, 'tile');
    assert.match(tile, /flex: 1/, 'a tile does not take its share of the row');
    assert.match(tile, /minWidth: 0/, 'a tile cannot shrink, so its neighbour goes off the screen at large text');

    // Every row a learner can press on Home declares the touch floor, sized for
    // one hand while walking.
    for (const { path, body } of files.filter((file) => file.path.startsWith('home'))) {
      for (const tag of tags(body, 'Pressable')) {
        const named = [...tag.matchAll(/st\.([A-Za-z]+)/g)].map((m) => m[1]!);
        const floors = named.filter((name) => body.includes(`${name}: {`) && style(body, name).includes('minHeight: HIT'));
        assert.ok(floors.length > 0, `${path} draws a tappable row that does not declare minHeight: HIT`);
      }
    }
    assert.match(style(NEXT_ROW, 'row'), /minHeight: HIT/, 'the next-step row falls under the touch floor');
    assert.match(
      style(stripComments(read('./TutorTab.tsx')), 'row'),
      /minHeight: HIT/,
      'the tutor rows fall under the touch floor',
    );
  });
});
