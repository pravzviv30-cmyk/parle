/**
 * One way to a level or an XP total on screen (README Part 6, F744).
 *
 * The level and the XP a learner reads are worked out once, in `game/view.ts`,
 * under the one shown daily cap, and reach a screen through `useLevel()` and
 * `useXp()`. A screen that called `levelFor(` or an XP helper itself could show
 * a second number under a second rule (a rank name, a different cap, a total
 * that falls when old entries age out), and two numbers that disagree are a
 * number nobody can trust.
 *
 * Two uses are not display and are named here, so the list is the exception
 * and not a hole:
 * - the content-difficulty standing, `levelFor(totalXp(activity))`, read for
 *   its `.index` only (game.md 2.5; `HomeTab.test.ts` pins the literal);
 * - the XP one sitting earned from its evidence, worked out at the four places
 *   a sitting with an activity entry finishes and handed to the settle.
 *
 * The matcher is run over synthetic offenders first, so a scan that silently
 * matches nothing fails here (the `goals/isolation.test.ts` pattern).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../', import.meta.url));
const APP = fileURLToPath(new URL('../../App.tsx', import.meta.url));

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every screen and component: the `.tsx` files, the game layer's own excepted (it is where the numbers are made). */
function screens(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...screens(full));
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** The helpers that make a displayed number, and the evidence helpers that price one sitting. */
const DISPLAY = /\b(levelFor|xpLevelFor|levelThreshold|totalXp|xpCreditedFor|displayXp|earnedXp|activityMonths)\(/g;
const ANY_XP_HELPER = /\b(?!useXp\b)([a-z][A-Za-z0-9]*Xp)\(/g;

/** Every display or XP-helper call a source makes, as `name(`, each once, sorted. */
function calls(source: string): string[] {
  const code = withoutComments(source);
  const found = new Set<string>();
  for (const m of code.matchAll(DISPLAY)) found.add(`${m[1]}(`);
  for (const m of code.matchAll(ANY_XP_HELPER)) found.add(`${m[1]}(`);
  return [...found].sort();
}

/** The content-difficulty standing: the only `levelFor(` a screen may hold, read for its index alone. */
const STANDING: Readonly<Record<string, RegExp>> = {
  'tabs/HomeTab.tsx': /const standing = levelFor\(totalXp\(activity\)\);/,
  'practice/NextTaskCard.tsx': /levelIndex: levelFor\(totalXp\(activity\)\)\.index/,
};

/** The four places a sitting with an activity entry finishes, and the one evidence helper each prices it with. */
const PRICED: Readonly<Record<string, string>> = {
  'ConvoScreen.tsx': 'conversationXp(',
  'nav/RootNavigator.tsx': 'lessonXp(',
  'DrillScreen.tsx': 'drillXp(',
  'ReviewScreen.tsx': 'reviewXp(',
};

/**
 * The app root prices the sessions that predate the activity log, once, at the
 * base lesson rate (`backfillFrom` in progress/activity.ts). A write, never a
 * number on screen.
 */
const BACKFILL = { file: 'App.tsx', helper: 'lessonXp(', shape: /backfillFrom\(history, lessonXp\(/ } as const;

function allowed(file: string): string[] {
  const out: string[] = [];
  if (STANDING[file] !== undefined) out.push('levelFor(', 'totalXp(');
  if (PRICED[file] !== undefined) out.push(PRICED[file]);
  if (file === BACKFILL.file) out.push(BACKFILL.helper);
  return out;
}

describe('one way to a level or an XP total on screen — README Part 6, F744', () => {
  test('no screen calls levelFor( or an XP helper for a number it shows; useLevel() and useXp() are the only way in', () => {
    // The matcher, on offenders it must catch and a use it must not.
    assert.deepEqual(calls('const l = levelFor(xp);'), ['levelFor(']);
    assert.deepEqual(calls('<Text>{xpLevelFor(total).level}</Text>'), ['xpLevelFor(']);
    assert.deepEqual(calls('const shown = totalXp(entries);'), ['totalXp(']);
    assert.deepEqual(calls('const n = streakBonusXp(day);'), ['streakBonusXp(']);
    assert.deepEqual(calls('const xp = useXp(); const level = useLevel();'), [], 'the hooks are the sanctioned way in');
    assert.deepEqual(calls('// levelFor(xp) in a comment is not a call'), []);

    const files = [...screens(SRC).filter((file) => !file.slice(SRC.length).startsWith('game/')), APP];
    assert.ok(files.length > 50, 'the scan found almost no screens, so it is reading the wrong place');
    const offenders: string[] = [];
    const seenStanding = new Set<string>();
    const seenPriced = new Set<string>();
    for (const full of files) {
      const file = full === APP ? 'App.tsx' : full.slice(SRC.length);
      const made = calls(readFileSync(full, 'utf8'));
      const ok = allowed(file);
      for (const call of made) if (!ok.includes(call)) offenders.push(`${file} calls ${call}`);
      if (STANDING[file] !== undefined && made.includes('levelFor(')) seenStanding.add(file);
      if (PRICED[file] !== undefined && made.includes(PRICED[file]!)) seenPriced.add(file);
    }
    assert.deepEqual(offenders, [], `a screen works out a level or an XP figure itself:\n${offenders.join('\n')}`);

    // The standing is the difficulty pitch and nothing else: the exact
    // expression, and only its index read.
    for (const [file, shape] of Object.entries(STANDING)) {
      const code = withoutComments(readFileSync(join(SRC, file), 'utf8'));
      assert.match(code, shape, `${file} reads the standing some other way, so this exception no longer describes it`);
      assert.equal((code.match(/\blevelFor\(/g) ?? []).length, 1, `${file} asks levelFor more than once`);
      for (const read of code.matchAll(/\bstanding\.(\w+)/g)) assert.equal(read[1], 'index', `${file} reads standing.${read[1]}, which would put the standing on screen`);
    }

    // Each evidence helper prices one sitting, once, and that price goes to the settle.
    for (const [file, helper] of Object.entries(PRICED)) {
      const code = withoutComments(readFileSync(join(SRC, file), 'utf8'));
      const name = helper.slice(0, -1);
      assert.equal((code.match(new RegExp(`\\b${name}\\(`, 'g')) ?? []).length, 1, `${file} prices a sitting with ${helper} more than once`);
      assert.match(code, new RegExp(`const xp = ${name}\\(`), `${file} no longer names the sitting's XP before it records it`);
      assert.match(code, /settleSitting\(\{/, `${file} prices a sitting and never settles it`);
    }

    // The backfill prices old sessions for the log, once, and shows nothing.
    const root = withoutComments(readFileSync(APP, 'utf8'));
    assert.match(root, BACKFILL.shape, 'the app root uses lessonXp for something other than the history backfill');
    assert.equal((root.match(/\blessonXp\(/g) ?? []).length, 1, 'the app root prices more than the history backfill');

    // The lists are what goes stale: an exception nobody uses any more is a hole left open.
    assert.deepEqual([...seenStanding].sort(), Object.keys(STANDING).sort(), 'a named standing reader no longer reads it; drop it from the list');
    assert.deepEqual([...seenPriced].sort(), Object.keys(PRICED).sort(), 'a named place no longer prices its sitting; drop it from the list');
  });
});
