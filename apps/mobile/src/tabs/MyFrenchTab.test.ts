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
 * Scoped deliberately. The `Stat` counts above it read `independence` directly
 * and predate this slice, so a file-wide ban on that literal would fail on code
 * this ticket is not allowed to touch.
 */
const SITUATIONS = between(
  SCREEN,
  'Your situations',
  'Choose another situation',
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
