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

  test('the recommended card says one French line and one action, both from the practice model', () => {
    // The card is the whole top of the page. Its line, its action and what it
    // says under the action all come from practice/practiceCard.ts, over
    // core's balanced selector, so the line and the button are about the same
    // sitting. Sliced to the next block rather than to the first `/>`, because
    // the controls inside the card close themselves first.
    const card = RENDER.slice(at('<PhraseCard'), at('made !== null'));
    assert.match(card, /label=\{NEXT_STEP\.label\}/, 'the card spells its own label instead of reading it from nextStep.ts');
    assert.match(card, /french=\{step\.card\.phrase\.fr\}/, 'the card draws something other than the model\'s own French line');
    assert.match(card, /gloss=\{step\.card\.phrase\.en\}/, 'the line is shown with no meaning beside it, which is a line a learner cannot use');
    assert.match(card, /playing=\{playing\}/, 'the card cannot say it is already speaking, so a second tap has nothing to stop');
    assert.match(card, /onHear=\{\(\) => hearNext\(step\.card\.phrase\.fr\)\}/, 'the card hears something other than the line it shows');

    const controlAt = card.indexOf('control={');
    assert.notEqual(controlAt, -1, 'the card offers the learner no way forward at all');
    const control = card.slice(controlAt);
    assert.match(control, /<PillButton label=\{step\.card\.action\.label\}/, 'the action spells its own label instead of reading the model');
    assert.match(control, /\{step\.card\.source !== null && /, 'the card does not say where the sitting comes from, or says it with nothing to say');
    assert.match(control, /\{step\.card\.noMinutes !== null && /, 'the card does not say a module sitting uses no live minutes');
    // The held-back retry for the first conversation is still the one quiet
    // control inside the card.
    assert.equal((control.match(/<OutlineButton/g) ?? []).length, 1, 'the card grew a second control beside the one action and its retry');
    assert.match(FLAT, /const rec = recommendation\(\{ resumable: resumableOf\(saved, packs, bank\), deck, bank, packs, now \}\)/, 'the card is not chosen by the balanced selector over real bank material and the saved sitting');
  });

  test('the tab keeps exactly one primary pill, and it is the recommended action', () => {
    // Every other way forward on this page is a quiet control. The one loud one
    // is whatever the model recommends: a short practice, a resume, or the
    // first conversation for a learner with nothing behind them.
    assert.equal((SCREEN.match(/<PillButton/g) ?? []).length, 1, 'a second primary pill was added somewhere on the tab');
    const pill = between(RENDER, '<PillButton', '/>', 'the tab draws one pill');
    assert.match(pill, /onPress=\{startRecommended\}/, 'the one pill opens something other than the recommended action');
    const handler = between(SCREEN, 'const startRecommended = () => {', '\n  };\n', 'the recommended action is a component-level handler');
    assert.match(handler, /if \(action\.kind === 'first'\) return startFirst\(\);/, 'the first conversation no longer goes through its probe');
    assert.match(handler, /nav\.navigate\('Drill', action\.params\)/, 'a short practice opens something other than a practice sitting');
    assert.ok(!/practice: action/.test(handler), 'the route is handed an object, which the web address bar writes as [object Object]');
    assert.ok(!/navigate\('Convo'/.test(handler), 'the recommended action opens a live room, which is not what the card promised');
  });

  test('a half-done completion lands first, a waiting sitting is resumed, and every read is bound to the account', () => {
    const load = between(SCREEN, 'const load = useCallback(', '\n  );\n', 'the tab reads its stores in one callback');
    // Recovery replays a frozen plan before anything is read, so the card
    // never offers to resume a sitting whose grades are still in flight.
    assert.ok(load.indexOf('recoverPracticeCompletion()') >= 0, 'a completion a previous launch left half-done is never finished');
    assert.ok(load.indexOf('recoverPracticeCompletion()') < load.indexOf('loadPracticeSession()'), 'the saved sitting is read before a pending completion lands');
    // The saved sitting feeds the recommendation, so Resume leads when one waits.
    assert.match(flat(load), /recommendation\(\{ resumable: resumableOf\(saved, packs, bank\), deck, bank, packs, now \}\)/, 'a waiting sitting is never offered as a resume');
    // Bound before the reads, checked after each one.
    assert.match(flat(load), /const scope = scopeGeneration\(\); const stale = \(\): boolean => cancelled\(\) \|\| scopeGeneration\(\) !== scope;/);
    assert.equal((load.match(/if \(stale\(\)\)/g) ?? []).length + (load.match(/if \(!stale\(\)\)/g) ?? []).length + (load.match(/if \(stale\(\) \|\|/g) ?? []).length, 3, 'a read can be drawn for an account that has changed');
    // Resume opens the saved sitting through a flat route, never an object.
    const start = between(SCREEN, 'const startRecommended = () => {', '\n  };\n', 'the recommended action is a component-level handler');
    assert.match(start, /nav\.navigate\('Drill', practiceRouteParams\(\{ origin: 'resume', packId: null, exposed: false \}\)\)/, 'Resume opens something other than the saved sitting');
  });

  test('the quiet doors are gated on the model, and the tutor door says it uses live minutes', () => {
    assert.match(FLAT, /\{step\.doors\.review !== null && <GhostButton label=\{step\.doors\.review\}[^>]*onPress=\{\(\) => nav\.navigate\('Review'\)\}/, 'scheduled review is not a quiet door to the deck');
    assert.match(FLAT, /\{step\.doors\.choose !== null && <GhostButton label=\{step\.doors\.choose\}[^>]*onPress=\{\(\) => nav\.navigate\('Conversations'\)\}/, 'choosing a conversation is not a quiet door to the list');
    // Every quiet door says its whole destination to a screen reader: the
    // label is its full sentence, and the revisit carries its cost with it.
    assert.match(FLAT, /accessibilityLabel=\{`\$\{step\.doors\.revisit\.label\}\. \$\{step\.doors\.revisit\.uses\}`\}/, 'the tutor door does not say its cost to a screen reader');
    assert.match(FLAT, /\{step\.doors\.revisit !== null && \(/, 'the tutor door is drawn without asking the model');
    assert.match(FLAT, /\{step\.doors\.revisit\.uses\}/, 'the tutor door does not say it uses live minutes');
    // The Tutor tab's continueArc rule, through the one shared helper, and
    // open only on a real answer: null (still reading) and false both close it.
    assert.match(FLAT, /const revisitAllowed = useContinueArc\(\) === true;/, 'the tutor door is not gated by the shared plan helper');
    assert.ok(!SCREEN.includes('capabilitiesFor('), 'the tab asks the plan table itself instead of through the helper');
    const revisit = between(SCREEN, 'const revisitWithTutor = (', '\n  };\n', 'the revisit is a component-level handler');
    assert.match(revisit, /nav\.navigate\('Convo', \{ continuationPackId: packId \}\)/, 'the revisit does not go through the owner-checked continuation path');
  });

  test('the blocks arrive in the order the mockup draws them', () => {
    assert.doesNotMatch(SCREEN, /<HeaderArt/, 'art must not overlap the shared masthead');
    assert.ok(at('<TabHeader') < at('<PhraseCard'), 'the tab header is not first');
    assert.ok(at('<PhraseCard') < at('made !== null'), 'the one thing to do now sits below the made-from rows');
    assert.ok(at('made !== null') < at('<TuneSoundCard'), 'the made-from rows are drawn above the block that holds them');
    // Whole-app phase 2: the quiet doors are the foot of the page, after the
    // more-ways rows, rather than a stack between the card and the rows.
    assert.ok(at('<TuneSoundCard') < at('<View style={st.doors}>'), 'the quiet doors sit between the card and the ways to practise');
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

  test('the source is named once per cluster, and the archive has exactly one door — whole-app phase 2', () => {
    // The card names the conversation its sitting draws on. The rows under it
    // name theirs only when it is a different one, which the practice model
    // decides; the tab no longer draws a second heading repeating the title.
    assert.match(
      FLAT,
      /const alsoFrom = alternativesSource\(made\?\.value \?\? null, step\?\.card\.sourcePackId \?\? null\)/,
      'the screen decides for itself whether the rows need their own provenance',
    );
    assert.match(FLAT, /\{alsoFrom !== null && <Text style=\{st\.fromLine\}>\{alsoFrom\}<\/Text>\}/, 'the rows name their conversation without asking the model, or not at all');
    for (const gone of ['MADE_FROM_LABEL', 'CONVERSATION_ARCHIVE_ACTION', 'madeFromSource(', 'personalSource']) {
      assert.ok(!SCREEN.includes(gone), `${gone} is back on Practice; the conversation is named once and the archive has one door`);
    }
    // One archive door on the whole page, and it is the quiet one.
    assert.equal((SCREEN.match(/nav\.navigate\('Conversations'\)/g) ?? []).length, 1, 'the archive has more than one door on Practice, or none');
    // The more-ways rows sit under their own quiet heading, in both branches.
    assert.equal((SCREEN.match(/<Label>\{ALTERNATIVES\.label\}<\/Label>/g) ?? []).length, 2, 'a branch of the more-ways rows has no heading, or has two');
  });

  test('the card says where its sitting comes from once, and what it costs beside the action — whole-app phase 2', () => {
    const card = RENDER.slice(at('<PhraseCard'), at('made !== null'));
    const control = card.slice(card.indexOf('control={'));
    const source = control.indexOf('{step.card.source !== null && ');
    const pill = control.indexOf('<PillButton');
    const cost = control.indexOf('{step.card.noMinutes !== null && ');
    assert.ok(source >= 0 && source < pill, 'the source is not said above the action it belongs to');
    assert.ok(cost > pill, 'the cost line is not beside the action');
    // Nothing between the pill and its cost but the pill itself.
    assert.ok(!/<Text|<GhostButton|<OutlineButton/.test(control.slice(pill, cost).replace(/<PillButton[^>]*\/>/, '')), 'something sits between the action and what it costs');
  });

  test('a made-from row is drawn only when it can actually start — whole-app phase 2', () => {
    // With no measured sound there is nothing to tune, so the personal branch
    // draws the sound row only when the model found one. The replay row was
    // always gated on a correction existing, and still is.
    const personal = RENDER.slice(RENDER.indexOf('<ReplayMomentCard') - 200);
    // Fable review (whole-app phase 2): gating on a correction existing was not
    // enough, because a held correction opens an empty sitting. The row is
    // gated on the model's `sayable`, the same rule the phrase row follows.
    assert.match(flat(personal), /\{made\.value\.replay !== null && made\.value\.replay\.sayable && \(/, 'the replay row draws when its sitting would be empty');
    // The model can only judge that with the bank the sitting would draw from.
    assert.match(SCREEN, /madeFromConversations\(\{ packs, marks, deck, checks, bank, now \}\)/, 'the made-from rows are judged without the bank');
    assert.match(flat(personal), /\{made\.value\.phrase !== null && \(/, 'the phrase row draws with no phrase behind it');
    assert.match(flat(personal), /\{made\.value\.sound !== null && \( <TuneSoundCard/, 'the sound row draws with nothing measured to tune');
  });

  test('the quiet doors come after the ways to practise, never as a second primary — whole-app phase 2', () => {
    // Review, the one archive door and the tutor revisit are the page's foot,
    // below the recommended card and the alternatives, drawn only when the
    // card has answered.
    assert.ok(at('<PhraseCard') < at('<Label>{ALTERNATIVES.label}</Label>'), 'the alternatives sit above the recommended card');
    assert.ok(at('<Label>{ALTERNATIVES.label}</Label>') < at('step.doors.review'), 'scheduled review competes with the recommendation from above the alternatives');
    assert.match(FLAT, /\{step !== null && \( <View style=\{st\.doors\}>/, 'the doors draw before the card has answered');
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
    // Whole-app phase 2 (2026-09-25): the heading is the tab's own name and one
    // short line, and nothing else sits between it and the card.
    assert.ok(!/<HeaderArt|<Label>\{MADE_FROM/.test(RENDER.slice(0, RENDER.indexOf('<PhraseCard'))), 'a second heading is back between the header and the card');
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
    // The recommended sitting is keyed through core's targets, which carry the
    // deck's own phrase keys; the tab never builds a node out of French lines.
    const card = readFileSync(new URL('../practice/recommendation.ts', import.meta.url), 'utf8');
    assert.match(card, /pack\.keyPhrases\.map\(\(p\) => phraseKeyOf\(p\.fr\)\)/, 'practice targets must use review-card identities');
    assert.match(card, /pack\.corrections\.map\(\(c\) => phraseKeyOf\(c\.better\)\)/, 'correction phrases must also reach practice');
    const practice = readFileSync(new URL('../conversationPacks/ConversationPracticeScreen.tsx', import.meta.url), 'utf8');
    assert.match(practice, /phraseKeyOf\(p\.fr\)/, 'recall must use review-card identities');
    assert.match(practice, /phraseKeyOf\(c\.better\)/, 'correction phrases must also reach recall');
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
