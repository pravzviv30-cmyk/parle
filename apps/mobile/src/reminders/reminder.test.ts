/**
 * The reminder's copy, its honesty mapping, and the one structural promise.
 *
 * Two of the tests here are named in the ledger. F226 holds the words: the same
 * sentence every day, from a builder that takes no arguments, with nothing in
 * it that a learner could read as a debt. F227 holds the shape: no module under
 * `reminders/` may reach the stores that know what the learner has done.
 *
 * F227 is the one worth reading twice. A source scan that matches nothing
 * passes forever and defends nothing, so this file does not only run the scan
 * over the real directory — it runs the same matcher over a synthetic module
 * that *does* import `progress/`, and fails if the matcher shrugs. The scan is
 * proven to bite in the same suite that relies on it biting.
 *
 * The ban list is checked for rot too. A ban that names `todayFrom` after
 * somebody has renamed `todayFrom` is a ban on nothing, and nothing would ever
 * say so, so the last test holds every banned symbol against the source of the
 * app it is meant to keep out.
 *
 * Test files are deliberately excluded from the scan. This one has to write the
 * forbidden paths and symbols down in order to prove the matcher sees them, and
 * a guard that its own proof trips is a guard nobody can write.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_COPY,
  REMINDER_EXPLAIN,
  REMINDER_OFF,
  REMINDER_REFUSED,
  REMINDER_TIMES,
  reminderContent,
  reminderRow,
  reminderTime,
} from './reminder.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const APP_SRC = fileURLToPath(new URL('../', import.meta.url));
const CORE_SRC = fileURLToPath(new URL('../../../../packages/core/src', import.meta.url));

/**
 * The directories that exist to answer "what has this learner done?".
 *
 * `progress/` holds the session history store, the activity log and today's
 * count; `missions/` holds which situations are finished; `review/` holds which
 * cards are due; `practice/` decides what to offer next from all three. Any one
 * of them turns the reminder into a state signal, which is the single thing
 * PRODUCT.md:90-93 refuses.
 */
const PRACTICE_DIRS: readonly string[] = ['progress', 'missions', 'review', 'practice'];

/**
 * The same knowledge arriving by another door.
 *
 * A path ban alone is routed around in one line: `@parle/core` re-exports the
 * report builder and the due-card query, and `import { dueCards } from
 * '@parle/core'` reaches practice state without naming a banned directory. So
 * the names are banned too, wherever they come from. Every one of these is real
 * today, and the last test in this file is what keeps that true.
 */
const PRACTICE_SYMBOLS: readonly string[] = [
  'buildProgressReport',
  'loadHistory',
  'loadActivity',
  'recordActivity',
  'todayFrom',
  'hasToday',
  'loadMissionCompletions',
  'missionStates',
  'loadDeck',
  'dueCards',
  'totalXp',
];

/**
 * Comments stripped, so prose can cite a file the code may not import.
 *
 * The header of `reminder.ts` names `progress/today.ts` as the voice it copies,
 * and a scan that cannot tell a citation from an import would force the module
 * to stop explaining itself. The `[^:]` guard keeps a `https://` in a string
 * from eating the rest of its line.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Every way this source reaches practice state, in words a failure can print. */
function forbiddenIn(source: string): string[] {
  const code = withoutComments(source);
  const found: string[] = [];
  for (const match of code.matchAll(/(?:from|import|require)\s*\(?\s*'([^']+)'/g)) {
    const spec = match[1];
    if (spec === undefined) continue;
    const segments = spec.split('/');
    for (const dir of PRACTICE_DIRS) {
      if (segments.includes(dir)) found.push(`imports '${spec}'`);
    }
  }
  for (const symbol of PRACTICE_SYMBOLS) {
    if (new RegExp(`\\b${symbol}\\b`).test(code)) found.push(`names ${symbol}`);
  }
  return found;
}

/** Every shipping module under reminders/, tests excluded and explained above. */
function reminderModules(): string[] {
  return readdirSync(HERE)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .sort();
}

/** Every non-test source file under a tree, for the ban-list rot check. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      sourceFiles(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

describe('the daily reminder', () => {
  test('the reminder says the same words every day and none of them guilt anyone', () => {
    // Arity zero is the design, not a detail. A builder that took a single
    // argument could take the learner's day, and then the words on the lock
    // screen would mean something about whether they had practised yet.
    assert.equal(
      reminderContent.length,
      0,
      'the content builder takes an argument, so the reminder can vary with something',
    );

    const first = reminderContent();
    const second = reminderContent();
    assert.deepEqual(first, second, 'two calls disagreed, so the words are not fixed');
    assert.ok(first.title.length > 0 && first.body.length > 0);

    // An arity-zero function can still read the clock, which is the same leak
    // with the argument hidden inside.
    const source = readFileSync(join(HERE, 'reminder.ts'), 'utf8');
    assert.doesNotMatch(
      source,
      /Date\.now|new Date|performance\.now/,
      'the reminder reads a clock, so its words can vary with the time of day',
    );

    // No digit, no count, no quota. A number on a lock screen is a score.
    assert.doesNotMatch(`${first.title} ${first.body}`, /\d/, 'the reminder line carries a number');

    assert.ok(REMINDER_COPY.length >= 8, 'the copy list is too short to be the whole surface');
    assert.ok(REMINDER_COPY.includes(first.title) && REMINDER_COPY.includes(first.body));
    assert.ok(REMINDER_COPY.includes(REMINDER_EXPLAIN) && REMINDER_COPY.includes(REMINDER_REFUSED));
    for (const line of REMINDER_COPY) {
      assert.equal(guiltIn(line), undefined, `guilt in reminder copy: ${line}`);
      assert.doesNotMatch(line, /—/, `em dash in reminder copy: ${line}`);
    }
  });

  test('a stored reminder over a refused permission reads as off, with one honest line', () => {
    const row = reminderRow({ enabled: true, time: 'morning' }, 'denied');
    assert.equal(row.on, false, 'a switch that is on over a refusal is a switch that does nothing');
    assert.equal(row.value, REMINDER_OFF);
    assert.equal(row.note, REMINDER_REFUSED);
    assert.equal(row.asks, false, 'a refused permission must not start a re-ask loop');

    // The line points at the phone, not at the learner.
    assert.match(REMINDER_REFUSED, /settings/i);

    // Off and refused says the same honest thing, because the switch is just as
    // dead before it is flipped as after.
    assert.equal(reminderRow({ enabled: false, time: 'morning' }, 'denied').note, REMINDER_REFUSED);
  });

  test('the row explains the ask before any system dialog, and goes quiet once it is answered', () => {
    const unset = reminderRow(null, 'undetermined');
    assert.equal(unset.on, false);
    assert.equal(unset.value, REMINDER_OFF);
    assert.equal(unset.note, REMINDER_EXPLAIN, 'the ask is not explained before it happens');
    assert.equal(unset.asks, true);
    assert.match(REMINDER_EXPLAIN, /will ask/, 'the sentence does not say a dialog is coming');

    const on = reminderRow({ enabled: true, time: 'night' }, 'granted');
    assert.equal(on.on, true);
    assert.equal(on.value, reminderTime('night').gloss);
    assert.equal(on.note, '', 'a working reminder still has something to explain');
    assert.equal(on.asks, false);

    const off = reminderRow({ enabled: false, time: 'night' }, 'granted');
    assert.equal(off.on, false);
    assert.equal(off.value, REMINDER_OFF);
    assert.equal(off.note, '');
  });

  test('the times are a small fixed set of presets, on the hour, with the default among them', () => {
    assert.ok(REMINDER_TIMES.length >= 3 && REMINDER_TIMES.length <= 5, 'a preset list this long is a time picker');
    const ids = REMINDER_TIMES.map((t) => t.value);
    assert.equal(new Set(ids).size, ids.length, 'two presets share an id');
    assert.ok(ids.includes(DEFAULT_REMINDER_TIME));

    let previous = -1;
    for (const preset of REMINDER_TIMES) {
      assert.ok(preset.hour > previous, 'the presets are not in order through the day');
      previous = preset.hour;
      assert.ok(Number.isInteger(preset.hour) && preset.hour >= 0 && preset.hour <= 23);
      assert.equal(preset.minute, 0, 'a preset off the hour is a time picker in disguise');
      assert.ok(REMINDER_COPY.includes(preset.label) && REMINDER_COPY.includes(preset.gloss));
    }

    // A stored value that has been round a disk and a sync is not to be trusted.
    assert.equal(reminderTime('nonsense').value, DEFAULT_REMINDER_TIME);
    assert.equal(reminderTime(undefined).value, DEFAULT_REMINDER_TIME);
  });
});

describe('what a reminder is not allowed to know', () => {
  test('nothing under reminders can read whether the learner practised', () => {
    const modules = reminderModules();
    assert.ok(modules.includes('reminder.ts'), 'the scan found no reminder.ts, so it is scanning nothing');

    for (const name of modules) {
      const found = forbiddenIn(readFileSync(join(HERE, name), 'utf8'));
      assert.deepEqual(
        found,
        [],
        `reminders/${name} can see whether the learner practised: it ${found.join(', ')}. ` +
          'A notification cancelled because you practised is a streak with the guilt in the scheduler.',
      );
    }
  });

  test('the scan bites, on a path and on a name, and leaves prose alone', () => {
    const byPath = "import { hasToday } from '../progress/today.ts';\nexport const x = 1;\n";
    assert.deepEqual(forbiddenIn(byPath), ["imports '../progress/today.ts'", 'names hasToday']);

    const byPackage = "import { dueCards } from '@parle/core';\nexport const x = 1;\n";
    assert.deepEqual(forbiddenIn(byPackage), ['names dueCards'], 'core re-exports route round a path ban');

    const lazy = "export async function x() { return import('../review/store.ts'); }\n";
    assert.deepEqual(forbiddenIn(lazy), ["imports '../review/store.ts'"], 'a dynamic import is still an import');

    const prose = '/** The voice comes from progress/today.ts, and todayFrom. */\nexport const x = 1;\n';
    assert.deepEqual(forbiddenIn(prose), [], 'a citation in a comment is not an import');

    const allowed = "import { TUTOR_NAME } from '../tutor/tutorName.ts';\nexport const x = TUTOR_NAME;\n";
    assert.deepEqual(forbiddenIn(allowed), []);
  });

  test('every name the ban carries still exists in the app it is meant to keep out', () => {
    const sources = [...sourceFiles(APP_SRC), ...sourceFiles(CORE_SRC)]
      .filter((file) => !file.startsWith(HERE))
      .map((file) => readFileSync(file, 'utf8'));

    for (const symbol of PRACTICE_SYMBOLS) {
      const pattern = new RegExp(`\\b${symbol}\\b`);
      assert.ok(
        sources.some((source) => pattern.test(source)),
        `the practice ban names ${symbol}, which no longer exists. A ban on a renamed symbol is a ban on nothing.`,
      );
    }
  });
});
