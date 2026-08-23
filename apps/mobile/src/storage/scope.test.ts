/**
 * The reset list, held against the app that writes the keys.
 *
 * `clearActiveUserData` names its suffixes by hand, and nothing has ever
 * checked that list against reality. A store that forgets to join it looks
 * completely fine — right up to the moment a learner resets their data and
 * something they thought they had cleared comes back, or a one-time flag that
 * survived the wipe silently never fires again for the rest of their life.
 *
 * So this reads both sides, the way palette.test.ts does: the list as the
 * module exports it, and every `userKey('...')` literal in the app source.
 * A new store cannot be added without this test noticing.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { userKey, USER_KEY_SUFFIXES } from './scope.ts';

/** The whole app, not just src/: App.tsx sets the scope up and could read it. */
const APP = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    // A test may name a suffix while proving something about it; only the app
    // itself decides which keys exist.
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Every `userKey('suffix')` the app actually writes, with the file it came from. */
function suffixesInSource(): { file: string; suffix: string }[] {
  const found: { file: string; suffix: string }[] = [];
  for (const file of sourceFiles(APP)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/userKey\(\s*'([^']+)'\s*\)/g)) {
      found.push({ file: file.slice(APP.length), suffix: match[1]! });
    }
  }
  return found;
}

describe('storage scope — what a reset actually reaches', () => {
  test('every key the app writes for a learner is one a reset clears', () => {
    const used = suffixesInSource();
    assert.ok(used.length > 0, 'the scan found no userKey calls at all, so it is checking nothing');
    const cleared = new Set<string>(USER_KEY_SUFFIXES);
    const missing = used.filter(({ suffix }) => !cleared.has(suffix));
    assert.deepEqual(
      missing,
      [],
      `these stores would survive a reset: ${missing.map((m) => `${m.suffix} (${m.file})`).join(', ')}`,
    );
  });

  test('the reset list names each key once, so the list itself is readable', () => {
    assert.equal(
      new Set(USER_KEY_SUFFIXES).size,
      USER_KEY_SUFFIXES.length,
      'a duplicated suffix is a sign the list was appended to twice for the same store',
    );
  });

  test('a key is always namespaced to the signed-in account', () => {
    // Not decoration: an un-namespaced key is one account reading another
    // learner's work on a shared phone, which is why this throws rather than
    // returning something plausible.
    // setActiveUser is never called in this suite, so the module is signed out.
    assert.throws(
      () => userKey('profile'),
      /no signed-in user/,
      'a store read with nobody signed in must be loud, never a silent shared key',
    );
  });
});
