/**
 * The two things a reminder needs from the build, neither of which any other
 * suite can see.
 *
 * `schedule.native.ts` is proven by `schedule.test.ts` to hold the right calls
 * in the right shape. That proof is about a module. It says nothing about
 * whether the module has a native library underneath it when it runs, and
 * nothing about where on an Android phone the result appears — and both of
 * those are decided in `app.json` and in one runtime call, not in the module's
 * logic.
 *
 * ## The first thing: the plugin is registered
 *
 * `expo-notifications` in `package.json` installs the JavaScript. The config
 * plugin is what makes prebuild write the library's Android manifest entries
 * and the iOS notification setup into a binary. Without the plugin entry the
 * app typechecks, bundles, and passes every suite in this repo, and then
 * `scheduleNotificationAsync` throws on a device. There is no compiler error
 * and no failing test between here and that crash, which is exactly why the
 * entry is asserted by name.
 *
 * The two props deliberately left alone are asserted too, because both are the
 * kind of thing a future edit adds while trying to be helpful:
 *
 * `enableBackgroundRemoteNotifications` writes `UIBackgroundModes:
 * remote-notification` into Info.plist. Luvani registers for no push service
 * and runs no push server, so an App Store reviewer asking what the background
 * mode is for would get an answer nobody in this repo could give honestly.
 *
 * `defaultChannel` looks like the answer to the second half of this test and is
 * not. The plugin writes it to `com.google.firebase.messaging
 * .default_notification_channel_id`, which is FCM's remote-push default and is
 * never consulted for a locally scheduled notification. Setting it would make
 * the Android channel look configured while the reminder still landed
 * somewhere else, which is worse than leaving it unset.
 *
 * ## The second thing: the reminder lands on a channel with a name
 *
 * On Android every notification belongs to a channel, and the channel is what
 * the learner sees in Settings and what they turn off when they have had
 * enough. expo-notifications' `BaseNotificationBuilder` reads the channel off
 * the trigger; when the trigger names none, or names one that was never
 * created, it falls back to an auto-created channel whose name comes from an
 * Android string resource. The reminder still arrives, under a generic name in
 * a list of one.
 *
 * Both ends are asserted because either alone is silently useless: a channel
 * created and not named in the trigger is a channel nothing routes to, and a
 * `channelId` in the trigger with no matching channel falls back exactly as if
 * it were absent.
 *
 * ## What these tests prove, and what they cannot
 *
 * They prove that `app.json` registers the config plugin, that the two props
 * above are not set, that `android.permissions` asks for POST_NOTIFICATIONS,
 * and that `schedule.native.ts` creates one channel under a readable name and
 * hands that same channel id to the daily trigger.
 *
 * They cannot prove that a notification arrives on a phone. Nothing here runs
 * prebuild, opens an Android manifest, or talks to an OS: `ios/` and
 * `android/` are generated and gitignored, so the manifest this config
 * produces does not exist in the repo to be read. Whether the channel name
 * reads well in Settings, whether the permission dialog appears, and whether
 * the notification is presented at the hour are all device evidence and none
 * of it is claimed here. Local scheduled notifications have not worked in Expo
 * Go on Android since SDK 53, so even a manual check needs a dev build. A
 * green tick here means the build is configured to have a chance, and no
 * document may read it as "the reminder fires".
 *
 * Written as a source-and-config walk, in the mould of
 * `token-server/src/ciContract.test.ts`, for the reason its header gives: the
 * thing being defended is a file, so a file is what gets read.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const APP_JSON = join(HERE, '..', '..', 'app.json');

/** The package whose config plugin has to be registered for any of this to run. */
const PLUGIN = 'expo-notifications';

/** Android 13 and later refuse to show anything without this granted. */
const POST_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';

interface AppConfig {
  expo: {
    android?: { permissions?: string[] };
    plugins?: (string | [string] | [string, Record<string, unknown>])[];
  };
}

const config = JSON.parse(readFileSync(APP_JSON, 'utf8')) as AppConfig;

/** Comments may cite anything; only what the module runs is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const NATIVE = stripComments(readFileSync(join(HERE, 'schedule.native.ts'), 'utf8'));

/**
 * How a plugin is registered, in three answers rather than two.
 *
 * `undefined` is not registered. `null` is registered bare, which is every prop
 * at its default and is what this app wants. An object is registered with
 * props, and then the props have to be read. Collapsing the last two into
 * "truthy" is how a prop that was deliberately left at its default gets set by
 * someone who could not tell the difference.
 */
function pluginProps(name: string): Record<string, unknown> | null | undefined {
  for (const entry of config.expo.plugins ?? []) {
    if (entry === name) return null;
    if (Array.isArray(entry) && entry[0] === name) return (entry[1] as Record<string, unknown>) ?? null;
  }
  return undefined;
}

/**
 * The braced literal that follows `marker`, counted rather than matched.
 *
 * A regex for `{...}` ends at the first `}`, which for an object with a nested
 * one is the wrong place and quietly returns half a literal to assert against.
 */
function bracedAfter(source: string, marker: string, what: string): string {
  const at = source.indexOf(marker);
  assert.notEqual(at, -1, `${what}: \`${marker}\` is not in the module at all`);
  const open = source.indexOf('{', at);
  assert.notEqual(open, -1, `${what}: \`${marker}\` is followed by no object literal`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`${what}: the literal after \`${marker}\` is never closed`);
}

/** The value of a single-quoted string constant, or undefined if it is not one. */
function stringConst(source: string, name: string): string | undefined {
  const found = source.match(new RegExp(`\\b${name}\\s*(?::[^=\\n]+)?=\\s*'([^']*)'`));
  return found?.[1];
}

/** The body of a declared function, brace-counted for the reason above. */
function functionBody(source: string, name: string, what: string): string {
  return bracedAfter(source, `function ${name}`, what);
}

describe('what the reminder needs from the build rather than from its own logic', () => {
  test('the build registers the notification plugin and names the channel a reminder lands on', () => {
    // --- the build half -------------------------------------------------
    const props = pluginProps(PLUGIN);
    assert.notEqual(
      props,
      undefined,
      `app.json does not register the ${PLUGIN} config plugin. The dependency is installed, so ` +
        'everything here compiles and every suite passes; prebuild then produces a binary in which ' +
        'scheduling a notification throws. Nothing between this line and a device says so.',
    );

    if (props !== null) {
      const configured = props as Record<string, unknown>;
      assert.notEqual(
        configured.enableBackgroundRemoteNotifications,
        true,
        'the plugin enables background remote notifications, which writes UIBackgroundModes: ' +
          'remote-notification into Info.plist. Luvani registers for no push service, so the App ' +
          'Store review question that flag invites has no honest answer.',
      );
      assert.equal(
        'defaultChannel' in configured,
        false,
        'the plugin sets defaultChannel. That prop is written to the FCM default-channel metadata ' +
          'and is only ever read for a remote push; a locally scheduled notification ignores it. ' +
          'The channel a reminder lands on is set on the trigger, which is asserted below.',
      );
    }

    const permissions = config.expo.android?.permissions ?? [];
    assert.ok(
      permissions.includes(POST_NOTIFICATIONS),
      `app.json does not ask for ${POST_NOTIFICATIONS}. Android 13 and later show nothing without ` +
        'it, and inheriting it from the library manifest leaves the app asking for a permission ' +
        'that is written down nowhere we own.',
    );
    assert.ok(
      permissions.includes('android.permission.RECORD_AUDIO'),
      'the microphone permission has gone from app.json. It is the one the whole product needs, ' +
        'and this list is short enough to lose a line from by accident.',
    );

    // --- the channel half -----------------------------------------------
    const created = NATIVE.match(/setNotificationChannelAsync\(/g) ?? [];
    assert.equal(
      created.length,
      1,
      `the native module creates ${created.length} notification channels, so which one the ` +
        'reminder lands on is a guess. One reminder, one channel.',
    );

    const channelId = stringConst(NATIVE, 'REMINDER_CHANNEL_ID');
    const channelName = stringConst(NATIVE, 'REMINDER_CHANNEL_NAME');
    assert.ok(
      channelId !== undefined && channelId.length > 0,
      'the native module declares no REMINDER_CHANNEL_ID string, so the channel it creates and the ' +
        'channel the trigger asks for cannot be checked against each other',
    );
    assert.ok(
      channelName !== undefined && channelName.length > 0,
      'the native module declares no REMINDER_CHANNEL_NAME string. A channel created without a name ' +
        'is the thing this test exists to prevent.',
    );

    assert.match(
      NATIVE,
      /setNotificationChannelAsync\(\s*REMINDER_CHANNEL_ID\s*,/,
      'the channel is created under something other than REMINDER_CHANNEL_ID, so the constant the ' +
        'trigger uses is not the channel that exists',
    );

    const channel = bracedAfter(NATIVE, 'setNotificationChannelAsync(', 'the channel');
    assert.match(
      channel,
      /\bname:\s*REMINDER_CHANNEL_NAME\b/,
      `the channel is created without a name: ${channel}. Android will accept it and show the ` +
        'learner whatever the platform picked, in the one place they would go to turn it off.',
    );

    // The name is what a person reads in Settings, so it has to be words. An
    // identifier reused as a name passes every mechanical check and reads like
    // a leak in the UI.
    const name = channelName as string;
    assert.notEqual(name, channelId, 'the channel name is the channel id, which is an identifier in a settings screen');
    assert.doesNotMatch(name, /[_.-]/, `the channel name "${name}" is punctuated like an identifier rather than written like words`);
    assert.match(name, /^[A-Z]/, `the channel name "${name}" does not start as a sentence does`);
    assert.equal(guiltIn(name), undefined, `guilt in the channel name: ${name}`);

    // Both ends, because either alone does nothing at all. A channel created
    // and never named on the trigger is a channel nothing routes to, and the
    // builder falls back exactly as if it had not been created.
    const begin = NATIVE.indexOf('const triggers =');
    assert.ok(begin >= 0, 'native reminders have no trigger builder');
    const trigger = NATIVE.slice(begin, NATIVE.indexOf('for (const trigger', begin));
    assert.match(NATIVE, /scheduleNotificationAsync\(\{ content: reminderContent\(\), trigger \}\)/);
    assert.match(
      trigger,
      /\bchannelId:\s*REMINDER_CHANNEL_ID\b/,
      `the daily trigger names no channel: ${trigger}. expo-notifications then puts the reminder on ` +
        'an auto-created fallback channel, under a name that came from an Android string resource.',
    );

    // Naming a channel is a courtesy. Losing the reminder because the courtesy
    // failed is not a trade anybody would make, so the call cannot be allowed
    // to take the schedule down with it.
    const ensure = functionBody(NATIVE, 'ensureReminderChannel', 'the channel helper');
    assert.match(
      ensure,
      /\bcatch\b/,
      'the channel call can throw out of the helper, which would fail a schedule the OS would have ' +
        'accepted. A reminder on a badly named channel beats no reminder.',
    );
  });

  test('the plugin reader tells a bare entry from a configured one, and the source readers bite', () => {
    // A reader that answers the same thing for every input passes forever. Each
    // shape the assertions above rely on is run through it once.
    assert.equal(pluginProps('expo-font'), null, 'a bare string entry is not read as registered-with-defaults');
    assert.equal(pluginProps('a-package-nobody-installed'), undefined, 'an absent plugin is not read as absent');

    assert.equal(stringConst("const X = 'hello';", 'X'), 'hello');
    assert.equal(stringConst("const X: string = 'hello';", 'X'), 'hello', 'an annotated constant is missed');
    assert.equal(stringConst("const Y = 'hello';", 'X'), undefined, 'a constant that is not there is read as something');

    assert.equal(
      bracedAfter('call({ a: { b: 1 } });', 'call(', 'the nested case'),
      '{ a: { b: 1 } }',
      'a nested literal ends the read early, so half an object is what gets asserted against',
    );

    assert.equal(
      stripComments('/** setNotificationChannelAsync( */\nconst x = 1;\n').includes('setNotificationChannelAsync'),
      false,
      'a citation in a comment reads as a call, and a module that cannot explain itself stops explaining itself',
    );
  });
});
