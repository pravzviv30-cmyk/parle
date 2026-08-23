/**
 * The tutor's name has one home.
 *
 * Same rule, and the same reason, as the token server address in F8: the app
 * said "your tutor" in twenty-odd places, and replacing that with the literal
 * "Luc" in twenty-odd places would trade one problem for a worse one. Twenty
 * copies agree about nothing today and would eventually disagree about
 * something, and a half-renamed tutor is a learner being introduced to two
 * people.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TUTOR_NAME } from './tutorName.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const HOME = 'tutorName.ts';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

describe('the tutor is called one thing, in one place', () => {
  test('the name is spelled out exactly once in the whole app', () => {
    const spelled: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (file.endsWith(HOME) || file.endsWith('tutorName.test.ts')) continue;
      const source = readFileSync(file, 'utf8');
      // Comments are prose about the code, not copy shown to anyone.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (new RegExp(`\\b${TUTOR_NAME}\\b`).test(code)) spelled.push(file);
    }
    assert.deepEqual(
      spelled,
      [],
      `the name is hardcoded outside ${HOME}, so a rename would half-happen:\n${spelled.join('\n')}`,
    );
  });

  test('it is a name a beginner can say, and not empty', () => {
    assert.ok(TUTOR_NAME.trim().length > 0, 'the tutor has no name');
    assert.match(TUTOR_NAME, /^[A-ZÀ-Ý][a-zà-ÿ]+$/u, 'a name a learner reads aloud, not a handle');
  });
});
