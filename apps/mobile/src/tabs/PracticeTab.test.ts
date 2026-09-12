/**
 * What the Practice tab is allowed to draw, and what it must not decide.
 *
 * The tab was the authored path until the founder replaced it with their own
 * mockup: an archive of the learner's own conversations, a summary of them, and
 * a card that suggests the next one. The rules below are the ones that survived
 * that rewrite plus the ones it created.
 *
 * Ceiling, stated plainly because it is easy to overstate what this proves:
 * this reads the tab as text. It cannot see a card on a phone, and it cannot
 * tell you the archive grows correctly, which is `practice/archive.test.ts`'s
 * job. What it can prove is that the growth decisions are made THERE and not
 * here, because a screen that can count is a screen that can draw a nought.
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

describe('Practice draws the learner\'s own conversations, and decides none of it — F442', () => {
  test('the whole archive is folded by practice/archive.ts, and the tab counts nothing', () => {
    // The rule this exists for: every "how many" question on this screen is
    // answered in one module, so the vault rail, the filter row and the feed
    // cannot disagree, and none of them can draw a nought.
    assert.match(FLAT, /import \{[^}]*archiveFrom[^}]*\} from '\.\.\/practice\/archive\.ts'/,
      'the tab does not read the archive from the module that owns it');
    assert.match(FLAT, /setArchive\(archiveFrom\(\{ packs, deck, now \}\)\)/,
      'the archive is not folded in one call with one clock reading');

    for (const forbidden of ['Math.', 'toFixed', 'dueCards', 'buildPath']) {
      assert.ok(!SCREEN.includes(forbidden), `the tab uses ${forbidden}; counting and pathing belong to core and to practice/archive.ts`);
    }
  });

  test('the path, its rows and its mix offer are gone, and nothing here re-grows them', () => {
    // The founder replaced the path with the archive. This fails if a later
    // change quietly puts a second navigation model back on the same screen.
    for (const gone of ['PathNodeRow', 'mixOffered', 'PathUnit', 'units', 'statusLine', 'seedTopicFor']) {
      assert.ok(!SCREEN.includes(gone), `${gone} is back on Practice; the tab is the archive now`);
    }
  });

  test("the tab keeps exactly one primary pill, in two branches, and one of them is the deck — F442", () => {
    // The pill budget is pinned in surfaceContract.test.ts at two occurrences
    // for two branches of one control. And HomeTab.test.ts reads this file for
    // `nav.navigate('Review')`: Home's phrase-bank link and this pill open the
    // same deck, so losing it here silently uncouples the two screens.
    // Three branches since F555: the deck, the newest conversation, and the
    // first conversation for a learner with none. Still one control.
    const headline = between(RENDER, 'NEXT_STEP.label', 'made !== null', 'the next step is drawn above the made-from cards');
    assert.equal((headline.match(/<PillButton/g) ?? []).length, 3, 'the next step is not exactly three branches of one pill');
    assert.equal((SCREEN.match(/<PillButton/g) ?? []).length, 3, 'a second primary pill was added somewhere on the tab');
    assert.match(headline, /label=\{NEXT_STEP\.first\}/, 'the first conversation is not a branch of the one control');
    assert.match(headline, /nav\.navigate\('Review'\)/, 'the review branch no longer opens the deck');
    assert.match(headline, /reviewLine\(step\.due\)/, 'the review line is spelled on the screen instead of read from nextStep.ts');
    assert.match(headline, /packLine\(step\.pack\)/, 'the conversation line is spelled on the screen instead of read from nextStep.ts');
  });

  test('the blocks arrive in the order the mockup draws them', () => {
    assert.ok(at('<TabHeader') < at('NEXT_STEP.label'), 'the tab header is not first');
    assert.ok(at('NEXT_STEP.label') < at('made !== null'), 'the one thing to do now sits below the made-from cards');
    assert.ok(at('made !== null') < at('ARCHIVE_LABEL'), 'the made-from cards sit below the archive');
    assert.ok(at('ARCHIVE_LABEL') < at('<SessionRow'), 'the feed is drawn above the block that summarises it');
    assert.ok(at('<SessionRow') < at('<ScenarioCard'), 'the suggestion card is drawn above the conversations it follows');
    assert.ok(at('<ScenarioCard') < at('CLOSING.title'), 'the closing note is not last');
  });

  test('every block that can be empty is gated, and the gate is the model rather than a length', () => {
    // Gated on the model, not on `sessions.length`, for MomentumCards' reason:
    // a block gated on a count still occupies its own top margin at zero, which
    // is a strip of dead air on exactly the first-run screen.
    assert.match(FLAT, /\{step !== null && \(/, 'the next step draws with nothing to say');
    assert.match(FLAT, /\{made !== null && \(/, 'the made-from cards draw before storage has answered');
    assert.match(FLAT, /\{archive !== null && archive\.vault !== null && \(/, 'the vault is not gated on the vault');
    assert.match(FLAT, /\{archive\.filters\.length > 0 && \(/, 'the filter row draws when there are no filters');
    assert.match(FLAT, /\{archive\?\.opening != null && \(/, 'the first-conversation words are not gated on the model');
    assert.match(FLAT, /\{scenario !== null && \(/, 'the suggestion card draws with no scenario');
  });

  test('the header carries the tab title and a purpose, and no monogram', () => {
    // The founder asked for the profile disc to go: Profile is a tab of its own
    // in the bar below, and the same face twice is one of them being furniture.
    const header = between(RENDER, '<TabHeader', '/>', 'Practice opens on a TabHeader');
    assert.match(header, /title="Practice"/, 'the tab lost its title');
    assert.match(header, /purpose="[^"]+"/, 'the tab lost its purpose line, which every tab but Home carries');
    assert.ok(!header.includes('trailing'), 'the monogram is back in the Practice header');
    assert.ok(!header.includes('Monogram'), 'the monogram is back in the Practice header');
  });

  test('the one door that touches the network guards its tap and says so — F154', () => {
    // Moved from the lesson row, which left with the path. The rule did not:
    // a tap that waits on a probe must be acknowledged, and a second tap must
    // not queue a second navigation.
    const handler = between(SCREEN, 'const talkAbout = (', '\n  };\n', 'the tutor door is a component-level handler');
    assert.match(handler, /if \(checking\) return;/, 'a second tap can queue a second conversation');
    assert.match(handler, /setChecking\(true\)/, 'the tap says nothing for as long as the probe runs');
    assert.match(handler, /recheck\(\)/, 'the door no longer probes, so this test is stale');
    assert.match(handler, /setChecking\(false\)/, 'one probe disables the door for good');
    assert.match(handler, /\.then\(go, go\)/, 'a probe that threw would leave the door dead');
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
  });

  test('a drill is opened with deck keys, never with the French lines themselves', () => {
    // The bug worth a test of its own: handing Drill the phrases rather than
    // the `phrase:` keys the deck is indexed by opens a sitting with nothing in
    // it, and nothing on screen says why.
    assert.ok(!/phraseKeys: [^}]*\.map\(\(phrase\) => phrase\.fr\)/.test(FLAT),
      'a drill is opened with raw French instead of the deck keys it is indexed by');
    assert.match(FLAT, /phraseKeyOf\(phrase\.fr\)/, 'the pack branch never keys its phrases for the deck');
  });

  test('the tab spells no copy that belongs to a module', () => {
    // Words live where the rule that chooses them lives. A line spelled here is
    // a line that can drift away from the one being tested.
    for (const spelled of ['Recorded sessions', 'Ordered by recency', 'Your spoken journeys', 'Suggest another', 'Archive and memory']) {
      assert.ok(!SCREEN.includes(spelled), `the tab spells "${spelled}" itself; that word belongs to practice/`);
    }
  });
});
