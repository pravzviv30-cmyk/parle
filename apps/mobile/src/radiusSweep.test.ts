/**
 * F994: corners come from the radius scale. A literal `border*Radius` survives
 * only in onboarding and the three tab-bar files, which keep their own sizes
 * until their builds. Zero is a square corner, not a literal. Files are walked
 * the way `scripts/unslop-scan.mjs` `isScanned` walks them: tests, `dev/` and
 * `art/` are skipped.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

const ALLOWED = [/^onboarding\//, /^nav\/(LuvaniTabBar|TabPill|TabGlyph)\.tsx$/];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dev' || entry.name === 'art') continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name) || /\.d\.ts$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Remove block comments and line comments, keeping line numbers stable. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

test('literal radii remain only in onboarding and the tab bar', () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const rel = relative(SRC, file).split(sep).join('/');
    if (ALLOWED.some((re) => re.test(rel))) continue;
    stripComments(readFileSync(file, 'utf8'))
      .split('\n')
      .forEach((line, i) => {
        if (/\bborder\w*Radius\s*:\s*-?(?!0(?![.\d]))\d/.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
  }
  assert.deepEqual(offenders, [], `Literal radii outside onboarding and the tab bar:\n${offenders.join('\n')}`);
});

test("the account field's Show button nests 3 in from the inset corner", () => {
  // Rule 3, tight nesting: the field is corner.inset and the button sits 3 in.
  const field = readFileSync(join(SRC, 'auth/AccountField.tsx'), 'utf8');
  assert.match(field, /show: \{[^}]*margin: 3, borderRadius: Math\.max\(radius\.nib, radius\.inset - 3\),/, 'the Show button does not take the inset corner less its 3pt margin');
});
