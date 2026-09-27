/**
 * One way of saying what something costs and how it sounds (Stage 4, item 5).
 *
 * The words are `copy/access.ts`'s. This holds them to the copy rules, pins the
 * two Stage 1-3 constants that already said the same thing word for word to
 * the vocabulary, and walks the source for the one claim the product must never
 * make: that typing to the tutor is free. A typed conversation is still the
 * live tutor, and it is metered exactly as a spoken one is.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { guiltIn } from './guilt.ts';
import {
  ACCESS_COPY,
  AUTHORED_EXAMPLE,
  DEVICE_VOICE,
  LESSON_MINUTES,
  LIVE_MINUTES,
  NEEDS_CONNECTION_AND_MINUTES,
  NO_MINUTES,
  RECORDED_AUDIO,
  TEXT_ONLY,
} from './access.ts';
import { PRACTICE_ALTERNATIVES, RECOMMENDED } from '../practice/copy.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Comments may say anything; only what compiles can reach a learner. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  // A '//' preceded by ':' is a URL inside a string, not a comment.
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/**
 * Every string literal and JSX text run in a source file that mentions typing
 * (Type, typed, typing) and also says "free" as a whole word.
 *
 * Word boundaries on both sides, so "freely" and "typeface" are not claims.
 * Deliberately a little blunt, on `copy/guilt.ts`'s reasoning: a false
 * positive costs one sentence a rewrite, a false negative tells a learner a
 * metered conversation costs nothing.
 */
function freeBesideTyped(source: string): string[] {
  const code = stripComments(source);
  const strings = [
    ...code.matchAll(/'((?:[^'\\\n]|\\.)*)'/g),
    ...code.matchAll(/"((?:[^"\\\n]|\\.)*)"/g),
    ...code.matchAll(/`((?:[^`\\]|\\.)*)`/g),
    ...code.matchAll(/>([^<>{}]+)</g),
  ].map((m) => m[1] ?? '');
  return strings.filter((text) => /\btyp(?:e|ed|ing)\b/i.test(text) && /\bfree\b/i.test(text));
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

describe('the access vocabulary — Stage 4 item 5', () => {
  test('each access claim is one fixed sentence', () => {
    assert.equal(NO_MINUTES, 'Uses no live minutes.');
    assert.equal(LIVE_MINUTES, 'Uses live minutes.');
    assert.equal(LESSON_MINUTES, 'Uses live minutes while your tutor is connected.');
    assert.equal(RECORDED_AUDIO, 'Recorded tutor audio');
    assert.equal(DEVICE_VOICE, 'Device voice');
    assert.equal(TEXT_ONLY, 'Text only: no French voice on this device');
    assert.equal(AUTHORED_EXAMPLE, 'Authored example, not your conversation.');
    assert.match(NEEDS_CONNECTION_AND_MINUTES, /connection/);
    assert.match(NEEDS_CONNECTION_AND_MINUTES, /live minutes/);
  });

  test('the vocabulary names no price, no count, no dash and no scold', () => {
    assert.ok(ACCESS_COPY.length >= 8, 'the sweep list is missing a line');
    for (const line of ACCESS_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.doesNotMatch(line, /\d|—|%|£|\$|€/, `"${line}" carries a number, a dash or a price`);
      assert.doesNotMatch(line, /\bfree\b/i, `"${line}" makes a free claim`);
      assert.equal(line, line.trim());
    }
    // A device synthesiser is never passed off as the tutor.
    assert.doesNotMatch(DEVICE_VOICE, /tutor/i);
    assert.doesNotMatch(TEXT_ONLY, /tutor/i);
  });

  test('the Stage 1-3 lines that already said this word for word read it from the vocabulary', () => {
    // Re-pointed without changing a visible character (Stage 4, 2026-09-25).
    assert.equal(RECOMMENDED.noMinutes, NO_MINUTES);
    assert.equal(PRACTICE_ALTERNATIVES.revisitUses, LIVE_MINUTES);
    const practice = readFileSync(join(SRC, 'practice', 'copy.ts'), 'utf8');
    assert.match(practice, /noMinutes: NO_MINUTES,/, 'practice/copy.ts spells the no-minutes line itself again');
    assert.match(practice, /revisitUses: LIVE_MINUTES,/, 'practice/copy.ts spells the live-minutes line itself again');
  });
});

describe('typing is never called free — Stage 4 item 5', () => {
  test('the scan finds a free claim beside typing, and leaves freely alone', () => {
    assert.deepEqual(freeBesideTyped(`const a = 'Typed practice is free.';`), ['Typed practice is free.']);
    assert.deepEqual(freeBesideTyped('<Text>Type for free</Text>'), ['Type for free']);
    assert.deepEqual(freeBesideTyped('const b = `Typing is FREE`;'), ['Typing is FREE']);
    assert.deepEqual(freeBesideTyped(`const c = 'Type freely, it still uses live minutes.';`), []);
    assert.deepEqual(freeBesideTyped(`const d = 'Free offline practice.';`), []);
    // A comment is not copy.
    assert.deepEqual(freeBesideTyped('// typed and free, in a comment\nconst e = 1;'), []);
  });

  test('no string in the app that mentions typing also says free', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const hit of freeBesideTyped(readFileSync(file, 'utf8'))) offenders.push(`${relative(SRC, file)}: ${hit}`);
    }
    assert.deepEqual(offenders, [], `A typed conversation is still the metered tutor:\n${offenders.join('\n')}`);
  });
});
