/**
 * The phone settings pair, checked from the outside.
 *
 * `phoneSettings.native.ts` reaches expo-audio and expo-linking, and it cannot
 * be imported here: loading it pulls in native modules that need a React Native
 * runtime, which `node --test` is not. That is not a gap in the tests, it is the
 * point of the split, and `reminders/schedule.test.ts` is the file this one is
 * modelled on line for line.
 *
 * **What these tests prove.** That the web half is a real no-op which reports
 * `unavailable` instead of pretending, and that half is executed rather than
 * read. That the two halves ship the same names, which the compiler cannot check
 * because it only ever resolves `phoneSettings.ts`. That the native half reads
 * the microphone off `granted` and `canAskAgain` rather than off a status word,
 * and that it never asks for the permission, so the one dialog iOS gives is
 * still spent where the learner is trying to speak. And that the operating
 * system is reached from a countable set of files: the microphone read from one,
 * the settings app from one, and a browser from two.
 *
 * **What they cannot prove.** That iOS Settings opens, that it lands on Luvani's
 * own page, that a permission changed there is seen on the walk back, or that a
 * mail app answers a `mailto:`. Every one of those is a Pass 7 row in
 * `docs/DEVICE_VERIFICATION.md`, and none of them is claimed here.
 *
 * This file is excluded from its own scans for the reason `reminder.test.ts`
 * gives: it has to write the names down in order to prove the matcher sees them,
 * and a guard its own proof trips is a guard nobody can write.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { phoneRows } from './phone.ts';
import { PHONE_SETTINGS_AVAILABLE, microphonePermission, openPhoneSettings } from './phoneSettings.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const SRC = fileURLToPath(new URL('..', import.meta.url));

/** The one file allowed to read a permission or open the settings app. */
const PAIR = 'settings/phoneSettings.native.ts';

/** The one file besides the pair allowed to leave the app on purpose. */
const LINKS = 'settings/links.ts';

/** The sign-in callback, which has imported both of those since long before this. */
const OAUTH = 'auth/oauth.native.ts';

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** Every hand-written source file under src/, src-relative and posix-slashed. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    if (full === SELF) continue;
    out.push(relative(SRC, full).split(sep).join('/'));
  }
  return out;
}

/** The files whose stripped source matches, so a comment can cite anything. */
function filesMatching(pattern: RegExp): string[] {
  return sourceFiles(SRC)
    .filter((file) => pattern.test(stripComments(readFileSync(join(SRC, file), 'utf8'))))
    .sort();
}

/** Every name a module exports, so the pair can be held to one surface. */
function exportedNames(source: string): string[] {
  const names = new Set<string>();
  const declaration =
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|type|interface|class|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of stripComments(source).matchAll(declaration)) names.add(match[1]!);
  return [...names].sort();
}

const WEB = readFileSync(join(HERE, 'phoneSettings.ts'), 'utf8');
const NATIVE = readFileSync(join(HERE, 'phoneSettings.native.ts'), 'utf8');
const NATIVE_CODE = stripComments(NATIVE);

describe('the phone settings pair — F476', () => {
  test('the phone settings pair exports the same names on both halves', () => {
    // Metro swaps phoneSettings.native.ts in on a device; tsc resolves
    // phoneSettings.ts and never opens the other file. A name added to one half
    // and not the other is a crash on a phone that typechecks perfectly here.
    assert.deepEqual(
      exportedNames(NATIVE),
      exportedNames(WEB),
      'the halves of the pair no longer export the same names, so the app gets a different module on a device than the one it was compiled against',
    );

    // The outcome type is declared twice because neither half can import the
    // other without Metro resolving the import back to itself. Same words, or
    // the screen is reading a vocabulary the device does not use.
    const outcome = /export type OpenSettingsOutcome = ([^;]+);/;
    const fromWeb = WEB.match(outcome)?.[1]?.trim();
    const fromNative = NATIVE.match(outcome)?.[1]?.trim();
    assert.ok(fromWeb !== undefined && fromWeb.length > 0, 'the web half declares no OpenSettingsOutcome');
    assert.equal(fromNative, fromWeb, 'the two halves disagree about what opening the settings app can answer');

    // Both annotate the availability flag, or the compiler decides the literal
    // `false` can never be true and every caller's check becomes a type error.
    for (const [half, source] of [['web', WEB], ['native', NATIVE]] as const) {
      assert.match(
        source,
        /export const PHONE_SETTINGS_AVAILABLE: boolean =/,
        `the ${half} half leaves the availability flag to infer, so a caller cannot compare it`,
      );
    }
  });

  test('the web half reports unavailable rather than pretending it opened something', async () => {
    // The only half of this pair node can execute, so it is executed.
    assert.equal(PHONE_SETTINGS_AVAILABLE, false, 'the web build claims it can open a phone settings app');
    assert.equal(await openPhoneSettings(), 'unavailable', 'the web build answered as if it had opened something');

    // Denied rather than undetermined, for the reason schedule.ts gives about
    // its own permission: undetermined promises a system dialog, and on the web
    // that dialog never comes.
    assert.equal(await microphonePermission(), 'denied');

    // And the flag is what actually keeps the group off the page, so a denied
    // web permission still draws nothing.
    assert.deepEqual(
      phoneRows({ microphone: await microphonePermission(), notifications: 'denied', available: PHONE_SETTINGS_AVAILABLE }),
      [],
      'the web build offers a walk to a settings app it has none of',
    );
  });

  test('only the platform pair talks to the operating system', () => {
    const scanned = sourceFiles(SRC);
    assert.ok(scanned.length > 150, `the walk found ${scanned.length} files, which is not this app`);
    assert.ok(scanned.includes(PAIR), 'the walk never reached the native half, so it is scanning nothing');

    // The microphone is READ in one file. The scenes ask for it, which is a
    // different call and a different decision: `requestRecordingPermissionsAsync`
    // raises the dialog and belongs where somebody is trying to speak.
    assert.deepEqual(
      filesMatching(/getRecordingPermissionsAsync/),
      [PAIR],
      `the microphone permission is read outside ${PAIR}, so two files decide what a refusal means`,
    );
    assert.ok(
      !NATIVE_CODE.includes('requestRecordingPermissionsAsync'),
      'the settings pair asks for the microphone, which spends the one dialog iOS gives on a screen nobody came to for it',
    );

    // The settings app is opened from one file.
    assert.deepEqual(
      filesMatching(/Linking\.openSettings\(/),
      [PAIR],
      `the phone's settings are opened outside ${PAIR}`,
    );

    // Leaving the app is countable. Native OAuth owns its exact callback and
    // browser session. The auth adapter only observes incoming email links.
    assert.deepEqual(
      filesMatching(/from 'expo-linking'/),
      [LINKS, PAIR, 'auth/supabaseAdapter.ts'].sort(),
      'something else in the app reaches expo-linking; a link out is a moment the app hands somebody to software it does not control',
    );
    const emailAdapter = readFileSync(join(SRC, 'auth/supabaseAdapter.ts'), 'utf8');
    assert.match(emailAdapter, /observeEmailCallbacks\(/);
    assert.doesNotMatch(emailAdapter, /Linking\.(?:openURL|openSettings|sendIntent)\(/);
    assert.deepEqual(
      filesMatching(/from 'expo-web-browser'/),
      [OAUTH, LINKS].sort(),
      'something else in the app opens a browser',
    );

    // Notifications are deliberately NOT read here. `reminderPermission()` in
    // reminders/schedule.ts already does it, and its native half is the only
    // file in the repo allowed to import expo-notifications. A second reader
    // would be a second importer and the split would stop meaning anything.
    assert.ok(!NATIVE_CODE.includes('expo-notifications'), 'the settings pair imports expo-notifications, which has exactly one importer');

    // The reading itself: granted and canAskAgain, not a status word, because
    // the question a row asks is whether only the phone's settings can change
    // this now. And the three words are the ones settings/phone.ts uses.
    assert.match(NATIVE_CODE, /function permissionOf\(/, 'the native half reads the permission inline, so nothing can point at the reading');
    assert.match(NATIVE_CODE, /if \(status\.granted\) return 'granted';/, 'the native half does not read granted first');
    assert.match(
      NATIVE_CODE,
      /return status\.canAskAgain \? 'undetermined' : 'denied';/,
      'the native half decides a refusal off something other than canAskAgain, which is literally the question the row asks',
    );

    // A failed read answers undetermined, not denied, and the asymmetry is the
    // point: denied is the one value that puts a row on screen, so a module that
    // answered it on a broken read would invite a learner into their phone's
    // settings to fix something that may not be broken.
    const reader = NATIVE_CODE.slice(NATIVE_CODE.indexOf('export async function microphonePermission'));
    assert.match(
      reader.slice(0, reader.indexOf('}\n\n')),
      /catch \{\s*return 'undetermined';/,
      'a microphone read that threw is reported as a refusal, so a broken read draws a row nobody can act on',
    );
  });
});
