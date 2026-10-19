/**
 * The punctuation ratchet: no middot, no em dash, no en dash in a string a
 * learner reads (revamp B, F597).
 *
 * `copy.test.ts` already bans the em dash from the app's own source, because a
 * learner once met one on the welcome screen. Revamp B's STYLE goes further:
 * the middot and the en dash are out too, and a line that wants a pause takes
 * a comma or a full stop. Fifteen files carried one of the three when it
 * landed, so this is a ratchet rather than a wall: every file that still
 * offends is on the allowlist below, and so is nothing else. Stage 3 strikes
 * a file from the list in the same change that rewrites its copy; Stage 6
 * strikes the two prompt sentences in core. The list ends empty.
 *
 * The walk covers the whole of `apps/mobile/src`, the whole of
 * `packages/core/src` (its lesson and ladder lines reach the tutor's voice,
 * and so the learner's ears), and `apps/mobile/App.tsx`, never test files.
 * Comments are stripped the way `motion.test.ts` strips them, because a
 * comment is where these marks are fine; regex literals are stripped as well,
 * because `drill/validate.ts` spells `/—/` to detect the character, which is a
 * pattern and not copy. What is left can only be a string, a template or JSX
 * text, which is exactly what reaches the screen or the voice. The character
 * spelled as an escape (`\u00B7`) or an HTML entity (`&middot;`) is the same
 * mark on glass, so it counts too.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_SRC = fileURLToPath(new URL('..', import.meta.url));
const REPO = join(MOBILE_SRC, '..', '..', '..');
const CORE_SRC = join(REPO, 'packages', 'core', 'src');
const APP_ENTRY = join(REPO, 'apps', 'mobile', 'App.tsx');

/**
 * The files that still carry a middot or a dash in their copy, by path from
 * the repo root. Strike a file the moment it is clean: the test fails on a
 * clean file left here as surely as on a new file that offends.
 */
// Direction B (approved 9 October 2026) uses compact plan separators.
const ALLOWLIST = [
  'apps/mobile/src/SessionScreen.tsx',
  'apps/mobile/src/SummaryScreen.tsx',
  'apps/mobile/src/conversationPacks/ConversationPracticeScreen.tsx',
  'apps/mobile/src/friends/InviteFriendsScreen.tsx',
  'apps/mobile/src/purchases/paywallView.ts',
  // Two prompt sentences to the tutor, not screen copy; Stage 6 rewrites them with commas.
  'packages/core/src/ladder/ladder.ts',
  'packages/core/src/lessons/cafe.ts',
];

/** The three marks, and the two other spellings that draw them. */
const MARK = /[·—–]|\\u(?:00[bB]7|201[34])|\\u\{(?:[bB]7|201[34])\}|&(?:middot|mdash|ndash|#183|#8211|#8212|#x[bB]7|#x201[34]);/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Block and line comments go, keeping line numbers; a `//` after `:` is a URL in a string. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/**
 * Regex literals go, keeping line numbers. A slash only opens a regex where an
 * expression can start: after `=`, `(`, `,`, `:`, `[`, `!`, `&`, `|`, `?`,
 * `{` or `return`. Division always follows a value, and JSX's `</` and `/>`
 * follow a `<` or a name, so neither is mistaken for one; and `}` is left off
 * the list on purpose, because a line of JSX text after an expression is copy.
 */
function stripRegexLiterals(source: string): string {
  return source.replace(
    /(^|[=(,:[!&|?{]|\breturn)(\s*)\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\/[dgimsuvy]*/gm,
    (whole: string, lead: string, gap: string) => lead + gap + whole.slice(lead.length + gap.length).replace(/[^\n]/g, ' '),
  );
}

const readable = (source: string) => stripRegexLiterals(stripComments(source));

test('no learner-facing string carries a middot, an em dash or an en dash, and the allowlist only shrinks', () => {
  // The walk and the strippers are proven before they are trusted, because a
  // walk that reads nothing and a stripper that eats strings both pass green.
  const files = [...sourceFiles(MOBILE_SRC), ...sourceFiles(CORE_SRC), APP_ENTRY];
  assert.ok(files.length > 400, `the walk found ${files.length} files, so it is reading the wrong folders`);
  assert.ok(files.some((f) => f.endsWith(join('drill', 'validate.ts'))), 'the walk no longer reaches packages/core');
  assert.equal(readable("const EM_DASH = /—/;").includes('—'), false, 'a regex literal is still read as copy');
  assert.equal(readable("label: 'Café · Terrace', // a · comment").includes('·'), true, 'the stripper eats a string, so it would hide copy');
  assert.equal(readable('{a} · {b} / {c}').includes('·'), true, 'the stripper eats JSX text after an expression');
  assert.equal(readable('size / 2 · x').includes('·'), true, 'the stripper reads division as a regex');

  const offences = new Map<string, string[]>();
  for (const file of files) {
    const path = relative(REPO, file).split('\\').join('/');
    readable(readFileSync(file, 'utf8'))
      .split('\n')
      .forEach((line, i) => {
        if (!MARK.test(line)) return;
        offences.set(path, [...(offences.get(path) ?? []), `${path}:${i + 1}  ${line.trim()}`]);
      });
  }

  const unlisted = [...offences.keys()].filter((path) => !ALLOWLIST.includes(path));
  assert.deepEqual(
    unlisted.flatMap((path) => offences.get(path)!),
    [],
    'a middot, an em dash or an en dash reached learner copy; use a comma or a full stop (the allowlist is for files that offended before the ban, and it takes no new ones)',
  );

  const cleaned = ALLOWLIST.filter((path) => !offences.has(path));
  assert.deepEqual(
    cleaned,
    [],
    'a file on the allowlist is clean now; strike it from ALLOWLIST so it cannot slip back',
  );
});
