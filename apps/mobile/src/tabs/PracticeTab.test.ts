/**
 * What the Practice tab is allowed to draw, and what it must not decide.
 *
 * The tab was the authored path, then the archive of everything the learner had
 * ever said. F574 took both down to one question and three rows: the line to
 * practise next, and the three shapes the newest conversation left behind. The
 * conversations themselves are a screen of their own now, so nothing on this
 * page counts anything.
 *
 * Ceiling, stated plainly because it is easy to overstate what this proves:
 * this reads the tab as text. It cannot see a card on a phone, and it cannot
 * tell you the step is the right one, which is `practice/nextStep.test.ts`'s
 * job. What it can prove is that the decisions are made THERE and not here,
 * because a screen that can count is a screen that can draw a nought.
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

const SCREEN = stripComments(read('./PracticeTab.tsx'));
const FLAT = flat(SCREEN);
/** The render only, so the ordering checks read JSX and not the state hooks. */
const RENDER = SCREEN.slice(SCREEN.indexOf('<ScrollScreen'));

/**
 * The text between two markers, with both proven present.
 *
 * `indexOf` answers -1 for something that is not there, and a slice taken from
 * -1 is a slice of the wrong part of the file, so every assertion after it
 * would be asked of text nobody wrote.
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

describe('Practice draws the learner\'s own conversations, and decides none of it — F574', () => {
  test('the tab counts nothing a learner could read as a score', () => {
    // Every "how many" question that used to be on this screen left with the
    // archive. What is left is a phrase and three rows, and none of them is a
    // number, so the page cannot tell somebody mid-session how they are doing.
    for (const forbidden of ['Math.', 'toFixed', 'dueCards', 'buildPath', 'percent']) {
      assert.ok(!SCREEN.includes(forbidden), `the tab uses ${forbidden}; counting belongs to core and to practice/`);
    }
  });

  test('the path, the archive and the suggestion card are gone, and nothing here re-grows them', () => {
    // Three navigation models have stood on this tab. This fails if a later
    // change quietly puts a second one back beside the one that is there.
    for (const gone of ['PathNodeRow', 'mixOffered', 'PathUnit', 'units', 'statusLine', 'seedTopicFor', 'ScenarioCard', 'SessionFilters', 'SessionRow', 'VaultCard', 'archiveFrom', 'CLOSING', 'talkAbout']) {
      assert.ok(!SCREEN.includes(gone), `${gone} is back on Practice; the tab is one question and three rows now`);
    }
  });

  test('the next practice card says one French line and one control per branch', () => {
    // The card is the whole top of the page. It reads its line, its gloss and
    // its label out of practice/nextStep.ts, and each of the three branches
    // gives the learner exactly one way forward: back to the deck, back to a
    // conversation, or into the first conversation of their life.
    // Sliced to the next block rather than to the first `/>`, because the
    // controls inside the card close themselves first and a slice that stopped
    // there would be asking these questions of two of the six props.
    const card = RENDER.slice(at('<PhraseCard'), at('made !== null'));
    assert.match(card, /label=\{NEXT_STEP\.label\}/, 'the card spells its own label instead of reading it from nextStep.ts');
    assert.match(card, /french=\{step\.phrase\.fr\}/, 'the card draws something other than the step\'s own French line');
    assert.match(card, /gloss=\{step\.phrase\.en\}/, 'the line is shown with no meaning beside it, which is a line a learner cannot use');
    assert.match(card, /playing=\{playing\}/, 'the card cannot say it is already speaking, so a second tap has nothing to stop');
    assert.match(card, /onHear=\{\(\) => hearNext\(step\.phrase\.fr\)\}/, 'the card hears something other than the line it shows');

    const controlAt = card.indexOf('control={');
    assert.notEqual(controlAt, -1, 'the card offers the learner no way forward at all');
    const control = card.slice(controlAt);
    assert.match(control, /step\.kind === 'review' \?[\s\S]*label=\{REVIEW_ACTION\}/, 'the deck branch no longer names its control from practice/copy.ts');
    assert.match(control, /nav\.navigate\('Review'\)/, 'the review branch no longer opens the deck');
    assert.match(control, /step\.kind === 'pack' \?[\s\S]*label=\{PACK_ACTION\}/, 'the conversation branch no longer names its control from practice/copy.ts');
    assert.match(control, /label=\{NEXT_STEP\.first\}/, 'the first conversation is not a branch of the one control');
    assert.equal((control.match(/<OutlineButton/g) ?? []).length, 3, 'the three branches are not one quiet control each plus the held-back retry');
  });

  test('the tab keeps exactly one primary pill, and it is the first conversation — F574', () => {
    // Every other way forward on this page is a quiet control, because the one
    // learner who needs a loud one is the learner with nothing behind them.
    assert.equal((SCREEN.match(/<PillButton/g) ?? []).length, 1, 'a second primary pill was added somewhere on the tab');
    const pill = between(RENDER, '<PillButton', '/>', 'the tab draws one pill');
    assert.match(pill, /onPress=\{startFirst\}/, 'the one pill opens something other than the first conversation');
  });

  test('the blocks arrive in the order the mockup draws them', () => {
    assert.doesNotMatch(SCREEN, /<HeaderArt/, 'art must not overlap the shared masthead');
    assert.ok(at('<TabHeader') < at('<PhraseCard'), 'the tab header is not first');
    assert.ok(at('<PhraseCard') < at('made !== null'), 'the one thing to do now sits below the made-from rows');
    assert.ok(at('made !== null') < at('<TuneSoundCard'), 'the made-from rows are drawn above the block that holds them');
    // Inside the made-from branch, because the starter branch above it draws
    // its own phrase row and a first `indexOf` over the whole file would answer
    // about that one. Both branches draw the moment, the phrase and the sound
    // in that order, and the assertion is about the branch that has the
    // learner's own material in it.
    const madeBranch = RENDER.slice(RENDER.indexOf('<ReplayMomentCard'));
    assert.ok(madeBranch.length > 0, 'the made-from branch no longer draws the moment row; this check is stale');
    assert.ok(
      madeBranch.indexOf('<MakePhraseCard') > 0 && madeBranch.indexOf('<MakePhraseCard') < madeBranch.indexOf('<TuneSoundCard'),
      'the moment, the phrase and the sound are not drawn in that order',
    );
    // And the starter branch draws the same three, in the same order, so a
    // learner's first sight of the page is the page they come back to.
    const starterBranch = between(RENDER, '{made.value === null ?', '<ReplayMomentCard', 'the tab still has a starter branch');
    assert.ok(
      starterBranch.indexOf('<TintRow') < starterBranch.indexOf('<MakePhraseCard'),
      'the starter draws its phrase above its moment, and the made-from branch draws them the other way round',
    );
    assert.ok(
      starterBranch.indexOf('<MakePhraseCard') < starterBranch.indexOf('<TuneSoundCard'),
      'the starter draws its sound above its phrase, and the made-from branch draws them the other way round',
    );
    assert.ok(at('STARTER.line') > at('<TuneSoundCard'), 'the sentence about what this page becomes is not under the shapes it is about');
  });

  test('personal practice says which conversation made it and keeps the archive one quiet tap away', () => {
    assert.match(
      FLAT,
      /const personalSource = madeFromSource\(made\?\.value \?\? null\)/,
      'the screen invents provenance instead of asking the practice model',
    );
    assert.match(
      FLAT,
      /\{personalSource !== null && \([\s\S]*<Label>\{MADE_FROM_LABEL\}<\/Label>[\s\S]*\{personalSource\}/,
      'the personal rows do not say where they came from',
    );
    assert.match(
      FLAT,
      /label=\{CONVERSATION_ARCHIVE_ACTION\}[\s\S]*nav\.navigate\('Conversations'\)/,
      'the complete conversation library is not reachable from Practice',
    );
  });

  test('every block that can be empty is gated, and the gate is the model rather than a length', () => {
    // Gated on the model, not on a count, for MomentumCards' reason: a block
    // gated on a length still occupies its own top margin at zero, which is a
    // strip of dead air on exactly the first-run screen.
    assert.match(FLAT, /\{step !== null && \(/, 'the next practice card draws with nothing to say');
    assert.match(FLAT, /\{made !== null && \(/, 'the made-from rows draw before storage has answered');
    assert.match(FLAT, /\{failed && \(/, 'a read that never finished leaves the learner on a page that says nothing');
    assert.match(FLAT, /\{made\.value === null \?/, 'the starter set is not gated on there being no conversation');
  });

  test('the header says where the page came from, and none of those words live here', () => {
    const header = between(RENDER, '<TabHeader', '/>', 'Practice opens on a TabHeader');
    assert.match(header, /title=\{PRACTICE_TITLE\}/, 'the tab lost its title, or spells it on the screen');
    assert.match(header, /purpose=\{PRACTICE_PURPOSE\}/, 'the tab lost its purpose line, which every tab but Home carries');
    assert.match(SCREEN, /trailing=\{<ProfileButton \/>\}/, 'Practice must retain the shared profile entry point');

    // The corner art is decoration and says nothing, so it is named from the
    // registry rather than by filename and hidden at large text by HeaderArt.
    assert.match(FLAT, /<TabHeader/, 'Practice uses the shared editorial header');
  });

  test('the door that touches the network guards its tap and says so — F154', () => {
    // A tap that waits on a probe must be acknowledged, and a second tap must
    // not queue a second conversation. This is the first conversation of the
    // learner's life, so a dead press is the worst press on the tab.
    const handler = between(SCREEN, 'const startFirst = (', '\n  };\n', 'the first conversation is a component-level handler');
    assert.match(handler, /if \(checking\) return;/, 'a second tap can queue a second conversation');
    assert.match(handler, /setChecking\(true\)/, 'the tap says nothing for as long as the probe runs');
    assert.match(handler, /recheck\(\)/, 'the door no longer probes, so this test is stale');
    assert.match(handler, /setChecking\(false\)/, 'one probe disables the door for good');
    assert.match(handler, /\.catch\(\(\) => \{/, 'a probe that threw would leave the door dead');
    assert.match(handler, /setHeldBack/, 'a refused start is not answered, so the learner is left on a press that did nothing');
    assert.ok(
      handler.indexOf('setChecking(true)') < handler.indexOf('recheck()'),
      'the flag is raised after the network is touched, which is after the wait it exists to cover',
    );

    assert.match(FLAT, /\{TUTOR_OFFLINE\.checking\}/, 'nothing on the tab says a probe is running');
    assert.match(
      FLAT,
      /\{checking && \([\s\S]{0,200}accessibilityLiveRegion="polite"[\s\S]{0,200}TUTOR_OFFLINE\.checking/,
      'the acknowledgement is either not a live region or not tied to the flag',
    );
    assert.match(FLAT, /\{heldBack !== null && \(/, 'a start that was refused has no way forward on the page');
  });

  test('a drill is opened with deck keys, never with the French lines themselves', () => {
    // The bug worth a test of its own: handing Drill the phrases rather than
    // the `phrase:` keys the deck is indexed by opens a sitting with nothing in
    // it, and nothing on screen says why.
    assert.ok(!/phraseKeys: [^}]*\.map\(\(phrase\) => phrase\.fr\)/.test(FLAT),
      'a drill is opened with raw French instead of the deck keys it is indexed by');
    assert.match(FLAT, /phraseKeyOf\(phrase\.fr\)/, 'the conversation branch never keys its phrases for the deck');
  });

  test('the page still works for a learner reading at the largest size, and invents no colour or size', () => {
    // Nothing here caps a line, pins a font scale, or sets a size of its own.
    // A French line is longer than its English twin and longer again at 200%
    // text, so the one thing this page must never do is clip it.
    for (const capped of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'fontSize']) {
      assert.ok(!SCREEN.includes(capped), `the tab uses ${capped}; type comes from theme.ts and grows with the reader`);
    }
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(SCREEN), 'the tab spells a colour by hand instead of taking one from the palette');
    assert.ok(!/(width|height): \d/.test(SCREEN), 'the tab pins a size in points instead of taking one from the grid');
    assert.ok(!/paddingBottom/.test(SCREEN), 'the tab pads its own bottom over the frame that already pays for the tab bar');
  });

  test('the tab spells no copy that belongs to a module', () => {
    // Words live where the rule that chooses them lives. A line spelled here is
    // a line that can drift away from the one being tested.
    for (const spelled of [
      'Made from your conversations',
      'Your next practice',
      'Practise this conversation',
      'Recorded sessions',
      'Ordered by recency',
      'Your spoken journeys',
      'Suggest another',
      'Archive and memory',
    ]) {
      assert.ok(!SCREEN.includes(spelled), `the tab spells "${spelled}" itself; that word belongs to practice/`);
    }
  });
});
