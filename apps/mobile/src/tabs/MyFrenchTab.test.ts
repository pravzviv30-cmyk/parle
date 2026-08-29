/**
 * What My French is allowed to claim about a situation — F218.
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
import { readFileSync } from 'node:fs';
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
