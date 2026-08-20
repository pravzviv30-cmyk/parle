/**
 * The copy rule, extended to the app.
 *
 * packages/core/src/copy.test.ts holds learner-facing *content* to "plain,
 * human writing with no em dashes". Nothing held the app's own UI strings to
 * the same rule, which is how one survived on the welcome screen. This test
 * walks every non-test source file in src/, strips comments (where em dashes
 * are fine and used), and fails on any that remain — those can only live in
 * string literals or JSX text, which is exactly what a learner reads.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    // Test files keep their em-dash describe names; that is a repo convention
    // (docs/TESTING.md), not learner-visible copy.
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Remove block comments and line comments, keeping line numbers stable. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  // A '//' preceded by ':' is a URL inside a string, not a comment.
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

test('no em dash reaches a learner through app copy', () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      if (line.includes('—')) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
    });
  }
  assert.deepEqual(
    offenders,
    [],
    `Em dashes found outside comments. The user asked for plain, human writing:\n${offenders.join('\n')}`,
  );
});
