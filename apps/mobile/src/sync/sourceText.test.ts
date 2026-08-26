/**
 * The ledger's whole discipline is that a box may only be ticked when the test
 * named in its `verified-by:` line exists and passes. Finding that test is a
 * search — `grep`, `git grep`, an agent reading the tree. A single raw NUL byte
 * anywhere in a suite makes every one of those tools classify the file as binary
 * and return *nothing*, silently.
 *
 * That is not hypothetical. `engine.test.ts` carried one (the sync fake's rowKey
 * delimiter, written as a literal character rather than the `\u0000` escape) and
 * a reviewer cross-checking a verified-by line against it concluded the test did
 * not exist. Node parses the file perfectly, every test passes, and the gate —
 * which reads run output rather than source — stays green. The failure is
 * invisible in exactly the direction that matters: it makes real work look absent.
 *
 * The escape is the same string to the runtime and a searchable one to everything
 * else, so there is no cost to requiring it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const SKIP = new Set(['node_modules', '.git', 'dist', 'graphify-out', '.claude', '.forge', 'ios', 'android']);

function testFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) testFiles(full, found);
    else if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) found.push(full);
  }
  return found;
}

/**
 * NUL, and only NUL. The first version of this check flagged every C0 control
 * and immediately produced a false positive: `packages/brain/src/profile/
 * profile.test.ts` holds a literal BEL inside `validLearnerName('Sam')`,
 * deliberately, to assert that control characters never reach a synthesiser —
 * and `file` still calls that suite UTF-8 text while `grep` reads every title in
 * it. BEL does not break search; NUL does.
 *
 * Widening this rule would fail a working file, and a guard that cries wolf is a
 * guard someone deletes. It checks the thing that actually made a test suite
 * invisible, and nothing else.
 */
function unsearchableBytes(source: string): { code: number; line: number }[] {
  const hits: { code: number; line: number }[] = [];
  let line = 1;
  for (const ch of source) {
    if (ch === '\n') { line += 1; continue; }
    if (ch.codePointAt(0) === 0) hits.push({ code: 0, line });
  }
  return hits;
}

test('every test file is plain text, so the titles the ledger names can be found by grep', () => {
  const files = testFiles(ROOT);
  assert.ok(files.length > 50, `expected to find the repo's suites, found ${files.length}`);

  const offenders: string[] = [];
  for (const file of files) {
    const hits = unsearchableBytes(readFileSync(file, 'utf8'));
    if (hits.length === 0) continue;
    const where = hits
      .map((h) => `line ${h.line} (U+${h.code.toString(16).padStart(4, '0').toUpperCase()})`)
      .join(', ');
    offenders.push(`${path.relative(ROOT, file)}: ${where}`);
  }

  assert.deepEqual(
    offenders,
    [],
    `these suites contain raw control characters, so grep treats them as binary and the ` +
      `test titles the ledger names cannot be found in them. Write the character as an ` +
      `escape (\\u0000, \\u001b) instead — identical to the runtime, searchable to everything ` +
      `else:\n  ${offenders.join('\n  ')}`,
  );
});
