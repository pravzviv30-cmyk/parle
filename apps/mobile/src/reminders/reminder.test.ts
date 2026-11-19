/**
 * The reminder's copy, its honesty mapping, and the one structural promise.
 *
 * Founder decision D2 (2026-10-04) reversed the old rule here: the reminder
 * now knows whether the learner practised, so it can skip that day. F226's
 * fixed sentence and F227's "nothing under reminders can read practice" were
 * retired with their titles, and the ledger now names F771's tests in
 * `plan.test.ts`, which hold the new promises. What stays here is the shape
 * the reversal keeps: exactly one module under `reminders/` may read what the
 * learner has done, it reads it through the game layer and the guest record
 * only, and every other module, the words included, still cannot.
 *
 * A source scan that matches nothing passes forever and defends nothing, so
 * this file does not only run the scan over the real directory — it runs the
 * same matcher over a synthetic module that *does* import `progress/`, and
 * fails if the matcher shrugs.
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

import { DAILY_PHRASES, DAILY_SCENARIOS } from '@luvani/core';
import { TUTOR_NAME } from '../tutor/tutorName.ts';

import { STREAK_BAN_EXEMPTIONS, guiltIn as guiltOf, streakGuiltIn as streakGuiltOf } from '../copy/guilt.ts';

import {
  DEFAULT_REMINDER_MODE,
  DEFAULT_REMINDER_TIME,
  REMINDER_COPY,
  REMINDER_EXPLAIN,
  REMINDER_LINES,
  STREAK_SAVE_LINES,
  NAMED_PHRASE_LINE,
  NAMEABLE_SITUATIONS,
  namedPhraseFits,
  REMINDER_OFF,
  REMINDER_PAUSED,
  REMINDER_PAUSED_VALUE,
  REMINDER_REFUSED,
  REMINDER_SMART_LABEL,
  REMINDER_SMART_VALUE,
  REMINDER_TIMES,
  clockGloss,
  reminderChoice,
  reminderRow,
  reminderTime,
  smartGloss,
  DEFAULT_TALK_DAYS,
  TALK_DAY_FREE_LINE,
  TALK_DAY_LINE,
  TALK_DAYS_COPY,
  talkDayBlock,
  talkDayLabel,
  talkDayReason,
  talkDaysFit,
  talkDaysLine,
  talkDaysPicked,
  talkDaysValue,
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
 * A path ban alone is routed around in one line: `@luvani/core` re-exports the
 * report builder and the due-card query, and `import { dueCards } from
 * '@luvani/core'` reaches practice state without naming a banned directory. So
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

  test("a reminder that paused itself reads Paused with one line, and the smart mode reads as the learner's own time", () => {
    // Paused: the switch is off, the row says so in one word, and the line says how to bring it back.
    const paused = reminderRow({ enabled: true, time: 'smart', paused: true }, 'granted');
    assert.deepEqual(paused, { on: false, value: REMINDER_PAUSED_VALUE, note: REMINDER_PAUSED, asks: false });
    assert.match(REMINDER_PAUSED, /back on/);
    // A refusal still wins over a pause, and an undecided permission still explains the ask.
    assert.equal(reminderRow({ enabled: true, time: 'smart', paused: true }, 'denied').note, REMINDER_REFUSED);
    assert.equal(reminderRow({ enabled: true, time: 'smart', paused: true }, 'undetermined').note, REMINDER_EXPLAIN);

    // Smart is a mode, not a preset: on, with no clock in the row, because the clock moves with the learner.
    assert.deepEqual(reminderRow({ enabled: true, time: 'smart' }, 'granted'), { on: true, value: REMINDER_SMART_VALUE, note: '', asks: false });
    assert.equal(DEFAULT_REMINDER_MODE, 'smart', "a new reminder does not follow the learner's own rhythm");
    assert.deepEqual(reminderChoice(undefined), { value: 'smart', label: REMINDER_SMART_LABEL });
    assert.deepEqual(reminderChoice('night'), { value: 'night', label: 'Before bed' });
    assert.ok(!REMINDER_TIMES.some((time) => (time.value as string) === 'smart'), 'smart joined the presets');
    assert.equal(smartGloss(null), '6:00 pm until your rhythm shows');
    assert.equal(smartGloss({ hour: 18, minute: 30 }), 'About 6:30 pm');
    assert.equal(clockGloss({ hour: 8, minute: 0 }), '8:00 am');
    assert.equal(clockGloss({ hour: 12, minute: 15 }), '12:15 pm');
    assert.equal(clockGloss({ hour: 21, minute: 30 }), '9:30 pm');

    // The explaining sentence promises what the planner keeps (plan.test.ts).
    assert.match(REMINDER_EXPLAIN, /at most one a day/);
    assert.match(REMINDER_EXPLAIN, /skips days you have already practised/);
    for (const line of [REMINDER_PAUSED, REMINDER_PAUSED_VALUE, REMINDER_SMART_VALUE, REMINDER_SMART_LABEL]) {
      assert.ok(REMINDER_COPY.includes(line), `"${line}" is outside the scanned copy`);
    }
  });
});

/** The planner, the one module under reminders/ that reads what the learner has done, and the doors it may use. */
const PLANNER = 'ReminderPlanner.tsx';
/**
 * The planner's reads: the planner itself, and the one helper it asks for
 * today's phrase (a `.ts` file, so the phrase is picked where no screen
 * works out a level, `game/display.test.ts`).
 */
const READERS: Readonly<Record<string, readonly string[]>> = {
  // gameLocal.ts for paidSince and protectedSince only: the freezes the save line reads (T1.2).
  [PLANNER]: ['../game/gameLocal.ts', '../game/settle.ts', '../game/view.ts', '../onboarding/guestModel.ts', '../onboarding/guestPractice.ts'],
  'todayPhrase.ts': ['../game/settle.ts', '../game/view.ts'],
};

/** Imports that reach the game layer or the guest record. */
function practiceDoorsIn(source: string): string[] {
  const found: string[] = [];
  for (const match of withoutComments(source).matchAll(/(?:from|import|require)\s*\(?\s*'([^']+)'/g)) {
    const spec = match[1];
    if (spec === undefined) continue;
    if (/(^|\/)game\/|guestModel|guestPractice/.test(spec)) found.push(spec);
  }
  return found.sort();
}

/** Every non-test app source that calls `callee(` (its own declaration aside), repo-relative from apps/mobile. */
function callers(callee: string): string[] {
  const app = fileURLToPath(new URL('../../App.tsx', import.meta.url));
  const pattern = new RegExp(`(?<!function\\s)\\b${callee}\\(`);
  return [...sourceFiles(APP_SRC), app]
    .filter((file) => !/\.test\.tsx?$/.test(file) && pattern.test(withoutComments(readFileSync(file, 'utf8'))))
    .map((file) => (file === app ? 'App.tsx' : `src/${file.slice(APP_SRC.length)}`))
    .sort();
}

describe('what a reminder is not allowed to know', () => {
  test('only the planner reads what the learner did, through the game layer and the guest record', () => {
    const modules = reminderModules();
    assert.ok(modules.includes('reminder.ts') && modules.includes(PLANNER) && modules.includes('plan.ts') && modules.includes('todayPhrase.ts'), 'the scan found too few modules, so it is scanning nothing');

    // No module here reaches the stores that know, by path or by name, the
    // planner included: practice arrives through the game layer's facts and the
    // guest record's finish days, never the progress stores themselves. The
    // one name allowed is the content standing that picks today's phrase, as
    // Home picks it, read for its index alone.
    for (const name of modules) {
      const source = readFileSync(join(HERE, name), 'utf8');
      const found = forbiddenIn(source);
      if (name === 'todayPhrase.ts') {
        assert.deepEqual(found, ['names totalXp'], `reminders/${name} reaches practice state beyond the standing: it ${found.join(', ')}`);
        assert.equal((withoutComments(source).match(/\btotalXp\(/g) ?? []).length, 1);
        assert.match(withoutComments(source), /levelFor\(totalXp\(facts\.activity\)\)\.index/, 'the standing is read for more than its index');
        continue;
      }
      assert.deepEqual(found, [], `reminders/${name} reaches practice state directly: it ${found.join(', ')}`);
    }

    // The planner reads gameLocal for the two freeze dates only: one
    // loadGameLocal call, straight into freezeProtectionOf, whose input names
    // paidSince and protectedSince and nothing else (T1.2 review).
    const planner = withoutComments(readFileSync(join(HERE, PLANNER), 'utf8'));
    assert.match(planner, /import \{ loadGameLocal \} from '\.\.\/game\/gameLocal\.ts';/, 'the planner imports more than loadGameLocal from gameLocal');
    assert.equal((planner.match(/\bloadGameLocal\b/g) ?? []).length, 2, 'the planner reads gameLocal somewhere else too');
    assert.match(planner, /freezeProtectionOf\(await loadGameLocal\(\)/, 'the planner reads gameLocal for more than the freezes');
    const plan = withoutComments(readFileSync(join(HERE, 'plan.ts'), 'utf8'));
    assert.match(plan, /export function freezeProtectionOf\(local: \{ paidSince: DayKey \| null; protectedSince: DayKey \| null \} \| null\)/, 'the freeze mapping takes more than the two dates');

    // And only the planner's reads use those doors.
    for (const name of modules) {
      const doors = practiceDoorsIn(readFileSync(join(HERE, name), 'utf8'));
      const allowed = READERS[name];
      if (allowed !== undefined) {
        assert.deepEqual(doors, [...allowed].sort(), `reminders/${name} reads practice through a door this test does not know`);
      } else {
        assert.deepEqual(doors, [], `reminders/${name} reads what the learner did; only the planner may`);
      }
    }
    assert.match(planner, /readGameFacts\(NO_OUTSIDE_FACTS, null\)/, 'the account planner reads practice somewhere other than the streak\'s own facts');
    assert.match(planner, /practiceDays: guestPracticeDays\(guest\), covers: \[\], finishes: guest\?\.finishedAt \?\? \[\]/, 'the guest planner reads something other than the finish days');

    // The words and the plan read no clock: every instant is handed in.
    for (const name of ['reminder.ts', 'plan.ts', 'openTarget.ts']) {
      assert.doesNotMatch(withoutComments(readFileSync(join(HERE, name), 'utf8')), /Date\.now|performance\.now|new Date\(\)/, `${name} reads a clock`);
    }
    // The doors scan bites, and leaves prose alone.
    assert.deepEqual(practiceDoorsIn("import { onSettled } from '../game/settle.ts';\n"), ['../game/settle.ts']);
    assert.deepEqual(practiceDoorsIn("import { guestPracticeDays } from '../onboarding/guestModel.ts';\n"), ['../onboarding/guestModel.ts']);
    assert.deepEqual(practiceDoorsIn('/** reads ../game/view.ts */\nexport const x = 1;\n'), []);
  });

  test('only the profile row can turn the reminder off', () => {
    // F241, closed by the planner. The worry was a practice surface reaching
    // in and cancelling the reminder from outside, a notification whose
    // absence means you did enough. Founder decision D2 made skipping a
    // practised day the design, and it lives in one place: a practice settles
    // through the game layer, the planner hears it (`onSettled`) and plans the
    // next days again. No practice surface touches the reminder itself.
    //
    // Turning the reminder off is writing `enabled: false` over a choice that
    // was on, and only the reminder row in Settings (Profile's, until F576
    // moved it) does that. The other writers record a yes, a pause or a
    // put-back: App.tsx saves the first run's answer when the account is made;
    // the planner saves a yes from the ask, the pause once its note has gone
    // out (founder decision D2: Paused is its own state, which Settings shows
    // and turns back on), and, when the OS refused a yes, exactly the choice
    // that was there before it, so the ask never turns a reminder off.
    // 2026-10-20 UI-008, artboard B-Streak: the Evening nudge on the Streak
    // screen is the same reminder's switch, written through the same doors
    // and turned off only by the learner's own flip (settings/streakNudge.ts),
    // kept in settings/ so no practice surface reaches the reminder.
    assert.deepEqual(callers('saveReminder'), ['App.tsx', 'src/reminders/ReminderPlanner.tsx', 'src/settings/SettingsScreen.tsx', 'src/settings/useEveningNudge.ts']);
    const app = withoutComments(readFileSync(fileURLToPath(new URL('../../App.tsx', import.meta.url)), 'utf8'));
    // Inspect the balanced call, so checking its durable acknowledgement does
    // not get mistaken for an additional reminder value.
    const onboardingWrites = app.match(/saveReminder\((?:[^()]|\([^()]*\))*\)/g) ?? [];
    assert.equal(onboardingWrites.length, 2, 'both onboarding completion paths must save the draft reminder');
    for (const call of onboardingWrites) assert.match(call, /^saveReminder\(reminderFromDraft\(draft\)\)$/, `App.tsx writes a reminder of its own: ${call}`);
    const planner = withoutComments(readFileSync(join(HERE, PLANNER), 'utf8'));
    assert.deepEqual(
      (planner.match(/saveReminder\((?:[^()]|\([^()]*\))*\)/g) ?? []).sort(),
      ['saveReminder(next)', 'saveReminder(stored ?? reminder)', 'saveReminder(yes(reminder.time))', 'saveReminder({ ...choice, paused: true })'],
      'the planner writes a choice other than a yes, a pause, a put-back or talk days',
    );
    // Talk days (T1.4) are written over the stored choice as it was, never turning it off.
    assert.match(planner, /if \(stored === null\) return 'failed';\s*const next: StoredReminder = \{ \.\.\.stored, talkDays: \[\.\.\.talkDays\] \};\s*await saveReminder\(next\);/, 'the talk-day write changes more than the talk days');
    assert.match(planner, /const yes = \(mode: ReminderMode\): StoredReminder => \(\{ \.\.\.\(stored \?\? \{\}\), enabled: true, time: mode, paused: false \}\);/, 'the ask writes a yes that is not on');
    assert.match(planner, /save: \(reminder\) => \(reminder\.enabled \? saveReminder\(yes\(reminder\.time\)\) : saveReminder\(stored \?\? reminder\)\),/, 'the put-back after a refused yes writes off over what was there');
    assert.match(planner, /if \(step\.pause && choice !== null\) await saveReminder\(\{ \.\.\.choice, paused: true \}\);/, 'the pause is written for something other than the note having gone out');
    const settings = withoutComments(readFileSync(join(APP_SRC, 'settings', 'SettingsScreen.tsx'), 'utf8'));
    assert.match(settings, /const toggleReminder = \(next: boolean\) => \{/, 'the row no longer has its switch');
    assert.match(settings, /onChange=\{toggleReminder\}/);

    // Stopping what is pending (rather than turning it off) is for the planner
    // (which the row's off goes through, on its one chain), and the doors where
    // a plan or an account leaves: sign-out, the under-13 answer, a new plan in
    // place of one with a reminder.
    assert.deepEqual(
      [...new Set([...callers('cancelReminder'), ...callers('stopReminders')])].sort(),
      ['App.tsx', 'src/auth/AuthFlow.tsx', 'src/onboarding/PreAccountOnboarding.tsx', 'src/reminders/ReminderPlanner.tsx'],
    );

    // No practice surface imports the reminder at all.
    const PRACTICE_SURFACES = /^(drill|review|daily|lesson|practice|progress|missions|game|live|tabs|recap|conversationPacks)\//;
    for (const file of sourceFiles(APP_SRC)) {
      const relative = file.slice(APP_SRC.length);
      if (!PRACTICE_SURFACES.test(relative) || /\.test\.tsx?$/.test(relative)) continue;
      // A type is not a door: `live/keepsake.ts` names the scheduler's outcome word and calls nothing.
      const imports = [...withoutComments(readFileSync(file, 'utf8')).matchAll(/\bimport\s+(type\s+)?[^;]*?from\s*'([^']+)'|\bimport\(\s*'([^']+)'/g)]
        .filter((m) => m[1] === undefined)
        .map((m) => m[2] ?? m[3] ?? '');
      const reaching = imports.filter((spec) => /reminders\/(schedule|store|ReminderPlanner)/.test(spec));
      assert.deepEqual(reaching, [], `${relative} reaches the reminder from a practice surface`);
    }
    for (const name of ['DrillScreen.tsx', 'ReviewScreen.tsx', 'ConvoScreen.tsx', 'LessonScreen.tsx']) {
      const path = join(APP_SRC, name);
      let source = '';
      try {
        source = readFileSync(path, 'utf8');
      } catch {
        continue;
      }
      assert.doesNotMatch(withoutComments(source), /reminders\/(schedule|store|ReminderPlanner)/, `${name} reaches the reminder`);
    }
  });

  test('the scan bites, on a path and on a name, and leaves prose alone', () => {
    const byPath = "import { hasToday } from '../progress/today.ts';\nexport const x = 1;\n";
    assert.deepEqual(forbiddenIn(byPath), ["imports '../progress/today.ts'", 'names hasToday']);

    const byPackage = "import { dueCards } from '@luvani/core';\nexport const x = 1;\n";
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

describe('the save lines (T1.2, D25)', () => {
  test('three of them, scanned, and they never name a plan, a repair, a time or a countdown', () => {
    assert.equal(STREAK_SAVE_LINES.length, 3);
    assert.ok(STREAK_SAVE_LINES.every((line) => REMINDER_LINES.includes(line)), 'a save line the guilt scans never read');
    // Founder's wording (Set A, line 2 revised 2026-11-18).
    assert.deepEqual(
      STREAK_SAVE_LINES.map((line) => [line.title({ n: 5, lifetime: 5, tutor: 'Marie' }), line.body({ n: 5, lifetime: 5, tutor: 'Marie' })]),
      [
        ['Save your 5-day streak', "Marie has today's phrase ready. A quick one keeps it going."],
        ['Save your 5-day streak', "Today's phrase counts. Marie is here."],
        ['Keep your 5 days going', "Today's phrase is quick, and Marie is ready."],
      ],
    );
    for (const line of STREAK_SAVE_LINES) {
      assert.equal(line.open, 'daily-phrase');
      for (const n of [3, 4, 6, 29, 99, 364]) {
        for (const words of [line.title({ n, lifetime: n, tutor: 'Marie' }), line.body({ n, lifetime: n, tutor: 'Marie' })]) {
          // The exempted words (D25) come out; everything else is scanned.
          const rest = STREAK_BAN_EXEMPTIONS.flatMap(({ words: banned }) => banned).reduce((left, word) => left.replace(new RegExp(word, 'gi'), ''), words);
          assert.equal(streakGuiltOf(rest), undefined, `a streak nag: ${words}`);
          assert.equal(guiltOf(words), undefined, `guilt: ${words}`);
          assert.doesNotMatch(words, /plan|subscri|repair|minute|hour|tonight|midnight|\d+:\d+|left|before/i, `a plan, a repair, a time or a countdown: ${words}`);
          assert.doesNotMatch(words, /\b1 days\b/);
        }
      }
    }
  });

  test('"save your" is said by the save lines and nothing else', () => {
    for (const line of REMINDER_LINES) {
      const words = [1, 3, 29].map((n) => `${line.title({ n, lifetime: n, tutor: 'Marie' })} ${line.body({ n, lifetime: n, tutor: 'Marie' })}`).join(' ');
      if (!STREAK_SAVE_LINES.includes(line)) assert.doesNotMatch(words, /save your/i, `${line.id} says "save your"`);
    }
    for (const copy of REMINDER_COPY) {
      if (/save your/i.test(copy)) assert.match(copy, /^Save your \d+-day streak$/);
    }
  });
});

const reminderMessageOf = (english: string) => ({ title: NAMED_PHRASE_LINE.title({ n: 0, lifetime: 0, tutor: 'Léa', english }), body: NAMED_PHRASE_LINE.body({ n: 0, lifetime: 0, tutor: 'Léa', english }) });

describe('the named phrase line (T1.3, D28)', () => {
  test('the scans read the named line for every phrase that can be picked, and a phrase that fails them, or sits outside the everyday situations, is never named', () => {
    // The allow-list (founder, 2026-11-19): café and food, shops and markets, transport; friends and small talk is left out because it holds personal lines.
    assert.deepEqual([...NAMEABLE_SITUATIONS], ['cafe-and-food', 'shops-and-markets', 'transport']);
    // The weekly line is scanned with real counts, not zeros.
    assert.ok(REMINDER_COPY.includes('6 days of French, 6 practices.'), 'the weekly line is scanned without real counts');
    assert.ok(DAILY_PHRASES.length > 20, 'the phrase pool is too short to be the pool');
    const themeOf = new Map(DAILY_SCENARIOS.map((scene) => [scene.id, scene.theme]));
    let fits = 0;
    for (const phrase of DAILY_PHRASES) {
      const facts = { n: 1, lifetime: 1, tutor: TUTOR_NAME, english: phrase.en };
      const title = NAMED_PHRASE_LINE.title(facts);
      const body = NAMED_PHRASE_LINE.body(facts);
      const everyday = NAMEABLE_SITUATIONS.includes(themeOf.get(phrase.scenarioId)!);
      if (namedPhraseFits(phrase, TUTOR_NAME)) {
        fits += 1;
        assert.ok(everyday, `"${phrase.en}" is named from ${themeOf.get(phrase.scenarioId)}, outside the everyday situations`);
        assert.ok(REMINDER_COPY.includes(title), `the scans never read "${title}"`);
        assert.ok(REMINDER_COPY.includes(body), `the scans never read "${body}"`);
        assert.doesNotMatch(body, /\.”|\?”\?/, `"${body}" keeps a full stop or doubles the question mark`);
        assert.ok(!body.includes(phrase.fr) || phrase.fr === phrase.en, `"${body}" shows the French`);
        assert.doesNotMatch(body, /\d/, `"${body}" puts a number on the lock screen`);
      } else {
        assert.ok(!everyday || guiltOf(`${title} ${body}`) !== undefined || streakGuiltOf(`${title} ${body}`) !== undefined || /[—–·!\d]|in a row|yesterday/i.test(`${title} ${body}`), `"${phrase.en}" was refused for no reason`);
      }
    }
    assert.ok(fits > 0, 'no phrase can be named');
    const cafe = { id: 'phrase:situation:cafe-first-coffee:0' };
    assert.equal(namedPhraseFits({ ...cafe, en: 'Hurry up!' }, 'Léa'), false);
    assert.equal(namedPhraseFits({ ...cafe, en: 'I missed the train' }, 'Léa'), false);
    assert.equal(namedPhraseFits({ ...cafe, en: "I'd like a coffee." }, 'Léa'), true);
    // An empty English, or one with a digit, is never named.
    assert.equal(namedPhraseFits({ ...cafe, en: '' }, 'Léa'), false);
    assert.equal(namedPhraseFits({ ...cafe, en: '  ' }, 'Léa'), false);
    assert.equal(namedPhraseFits({ ...cafe, en: 'Table for 2, please' }, 'Léa'), false);
    // Outside the everyday situations, or an id this build cannot place: never named.
    assert.equal(namedPhraseFits({ id: 'phrase:situation:pharmacy-headache:0', en: 'Hello.' }, 'Léa'), false);
    assert.equal(namedPhraseFits({ id: 'phrase-2026-10-07', en: 'Hello.' }, 'Léa'), false);
    // The new copy (founder, 2026-11-19): a fixed title, the English in the body.
    assert.deepEqual(reminderMessageOf("I'd like a coffee."), { title: 'How do you say this?', body: "“I'd like a coffee” Today's phrase, with Léa." });
    assert.deepEqual(reminderMessageOf('Where is it?'), { title: 'How do you say this?', body: "“Where is it?” Today's phrase, with Léa." });
  });
});

// Expo weekdays: 1 Sunday, 2 Monday ... 7 Saturday.
const [SUN, MON, TUE, WED, THU, FRI, SAT] = [1, 2, 3, 4, 5, 6, 7];

describe('your talk days, the shared rule (T1.4, founder 2026-11-19)', () => {
  test('up to three days, never two next to each other, Sunday and Monday next to each other', () => {
    assert.equal(talkDaysFit([MON, WED, FRI]), true);
    assert.equal(talkDaysFit([TUE]), true);
    assert.equal(talkDaysFit([]), true, 'none picked is a fit; the buttons say none is not enough');
    assert.equal(talkDaysFit([MON, TUE]), false);
    assert.equal(talkDaysFit([SUN, MON]), false, 'Sunday and Monday are next to each other');
    assert.equal(talkDaysFit([SAT, SUN]), false);
    assert.equal(talkDaysFit([SUN, TUE, THU]), true);
    assert.equal(talkDaysFit([MON, WED, FRI, SUN]), false, 'four days');
    assert.equal(talkDaysFit([MON, MON]), false, 'a day twice');
    assert.equal(talkDaysFit([0, 8]), false, 'not a weekday');
    assert.deepEqual([...DEFAULT_TALK_DAYS], [MON, WED, FRI]);
  });

  test('a blocked day names the chosen day it sits next to, in words', () => {
    assert.equal(talkDayBlock([MON], TUE), MON);
    assert.equal(talkDayBlock([MON], SUN), MON, 'the week wraps');
    assert.equal(talkDayBlock([MON], WED), null);
    assert.equal(talkDayBlock([MON], MON), null, 'a chosen day is not blocked');
    assert.equal(talkDayReason([MON], SUN), 'next to Mon');
    assert.equal(talkDayReason([MON], WED), null);
    assert.equal(talkDayLabel([MON], MON), 'Monday, chosen');
    assert.equal(talkDayLabel([MON], TUE), 'Tuesday, next to Monday, not available');
    assert.equal(talkDayLabel([MON], THU), 'Thursday');
  });

  test('the line under the chips: blocked days, the limit, and none picked', () => {
    assert.equal(talkDaysLine([MON, THU], false), 'Tue, Wed, Fri and Sun sit next to a chosen day.');
    assert.equal(talkDaysLine([MON, WED, FRI], false), 'Tue, Thu, Sat and Sun sit next to a chosen day.');
    assert.equal(talkDaysLine([MON, WED, FRI], true), 'Three days is the most. Tap a chosen day to free it.');
    assert.equal(talkDaysLine([MON], true), 'Tue and Sun sit next to a chosen day.', 'the limit line only once three are chosen');
    assert.equal(talkDaysLine([], false), 'Pick at least one day, or choose Not now.');
    assert.equal(talkDaysLine([], false, TALK_DAYS_COPY.noneSettings), 'Pick at least one day, or turn off talk days.');
    assert.equal(talkDaysLine([SUN, TUE], false), 'Mon, Wed and Sat sit next to a chosen day.');
  });

  test('the saved days preselect, else Mon, Wed and Fri; the row says the days or Off', () => {
    assert.deepEqual(talkDaysPicked([TUE, SAT]), [TUE, SAT]);
    assert.deepEqual(talkDaysPicked(undefined), [MON, WED, FRI]);
    assert.deepEqual(talkDaysPicked([]), [MON, WED, FRI]);
    assert.deepEqual(talkDaysPicked([MON, TUE]), [MON, WED, FRI], 'a saved set that breaks the rule');
    assert.equal(talkDaysValue([FRI, MON, WED]), 'Mon, Wed, Fri');
    assert.equal(talkDaysValue([SUN]), 'Sun');
    assert.equal(talkDaysValue(undefined), 'Off');
    assert.equal(talkDaysValue([]), 'Off');
  });

  test('the talk-day lines are scanned, name the tutor, and carry no digit', () => {
    assert.ok(REMINDER_LINES.includes(TALK_DAY_LINE) && REMINDER_LINES.includes(TALK_DAY_FREE_LINE), 'a talk-day line is outside the scans');
    const facts = { n: 0, lifetime: 0, tutor: 'Léa' };
    assert.equal(TALK_DAY_LINE.title(facts), 'A conversation with Léa today');
    assert.equal(TALK_DAY_LINE.body(facts), 'Léa is ready to talk when you are.');
    assert.equal(TALK_DAY_FREE_LINE.title(facts), 'A conversation with Léa today');
    assert.equal(TALK_DAY_FREE_LINE.body(facts), 'Léa is free to talk again.');
    // The sheet's own words, and a spread of under-chip lines, go through the copy sweep too.
    for (const line of [...Object.values(TALK_DAYS_COPY), talkDaysLine([MON, THU], false), talkDaysLine([SUN], false)]) {
      assert.ok(REMINDER_COPY.includes(line.replace('{tutor}', TUTOR_NAME)), `the sweep never reads "${line}"`);
    }
  });
});
