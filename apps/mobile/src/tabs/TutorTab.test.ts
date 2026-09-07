/**
 * What the Tutor tab is allowed to decide about its own doors — F405.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen, the way `PracticeTab.test.ts` reads its own. The rule it guards is
 * the one F404 finished pulling into `tutor/gate.ts` and `tutor/dashboard.ts`:
 * the tab draws the doors, it does not word them and it does not count them.
 *
 * Half of this is about what the founder took OFF the screenshot, and a
 * removal is the one thing a source read holds better than a renderer would:
 * the orange "In progress" pill, the purple ear beside the resume title and
 * the "Free improvisation" line under the open conversation are each named
 * here, so putting one back fails by name rather than by a screenshot nobody
 * compares. The pill count is here for the same reason — the rule became one
 * pill per door, which is exactly the kind of loosened rule that drifts into
 * three.
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

describe('the tutor tab is the screenshot, drawn from the door model — F405', () => {
  test('the tutor tab draws the resume, the missions and the open conversation exactly as the doors say, with rows, one pill per door and no ear — F405', () => {
    // Every word on the page comes from a module that a test can reach. The tab
    // spells no heading, no purpose line and no notice of its own.
    const dashboard = FLAT.match(/import \{([^}]*)\} from '\.\.\/tutor\/dashboard\.ts'/);
    assert.ok(dashboard, 'the tab never imports tutor/dashboard.ts, so it has no header words to draw');
    for (const name of ['tutorHeading', 'TUTOR_PURPOSE', 'TUTOR_ORB_SUBLINE']) {
      assert.ok(dashboard[1]!.includes(name), `the tab imports the header module without ${name}`);
    }
    const gate = FLAT.match(/import \{([^}]*)\} from '\.\.\/tutor\/gate\.ts'/);
    assert.ok(gate, 'the tab never imports tutor/gate.ts, so it has no doors to draw');
    for (const name of ['minutesRemainingLine', 'scenarioCountLine', 'tutorDoors']) {
      assert.ok(gate[1]!.includes(name), `the tab imports the door module without ${name}`);
    }
    assert.match(FLAT, /\{tutorHeading\(tutorName\)\}/, 'the tab writes its own header instead of asking dashboard.ts');
    assert.match(
      FLAT,
      /MICROPHONE_NOTICE/,
      'the tab makes a second microphone promise instead of the one the chooser already makes',
    );

    // The count is the catalogue's, handed in rather than counted twice.
    assert.match(FLAT, /tutorDoors\([\s\S]{0,400}MISSIONS\.length/, 'the doors are asked for without the number of situations');

    // ── the resume door ────────────────────────────────────────────────────
    const resume = between(RENDER, "door.key === 'resume'", "door.key === 'missions'", 'the resume door is drawn first');
    assert.match(resume, /<MissionDisc\b/, 'the resume door lost the drawing of the place it resumes');
    assert.match(resume, /type\.title[\s\S]{0,60}\{door\.title\}/, 'the resume door does not set its French title in the serif');
    assert.match(resume, /\{door\.gloss\}/, 'the resume door lost the line saying what the scene is');
    assert.match(
      resume,
      /door\.minutesRemaining !== null &&[\s\S]*minutesRemainingLine\(door\.minutesRemaining\)/,
      'the minutes line is drawn without checking that anything measured it, which is how a null becomes a claim',
    );
    assert.match(resume, /<PillButton\s+label=\{door\.action\}/, 'the resume door does not carry the pill the founder asked to be bigger');
    // What the founder took off this card. Both were drawn in the screenshot
    // and both are gone: a status pill mid-session is a report card, and the
    // ear said "audio" beside a title that was never a sound.
    assert.ok(!SCREEN.includes('<EarGlyph'), 'the purple ear is back on the resume card');
    assert.ok(!SCREEN.includes('In progress'), 'the orange In progress pill is back on the resume card');

    // ── the guided practice missions door ──────────────────────────────────
    // The slice ends where the missions door ends, which is the scripted lesson
    // now rather than the open conversation. Reading to `'free'` would swallow
    // the lesson's outline button and report it as a button on this door.
    const missions = between(RENDER, "door.key === 'missions'", "door.key === 'lesson'", 'the missions door is drawn second');
    assert.match(missions, /\{door\.label\}/, 'the missions door lost its heading');
    assert.match(missions, /scenarioCountLine\(door\.count\)/, 'the count is spelled on the screen instead of formatted by gate.ts');
    assert.match(missions, /\{door\.gloss\}/, 'the missions door lost the description line the founder asked for');
    assert.match(missions, /MISSIONS\.map\(/, 'the missions door lost its list of rows');
    assert.match(missions, /<MissionDisc place=\{mission\.place\} size=\{48\}/, 'a row lost its drawing');
    assert.match(missions, /\{mission\.titleEn\}/, 'a row never says which situation it is');
    assert.match(missions, /\{mission\.goalEn\}/, 'a row never says what the learner will be able to do');
    assert.match(missions, /<ArrowRight\b/, 'a row that opens a screen does not say so');
    assert.match(missions, /style=\{\(\{ pressed \}\) => \[st\.row\b/, 'a row never says it was pressed, so a tap on it looks like nothing');
    // The floor is in the style, so the claim has to be read there rather than
    // beside the Pressable that wears it.
    const rowStyle = between(SCREEN, 'row: {', '}', 'the rows are drawn with a style that is not defined');
    assert.match(rowStyle, /minHeight: HIT/, 'a row is built under the 44pt touch floor');
    assert.match(missions, /\{ focus: mission\.id \}/, 'a row opens the chooser without naming the situation it promised');
    assert.doesNotMatch(missions, /<PillButton\b|<OutlineButton\b/, 'the missions door grew a button; it is a list of rows now');

    // ── the open conversation ──────────────────────────────────────────────
    const free = between(RENDER, "door.key === 'free'", 'st.quiet', 'the open conversation is drawn last');
    assert.match(free, /<EveningIn[^/]*paused=/, 'the open conversation loops its drawing while the tab is not looked at');
    assert.match(free, /<PillButton\s+label=\{door\.action\}/, 'the open conversation lost the button under its drawing');
    assert.ok(
      free.indexOf('<EveningIn') < free.indexOf('<PillButton'),
      'the button sits above the drawing; the founder asked for it centred directly underneath',
    );
    assert.ok(!SCREEN.includes('Free improvisation'), 'the Free improvisation line is back under the open conversation');

    // One pill per door, and no third anywhere: the resume and the open
    // conversation each carry one, the list of rows carries none.
    const pills = (SCREEN.match(/<PillButton\b/g) ?? []).length;
    assert.equal(pills, 2, `the tab draws ${pills} pills; one for the resume and one for the open conversation is all there is`);

    // The order the founder drew, read off the render rather than the model.
    assert.ok(at('<TabHeader') < at('<VoiceOrb'), 'the voice circle sits above the header');
    assert.ok(at('<VoiceOrb') < at('doors.map('), 'the doors sit above the voice circle');
    assert.ok(at("door.key === 'resume'") < at("door.key === 'missions'"), 'the missions come before the scene to pick back up');
    assert.ok(at("door.key === 'missions'") < at("door.key === 'lesson'"), 'the scripted lesson comes before the guided situations');
    assert.ok(at("door.key === 'lesson'") < at("door.key === 'free'"), 'the open conversation is not last');

    // The screen spells no numeral. Both counts travel as numbers and are
    // worded by the two formatters, so a digit in a string here would be a
    // second answer to a question gate.ts already answers.
    const doors = between(RENDER, 'doors.map(', 'st.quiet', 'the tab draws its doors from the model');
    for (const literal of doors.match(/'[^']*'|"[^"]*"/g) ?? []) {
      assert.ok(!/\d/.test(literal), `the doors block spells a numeral itself: ${literal}`);
    }

    // And the quiet footer, which is the only way through for someone who
    // cannot speak where they are sitting.
    const quiet = SCREEN.slice(SCREEN.indexOf('st.quiet'));
    assert.match(quiet, /open\(true\)/, 'the quiet typed door left the foot of the tab');
    assert.match(quiet, /TUTOR_INTRO_LINK/, 'the way back to the explainer left the foot of the tab');
    assert.match(quiet, /<HelpGlyph\b/, 'the intro link lost the mark that says it is help');
    assert.match(quiet, /\{MICROPHONE_NOTICE\}/, 'the microphone promise is decided and never reaches glass');
  });
});

/**
 * The orb and the card were both talking.
 *
 * `VoiceOrb` captions itself by default, which is right on the live screen where
 * it is the only thing on the page. On this card it is not: the card says "Tap
 * to speak" and a second line under it, and the orb's own caption rendered on
 * top of both. It looked like a rendering fault and it had been there since the
 * card was built. The founder's screenshot has one caption on it.
 */
describe('the tutor card owns its words — F415', () => {
  test("the tutor's circle lets the card do the talking — F415", () => {
    const orbs = FLAT.match(/<VoiceOrb\b[^>]*\/>/g) ?? [];
    assert.equal(orbs.length, 1, 'the tutor tab draws a number of voice circles other than one');
    assert.match(
      orbs[0]!,
      /withCaption=\{false\}/,
      'the circle captions itself on a card that already says two lines, and the two land on top of each other',
    );
    // And the card still says them, so silencing the orb did not silence the card.
    assert.match(FLAT, /Tap to speak/, 'the card lost the words the circle was told not to say');
    assert.match(FLAT, /TUTOR_ORB_SUBLINE/, 'the card lost its second line');
  });
});

/**
 * The scripted lesson's only route into the app used to be on another tab.
 *
 * `tabs/PracticeTab.tsx` held the single `navigate('Lesson')` in the whole
 * source, so a Practice tab rebuilt without that row would have deleted the
 * scripted lesson from the product without deleting a line of it: the screen
 * still builds, the suites still pass, and no learner can ever reach it again.
 * This is the assertion that fails if the door goes.
 *
 * The rest is the same rule the rest of this file guards. The lesson is a door
 * like the other three: `tutor/gate.ts` words it, orders it and says it takes
 * no pill, and the tab draws it and decides nothing.
 */
describe('the scripted lesson has a door on the tutor tab', () => {
  test('the Lesson route is reachable from the tutor tab, and the tab words none of it', () => {
    // Reachable at all. Everything else on this door is decoration next to it.
    assert.match(FLAT, /nav\.navigate\(start\.screen, start\.params\)/, 'the tutor tab has no way to the Lesson route');
    assert.match(FLAT, /lessonStart\(/, 'the tab decides where the lesson opens instead of reading it from gate.ts');

    const gate = FLAT.match(/import \{([^}]*)\} from '\.\.\/tutor\/gate\.ts'/);
    assert.ok(gate, 'the tab never imports tutor/gate.ts, so it has no doors to draw');
    for (const name of ['lessonStart', 'TUTOR_LESSON_QUIET_LINK']) {
      assert.ok(gate[1]!.includes(name), `the tab imports the door module without ${name}`);
    }

    // The title is the catalogue's, handed in the way the mission count is, so
    // a lesson renamed in core cannot leave this door saying the old name.
    assert.match(FLAT, /tutorDoors\([\s\S]{0,600}CAFE_LESSON\.title/, 'the doors are asked for without the title the catalogue holds');
    assert.ok(!SCREEN.includes('Commander un café'), 'the tab spells the lesson title itself');

    const lesson = between(RENDER, "door.key === 'lesson'", "door.key === 'free'", 'the lesson door is drawn third');
    assert.match(lesson, /\{door\.label\}/, 'the lesson door lost its heading');
    assert.match(lesson, /type\.title[\s\S]{0,80}\{door\.title\}/, 'the lesson door does not set its French title in the serif');
    assert.match(lesson, /\{door\.gloss\}/, 'the lesson door lost the line saying what it is for');
    assert.match(lesson, /<MissionDisc\b/, 'the lesson door lost the drawing of where it is set');
    assert.match(
      lesson,
      /<OutlineButton\s+label=\{door\.action\}/,
      'the lesson door names its own button instead of reading the word from gate.ts',
    );
    // No pill. The tab draws exactly two and both were spoken for before this
    // door existed; `surfaceContract.test.ts` pins that number per tab, and a
    // secondary door is the outline, which is what the rest of the app uses.
    assert.doesNotMatch(lesson, /<PillButton\b/, 'the lesson door took a third pill');
  });

  test('the lesson door probes before it navigates, the way every other door here does', () => {
    const opener = between(FLAT, 'const openLesson', 'if (showingIntro)', 'the tab has an opener for the lesson');
    assert.match(opener, /if \(checking\) return;/, 'a second tap during the probe opens a second lesson');
    assert.ok(
      opener.indexOf('setChecking(true)') < opener.indexOf('recheck()'),
      'the probe runs before the flag is raised, which is the dead press the flag exists to stop',
    );
    assert.match(opener, /recheck\(\)\.then\(go, go\)/, 'a probe that threw leaves the tab retired behind a raised flag');
    assert.match(opener, /setChecking\(false\)/, 'the flag is raised and never lowered');
    assert.match(opener, /lessonStart\(textMode\)/, 'the opener throws away the route the learner chose');

    // Both controls on the card go through it, the spoken one and the quiet one.
    const lesson = between(RENDER, "door.key === 'lesson'", "door.key === 'free'", 'the lesson door is drawn third');
    assert.match(lesson, /openLesson\(true\)/, 'the quiet control on the lesson door skips the probe');
    assert.match(FLAT, /openLesson\(false\)/, 'the lesson button skips the probe');
  });

  test('the lesson carries its own quiet way in, and the footer control keeps its one destination', () => {
    // "Unable to speak right now?" at the foot of the tab reaches the
    // conversation and nothing else. One control cannot honestly reach two
    // places, so the lesson carries its own link on its own card, worded to
    // name its own door rather than asking the same question a second time.
    const quiet = SCREEN.slice(SCREEN.indexOf('st.quiet'));
    assert.match(quiet, /open\(true\)/, 'the quiet typed door left the foot of the tab');
    assert.ok(!quiet.includes('openLesson'), 'the footer control now guesses between the conversation and the lesson');

    // And the lesson's own one is there, because the live lesson offers the
    // typed door only after a failure. ConvoScreen offers it mid-session and
    // LiveSessionScreen does not, so without this the typed lesson is reachable
    // only by first breaking.
    const lesson = between(RENDER, "door.key === 'lesson'", "door.key === 'free'", 'the lesson door is drawn third');
    assert.match(lesson, /\{TUTOR_LESSON_QUIET_LINK\}/, 'the lesson has no quiet way in from the tab');
  });
});

/**
 * The three ways this tab used to stop working while still looking fine.
 *
 * None of them is visible in a screenshot, which is why they lasted. A bottom
 * tab stays mounted after its first visit, so the voice circle went on
 * breathing behind every other tab for the rest of the session. The `checking`
 * flag had one handler, so a probe that ever threw would leave every door, row
 * and link on the page disabled with nothing on screen to say why. And the
 * storage read had none at all, so a disk that would not answer took the
 * resume door away in silence.
 *
 * Read as source, because there is no renderer in this suite (docs/TESTING.md).
 * The ceiling is honest: this proves the pause is threaded, the flag is let go
 * of on both paths and the read has a rejection path, never that a phone
 * stopped drawing or that a learner saw a door.
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
    // The drawing beside the open conversation has done this since it was
    // added. The circle is the same claim, and it was the one thing on the page
    // exempt from it.
    assert.match(FLAT, /<EveningIn width=\{176\} paused=\{!focused\} \/>/, 'the drawing stopped taking the pause the circle now takes');
  });

  test('a probe that threw lets go of the checking flag instead of retiring the tab', () => {
    const opener = between(FLAT, 'const open = (', 'const openLesson', 'the tab has an opener for the conversation');
    assert.match(opener, /if \(checking\) return;/, 'a second tap during the probe opens a second room');
    // One flag disables the speak card, all four doors, every mission row and
    // all three links at the foot. Raised and never lowered, it is the whole
    // tab.
    assert.match(
      opener,
      /\.catch\(/,
      'the probe has one handler, so a rejection leaves the flag up and every door, row and link on the tab disabled behind it',
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

    // And the lesson door, which has had both paths since it was written, is
    // still the model this follows.
    const lesson = between(FLAT, 'const openLesson', 'if (showingIntro)', 'the tab has an opener for the lesson');
    assert.match(lesson, /recheck\(\)\.then\(go, go\)/, 'the lesson opener lost the shape the conversation opener now matches');
  });

  test('a disk that will not answer takes the resume door and nothing else off the tab', () => {
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
    // What the failure must NOT do. The speak card, the situations, the lesson
    // and the open conversation are all on the page without the disk, so a read
    // that failed leaves the page it found: a re-read that did not answer is
    // not evidence that the scene the learner walked out of is gone.
    const rescue = effect.slice(effect.indexOf('.catch('));
    assert.ok(!rescue.includes('setResume('), 'a failed read takes away the door a successful one drew');
    assert.ok(!rescue.includes('setRecords('), 'a failed read clears the records the minutes line is measured from');
  });

  test('the doors are built when a read answers, not on every render', () => {
    // `tutorDoors` allocates four door objects and the record scan walks every
    // scene, and both used to run in the render body: on every flip of the
    // checking flag, every focus change and every toggle of the intro.
    assert.match(
      FLAT,
      /const doors = useMemo\(/,
      'the door model and the record scan are rebuilt on every render, including on every flip of the checking flag',
    );
    const memo = between(FLAT, 'const doors = useMemo(', 'const enter = (', 'the doors are built in a memo');
    assert.match(memo, /tutorDoors\(/, 'the memo holds something other than the door model');
    assert.match(memo, /records\.find\(/, 'the record scan is still outside the memo, so it runs on every render anyway');
    assert.match(
      memo,
      /\[records, resume\]/,
      'the memo does not name the two reads the doors are built from, so it is either stale or not a memo',
    );
  });
});
