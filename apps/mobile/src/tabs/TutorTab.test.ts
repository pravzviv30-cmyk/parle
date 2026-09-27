/**
 * What the Tutor tab is allowed to decide about its own rows — F405, F573.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen, the way `PracticeTab.test.ts` reads its own. The rule it guards is
 * the one F404 finished pulling into `tutor/gate.ts` and `tutor/dashboard.ts`:
 * the tab draws the rows, it does not word them and it does not count them.
 *
 * Most of this is about what Revamp A took OFF the tab, and a removal is the
 * one thing a source read holds better than a renderer would. The six door
 * cards, the fold that opened onto every situation, the scene to pick back up,
 * the scripted lesson and the explainer link are each named here, so one coming
 * back fails by name rather than by a screenshot nobody compares. None of them
 * was deleted from the product: the scene is Home's hero, the situations and
 * the lesson are the chooser's, the explainer is a Settings row, and each of
 * those has a test of its own on the other side.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { guiltIn } from '../copy/guilt.ts';
import { launchAccessibilityLabel, launchLabel, launchNotice, orbStatusLabel, tutorOrbState } from '../tutor/orbState.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./TutorTab.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');
/** The render only, so the ordering checks read JSX and not the state hooks. */
const RENDER = SCREEN.slice(SCREEN.indexOf('<ScrollScreen'));

/**
 * The text between two markers, with both proven present.
 *
 * The same guard `PracticeTab.test.ts`'s `between` writes: `indexOf` answers -1
 * for something that is not there, and a slice from -1 is a slice of the wrong
 * part of the file.
 */
function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

/** Where a marker sits in the render, proven present first. */
function at(marker: string): number {
  const i = RENDER.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the screen at all`);
  return i;
}

describe('the tutor tab recommends a conversation and exposes its supporting tools', () => {
  test('the tutor tab draws shared rows and one explicit primary action', () => {
    // Every word on the page comes from a module that a test can reach. The tab
    // spells no heading, no purpose line and no notice of its own.
    const dashboard = FLAT.match(/import \{([^}]*)\} from '\.\.\/tutor\/dashboard\.ts'/);
    assert.ok(dashboard, 'the tab never imports tutor/dashboard.ts, so it has no header words to draw');
    for (const name of ['tutorHeading', 'TUTOR_PURPOSE']) {
      assert.ok(dashboard[1]!.includes(name), `the tab imports the header module without ${name}`);
    }
    const gate = FLAT.match(/import \{([^}]*)\} from '\.\.\/tutor\/gate\.ts'/);
    assert.ok(gate, 'the tab never imports tutor/gate.ts, so it has no rows to draw');
    for (const name of ['tutorDoors', 'entryStart', 'ENTRY_MODES_LABEL']) {
      assert.ok(gate[1]!.includes(name), `the tab imports the door module without ${name}`);
    }
    assert.match(FLAT, /\{tutorHeading\(tutorName\)\}/, 'the tab writes its own header instead of asking dashboard.ts');
    assert.match(
      FLAT,
      /MICROPHONE_NOTICE/,
      'the tab makes a second microphone promise instead of the one the chooser already makes',
    );

    // ── three rows, and exactly three ──────────────────────────────────────
    // A row is a tinted strip with a mark, two lines and a chevron, and the
    // component that draws one is the app's, not this tab's. The count is the
    // whole point of the pass: six door cards became three rows.
    const rows = (SCREEN.match(/<TintRow\b/g) ?? []).length;
    assert.equal(rows, 3, 'one mapped conversation row, pronunciation and memory share TintRow');
    assert.match(RENDER, /\{DOORS\.map\(\(door\) => \(/, 'the three ways in are not drawn from the door model');
    const modes = between(RENDER, 'DOORS.map(', '</View>', 'the three ways in are drawn as rows');
    assert.match(modes, /tint=\{DOOR_TINT\[door\.key\]\}/, 'a row picks its own paper instead of reading doorTint.ts');
    assert.match(modes, /glyph=\{GLYPH\[door\.key\]\}/, 'a row lost the mark on its white disc');
    assert.match(modes, /title=\{door\.key === 'rehearse' \? `\$\{door\.label\} · Max` : door\.label\}/, 'the rehearsal row discloses Max before opening');
    assert.match(modes, /gloss=\{door\.gloss\}/, 'a row does not say what is behind it');
    assert.match(modes, /onPress=\{\(\) => enter\(door\.key\)\}/, 'a row opens somewhere other than where the door model says');
    assert.match(modes, /disabled=\{checking\}/, 'a row stays pressable while the connection check runs');
    assert.match(RENDER, /<Label>\{ENTRY_MODES_LABEL\}<\/Label>/, 'the three ways in have no heading');
    // The three marks, in the violet that means identity, one per row.
    for (const glyph of ['<CoffeeCupGlyph', '<ChatGlyph', '<DocumentGlyph']) {
      assert.ok(SCREEN.includes(glyph), `the rows lost ${glyph}, so two of them are the same mark`);
    }
    assert.match(FLAT, /const GLYPH: Record<EntryModeKey, ReactNode> = \{/, 'the marks are chosen inside the render instead of once');

    // Every row this tab places declares the touch floor, sized for one hand
    // while walking, whatever a future restyle does to the shared component.
    const rowStyle = between(SCREEN, 'row: {', '}', 'the rows are drawn with a style that is not defined');
    assert.match(rowStyle, /minHeight: HIT/, 'a row is built under the 44pt touch floor');
    assert.match(between(SCREEN, 'remembers: {', '}', 'the memory row is placed'), /minHeight: HIT/, 'the memory row is built under the touch floor');

    // ── what left the tab ──────────────────────────────────────────────────
    // The guided list, the scene to pick back up and the scripted lesson. Each
    // is reachable elsewhere and asserted there; here they are simply gone,
    // because a tab that offers everything offers nothing.
    assert.ok(!SCREEN.includes('MISSIONS.map('), 'the tab lists every situation again, and the chooser already does');
    assert.ok(!SCREEN.includes('tutorDoors(resume'), 'the scene to pick back up is a door on the tab again');
    // Was `<MissionDisc`, which is not a component any more: the disc and the
    // drawing behind it were retired once nothing rendered them. The claim is
    // the same claim, pointed at the mark that a place actually wears now, so
    // it still fails if the six situations come back as rows with places on
    // them rather than as one door into the chooser.
    assert.ok(!SCREEN.includes('<PlaceGlyph'), 'the tab marks its rows by place again; a place is My French\'s mark, and these three rows are ways of talking');
    assert.ok(!SCREEN.includes('scenarioCountLine'), 'a row counts the catalogue at a learner');
    assert.ok(!SCREEN.includes('TUTOR_INTRO_LINK'), 'the explainer link is back on a page with one circle on it');
    assert.ok(!SCREEN.includes('<EarGlyph'), 'the purple ear is back on the tab');
    assert.ok(!SCREEN.includes('In progress'), 'the orange In progress pill is back on the tab');

    // ── what the tutor remembers (F546, F573) ──────────────────────────────
    assert.match(RENDER, /\{continuity !== null && \(/, 'the memory row is drawn for a learner with nothing behind them');
    assert.match(RENDER, /<ContinuityCard/, 'the memory left the tab');
    assert.match(FLAT, /continuityFrom\(\{ brain: profile\.brain, packs, records: scenes, progress \}\)/, 'the memory line reads its own idea of where the scenes stand');
    assert.match(FLAT, /headline=\{continuityHeadline\(tutorName\)\}/, 'the memory row names somebody other than the chosen tutor');
    // The row carries a pack id into the room. The tab cannot retire it: a tap
    // can still land on an offline gate, so only ConvoScreen's first live view
    // is evidence that the thread was actually picked up.
    assert.doesNotMatch(FLAT, /markPackContinued/, 'the tab retires a thread before a room has opened');
    assert.match(
      FLAT,
      /nav\.navigate\(route\.screen, \{ \.\.\.route\.params, continuationPackId: route\.markPack, textMode: mode === 'type' \}\)/,
      'the pack identity does not reach the room that can prove it opened',
    );
    assert.match(FLAT, /nav\.navigate\(route\.screen, route\.screen === 'Convo' \? \{ \.\.\.route\.params, textMode: mode === 'type' \} : route\.params\)/, 'continuity preserves the mode and its original destination');

    const convo = stripComments(read('../ConvoScreen.tsx')).replace(/\s+/g, ' ');
    const navigator = stripComments(read('../nav/RootNavigator.tsx')).replace(/\s+/g, ' ');
    assert.match(navigator, /continuationPackId=\{route\.params\?\.continuationPackId\}/, 'the route drops the pack id before ConvoScreen');
    assert.match(
      convo,
      /continuationPackId === undefined \|\| live\.convo === null\) return;/,
      'a failed or unopened room can mark a conversation as continued',
    );
    const raised = convo.indexOf('continuationMarkedRef.current = true');
    const written = convo.indexOf('markPackContinued(continuationPackId, Date.now())');
    assert.ok(raised >= 0 && written > raised, 'the async mark is queued before the once-only guard is raised');

    // The same moment in the account history: a revisit started, only for a
    // room that published a view and has a server session id, once per id.
    assert.match(
      convo,
      /if \(continuationPackId === undefined \|\| live\.convo === null \|\| live\.sessionId === null\) return; if \(revisitRecordedRef\.current === live\.sessionId\) return; revisitRecordedRef\.current = live\.sessionId; void recordRevisitStarted\(\{ sessionId: live\.sessionId, packId: continuationPackId, at: Date\.now\(\) \}\);/,
      'the revisit is recorded before the room opens, without a real session id, or more than once',
    );
    assert.equal((convo.match(/recordRevisitStarted\(/g) ?? []).length, 1, 'the revisit is recorded from more than one place');
    assert.doesNotMatch(convo, /sessionId: [`'"]/, 'a revisit session id is made up rather than read from the grant');

    // ── no pill ────────────────────────────────────────────────────────────
    // The circle is the tab's one primary action. The resume card's pill left
    // with the resume card, and a row that opens a screen says so with a
    // chevron rather than a button.
    const pills = (SCREEN.match(/<PillButton\b/g) ?? []).length;
    assert.equal(pills, 1, 'the recommended conversation has one named primary action');

    // The order the canvas draws, read off the render rather than the model.
    assert.ok(at('<TabHeader') < at('<VoiceOrb'), 'the voice circle sits above the header');
    assert.ok(at('<VoiceOrb') < at('<ContinuityCard'), 'the memory sits above the circle');
    assert.ok(at('<ContinuityCard') < at('DOORS.map('), 'the three ways in sit above the memory');

    // The screen spells no numeral anywhere in its rows. Nothing up here is a
    // count, so a digit in a literal would be a second answer to a question
    // gate.ts already answers.
    const block = between(RENDER, 'DOORS.map(', 'st.quiet', 'the tab draws its rows from the model');
    for (const literal of block.match(/'[^']*'|"[^"]*"/g) ?? []) {
      assert.ok(!/\d/.test(literal), `the rows block spells a numeral itself: ${literal}`);
    }

    // And the quiet footer, which is the only way through for someone who
    // cannot speak where they are sitting.
    const quiet = SCREEN.slice(SCREEN.indexOf('st.quiet'));
    assert.match(RENDER, /key: 'type', label: 'Type'/, 'typing is a visible peer of speaking');
    assert.match(RENDER, /open\(mode === 'type', next\.params\)/, 'the primary action preserves mode and recommendation');
    assert.match(quiet, /\{MICROPHONE_NOTICE\}/, 'the microphone promise is decided and never reaches glass');
  });
});

/**
 * The orb and the card were both talking.
 *
 * The ready action is embedded in the watercolour orb. Other states still put
 * their honest explanation under the circle, and the continuity promise stays
 * under the header. The orb's ordinary caption is off here because this page owns the
 * accessible button and the state words around it.
 */
describe('the tutor page owns its words — F415', () => {
  test("the tutor's circle lets the page do the talking — F415", () => {
    const orbs = FLAT.match(/<VoiceOrb\b[^>]*\/>/g) ?? [];
    assert.equal(orbs.length, 1, 'the tutor tab draws a number of voice circles other than one');
    assert.match(
      orbs[0]!,
      /withCaption=\{false\}/,
      'the circle captions itself on a page that already says two lines, and the two land on top of each other',
    );
    assert.match(orbs[0]!, /size=\{TUTOR_ORB_SIZE\}/, 'the circle bypasses the one size the landing page owns');
    assert.match(SCREEN, /const TUTOR_ORB_SIZE = 96;/, 'the compact orb leaves room for the recommendation and action');
    // The card went with Revamp A: a white rectangle around the one shape on
    // this tab that means something was a second edge competing with it.
    assert.ok(!SCREEN.includes('st.speakCard'), 'the circle is back inside a card of its own');
    // The ready words live inside the circle; non-ready states keep the status
    // under it, and the purpose line remains beneath the whole control.
    assert.match(FLAT, /const orb = tutorOrbState\(\{ live, checking, canStart \}\)/, 'the circle no longer reads its state from the facts');
    // The label is one pure rule now, so what an unavailable tutor's button
    // says is held directly rather than read off a ternary.
    assert.match(FLAT, /<PillButton label=\{launchLabel\(\{ checking, live, mode \}\)\}/, 'the start button no longer reads its words from the rule');
    assert.equal(launchLabel({ checking: false, live: true, mode: 'speak' }), 'Start speaking', 'the explicit action explains the selected mode');
    assert.equal(launchLabel({ checking: false, live: true, mode: 'type' }), 'Start typing');
    assert.equal(launchLabel({ checking: true, live: false, mode: 'speak' }), 'Connecting…');
    assert.equal(launchLabel({ checking: false, live: false, mode: 'speak' }), 'Check connection', 'an unavailable tutor still offers to start speaking');
    assert.equal(launchLabel({ checking: false, live: false, mode: 'type' }), 'Check connection', 'typing is not offline and cannot start without the tutor');
    assert.match(FLAT, /\{orb\.state !== 'ready' && <Text style=\{st\.orbSubline\}>\{orb\.subline\}<\/Text>\}/, 'a non-ready state no longer explains why the circle cannot start');
    const rule = read('../tutor/orbState.ts');
    assert.match(rule, /'Tap to talk'/, 'the rule lost the minimalist ready line');
    assert.match(rule, /TUTOR_ORB_SUBLINE/, 'the rule lost the second line');
    const words = read('../tutor/dashboard.ts');
    assert.match(words, /'Your tutor remembers where you left off\.'/, 'the header lost the continuity promise in the approved Tutor direction');
  });

  /**
   * Rewritten 2026-09-25 (whole-app Stage 3A), by decision. This test used to
   * pin the circle as a second press that opened the same room as the pill.
   * Two equally actionable controls for one start is what the whole-app review
   * asked to remove: the circle now reports the tutor's state and the pill is
   * the one launch. What the old test protected still holds, moved to the pill:
   * one named action, mode kept, no second room during the probe.
   */
  test('the circle reports the tutor state, and the one pill is the only way to start', () => {
    // The circle is not a control any more: nothing on the tab is a Pressable,
    // and the recommended start is opened from exactly one place.
    assert.ok(!SCREEN.includes('<Pressable'), 'the circle is still a press that starts the conversation beside the pill');
    assert.equal(
      (RENDER.match(/open\(mode === 'type', next\.params\)/g) ?? []).length,
      1,
      'the recommended conversation is started from more than one control',
    );
    const pill = between(FLAT, '<PillButton', '/>', 'the tab keeps one launch pill');
    assert.match(pill, /onPress=\{\(\) => open\(mode === 'type', next\.params\)\}/, 'the pill no longer opens the recommended conversation');
    assert.match(pill, /disabled=\{checking\}/, 'a second tap during the connection check opens a second room');
    assert.match(pill, /accessibilityLabel=\{launchAccessibilityLabel\(\{ checking, live, mode, tutorName \}\)\}/, 'the one launch does not name the tutor and the mode to a screen reader');

    // The circle is announced as a state, in words from the rule, never as an action.
    const block = between(FLAT, '<View style={st.orb}', '</View>', 'the circle sits in its own block');
    assert.match(block, /accessibilityLabel=\{orbStatusLabel\(orb, tutorName\)\}/, 'the circle is not announced by its state');
    assert.doesNotMatch(block, /accessibilityRole="button"/, 'the circle still announces itself as a button');
    assert.doesNotMatch(block, /onPress=/, 'the circle still starts something');
    const tutor = 'Camille';
    const states = [
      tutorOrbState({ live: true, checking: false, canStart: true }),
      tutorOrbState({ live: true, checking: true, canStart: null }),
      tutorOrbState({ live: false, checking: false, canStart: null }),
      tutorOrbState({ live: true, checking: false, canStart: false }),
    ];
    const said = states.map((view) => orbStatusLabel(view, tutor));
    assert.equal(new Set(said).size, states.length, 'two different states read the same to a screen reader');
    for (const line of said) {
      assert.ok(line.startsWith(tutor), `"${line}" does not say whose state it is`);
      assert.doesNotMatch(line, /\b(tap|start|open|press)\b/i, `"${line}" reads as an action, and the circle does nothing when pressed`);
      assert.doesNotMatch(line, /—|\d/, `"${line}" carries an em dash or a number`);
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
    }

    const orbStyle = between(SCREEN, 'orb: {', '}', 'the circle block has a style');
    assert.match(orbStyle, /minWidth: TUTOR_ORB_SIZE/, 'the circle block is smaller than the circle');
    assert.match(orbStyle, /minHeight: TUTOR_ORB_SIZE/, 'the circle block is smaller than the circle');
    assert.ok(!SCREEN.includes('st.pressed'), 'the circle still carries a press state for a press it no longer has');
  });

  test('speaking and typing are a mode, and the page says both use live minutes', () => {
    // Typed is not the free choice: both open the metered tutor. Free practice
    // is Practice's, and it says so there.
    assert.match(FLAT, /<Text style=\{st\.notice\}>\{launchNotice\(mode\)\}<\/Text>/, 'the line under the pill is spelled on the tab');
    for (const mode of ['speak', 'type'] as const) {
      const line = launchNotice(mode);
      assert.match(line, /live minutes/, `the ${mode} notice hides that the tutor uses live minutes`);
      assert.doesNotMatch(line, /\bfree\b|offline/i, `the ${mode} notice calls the tutor free or offline`);
      assert.doesNotMatch(line, /—/);
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
    }
    assert.match(launchNotice('type'), /microphone/i, 'the typed notice no longer says the microphone stays closed');
    assert.equal(launchAccessibilityLabel({ checking: false, live: true, mode: 'type', tutorName: 'Camille' }), 'Start a typed conversation with Camille');
    assert.equal(launchAccessibilityLabel({ checking: false, live: true, mode: 'speak', tutorName: 'Camille' }), 'Start a spoken conversation with Camille');
    assert.equal(launchAccessibilityLabel({ checking: false, live: false, mode: 'speak', tutorName: 'Camille' }), 'Check connection', 'an unreachable tutor is still offered a conversation to a screen reader');
  });
});

/**
 * The three ways this tab used to stop working while still looking fine.
 *
 * None of them is visible in a screenshot, which is why they lasted. A bottom
 * tab stays mounted after its first visit, so the voice circle went on
 * breathing behind every other tab for the rest of the session. The `checking`
 * flag had one handler, so a probe that ever threw would leave every row and
 * link on the page disabled with nothing on screen to say why. And the storage
 * read had none at all, so a disk that would not answer took the memory away in
 * silence.
 *
 * Read as source, because there is no renderer in this suite (docs/TESTING.md).
 * The ceiling is honest: this proves the pause is threaded, the flag is let go
 * of on both paths and the read has a rejection path, never that a phone
 * stopped drawing or that a learner saw a row.
 */
describe('the tutor tab keeps working after a tab switch, a probe that threw and a disk that said no', () => {
  test('the voice circle stops breathing when the tab is not the one on top', () => {
    const orbs = FLAT.match(/<VoiceOrb\b[^>]*\/>/g) ?? [];
    assert.equal(orbs.length, 1, 'the tutor tab draws a number of voice circles other than one');
    assert.match(
      orbs[0]!,
      /paused=\{!focused\}/,
      'the circle is never told the tab was left, so two native-driver loops run behind Home, Practice and Profile for the rest of the session',
    );
    // Only a tab can ask this: the hook throws outside a navigator, and the
    // intro draws mini orbs above one. So the answer comes from here.
    assert.match(FLAT, /const focused = useIsFocused\(\);/, 'the tab passes a pause without knowing whether it is looked at');
    // The circle is the tab's one moving thing. The open conversation's drawing
    // went with its card in F547 and the six place drawings with F573; the
    // scenes themselves were deleted after that, so naming them here would be
    // asserting that two identifiers which no longer exist are not written
    // down. The live form of the claim is that the tab reaches for no authored
    // scene at all: one orb, and nothing else that could loop.
    assert.doesNotMatch(FLAT, /from '\.\.\/illustrations/, 'the tab imports an authored scene again, and the circle is meant to be the one moving thing on it');
    assert.equal((SCREEN.match(/<VoiceOrb\b/g) ?? []).length, 1, 'the tab draws a second circle, so two native-driver loops run on one page');
  });

  test('a probe that threw lets go of the checking flag instead of retiring the tab', () => {
    const opener = between(FLAT, 'const open = (', 'useFocusEffect(', 'the tab has an opener for the conversation');
    assert.match(opener, /if \(checking\) return;/, 'a second tap during the probe opens a second room');
    // One flag disables the circle, all three rows, the memory row and the
    // quiet link at the foot. Raised and never lowered, it is the whole tab.
    assert.match(
      opener,
      /\.catch\(/,
      'the probe has one handler, so a rejection leaves the flag up and every row and link on the tab disabled behind it',
    );
    assert.ok(
      opener.indexOf('.then(') < opener.indexOf('.catch('),
      'the rejection is handled before the answer is, so the chain reads backwards',
    );
    // At the END of the chain, not beside the fulfilment handler. A throw
    // inside `.then` rejects the promise `.then` returns, and an onRejected
    // passed alongside it never sees that throw, which is the shape that
    // reached a phone on Practice this week.
    assert.doesNotMatch(
      opener,
      /\}, \(\) => \{/,
      'the rejection is a second argument to .then, which cannot see a throw from the handler beside it',
    );
    assert.equal(
      (opener.match(/setChecking\(false\)/g) ?? []).length,
      2,
      'the flag is let go of on one path only, so the other one leaves the tab inert',
    );
    // The learner is never left in front of a dead control: the start that did
    // not happen is kept, so the retry is the same start.
    assert.match(opener, /setHeldBack\(\{ textMode \}\)/, 'a start lost to a throw is dropped rather than kept for the retry');
  });

  test('a disk that will not answer takes the memory row and nothing else off the tab', () => {
    const effect = between(FLAT, 'useFocusEffect(', 'const open = (', 'the tab reads its storage on focus');
    assert.match(
      effect,
      /\.catch\(/,
      'the storage read is never answered when it fails, so the read escapes as an unhandled rejection and the tab waits on a disk that already said no',
    );
    assert.ok(
      effect.indexOf('.then(') < effect.indexOf('.catch('),
      'the rejection is handled before the answer is, so a throw from inside the fulfilment handler still escapes',
    );
    assert.doesNotMatch(
      effect,
      /\}, \(\) => \{/,
      'the rejection is a second argument to .then, which cannot see a throw from the handler beside it',
    );
    // What the failure must NOT do. The circle and the three ways in are all on
    // the page without the disk, so a read that failed leaves the page it
    // found: a re-read that did not answer is not evidence that the thread the
    // learner walked away from is gone.
    const rescue = effect.slice(effect.indexOf('.catch('));
    assert.ok(!rescue.includes('setContinuity('), 'a failed read takes away the memory a successful one drew');
    assert.ok(!rescue.includes('setThread('), 'a failed read clears the thread the row offers to pick up');
  });

  test('the three rows are built once for the life of the app, not on every render', () => {
    // `tutorDoors` used to be asked for the resumable scene, the size of the
    // catalogue and a lesson title, and it ran in the render body: on every
    // flip of the checking flag and every focus change. It takes no arguments
    // and reads nothing now, so there is nothing to memo and nothing to
    // rebuild, and the answer is one constant above the component.
    assert.match(FLAT, /const DOORS = tutorDoors\(\); /, 'the door model is built inside the component, so it is rebuilt on every render');
    assert.ok(
      SCREEN.indexOf('const DOORS = tutorDoors()') < SCREEN.indexOf('export function TutorTab()'),
      'the rows are built inside the component rather than once for the life of the app',
    );
    assert.equal(
      (SCREEN.match(/tutorDoors\(/g) ?? []).length,
      1,
      'the tab asks for the door model more than once, and two answers to one question is how two of them drift',
    );
    // And the marks beside them are one table above the component too, so a
    // render never allocates three elements to draw three fixed rows.
    assert.ok(
      SCREEN.indexOf('const GLYPH: Record<EntryModeKey, ReactNode>') < SCREEN.indexOf('export function TutorTab()'),
      'the row marks are rebuilt on every render',
    );
  });
});

describe('the offline block leaves when the tutor comes back — Stage 4 review (2026-09-25)', () => {
  test('a refused start is forgotten once the tutor is reachable again', () => {
    // `heldBack` was cleared only by a successful start from this tab, while
    // `live` can turn true from another screen's `recheck()`. The block, and
    // its unmetered "Try guided practice" door into a lesson that would now
    // run live, stayed drawn. `recheck()` sets `live` to its own answer
    // (app/LiveContext.tsx), so a refusal always coincides with `live` false
    // and clearing on `live` loses no refusal that is still true.
    assert.match(FLAT, /useEffect\(\(\) => \{ if \(live\) setHeldBack\(null\); \}, \[live\]\);/, 'a stale refusal keeps the offline block on screen after the tutor is back');
    const context = stripComments(read('../app/LiveContext.tsx'));
    assert.match(context, /setLive\(r\.ok\);\s*return r\.ok;/, 'recheck answers one thing and sets live to another');
    assert.match(context, /setLive\(false\);\s*return false;/, 'a probe that threw leaves live as it was');
    // The block is still drawn on the same two conditions, and says nothing
    // about minutes, because offline the lesson runs on the phone.
    const offline = between(RENDER, '{(!live || heldBack !== null) && (', '</Card>', 'the offline block is drawn');
    assert.ok(!offline.includes('LESSON_MINUTES'), 'the offline lesson, which uses no minutes, is said to use them');
  });
});