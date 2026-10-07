/**
 * The platform pair, checked from the outside.
 *
 * `schedule.native.ts` is the only file in this repo that imports
 * `expo-notifications`, and it cannot be imported here: loading it pulls in a
 * native module that needs a React Native runtime, which `node --test` is not.
 * That is not a gap in the tests, it is the point of the split. A dependency
 * that exactly one module touches is a dependency that can be replaced, moved
 * behind a different SDK, or deleted, by reading one file. The moment a second
 * importer appears that stops being true and nothing would say so.
 *
 * So this file does what `review/cardView.test.ts` and
 * `tutor-agent/src/agentWiring.test.ts` do when the thing under test cannot be
 * run: it reads the source. Be exact about what that buys.
 *
 * **What these tests prove.** That exactly one file in apps/, packages/,
 * services/ and scripts/ imports `expo-notifications`, and that it is the
 * native half of this pair. That it hands the OS the plan's dated slots and
 * nothing that repeats, cancels only this app's own slots by identifier, and
 * reads no clock (founder decision D2 retired the old daily repeating trigger,
 * F230, which could not skip a practised day; `plan.test.ts` holds the plan).
 * That the web half is a real no-op which reports `unavailable` instead of
 * pretending, and this half is executed, not read. That the two halves still
 * ship the same names, which the compiler cannot check because it only ever
 * sees `schedule.ts`. And that the module asks the OS for no badge of any kind
 * and creates its Android channel with the badge explicitly turned off.
 *
 * **What they cannot prove.** That a notification arrives on a phone. Nothing
 * in this suite touches iOS or Android; permission, delivery, the Android
 * channel a reminder lands in and what the lock screen actually shows are all
 * device evidence, and none of them is claimed here. Expo Go on Android has
 * not scheduled local notifications since SDK 53, so even a manual check needs
 * a dev build. Any document that reads a green tick here as "the reminder
 * fires" is reading it wrong.
 *
 * The badge is the sharpest case of that line, so it is worth stating twice.
 * These tests prove the request this module makes: no badge permission asked
 * for on iOS, and `showBadge: false` written into the channel input on Android.
 * They cannot prove that no count appears on a launcher icon. That depends on
 * the OS honouring the flag, on which channel the notification actually lands
 * on, and on a launcher that may ignore the setting outright — three things
 * only a dev build on a real phone can answer, and none of them is claimed.
 *
 * This file is excluded from its own scan for the reason `reminder.test.ts`
 * gives: it has to write the forbidden import down in order to prove the
 * matcher sees it, and a guard its own proof trips is a guard nobody can write.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emptyLog, planReminders } from './plan.ts';
import { reminderRow } from './reminder.ts';
import {
  REMINDERS_AVAILABLE,
  askReminderPermission,
  cancelReminder,
  onReminderTapped,
  reminderPermission,
  schedulePlan,
} from './schedule.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

/** The dependency this pair exists to keep in one place. */
const NATIVE_DEPENDENCY = 'expo-notifications';

/** The one file allowed to touch it, written the way a failure should print it. */
const SOLE_IMPORTER = 'apps/mobile/src/reminders/schedule.native.ts';

/** Everything this repo writes by hand. `docs/` has no imports to find. */
const SCAN_ROOTS: readonly string[] = ['apps', 'packages', 'services', 'scripts'];

/**
 * Installed or generated trees, which are not this repo's own source.
 *
 * `ios` and `android` are prebuild output rather than files anybody edits, and
 * `dist` is the web export: a bundle there contains whatever the bundler
 * inlined, so scanning it would report the bundler's copy of a module as a
 * second importer.
 */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', 'ios', 'android', 'Pods']);

const SOURCE_FILE = /\.(?:tsx?|jsx?|mjs|cjs)$/;

/** Comments may cite anything; only what the module actually runs is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/**
 * Every module specifier this source pulls in, static or lazy.
 *
 * The same matcher `reminder.test.ts` uses, for the same reason: `import(...)`
 * and `require(...)` reach a package just as surely as a static import, and a
 * ban that only sees the top of the file is routed around on line thirty.
 */
function importsIn(source: string): string[] {
  const found: string[] = [];
  for (const match of stripComments(source).matchAll(/(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    if (match[1] !== undefined) found.push(match[1]);
  }
  return found;
}

/** True when this source reaches expo-notifications by any door. */
function touchesNotifications(source: string): boolean {
  return importsIn(source).some(
    (spec) => spec === NATIVE_DEPENDENCY || spec.startsWith(`${NATIVE_DEPENDENCY}/`),
  );
}

/** Every hand-written source file under a root, repo-relative and posix-slashed. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sourceFiles(full, out);
      continue;
    }
    if (!SOURCE_FILE.test(entry.name)) continue;
    if (full === SELF) continue;
    out.push(relative(REPO, full).split(sep).join('/'));
  }
  return out;
}

function repoSources(): string[] {
  const out: string[] = [];
  for (const root of SCAN_ROOTS) sourceFiles(join(REPO, root), out);
  return out.sort();
}

/** The importers the scan finds, which is the whole of the first claim. */
function notificationImporters(): string[] {
  return repoSources().filter((file) => touchesNotifications(readFileSync(join(REPO, file), 'utf8')));
}

const NATIVE = stripComments(readFileSync(join(HERE, 'schedule.native.ts'), 'utf8'));

/** The object literal opening after `from`, brace-counted so a nested one cannot end it early. */
function objectLiteralAt(source: string, from: number, what: string): string {
  const open = source.indexOf('{', from);
  assert.notEqual(open, -1, `the ${what} is not written as an object literal`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`the ${what} literal is never closed`);
}

/** The `trigger: { ... }` literal handed to the OS. */
function triggerLiteral(source: string): string {
  const start = source.indexOf('trigger:');
  assert.notEqual(start, -1, 'the native module schedules nothing with a trigger');
  return objectLiteralAt(source, start, 'trigger');
}

/**
 * The configuration handed to `setNotificationChannelAsync`, which is the only
 * place a badge can be turned off.
 *
 * A missing call is a failure rather than a skip, and that is the whole of the
 * Android half: with no channel of ours the reminder lands on the one expo
 * auto-creates, and `BaseNotificationBuilder.createFallbackChannel()` builds
 * that one with an explicit `setShowBadge(true)`.
 */
function channelLiteral(source: string): string {
  const start = source.indexOf('setNotificationChannelAsync(');
  assert.notEqual(
    start,
    -1,
    'the native module creates no channel, so the reminder lands on the badge-showing one expo auto-creates',
  );
  return objectLiteralAt(source, start, 'channel configuration');
}

/**
 * The one spelling of the word that removes a count rather than asking for one.
 *
 * Not a stylistic exemption. `AndroidXNotificationsChannelManager` only calls
 * `setShowBadge` when the channel input carries this key, so a channel written
 * without it takes the platform default instead of ours, and the default is
 * documented as showing the badge. Writing the key down is the fix, which is
 * why it is also the only badge the guard below lets through.
 */
const BADGE_SUPPRESSION = /showBadge:\s*false\b/;

/**
 * Every mention of a badge in a source that is not that suppression.
 *
 * The tokens rather than a boolean, so a failure names what it found:
 * `allowBadge` in the permission request, `showBadge` on a `true`,
 * `setBadgeCountAsync`, or a `badge` count written into the content.
 */
function badgeRequestsIn(source: string): string[] {
  const asking = stripComments(source).replace(new RegExp(BADGE_SUPPRESSION.source, 'g'), '');
  return asking.match(/[\w.]*badge[\w.]*/gi) ?? [];
}

/** Every name a module exports, so the pair can be held to one surface. */
function exportedNames(source: string): string[] {
  const names = new Set<string>();
  const declaration = /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|type|interface|class|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of stripComments(source).matchAll(declaration)) names.add(match[1]!);
  return [...names].sort();
}

describe('the reminder pair that talks to the OS', () => {
  test('only the native schedule module touches expo-notifications, and it hands the OS the plan in dated slots it cancels by name', () => {
    const scanned = repoSources();
    assert.ok(scanned.length > 400, `the walk found ${scanned.length} files, which is not this repo`);
    assert.ok(scanned.includes(SOLE_IMPORTER), 'the walk never reached the native module, so it is scanning nothing');

    assert.deepEqual(
      notificationImporters(),
      [SOLE_IMPORTER],
      `${NATIVE_DEPENDENCY} is reached from somewhere other than ${SOLE_IMPORTER}. ` +
        'One importer is what makes a native dependency separable from the code; two makes it load-bearing everywhere.',
    );

    // One scheduling call, in a loop over the plan's slots, so there is one
    // trigger to reason about.
    const scheduled = NATIVE.match(/scheduleNotificationAsync\(/g) ?? [];
    assert.equal(scheduled.length, 1, `the native module schedules ${scheduled.length} times, so which trigger fires is a guess`);
    assert.match(NATIVE, /for \(const slot of slots\) \{\s*await Notifications\.scheduleNotificationAsync\(\{/);

    // A dated one-off at the instant the plan chose, on the named channel. No
    // literal and no clock: the time belongs to the plan.
    const trigger = triggerLiteral(NATIVE);
    assert.match(trigger, /type: Notifications\.SchedulableTriggerInputTypes\.DATE/);
    assert.match(trigger, /date: slot\.at/);
    assert.match(trigger, /channelId: REMINDER_CHANNEL_ID/);
    assert.doesNotMatch(trigger, /\d/, `the trigger carries a literal number: ${trigger}. The time belongs to the plan.`);
    // Nothing repeats: a repeating trigger cannot skip the day somebody practised (D2).
    assert.doesNotMatch(NATIVE, /TIME_INTERVAL|SchedulableTriggerInputTypes\.(?:DAILY|WEEKLY|CALENDAR|MONTHLY|YEARLY)/, 'the reminder uses a trigger that repeats');
    assert.doesNotMatch(NATIVE, /\brepeats\b/);
    assert.doesNotMatch(
      NATIVE,
      /Date\.now|new Date|setTimeout|setInterval|getHours|toISOString/,
      'the native module reads a clock, so it is working out a fire time the plan already chose',
    );

    // Each slot is named for its day, so a second plan replaces the first; the
    // words are the plan's, built in reminder.ts where the scans read them.
    assert.match(NATIVE, /identifier: slot\.id/);
    assert.match(NATIVE, /content: \{ title: slot\.title, body: slot\.body, data: \{ open: slot\.open \} \}/);

    // Cancelled by name, and only this app's own: never everything.
    assert.doesNotMatch(NATIVE, /cancelAllScheduledNotificationsAsync/, 'a re-plan sweeps away notifications that are not its own');
    assert.match(NATIVE, /const pending = await Notifications\.getAllScheduledNotificationsAsync\(\);/);
    assert.match(NATIVE, /if \(request\.identifier\.startsWith\(SLOT_PREFIX\)\) await Notifications\.cancelScheduledNotificationAsync\(request\.identifier\);/);
    // No foreground banner: there is no notification handler at all.
    assert.doesNotMatch(NATIVE, /setNotificationHandler/, 'a reminder arriving while the app is open is presented over the practice');
  });

  test('the importer scan bites, on a static import and on a lazy one, and leaves prose alone', () => {
    // A scan that matches nothing passes forever and defends nothing. Every
    // shape a second importer could arrive in is run through the same matcher
    // the test above relies on.
    assert.equal(touchesNotifications("import * as N from 'expo-notifications';\n"), true, 'a static import walks past the scan');
    assert.equal(touchesNotifications('import * as N from "expo-notifications";\n'), true, 'a double-quoted import walks past the scan');
    assert.equal(touchesNotifications("export { x } from 'expo-notifications/build/Notifications';\n"), true, 'a deep re-export walks past the scan');
    assert.equal(touchesNotifications("const N = await import('expo-notifications');\n"), true, 'a lazy import walks past the scan');
    assert.equal(touchesNotifications("const N = require('expo-notifications');\n"), true, 'a require walks past the scan');

    assert.equal(
      touchesNotifications('/** The native half imports expo-notifications. */\nexport const x = 1;\n'),
      false,
      'a citation in a comment is not an import, and a module that cannot explain itself stops explaining itself',
    );
    assert.equal(touchesNotifications("export const dep = 'expo-notifications';\n"), false, 'a bare string is not an import');
    assert.equal(touchesNotifications("import { Notifier } from './notify.ts';\n"), false);
  });

  test('the web half reports unavailable rather than pretending a reminder was scheduled', async () => {
    // The only half of this pair that node can execute, so it is executed.
    assert.equal(REMINDERS_AVAILABLE, false, 'the web build claims it can schedule a notification');
    const plan = planReminders({
      now: Date.UTC(2026, 9, 7, 9),
      calendar: { dayOf: (at) => new Date(at).toISOString().slice(0, 10), minuteOf: () => 0, at: (day, hour, minute) => Date.parse(`${day}T00:00:00Z`) + (hour * 60 + minute) * 60_000 },
      choice: { enabled: true, time: 'morning' },
      finishes: [],
      practiceDays: [],
      covers: [],
      tutor: 'Luc',
      log: emptyLog(),
    });
    assert.ok(plan.length > 0, 'the plan handed to the web half is empty, so this proves nothing');
    assert.equal(await schedulePlan(plan), 'unavailable', 'the web build answered as if a reminder had been set');
    assert.equal(await cancelReminder(), 'unavailable', 'the web build answered as if it had cancelled something');
    let tapped = false;
    const stop = onReminderTapped(() => {
      tapped = true;
    });
    stop();
    assert.equal(tapped, false, 'the web build heard a tap on a reminder that cannot exist');

    // Denied rather than undetermined, and the difference matters: undetermined
    // makes reminderRow promise a system dialog, and on the web that dialog
    // never comes. The switch would sit there asking to be flipped forever.
    assert.equal(await reminderPermission(), 'denied');
    assert.equal(await askReminderPermission(), 'denied');

    const row = reminderRow({ enabled: true, time: 'morning' }, await reminderPermission());
    assert.equal(row.on, false, 'the web build draws a live switch over a channel it has no way to use');
    assert.equal(row.asks, false, 'the web build offers a dialog that will never open');
  });

  test('the two halves ship the same names, because the compiler only ever sees one of them', async () => {
    // Metro swaps schedule.native.ts in on a device; tsc resolves schedule.ts
    // and never opens the other file. A name added to one half and not the
    // other is therefore a crash on a phone that typechecks perfectly here.
    const web = readFileSync(join(HERE, 'schedule.ts'), 'utf8');
    const native = readFileSync(join(HERE, 'schedule.native.ts'), 'utf8');
    assert.deepEqual(
      exportedNames(native),
      exportedNames(web),
      'the halves of the pair no longer export the same names, so the app gets a different module on a device than the one it was compiled against',
    );

    // The outcome type is declared twice because neither half can import the
    // other without Metro resolving the import back to itself. Same words, or
    // the screen is reading a vocabulary the device does not use.
    const outcome = /export type ScheduleOutcome = ([^;]+);/;
    const fromWeb = web.match(outcome)?.[1]?.trim();
    const fromNative = native.match(outcome)?.[1]?.trim();
    assert.ok(fromWeb !== undefined && fromWeb.length > 0, 'the web half declares no ScheduleOutcome');
    assert.equal(fromNative, fromWeb, 'the two halves disagree about what a scheduling attempt can answer');
  });

  test("the reminder's channel asks for no badge and the guard says which kind it means", () => {
    // Two opposite things share the word, and F230's flat ban could not tell
    // them apart: *asking for* a badge, which is the count this phase refuses
    // to show, and *suppressing* one, which is the line that removes it. So the
    // ban is kept whole for the first and inverted into a requirement for the
    // second. A guard that forbids its own fix is how F240 stayed open.
    assert.match(NATIVE, /allowAlert: true/, 'the permission request does not ask to show anything');

    // iOS. The request is spelled out because expo's default asks for alert,
    // sound *and* badge; an omitted `allowBadge` is read as false, so on that
    // platform the suppression is the absence of the key and this ban is the
    // whole of it. Nothing here can prove what the icon does on a phone.
    assert.deepEqual(
      badgeRequestsIn(NATIVE),
      [],
      'the native module asks for a badge. A count on the icon is the number this whole phase refuses to show anyone, ' +
        'and the one spelling of the word this file may use is the channel suppression below.',
    );

    // Android. The key has to be written down: the manager only calls
    // setShowBadge when the input carries it, so a channel without it takes the
    // platform default rather than a decision of ours.
    assert.match(
      channelLiteral(NATIVE),
      BADGE_SUPPRESSION,
      'the reminder channel does not turn the badge off, so whether the launcher icon carries a count is ' +
        "Android's default and not a decision anybody here made.",
    );

    // The guard is run against both kinds, because that discrimination is the
    // repair. One that reads the fix as a violation is the bug this replaces,
    // and one that waves the word through defends nothing.
    assert.deepEqual(badgeRequestsIn('setNotificationChannelAsync(ID, { showBadge: false });'), [], 'turning the badge off still reads as asking for one');
    assert.deepEqual(badgeRequestsIn('setNotificationChannelAsync(ID, { showBadge: true });'), ['showBadge'], 'a channel that asks for the badge walks past the guard');
    assert.deepEqual(badgeRequestsIn('requestPermissionsAsync({ ios: { allowBadge: true } });'), ['allowBadge'], 'the iOS badge permission walks past the guard');
    assert.deepEqual(badgeRequestsIn('await Notifications.setBadgeCountAsync(1);'), ['Notifications.setBadgeCountAsync'], 'setting the count outright walks past the guard');
    assert.deepEqual(badgeRequestsIn('content: { title: T, badge: 1 },'), ['badge'], 'a badge count in the notification content walks past the guard');
    assert.deepEqual(
      badgeRequestsIn('/** No badge is ever asked for. */\nexport const x = 1;\n'),
      [],
      'a citation in a comment is not a request, and a module that cannot explain itself stops explaining itself',
    );

    assert.doesNotMatch(NATIVE, /\bbody:\s*['"`]/, 'the notification body is written here instead of in reminder.ts, where the guilt scan can read it');
  });
});
