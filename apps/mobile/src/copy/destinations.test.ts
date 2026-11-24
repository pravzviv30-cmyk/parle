/**
 * The destinations ratchet (F1172, founder Q1 2026-11-24): no learner-facing
 * string names a place the tab bar does not have.
 *
 * The tabs were renamed (Home became Today, Tutor became Speak, My French and
 * then Progress became Journey) and fifteen lines kept sending the learner to
 * the old names. The retired names are derived from `TAB_LABELS`, so a later
 * rename retires its old word here without anyone remembering to: every route
 * whose label differs from its route name, plus the two former labels that
 * were never route names, Progress and My French.
 *
 * Two shapes count. A place word before a retired name ("in Progress", "Back
 * to Tutor", "Opens Progress"), and a string or JSX text that is exactly a
 * former label (a row or an eyebrow reading "Progress"). A bare route name in
 * code (`navigate('Home')`) is neither, and "Tutor" as the tutor's own name
 * ("Finish a Tutor conversation") has no place word before it.
 *
 * The walk and the comment stripping are the ones `punctuation.test.ts` uses,
 * over `apps/mobile/src`, `packages/core/src` and `App.tsx`, never test files,
 * plus the built legal pages. The allowlist only shrinks: the legal files are
 * PR #28's, struck when it lands.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAB_LABELS } from '../nav/tabBarModel.ts';

const MOBILE_SRC = fileURLToPath(new URL('..', import.meta.url));
const REPO = join(MOBILE_SRC, '..', '..', '..');
const CORE_SRC = join(REPO, 'packages', 'core', 'src');
const APP_ENTRY = join(REPO, 'apps', 'mobile', 'App.tsx');

/** Files that still name a retired place, by path from the repo root. Strike each the moment it is clean. */
const ALLOWLIST = [
  // PR #28 owns the privacy wording and adopts the same Q1 answer.
  'apps/mobile/src/legal/policy.ts',
  'apps/mobile/src/legal/dist/privacy.html',
];

/** Labels the tab bar once showed that were never route names. */
const FORMER_LABELS = ['Progress', 'My French'];

const spaced = (route: string) => route.replace(/([a-z])([A-Z])/g, '$1 $2');
const RETIRED = [
  ...new Set([
    ...Object.entries(TAB_LABELS).filter(([route, label]) => route !== label).map(([route]) => spaced(route)),
    ...FORMER_LABELS,
  ]),
];
const NAME = RETIRED.map((n) => n.replace(' ', '\\s+')).join('|');
/** A place word, then a retired name with a capital, so "in progress" and "at home" stay ordinary French-learner English. */
const PLACE = new RegExp(`\\b(?:to|in|into|from|at|on|Opens|Open|open|opens)\\s+(?:the\\s+)?(?:${NAME})\\b`);
const FORMER = FORMER_LABELS.map((n) => n.replace(' ', '\\s+')).join('|');
/** A whole string, or a whole run of JSX text, that is exactly a former label. */
const EXACT = new RegExp(`(['"\`])\\s*(?:${FORMER})\\s*\\1|>\\s*(?:${FORMER})\\s*<`);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(tsx?|html)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Block and line comments go, keeping line numbers; a `//` after `:` is a URL in a string. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const offends = (line: string) => PLACE.test(line) || EXACT.test(line);

test('no learner-facing string names a destination the tab bar does not have', () => {
  // The derivation, the walk and the patterns are proven before they are trusted.
  assert.deepEqual([...RETIRED].sort(), ['Home', 'My French', 'Progress', 'Tutor']);
  const files = [...sourceFiles(MOBILE_SRC), ...sourceFiles(CORE_SRC), APP_ENTRY];
  assert.ok(files.length > 400, `the walk found ${files.length} files, so it is reading the wrong folders`);
  assert.ok(files.some((f) => f.endsWith(join('legal', 'dist', 'privacy.html'))), 'the walk no longer reaches the built legal pages');
  assert.equal(offends("label: 'Back to Tutor'"), true);
  assert.equal(offends("'Saved in Progress, Daily collection.'"), true);
  assert.equal(offends('<Label>Progress</Label>'), true);
  assert.equal(offends("export const ROW = 'My French';"), true);
  assert.equal(offends("navigation.navigate('Home')"), false, 'a route name in code is not copy');
  assert.equal(offends("'Finish a Tutor conversation'"), false, 'the tutor by name is not a place');
  assert.equal(offends("'Your progress in French'"), false);
  assert.equal(stripComments("// Back to Tutor\nconst a = 1;").includes('Tutor'), false, 'a comment is still read as copy');

  const offences = new Map<string, string[]>();
  for (const file of files) {
    const path = relative(REPO, file).split('\\').join('/');
    stripComments(readFileSync(file, 'utf8'))
      .split('\n')
      .forEach((line, i) => {
        if (!offends(line)) return;
        offences.set(path, [...(offences.get(path) ?? []), `${path}:${i + 1}  ${line.trim()}`]);
      });
  }

  const unlisted = [...offences.keys()].filter((path) => !ALLOWLIST.includes(path));
  assert.deepEqual(
    unlisted.flatMap((path) => offences.get(path)!),
    [],
    `a line names ${RETIRED.join(', ')}, which the tab bar calls ${Object.values(TAB_LABELS).join(', ')}; name the tab the learner lands on, or say plain "Back" (founder Q1)`,
  );

  const cleaned = ALLOWLIST.filter((path) => !offences.has(path));
  assert.deepEqual(cleaned, [], 'a file on the allowlist is clean now; strike it from ALLOWLIST so it cannot slip back');
});
