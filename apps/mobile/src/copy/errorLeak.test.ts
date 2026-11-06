/**
 * A caught error's message never reaches a screen as itself.
 *
 * `cause instanceof Error ? cause.message : 'fallback'` is how a code, a URL or
 * a library sentence ("Network request failed") got in front of a learner. A
 * catch block passes the cause to `errorCopy` (copy/errorCopy.ts) instead. So
 * the walk below reads every non-test .ts and .tsx file under apps/mobile/src,
 * comments stripped, and refuses `instanceof Error ? x.message` and
 * `setSomething(error.message)` on a caught value (e, err, error, cause, ex,
 * caught). A typed result's `result.message` is designed copy and stays.
 *
 * What it cannot see: a message handed on through a variable, a prop or a
 * return value, a message taken from a server body field, and other shapes such
 * as `String(e)`, `${e.message}`, `e?.message`, `(e as Error).message` or a
 * receiver not named set*. None of those reach a screen today; they are read
 * by hand. The live failure notice in live/failure.ts has its own test. A
 * tripwire, read from the source as the other walks in this package are.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Comments may say anything; line numbers are kept. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SHAPES = [/instanceof Error \?\s*\w+\.message/g, /\bset[A-Z]\w*\(\s*(?:e|err|error|cause|ex|caught)\.message\s*\)/g];

/** The lines where a message is shown as itself. */
function leaks(body: string): number[] {
  return SHAPES.flatMap((shape) => [...body.matchAll(shape)].map((m) => body.slice(0, m.index).split('\n').length));
}

describe('error messages stay off the screen', () => {
  test('no catch block shows a caught message as itself', () => {
    // The shapes first, so a walk that finds nothing is a clean tree and not a broken pattern.
    assert.equal(leaks("setIssue(cause instanceof Error ? cause.message : 'x');").length, 1);
    assert.equal(leaks('setError(e.message);').length, 1);
    assert.equal(leaks('setFormMessage(result.message);').length, 0);
    assert.equal(leaks("setIssue(errorCopy(cause, 'x'));").length, 0);

    const files = sources(SRC);
    assert.ok(files.length > 500, `the walk found only ${files.length} files`);
    const found: string[] = [];
    for (const file of files) {
      const rel = relative(SRC, file);
      for (const line of leaks(stripComments(readFileSync(file, 'utf8')))) found.push(`${rel.split(sep).join('/')}:${line}`);
    }
    assert.deepEqual(found, [], `these show a caught message as itself, use errorCopy: ${found.join(', ')}`);
  });
});
