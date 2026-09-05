/**
 * What My French is allowed to claim about a situation — F218, and about a
 * week — F233.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen. That is a blunt tool and its ceiling is honest: it proves the mark is
 * wired to `passport.ts` and to nothing else, never that a green dot appeared on
 * a phone. The class of bug it is pointed at is the one a renderer would not
 * catch either — a screen quietly growing a second opinion about independence,
 * next to a module that already has the only one.
 *
 * The whole slice is one sentence: a filled mark means the learner got through
 * that scene with nothing handed over. Every assertion here is that sentence
 * read backwards. `isStamped` chooses the fill, `signal.good` appears once in
 * the file so no other row can acquire one, and the state that has not happened
 * gets a hairline rather than a colour, on TodayRow's rule that a thing which
 * has not happened is not a state worth signalling.
 *
 * Both halves are needed. A test that only checks the green dot exists passes
 * just as happily on a screen that draws six of them.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./MyFrenchTab.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');

/**
 * The text between two markers, with both proven present.
 *
 * `surfaceContract.test.ts`'s `writtenBefore` guards the same trap for the same
 * reason: `indexOf` answers -1 for something that is not there, and a slice
 * taken from -1 is a slice of the wrong part of the file, so the assertions
 * that follow would be asked of text nobody wrote.
 */
function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

/**
 * The situations list only, which is the part of this screen F218 owns.
 *
 * Scoped deliberately, but no longer because a count above it names
 * `independence`: F348 took the `Stat` rail out, and its own test now bans the
 * independence literals across the whole file. This slice stays narrow because
 * the next-situation card below it passes `next.independence` to `missionStatus`
 * — an expression, not a literal — and the F218 stamp checks (one green in the
 * slice, one stamp mark) want the situations list and nothing past it. It closes
 * at `st.nextSituation`, the card's own wrapper, because the pill block now sits
 * between the list and the chooser and closing on the chooser would swallow it.
 */
const SITUATIONS = between(
  SCREEN,
  'Your situations',
  'st.nextSituation',
  'the situations list is the part of My French that draws stamps',
);

/**
 * Every `<Tag ...>` in a body, whole, counting braces.
 *
 * The same walk `cardView.test.ts` writes, and for the same reason: a
 * `style={[st.a, cond ? st.b : st.c]}` carries no `>` but an `onPress` arrow
 * does, so a lazy regex stops early and reports the wrong text as the element.
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

/** The one element that draws a stamp, on one line so wrapping cannot hide it. */
function markTag(): string {
  const found = tags(SITUATIONS, 'View').filter((element) => element.includes('st.stampMark'));
  assert.equal(found.length, 1, `the situations list draws exactly one stamp mark, found ${found.length}`);
  return found[0]!.replace(/\s+/g, ' ');
}

/** One style rule from the sheet at the foot of the screen. */
function style(name: string): string {
  return between(SCREEN, `${name}: {`, '}', `${name} is a style this screen defines`);
}

/** Every quoted string in a body: the words a learner could end up reading. */
function literals(body: string): string[] {
  return body.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? [];
}

describe('My French draws the stamps — F218', () => {
  test('the My French screen draws a stamp only for a scene finished unaided', () => {
    const mark = markTag();

    // The screen asks the module and takes the answer. A ternary on
    // `independence` here would be a second ladder, one screen from the first.
    assert.match(
      FLAT,
      /import \{[^}]*stampsFrom[^}]*\} from '\.\.\/progress\/passport\.ts'/,
      'the situations list must consume stampsFrom rather than re-deriving the state',
    );
    assert.match(
      mark,
      /isStamped\(\s*stamp\s*\)\s*\?\s*st\.stampEarned\s*:\s*st\.stampNotYet/,
      'the fill must be chosen by isStamped, so only on-your-own can earn one',
    );
    assert.match(
      style('stampEarned'),
      /backgroundColor:\s*signal\.good/,
      'a stamp is a filled green mark, the same green that means the learner produced French everywhere else',
    );

    // And the other half, which is where this would have gone wrong. A row that
    // has not happened is not a state, so it gets no colour at all.
    const notYet = style('stampNotYet');
    assert.doesNotMatch(
      notYet,
      /backgroundColor/,
      'not-yet keeps the hairline treatment; filling it would report an absence back to the learner',
    );
    assert.match(notYet, /borderColor:\s*paper\.line/, 'the waiting mark is a hairline in paper.line, not a signal');

    // One green in the file means no other row can quietly acquire a stamp,
    // with-help included. This is the assertion that makes the word "only" true.
    assert.equal(
      (SCREEN.match(/signal\.good/g) ?? []).length,
      1,
      'signal.good is used more than once on this screen, so something other than a stamp can read as one',
    );

    for (const invented of ["'on-your-own'", "'with-help'", "'not-yet'"]) {
      assert.ok(
        !SITUATIONS.includes(invented),
        `the situations list names ${invented} itself; that judgement belongs in passport.ts`,
      );
    }
  });

  test('a stamp says what it is claiming, in the passport words', () => {
    const mark = markTag();

    // A green dot is not readable by everyone, and the row's own status line
    // answers a different question ("what next"), so the mark carries its own
    // name. stampLabel exists for exactly this and names the situation.
    assert.match(mark, /accessibilityRole="image"/, 'the stamp mark reaches assistive tech as an unlabelled view');
    assert.match(
      mark,
      /accessibilityLabel=\{stampLabel\(stamp\)\}/,
      'the mark must borrow the passport words rather than growing a second sentence here',
    );
  });

  test('no mark is drawn until one has been earned', () => {
    // hasStamps is the gate. A rail of empty marks is a quota, and a quota you
    // have not met is guilt wearing a different hat (progress/today.ts).
    assert.match(FLAT, /hasStamps\(\s*stamps\s*\)/, 'nothing on this screen consults hasStamps');

    const at = SITUATIONS.indexOf('st.stampMark');
    assert.notEqual(at, -1, 'there is no stamp mark to gate');
    const gate = SITUATIONS.lastIndexOf('showStamps', at);
    assert.notEqual(gate, -1, 'the stamp mark is drawn with nothing gating it');
    assert.ok(at - gate < 120, 'the gate is somewhere else on the screen, not on the mark it is meant to hold back');
  });

  test('a row adds no words a learner could read as a debt, and no count', () => {
    const said = literals(SITUATIONS);
    assert.ok(said.length > 4, `only ${said.length} strings found in the situations list, so this sweep proves little`);

    for (const line of said) {
      const banned = guiltIn(line);
      assert.equal(banned, undefined, `the situations list says ${line}, which carries the banned word "${banned}"`);
      assert.doesNotMatch(line, /\d/, `the situations list says ${line}; a stamp is never a count, a share or a total`);
    }
  });
});

/* ===========================================================================
 * F233 — the week's story, read where the learner went looking.
 *
 * `progress/story.ts` decides everything about the week and this screen draws
 * it. So the positive half of these tests is small on purpose: an import, a
 * gate, a map. Every assertion with any weight in it is about what the screen
 * must *not* have grown.
 *
 * The word "only" in the pinned title is the hard part, and it is worth being
 * exact about what is behind it. It is a measurement over source: every
 * non-test file under `src/` is read, comments stripped, and the set of files
 * that import `progress/story.ts` has to be exactly one. That proves no other
 * module in the app can see the week, so nothing scheduled, backgrounded or
 * notified can carry it anywhere. What it cannot prove is a runtime claim: it
 * says nothing about a server, and it does not watch a phone. The other half of
 * "never pushed" is enforced from the far side, by `reminders/reminder.test.ts`
 * refusing any module under `reminders/` the ability to import `progress/`.
 * Neither test alone is the promise; the pair is.
 *
 * Comments are stripped before the walk, and that is load-bearing rather than
 * tidy. `story.ts`'s own header names the modules around it, and a file that
 * merely *mentions* `progress/story.ts` in prose is not a file that can read
 * the week.
 * =========================================================================== */

/** src/, so "reached from one place" can be counted rather than asserted. */
const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Every non-test source file under src/. Tests are not a way in for a learner. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The block that draws the week.
 *
 * Anchored on `st.week`, which the JSX carries and the stylesheet below it does
 * not, so deleting the block leaves nothing to measure and the failure says so.
 * Anchoring on the gate instead was tried and is worse: hoist the gate into a
 * `const` and the slice runs from there to the first `</View>` anywhere on the
 * page, so every assertion after it would be asked of the missions list. Where
 * the gate sits is checked by position, below, which is the F218 pattern.
 *
 * A function rather than a const, unlike `SITUATIONS` above it, because a
 * `between` at module level throws before any test runs and takes the other
 * four down with it. A missing week block is one red test, not five.
 */
function week(): string {
  return between(SCREEN, 'st.week', '</View>', "My French draws the week's story");
}

/**
 * The words in a body, as opposed to the code: quoted strings and JSX text.
 *
 * `literals` alone is not enough here. A section heading written as JSX text
 * carries no quotes, so a sweep built only on quoted strings would read the
 * accessibility role and miss the one line on the block a learner actually
 * reads.
 */
function spoken(body: string): string[] {
  const text = [...body.matchAll(/>\s*([A-Za-z][^<{}]*?)\s*</g)].map((m) => m[1]!);
  return [...literals(body), ...text];
}

describe("My French carries the week's story — F233", () => {
  test("my french shows the week's story only where the learner goes looking", () => {
    // Where the learner went looking. My French is a tab you open, and the
    // story is drawn in it from the module that owns every word of it.
    const imported = FLAT.match(/import \{([^}]*)\} from '\.\.\/progress\/story\.ts'/);
    assert.ok(imported, 'My French never imports the week story, so there is nothing here to show');
    for (const name of ['storyFrom', 'hasStory']) {
      assert.ok(imported[1]!.includes(name), `My French imports the story module without ${name}`);
    }
    assert.match(FLAT, /loadHistory\(\)/, 'the screen never reads the history the story is built from');
    assert.match(
      FLAT,
      /storyFrom\(history, now\)/,
      'the story is not built from the loaded history and a passed clock; `now` is required, not defaulted',
    );
    // The whole history goes in. Narrowing is the module's job, and doing it
    // here is how the no-delta guarantee gets bypassed one commit later.
    assert.doesNotMatch(
      FLAT,
      /history\s*\.\s*(filter|slice|sort|reverse)\b/,
      'the screen narrows the history before storyFrom sees it; narrowing is that module\'s job and its guarantee',
    );
    assert.match(week(), /story\.sentences\.map\(/, 'the screen never draws the sentences the module built');

    // Nothing on a quiet week. An empty rail is a quota, and a quota you have
    // not met is guilt with better manners (progress/today.ts, progress/story.ts).
    const drawn = SCREEN.indexOf('story.sentences.map(');
    assert.notEqual(drawn, -1, 'there are no sentences to gate');
    const gate = SCREEN.lastIndexOf('hasStory(story)', drawn);
    assert.notEqual(gate, -1, 'the sentences are drawn with nothing holding them back');
    assert.ok(
      drawn - gate < 160,
      'the hasStory gate is somewhere else on the screen, not on the block it is meant to hold back',
    );

    // A week's account heads the page of stamps rather than sitting under it.
    assert.ok(
      gate < SCREEN.indexOf('Your situations'),
      "the week's account is buried under the passport instead of heading it",
    );

    // And now "only". One file in the whole app can see the week.
    const storyModule = join('progress', 'story.ts');
    const readers = sourceFiles(SRC)
      .filter((path) => !path.endsWith(storyModule))
      .filter((path) => /from '[^']*progress\/story\.ts'/.test(stripComments(readFileSync(path, 'utf8'))))
      .map((path) => path.slice(SRC.length));
    assert.deepEqual(
      readers,
      ['tabs/MyFrenchTab.tsx'],
      'something other than My French can read the week, so the story has a second way to reach a learner',
    );

    // Read on demand means this screen is not on the path of anything that
    // arrives uninvited, and it does not become one by importing the way out.
    assert.doesNotMatch(FLAT, /from '\.\.\/reminders\//, 'My French reaches into the reminders layer');
    assert.doesNotMatch(FLAT, /expo-notifications/, 'My French reaches for the notification API');
  });

  test('the week is drawn as it arrives, and nothing here re-decides it', () => {
    // Already ordered, already capped. A screen that sorts or slices is a
    // second opinion about a week, one import away from the only one.
    for (const meddling of ['.sort(', '.slice(', '.reverse(', '.join(', '.filter(', '.length']) {
      assert.ok(
        !SCREEN.includes(`story.sentences${meddling}`),
        `the screen writes story.sentences${meddling}; the sentences arrive ordered and capped and are drawn as they arrive`,
      );
    }
    // And not through a copy, which is how the line above would be walked past
    // on the first attempt: `[...story.sentences].sort()` contains none of them.
    assert.ok(
      !SCREEN.includes('[...story.sentences]'),
      'the screen copies the sentences before drawing them, which is only ever done to reorder or trim them',
    );

    // Nothing here names what the week contained. Every one of these is a
    // fact story.ts weighs, and weighing it twice is how two accounts of one
    // week end up on two screens.
    for (const owned of ['unassistedRate', 'wordsProduced', 'MAX_STORY_SENTENCES', 'DAYS_IN_THE_STORY']) {
      assert.ok(
        !SCREEN.includes(owned),
        `My French names ${owned} itself; what a week contained is the judgement of story.ts, not of a screen`,
      );
    }

    // The block types no number of its own. story.ts holds a narrow licence to
    // print a count of words the learner produced; a digit typed here would be
    // outside it and nothing would say so.
    assert.doesNotMatch(week(), /\d/, 'the week block types a number of its own; every digit in the story comes from story.ts');

    // Words, not a mark. 4.5 is the floor for something a learner reads, and
    // paper.inkFaint measures 2.91 on this ground (palette.test.ts), which is
    // under even the mark floor.
    const sentence = tags(week(), 'Text');
    assert.equal(sentence.length, 1, `the week block draws ${sentence.length} kinds of Text, so this check is reading the wrong one`);
    assert.match(sentence[0]!, /color: paper\.ink[\s,}]/, "the week's sentences are not set in ink");
    assert.doesNotMatch(
      sentence[0]!,
      /inkSoft|inkFaint/,
      'a sentence a learner reads is set in a secondary ink; words clear 4.5 and those do not',
    );

    // A green dot is not readable by everyone and neither is a heading, so the
    // block says what it is to assistive tech as well as to the eye.
    assert.match(week(), /accessibilityRole="summary"/, 'the week arrives at a screen reader as an unnamed group of views');

    // And the one line of copy this screen adds carries none of the vocabulary
    // of a chain you can break.
    const said = spoken(week());
    assert.ok(said.length > 0, 'no words were found in the week block, so this sweep proves nothing');
    for (const line of said) {
      const banned = guiltIn(line);
      assert.equal(banned, undefined, `the week block says ${line}, which carries the banned word "${banned}"`);
    }
  });
});

/* ===========================================================================
 * F348 — nothing at zero, and the next situation closes the screen.
 *
 * The three-`Stat` rail is gone: it was the one place on this screen that drew
 * a number with no module deciding whether it should be there at all. Every
 * count that remains sits behind the gate of the module that owns it —
 * `hasPhrases`, `hasStory`, `hasStamps` — so a first-run learner meets an
 * honest empty screen rather than a rail of zeros. The rows read their verb
 * from `portfolio.ts`'s `situationAction`, and the screen closes on the next
 * situation from core, with the chooser demoted to the quiet door beneath it.
 * =========================================================================== */

/** Where a marker sits in the screen, proven present so ordering is real. */
function at(marker: string): number {
  const i = SCREEN.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the screen at all`);
  return i;
}

describe('My French draws nothing at zero and closes on the next situation — F348', () => {
  test('my french draws no count at zero: the stat rail is gone and every block waits on its module\'s gate', () => {
    // F348 removed a rail of three Stats that drew bare counts with no module
    // deciding whether they belonged. F366 brought three facts back behind a
    // gate: the only Stat on the screen is the one evidence.ts hands over,
    // inside hasEvidence, and nothing here can rehang a count outside it.
    assert.equal((SCREEN.match(/<Stat\b/g) ?? []).length, 1, 'My French draws a Stat outside the evidence row');
    assert.ok(!SCREEN.includes('st.stats'), 'the old stat rail style survives, so a count can still be rehung on it');
    assert.match(FLAT, /hasEvidence\(evidence\) &&/, 'the evidence row is drawn without asking hasEvidence');

    // No count is drawn without its module's gate: the notebook waits on
    // hasPhrases the way the week waits on hasStory and the stamps on hasStamps.
    assert.match(FLAT, /import \{[^}]*hasPhrases[^}]*\} from '\.\.\/phrases\/phrasebook\.ts'/, 'the notebook count has no gate to wait on');
    assert.match(FLAT, /hasPhrases\(\s*book\s*\)/, 'the notebook is drawn without asking hasPhrases');
    assert.match(FLAT, /hasStory\(story\)/, 'the week is drawn without asking hasStory');
    assert.match(FLAT, /hasStamps\(\s*stamps\s*\)/, 'the stamps are drawn without asking hasStamps');

    // The screen names no independence literal anywhere now the rail is gone.
    // That judgement is the passport's, one module away, and naming it here is a
    // second ladder however it is dressed.
    for (const invented of ["'on-your-own'", "'with-help'", "'not-yet'"]) {
      assert.ok(!SCREEN.includes(invented), `My French names ${invented} itself; that judgement belongs in passport.ts`);
    }
    assert.ok(!SCREEN.includes('.independence ==='), 'My French compares independence directly, which is the passport\'s comparison to make');
  });

  test('my french draws its evidence from evidence.ts, inside its gate, and decides none of it on the screen — F366', () => {
    // Three facts at the head of the page, and every one of them decided one
    // module away. The screen loads the activity log, hands everything to
    // evidenceFrom, waits on hasEvidence, and maps the stats it is given. It
    // never counts, never filters missions itself, and never names a level.
    assert.match(
      FLAT,
      /import \{[^}]*evidenceFrom[^}]*hasEvidence[^}]*\} from '\.\.\/progress\/evidence\.ts'/,
      'My French does not read its evidence from evidence.ts',
    );
    assert.match(FLAT, /import \{[^}]*\bStat\b[^}]*\} from '\.\.\/components\.tsx'/, 'My French does not draw the Stat primitive');
    assert.match(FLAT, /loadActivity\(\)/, 'My French never reads the activity log, so it has no level to show');
    assert.match(FLAT, /evidenceFrom\(\{ missions: nextMissions, book: nextBook, activity \}\)/, 'the evidence is not built from the same reads the rest of the screen uses');

    // The row: gated, mapped, three to a row, and read as one summary.
    const row = between(SCREEN, 'hasEvidence(evidence) &&', 'hasPhrases(book)', 'the evidence row is not drawn above the notebook');
    assert.match(row, /evidence\.stats\.map\(/, 'the row does not map the stats the module handed over');
    assert.match(row, /<Stat key=\{stat\.label\} value=\{stat\.value\} label=\{stat\.label\} columns=\{3\}/, 'a stat is not drawn three to a row from the module\'s own fields');
    assert.match(row, /accessibilityRole="summary"/, 'the row is not read as one summary');

    // The analytics event reads the same numbers, from the same module.
    assert.match(FLAT, /situationsDone: nextEvidence\.situations, linesKept: nextEvidence\.lines/, 'the analytics event counts for itself instead of reading evidence.ts');
    assert.ok(!SCREEN.includes('timesFinished > 0'), 'My French counts finished situations itself; that is evidence.ts\'s count');
    assert.ok(!SCREEN.includes('levelFor('), 'My French names a level itself; that is evidence.ts\'s to say');
  });

  test('my french closes on the next situation, and the chooser is the quiet door', () => {
    // Core picks the next situation, the same call Home makes; this screen draws
    // it and never re-derives which one.
    assert.match(FLAT, /import \{[^}]*suggestedMission[^}]*\} from '@luvani\/core'/, 'My French never imports suggestedMission');
    assert.match(FLAT, /suggestedMission\(nextMissions\)/, 'the next situation is not picked from the same list Home reads');

    // Exactly one primary pill, the next-situation start, named for the situation
    // it opens through startLabel so a screen reader hears which one.
    const pills = FLAT.match(/<PillButton label=\{NEXT_SITUATION\.action\} accessibilityLabel=\{startLabel\(/g) ?? [];
    assert.equal(pills.length, 1, `My French draws ${pills.length} next-situation pills; it draws exactly one`);

    // The chooser is the quiet door below it, and it is always reachable — drawn
    // outside the next-situation gate so a learner with no suggestion can still leave.
    assert.match(FLAT, /<GhostButton label="Choose another situation"/, 'the chooser is not the quiet ghost door');
    assert.ok(at('st.nextSituation') < at('Choose another situation'), 'the chooser sits above the next-situation card instead of closing beneath it');

    // Top to bottom: notebook, week, situations, the next-situation card.
    assert.ok(at('Your notebook') < at('st.week'), 'the notebook does not head the screen');
    assert.ok(at('st.week') < at('Your situations'), 'the week does not sit above the situations list');
    assert.ok(at('Your situations') < at('st.nextSituation'), 'the situations list does not sit above the next-situation card');
  });

  test('a finished situation\'s row says refine pronunciation in the module\'s words, and goes where the module says', () => {
    // The row asks the module for its verb and branches on kind. A finished
    // situation refines its sounds; an unfinished one is started. Neither word
    // is spelled here.
    assert.match(FLAT, /situationAction\(\s*item\s*\)/, 'the row does not read its action from situationAction');
    assert.match(FLAT, /action\.kind === 'refine'/, 'the row does not branch on the module\'s kind');

    // Refine goes to the sound check; start tracks the entry and opens the scene.
    assert.match(SITUATIONS, /nav\.navigate\('SoundCheck', \{ missionId: item\.mission\.id \}\)/, 'a refine row does not open the sound check');
    assert.match(SITUATIONS, /name: 'mission_started'/, 'a start row does not track the mission it opens');
    assert.match(SITUATIONS, /entry: 'my-french'/, 'a start row does not carry its own entry point');
    assert.match(SITUATIONS, /nav\.navigate\('Convo', \{ missionId: item\.mission\.id \}\)/, 'a start row does not open the scene');

    // The old words left the file with the decision. "Check" and "Sound check
    // for" now live only in the module, so they cannot drift from it here.
    assert.ok(!SCREEN.includes("'Check'"), 'My French still spells the Check label itself');
    assert.ok(!SCREEN.includes('Sound check for'), 'My French still spells the sound-check sentence itself');
  });
});

/* ===========================================================================
 * F394 — the situations the learner saved, and nothing when they saved none.
 *
 * Home's daily situation card carries a Bookmark, and what it saves has to
 * arrive somewhere the learner can find it again. That somewhere is here,
 * beside the notebook and the scenes they have already walked into.
 *
 * Everything with a decision in it is `bookmarks/view.ts`: which situations are
 * saved, in which order, what the block is called and what the verb on a row
 * is. This screen asks and draws. The assertion with weight in it is the gate:
 * a shelf that says it is empty says the learner failed to fill it, which is
 * the rule `progress/evidence.ts` and `progress/today.ts` already hold.
 * =========================================================================== */

describe('My French carries the saved situations — F394', () => {
  test('my french draws saved situations inside hasSaved and starts one through the seed topic — F394', () => {
    // The fold is the module's, over the store's decisions and core's pool. A
    // screen that filtered the items itself would be a second opinion about
    // what "saved" means, one import away from the only one.
    const imported = FLAT.match(/import \{([^}]*)\} from '\.\.\/bookmarks\/view\.ts'/);
    assert.ok(imported, 'My French never imports the saved-situations view, so it has nothing to draw');
    for (const name of ['SAVED_SITUATIONS_LABEL', 'SAVED_SITUATION_ACTION', 'hasSaved', 'savedSituations']) {
      assert.ok(imported[1]!.includes(name), `My French imports the bookmarks view without ${name}`);
    }
    assert.match(FLAT, /loadBookmarks\(\)/, 'the screen never reads the bookmark store');
    assert.match(
      FLAT,
      /savedSituations\(bookmarks, DAILY_SCENARIOS\)/,
      "the saved list is not folded from the store against core's pool, so a retired id could draw a blank row",
    );
    for (const meddling of ['.sort(', '.filter(', '.reverse(', '.slice(']) {
      assert.ok(!SCREEN.includes(`saved${meddling}`), `the screen writes saved${meddling}; the list arrives ordered and is drawn as it arrives`);
    }

    // Nothing at zero. Not an empty state, not a hint, not a nudge to go and
    // save something: a learner who has saved nothing has not failed at
    // anything, and a panel telling them the shelf is empty says they have.
    const drawn = SCREEN.indexOf('<Label>{SAVED_SITUATIONS_LABEL}');
    assert.notEqual(drawn, -1, 'there is no saved block to gate');
    const gate = SCREEN.lastIndexOf('hasSaved(saved)', drawn);
    assert.notEqual(gate, -1, 'the saved block is drawn with nothing holding it back');
    assert.ok(drawn - gate < 160, 'the hasSaved gate is somewhere else on the screen, not on the block it is meant to hold back');

    // The block's own words are the module's, both of them.
    assert.match(SCREEN, /<Label>\{SAVED_SITUATIONS_LABEL\}<\/Label>/, 'the screen spells the saved heading itself');
    assert.ok(!SCREEN.includes("'Saved situations'"), 'the screen spells the saved heading itself');
    assert.ok(!SCREEN.includes('label="Start"'), 'the screen spells the saved verb itself');

    // A row says which situation it is, in English, and opens it as a
    // conversation through the same seed-topic pipe Home starts one with. No
    // mission id: a daily situation is not a mission and never claims to be.
    const saved = between(SCREEN, '<Label>{SAVED_SITUATIONS_LABEL}', 'packs.length', 'the saved block sits above the conversation packs');
    assert.match(saved, /\{situation\.titleEn\}/, 'a saved row does not name the situation');
    assert.match(saved, /label=\{SAVED_SITUATION_ACTION\}/, 'a saved row does not read its verb from the module');
    assert.match(
      saved.replace(/\s+/g, ' '),
      /nav\.navigate\('Convo', \{ seedTopic: seedTopicOf\(situation\) \}\)/,
      'a saved row does not open the conversation on the scene it names',
    );
    assert.match(saved, /accessibilityLabel=\{startLabel\(situation\.titleEn\)\}/, 'a saved row leaves a screen reader with a bare verb');
    assert.doesNotMatch(saved, /<PillButton/, 'a saved row is drawn as a second primary; the tab has one pill and it is the next situation');

    // The row is reachable one handed, like every other row in the app.
    assert.match(style('savedRow'), /minHeight: HIT/, 'a saved row falls under the touch floor');

    // And the block adds no words a learner could read as a debt, and no count.
    const said = literals(saved);
    for (const line of said) {
      const banned = guiltIn(line);
      assert.equal(banned, undefined, `the saved block says ${line}, which carries the banned word "${banned}"`);
      assert.doesNotMatch(line, /\d/, `the saved block says ${line}; a shelf of saved scenes is never a count`);
    }
  });
});
