/**
 * The Phone group's one rule, run rather than read.
 *
 * `phoneRows` is a pure function of three values, so the whole of it can be
 * asked directly: nine combinations of permission and one flag, and what each
 * one draws. That is the point of lifting it out of the screen at all
 * (docs/TESTING.md has no renderer to ask instead).
 *
 * The screen is then held to *using* it, and to using it through the platform
 * pair, which is the part only a source walk can see.
 *
 * **What these tests prove.** That a refused permission is the only state that
 * draws a row; that an allowed one, an unasked one and a value that has not
 * been read yet all draw nothing; that a build with no settings app to open
 * draws nothing whatever the permissions say; that the row's words say where
 * the setting really lives and that typing is still a way through; and that the
 * screen re-reads both permissions on focus AND on the way back into the
 * foreground, through one reader, rather than caching them.
 *
 * That last clause is F492, and it is worth saying why it is spelled out twice.
 * The focus test carried this name for two rounds while asserting nothing more
 * than that a focus effect existed, which is precisely the half that does not
 * cover the walk it was named after: `useFocusEffect` fires on a navigation
 * focus change, and the phone's own settings background the app without this
 * screen ever losing focus. The name is true now because the assertion reaches
 * the foreground path, not because the name was made smaller.
 *
 * **What they cannot prove.** That iOS Settings actually opens, that it lands
 * on Luvani's own page, or that the row is gone when the learner walks back on
 * a real phone. Those are three of the Pass 7 rows in
 * `docs/DEVICE_VERIFICATION.md`, and none of them is claimed here.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import {
  MICROPHONE_ROW,
  MICROPHONE_SUB,
  NOTIFICATIONS_ROW,
  NOTIFICATIONS_SUB,
  PHONE_COPY,
  phoneRows,
  type PhonePermission,
} from './phone.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SETTINGS = stripComments(read('./SettingsScreen.tsx'));

/** Every state a permission can reach this module in, including "not read yet". */
const STATES: readonly (PhonePermission | null)[] = ['granted', 'undetermined', 'denied', null];

const keysFor = (
  microphone: PhonePermission | null,
  notifications: PhonePermission | null,
  available = true,
): string[] => phoneRows({ microphone, notifications, available }).map((row) => row.key);

describe('a refused permission is the only one worth a row — F476', () => {
  test("a refused permission draws a row that opens the phone's settings, and an allowed one draws nothing", () => {
    // The whole truth table, so nothing about this rule is a guess. Only
    // `denied` draws, in either slot, in every combination.
    for (const microphone of STATES) {
      for (const notifications of STATES) {
        const expected = [
          ...(microphone === 'denied' ? ['microphone'] : []),
          ...(notifications === 'denied' ? ['notifications'] : []),
        ];
        assert.deepEqual(
          keysFor(microphone, notifications),
          expected,
          `microphone ${String(microphone)} and notifications ${String(notifications)} drew the wrong rows`,
        );
      }
    }

    // Granted draws nothing, because a row reading Allowed does nothing when it
    // is tapped except offer a walk to a screen where the only act available is
    // turning something off. A settings list is not where an app reports on
    // itself.
    assert.deepEqual(keysFor('granted', 'granted'), [], 'an allowed permission put a row on the screen');

    // Undetermined draws nothing either, and that is the real decision. iOS
    // shows each dialog once per install, and the moment worth spending it on
    // is the scene, where the learner is already trying to speak.
    assert.deepEqual(keysFor('undetermined', 'undetermined'), [], 'a permission nobody has been asked for drew a row');

    // Not read yet is a silence, not a state. A guessed `denied` would flash a
    // row at somebody who has never been asked anything.
    assert.deepEqual(keysFor(null, null), [], 'a permission that has not been read yet drew a row');

    // The microphone comes first because it is the one that stops a
    // conversation, and both are drawn when both are refused.
    assert.deepEqual(keysFor('denied', 'denied'), ['microphone', 'notifications'], 'the two rows are in the wrong order');

    // A build with no settings app to open draws nothing at all, whatever the
    // permissions say. The same job `REMINDERS_AVAILABLE` does for the reminder
    // card, and the same reason: a sentence naming phone settings is a lie on a
    // laptop.
    assert.deepEqual(keysFor('denied', 'denied', false), [], 'the web build offers a walk to a settings app it has none of');

    // The words the two rows carry, from the module rather than from the screen.
    const rows = phoneRows({ microphone: 'denied', notifications: 'denied', available: true });
    assert.deepEqual(rows.map((row) => row.label), [MICROPHONE_ROW, NOTIFICATIONS_ROW]);
    assert.deepEqual(rows.map((row) => row.sub), [MICROPHONE_SUB, NOTIFICATIONS_SUB]);
    // Each says where the setting really lives, because it is not in this app
    // and a learner hunting for it here would not find it.
    for (const row of rows) assert.match(row.sub, /phone settings/, `${row.label} does not say where the setting is`);
    // And the microphone row says the quiet twin is still open. A learner is
    // never forced to speak aloud, so a refused microphone must not read as a
    // locked door.
    assert.match(MICROPHONE_SUB, /type/, 'the microphone row does not say that typing is still a way through');
  });

  test('the screen re-reads both permissions on focus so the walk back from Settings is enough', () => {
    // One effect, on focus, reading everything the OS and the store own. On
    // mount it would go stale the first time a learner left the app, which is
    // exactly the walk this row exists to make possible.
    assert.equal(
      (SETTINGS.match(/useFocusEffect\(/g) ?? []).length,
      1,
      'Settings reads the operating system in more than one effect, so which one is authoritative is a guess',
    );
    assert.ok(
      !SETTINGS.includes('useEffect('),
      'Settings reads something on mount, which goes stale the first time a learner leaves the app',
    );
    const at = SETTINGS.indexOf('useFocusEffect(');
    const effect = SETTINGS.slice(at, SETTINGS.indexOf('const forgetDeleteDraft', at));
    for (const call of ['microphonePermission()', 'reminderPermission()', '.offering(user.id)', 'loadConsent()']) {
      assert.ok(effect.includes(call), `the focus effect never reads ${call}`);
    }

    // And the name of this test is only true because of the four lines below.
    // F492: for two rounds it said "the walk back from Settings is enough" and
    // asserted nothing but that a focus effect existed, which was already the
    // half that does not cover the walk. `useFocusEffect` fires on a NAVIGATION
    // focus change; tapping the Microphone row backgrounds Luvani without this
    // screen ever losing focus, so the return has to be heard from AppState or
    // it is not heard at all.
    assert.match(
      effect,
      /AppState\.addEventListener\('change', \(next\) => \{\s*if \(next === 'active'\) readPhonePermissions\(\);/,
      'nothing re-reads the permissions when the app comes back to the foreground, so the walk back from the phone ' +
        "settings leaves the row the learner just repaired sitting on the screen",
    );
    assert.equal(
      (effect.match(/readPhonePermissions\(\)/g) ?? []).length,
      2,
      'the focus path and the foreground path do not share one reader, so the two can answer differently',
    );
    // Torn down with the effect that made it, so it listens exactly while this
    // screen is on top and a backgrounded Home does not re-read anything.
    assert.match(effect, /foreground\.remove\(\)/, 'the foreground listener outlives the screen that registered it');
    assert.match(SETTINGS, /import \{ AppState,/, 'AppState is reached some other way than the react-native import');

    // Read, never ask. The dialog belongs to the scene and to the reminder
    // switch; an entry that raised it would spend the one chance iOS gives on a
    // list somebody was browsing.
    //
    // The reminder moved onto this screen with revamp A (F576), and with it the
    // one legitimate ask in the file. So the ban is where it always meant to
    // be rather than over the whole file: nothing on either entry path asks,
    // the microphone is never asked for here at all, and the notification
    // dialog is raised in exactly one place, behind the module's own `asks`.
    for (const ask of ['askReminderPermission(', 'requestRecordingPermissions']) {
      assert.ok(!effect.includes(ask), `the focus effect calls ${ask}, which raises a dialog nobody on this screen asked for`);
    }
    assert.ok(
      !SETTINGS.includes('requestRecordingPermissions'),
      'Settings raises the microphone dialog, which belongs to the scene where the learner is already trying to speak',
    );
    assert.equal(
      (SETTINGS.match(/askReminderPermission\(/g) ?? []).length,
      1,
      'the notification dialog is raised in more than one place on Settings, so the one ask iOS gives can be spent twice',
    );
    assert.match(
      SETTINGS,
      /void \(row\.asks \? askReminderPermission\(\) : reminderPermission\(\)\)/,
      'the reminder switch asks without checking whether this is the state an ask belongs in, so a re-ask silently does nothing',
    );

    // The rows are the module's answer, and the tap goes through the pair.
    assert.match(SETTINGS, /phoneRows\(\{ microphone, notifications, available: PHONE_SETTINGS_AVAILABLE \}\)/, 'the screen decides which phone rows to draw itself');
    assert.match(SETTINGS, /onPress=\{walkToPhoneSettings\}/, 'the phone row does not open the phone settings');
    assert.match(SETTINGS, /void openPhoneSettings\(\)\.then\(/, 'the screen reaches the operating system some other way than the pair');
  });

  /**
   * The walk back, in the two halves this suite can actually hold.
   *
   * One is the wiring: the return to the foreground is heard, it goes through
   * the same reader focus does, and the reader writes the two values the rows
   * are computed from. The other is the rule: what those values produce once
   * the permission has been allowed.
   *
   * Neither of them opens iOS Settings. P7-1, P7-2 and P7-3 in
   * `docs/DEVICE_VERIFICATION.md` are still the proof that a device gives, and
   * they are still `not run`.
   */
  test("returning from the phone's settings re-reads the permission, not only re-entering the screen", () => {
    const at = SETTINGS.indexOf('useFocusEffect(');
    const effect = SETTINGS.slice(at, SETTINGS.indexOf('const forgetDeleteDraft', at));

    // The listener, keyed on the one state change that means "the learner is
    // looking at Luvani again". `background` and `inactive` are the way out and
    // re-reading on either would ask the OS a question nobody is waiting for.
    assert.match(effect, /AppState\.addEventListener\('change'/, 'nothing in Settings listens for the app coming back');
    assert.match(effect, /next === 'active'/, 'the listener fires on leaving as well as returning');
    assert.ok(
      !/next === 'background'/.test(effect) && !/next === 'inactive'/.test(effect),
      'the screen re-reads the permissions on the way out as well, which asks the OS a question nobody is waiting for',
    );

    // One reader, reached both ways, so focus and foreground can never answer
    // differently. Two copies of this read is how they would.
    assert.match(effect, /const readPhonePermissions = \(\) => \{/, 'there is no one named reader for the two entries');
    assert.equal(
      (effect.match(/microphonePermission\(\)/g) ?? []).length,
      1,
      'the microphone is read in more than one place inside the effect, so there are two answers to one question',
    );
    assert.equal(
      (effect.match(/reminderPermission\(\)/g) ?? []).length,
      1,
      'the notification channel is read in more than one place inside the effect',
    );

    // The reader writes the two values the rows are computed from. Without
    // this, the listener could fire forever into nothing.
    assert.match(
      effect,
      /setMicrophone\(mic\);\s*setNotifications\(notify\);/,
      'the re-read does not write the two values the Phone group is drawn from',
    );
    // Still a read and never an ask, on both paths. A foreground listener that
    // raised the dialog would spend the one iOS gives on somebody who has just
    // walked back in, and the reminder switch that moved onto this screen with
    // revamp A (F576) is not on either of these paths: the whole of the ask
    // lives in `toggleReminder`, which a learner reaches by touching a switch.
    for (const ask of ['askReminderPermission(', 'requestRecordingPermissions']) {
      assert.ok(!effect.includes(ask), `the re-read calls ${ask} instead of asking what the answer already is`);
    }
    const toggle = SETTINGS.slice(SETTINGS.indexOf('const toggleReminder'), SETTINGS.indexOf('const chooseReminderTime'));
    assert.ok(toggle.length > 0, 'the reminder switch moved or was renamed; this half of the test is reading nothing');
    assert.match(
      toggle,
      /askReminderPermission\(\)/,
      'the one dialog this screen may raise is no longer the reminder switch, so the ask has moved somewhere nobody tapped',
    );
  });

  test('a permission row disappears once the permission it names is granted', () => {
    // The walk, in the only form this suite can run it: what the screen held
    // when the learner left, and what the re-read hands back when they return.
    assert.deepEqual(keysFor('denied', 'denied'), ['microphone', 'notifications'], 'a refused permission draws no row to repair');
    assert.deepEqual(keysFor('granted', 'denied'), ['notifications'], 'allowing the microphone left its row on the screen');
    assert.deepEqual(keysFor('denied', 'granted'), ['microphone'], 'allowing notifications left its row on the screen');
    assert.deepEqual(keysFor('granted', 'granted'), [], 'the Phone group survives both permissions being allowed');

    // And the screen really draws the group from that answer, rather than
    // deciding for itself. The truth table above is worth nothing if the value
    // the walk back writes is read by something else.
    assert.match(
      SETTINGS,
      /const phone = phoneRows\(\{ microphone, notifications, available: PHONE_SETTINGS_AVAILABLE \}\);/,
      'the screen decides which phone rows to draw itself, so the re-read reaches nothing',
    );
    // The group has two reasons to exist since the daily reminder moved into it
    // (F576), and exactly two: a reminder this build can actually schedule, or a
    // permission the OS has refused. Both absent and the whole group is absent,
    // which is what an allowed microphone on a phone with no reminder set gets.
    assert.match(
      SETTINGS,
      /\{\(reminders \|\| phone\.length > 0\) && \(/,
      'the Phone group is drawn whether or not there is a row in it, or it is drawn on some third condition',
    );
    // And the permission rows themselves come from the module's answer and
    // nowhere else, so a granted permission has no other way onto the screen.
    assert.equal(
      (SETTINGS.match(/phone\.map\(/g) ?? []).length,
      1,
      'the phone rows are drawn from somewhere other than the list the module returned',
    );
    for (const spelled of ['MICROPHONE_ROW', 'NOTIFICATIONS_ROW']) {
      assert.ok(
        !SETTINGS.includes(spelled),
        `Settings draws ${spelled} directly, so a row can appear on a permission phoneRows never returned`,
      );
    }
  });

  test('the phone rows say nothing that counts and nothing that scolds', () => {
    assert.ok(PHONE_COPY.length >= 4, 'the copy list is too short to be the whole group');
    for (const line of [MICROPHONE_ROW, MICROPHONE_SUB, NOTIFICATIONS_ROW, NOTIFICATIONS_SUB]) {
      assert.ok(PHONE_COPY.includes(line), `left out of the scanned list: ${line}`);
    }
    for (const line of PHONE_COPY) {
      assert.ok(line.trim().length > 0, 'a blank line reached the group');
      assert.equal(guiltIn(line), undefined, `guilt in phone copy: ${line}`);
      assert.doesNotMatch(line, /—/, `em dash in phone copy: ${line}`);
      assert.doesNotMatch(line, /\d/, `a digit in phone copy: ${line}`);
      // Nothing about how often anybody practises, and nothing about what
      // happens without a reminder. The row says what is in the way and stops.
      assert.doesNotMatch(line, /\bday(s)?\b|\bweek\b|\bpractis|\bremember\b/i, `the row talks about the learner's habits: ${line}`);
    }
  });
});
